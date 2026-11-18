-- PostgreSQL 구성 저장 스키마 제안. 운영 DB에 적용된 마이그레이션이 아니다.
-- 기준 문서: ../viewer-json-database-contract.md
-- layout 버전 18, 소스 기준 2026-11-17. 한글 설명 정리 2026-11-18.
-- JSON 내부의 프론트 식별자는 text로 보존한다. 서버가 발급하는 식별자만 UUID다.
-- 해시 계산, 권한, 리비전/자산의 불변성, 중복 배열의 일치 여부,
-- JSON 내부 참조 검증과 낙관적 동시성 제어는 서비스 계층에서 처리한다.
-- 원본 layout_json이 복원의 기준이며, 검색용 테이블은 선택적 복제다.
-- 일반 에디터 저장은 구성 JSON 저장이다. 바이너리는 자산 저장 흐름으로 연결한다.
BEGIN;
CREATE SCHEMA digital_twin_config;
SET LOCAL search_path TO digital_twin_config, public;

-- dt_project: 프로젝트 식별자·이름·범위와 최신 초안/발행 리비전 포인터를 보관한다.
CREATE TABLE dt_project (
  project_id uuid PRIMARY KEY,
  external_project_id text NOT NULL UNIQUE,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('SITE','BUILDING','SINGLE_EQUIPMENT','MULTI_EQUIPMENT','CUSTOM')),
  draft_revision bigint,
  published_revision bigint,
  thumbnail_url text,
  backend_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (draft_revision IS NULL OR draft_revision > 0),
  CHECK (published_revision IS NULL OR published_revision > 0)
);
-- dt_project_revision: 리비전별 전체 구성 JSON, 수신 원문·해시, 자산 manifest와 검증 결과를 보존한다.
CREATE TABLE dt_project_revision (
  project_id uuid NOT NULL REFERENCES dt_project(project_id),
  revision bigint NOT NULL CHECK (revision > 0),
  layout_version integer NOT NULL CHECK (layout_version = 18),
  layout_source_utf8 text NOT NULL,
  layout_json jsonb NOT NULL,
  layout_sha256 text NOT NULL CHECK (layout_sha256 ~ '^[0-9a-f]{64}$'),
  asset_manifest_json jsonb NOT NULL,
  editor_status text,
  validation_json jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, revision),
  CHECK (octet_length(convert_to(layout_source_utf8, 'UTF8')) <= 1048576),
  CHECK ((jsonb_typeof(layout_json) = 'object') IS TRUE),
  CHECK ((layout_json -> 'version' = to_jsonb(layout_version)) IS TRUE),
  CHECK ((jsonb_typeof(layout_json #> '{hierarchy,nodes}') = 'array') IS TRUE),
  CHECK (layout_source_utf8::jsonb = layout_json),
  CHECK ((jsonb_typeof(asset_manifest_json) = 'array') IS TRUE)
);
ALTER TABLE dt_project ADD CONSTRAINT dt_project_draft_fk
  FOREIGN KEY (project_id, draft_revision) REFERENCES dt_project_revision(project_id, revision)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE dt_project ADD CONSTRAINT dt_project_published_fk
  FOREIGN KEY (project_id, published_revision) REFERENCES dt_project_revision(project_id, revision)
  DEFERRABLE INITIALLY DEFERRED;

-- dt_asset: 서버 자산의 종류·해시·저장소 키·크기·업로드 상태를 관리한다.
CREATE TABLE dt_asset (
  asset_id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('DISPLAY_ASSET','NATIVE_BUNDLE')),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  archive_sha256 text CHECK (archive_sha256 ~ '^[0-9a-f]{64}$'),
  object_key text,
  archive_manifest_json jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  status text NOT NULL CHECK (status IN ('UPLOADING','READY','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'NATIVE_BUNDLE' OR (archive_sha256 IS NOT NULL AND object_key IS NOT NULL))
);
-- dt_asset_version: 자산에 포함된 프론트 파일/사용자 정의 객체의 원본 정의 JSON을 보존한다.
CREATE TABLE dt_asset_version (
  asset_id uuid NOT NULL REFERENCES dt_asset(asset_id),
  record_kind text NOT NULL CHECK (record_kind IN ('equipment','textures','custom')),
  frontend_asset_id text NOT NULL,
  name text,
  definition_json jsonb NOT NULL CHECK ((jsonb_typeof(definition_json) = 'object') IS TRUE),
  PRIMARY KEY (asset_id, record_kind, frontend_asset_id)
);
-- dt_asset_file: 자산 내부 파일별 상대 경로·저장소 키·크기·해시를 보존한다.
CREATE TABLE dt_asset_file (
  asset_id uuid NOT NULL REFERENCES dt_asset(asset_id),
  member_path text NOT NULL,
  object_key text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (asset_id, member_path)
);
-- dt_revision_asset: 프로젝트 리비전과 자산을 연결하고 manifest 항목의 순서와 원본 참조를 보존한다.
CREATE TABLE dt_revision_asset (
  project_id uuid NOT NULL,
  revision bigint NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  asset_id uuid NOT NULL REFERENCES dt_asset(asset_id),
  reference_json jsonb NOT NULL CHECK ((jsonb_typeof(reference_json) = 'object') IS TRUE),
  PRIMARY KEY (project_id, revision, ordinal),
  FOREIGN KEY (project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
CREATE INDEX dt_revision_asset_lookup ON dt_revision_asset(asset_id);
-- dt_api_request: 동일 사용자 범위·작업·요청 ID의 재처리 방지를 위한 요청 해시와 응답을 보관한다.
CREATE TABLE dt_api_request (
  actor_scope text NOT NULL,
  operation text NOT NULL,
  request_id text NOT NULL,
  target_key text NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_scope, operation, request_id)
);

-- 선택적 검색용 복제: 이 테이블만으로 원본 layout을 재조립하지 않는다.
-- source_path는 layout 안의 원본 객체를 가리키는 RFC 6901 JSON Pointer다.
-- dt_scene_settings: 공간 계층·작업 흐름·부지 환경·격자 설정의 검색용 복제다.
CREATE TABLE dt_scene_settings (
  project_id uuid NOT NULL, revision bigint NOT NULL,
  hierarchy_json jsonb, workflow_json jsonb, environment_json jsonb, grid_json jsonb,
  PRIMARY KEY(project_id, revision),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_scene_node: 계층 노드·부지 오브젝트·부지 경로를 원본 경로와 순서로 식별하는 검색용 복제다.
CREATE TABLE dt_scene_node (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('HIERARCHY','SITE_OBJECT','SITE_PATH')),
  node_id text, parent_id text, node_type text, ordinal integer NOT NULL CHECK(ordinal >= 0),
  node_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
CREATE INDEX dt_scene_node_id ON dt_scene_node(project_id, revision, node_id);
-- dt_room_scene: 방 ID별 장면 구성의 검색용 복제다.
CREATE TABLE dt_room_scene (
  project_id uuid NOT NULL, revision bigint NOT NULL, room_id text NOT NULL,
  scene_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, room_id),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_floor_plan: 층 ID별 평면도 구성의 검색용 복제다.
CREATE TABLE dt_floor_plan (
  project_id uuid NOT NULL, revision bigint NOT NULL, floor_id text NOT NULL,
  plan_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, floor_id),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_vertical_structure: 건물 ID별 수직 구조물 배열의 검색용 복제다.
CREATE TABLE dt_vertical_structure (
  project_id uuid NOT NULL, revision bigint NOT NULL, building_id text NOT NULL,
  structures_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, building_id),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_structure: 원본 경로별 개별 구조물과 소유 대상·순서의 검색용 복제다.
CREATE TABLE dt_structure (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  structure_id text, owner_id text, ordinal integer NOT NULL CHECK(ordinal >= 0),
  structure_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_equipment_instance: 설비 배치 인스턴스를 소유 공간·원본 경로·순서와 함께 보관하는 검색용 복제다.
CREATE TABLE dt_equipment_instance (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  equipment_id text, owner_id text, owner_kind text,
  ordinal integer NOT NULL CHECK(ordinal >= 0), instance_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
CREATE INDEX dt_equipment_id ON dt_equipment_instance(project_id, revision, equipment_id);
-- dt_viewer_settings: 프로젝트 리비전별 뷰어 표시·조명·시점 설정의 검색용 복제다.
CREATE TABLE dt_viewer_settings (
  project_id uuid NOT NULL, revision bigint NOT NULL, preset_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_camera_preset: 원본 경로별 카메라 프리셋과 소유 설비·순서의 검색용 복제다.
CREATE TABLE dt_camera_preset (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  equipment_id text, camera_id text, ordinal integer NOT NULL CHECK(ordinal >= 0), camera_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_object_visual: 설비와 표시 자산의 연결 및 표시 설정의 검색용 복제다.
CREATE TABLE dt_object_visual (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  binding_id text, equipment_id text, frontend_asset_id text,
  ordinal integer NOT NULL CHECK(ordinal >= 0), binding_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_sensor_visual: 센서 설치·표시·투영 설정과 서버 센서 연결의 검색용 복제다.
CREATE TABLE dt_sensor_visual (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  binding_id text, server_sensor_id text,
  ordinal integer NOT NULL CHECK(ordinal >= 0), binding_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
CREATE INDEX dt_sensor_server_id ON dt_sensor_visual(project_id, revision, server_sensor_id);
-- dt_spatial_roi: 관측 영역의 형상·측정·분석 설정과 소유 설비의 검색용 복제다.
CREATE TABLE dt_spatial_roi (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  roi_id text, equipment_id text,
  ordinal integer NOT NULL CHECK(ordinal >= 0), roi_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);
-- dt_server_binding: 서버 통신·측정값 바인딩과 소유 설비의 검색용 복제다.
CREATE TABLE dt_server_binding (
  project_id uuid NOT NULL, revision bigint NOT NULL, source_path text NOT NULL,
  binding_id text, equipment_id text,
  ordinal integer NOT NULL CHECK(ordinal >= 0), binding_json jsonb NOT NULL,
  PRIMARY KEY(project_id, revision, source_path),
  FOREIGN KEY(project_id, revision) REFERENCES dt_project_revision(project_id, revision)
);

-- 별도 서비스/상태: 현재 PUT /draft 요청에 자동으로 포함되는 필드가 아니다.
-- dt_calibration: 별도 보정 API의 바인딩별 요청 본문과 결과를 리비전별로 저장하는 제안이다.
CREATE TABLE dt_calibration (
  project_id uuid NOT NULL REFERENCES dt_project(project_id),
  binding_id text NOT NULL, revision bigint NOT NULL CHECK(revision > 0),
  payload_json jsonb NOT NULL, result_json jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, binding_id, revision)
);
-- dt_image_processing: 별도 영상 처리 API의 바인딩별 요청 본문을 리비전별로 저장하는 제안이다.
CREATE TABLE dt_image_processing (
  project_id uuid NOT NULL REFERENCES dt_project(project_id),
  binding_id text NOT NULL, revision bigint NOT NULL CHECK(revision > 0),
  payload_json jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, binding_id, revision)
);
-- dt_roi_record: layout 밖에서 별도로 관리하는 ROI 원본과 현재 리비전을 저장하는 제안이다.
CREATE TABLE dt_roi_record (
  project_id uuid NOT NULL REFERENCES dt_project(project_id),
  roi_id text NOT NULL, revision bigint NOT NULL CHECK(revision >= 0),
  roi_json jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, roi_id)
);
-- dt_user_state: 현재 브라우저에 저장하는 사용자별 운영 데이터를 서버에 보관하기 위한 별도 제안이다.
CREATE TABLE dt_user_state (
  project_id uuid NOT NULL REFERENCES dt_project(project_id),
  user_key text NOT NULL, revision bigint NOT NULL CHECK(revision >= 0),
  operations_json jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, user_key)
);
COMMENT ON COLUMN dt_project_revision.layout_json IS '복원의 기준이 되는 전체 layout 원본. 모든 중첩 키와 알 수 없는 키, null, false, 0, 배열 순서를 보존한다.';
COMMENT ON COLUMN dt_project_revision.layout_source_utf8 IS '수신한 layout 직렬화 문자열을 그대로 보존한다. 바이트 해시 검증 시 JSONB에서 다시 직렬화한 문자열을 사용하지 않는다.';
COMMENT ON TABLE dt_user_state IS '현재 브라우저 로컬 운영 데이터의 별도 서버 저장소 제안. 공용 데이터와 개인 설정의 공유 범위에는 별도 API 정책이 필요하다.';
COMMIT;
