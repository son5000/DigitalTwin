# 백엔드 구현 요청: 프로젝트 원본 자산 저장·뷰어 복원

작성일: 2026-11-17 · 대상: DigitalTwin 프론트 / `https://checklab.co.kr/api/v1`

**설정 JSON 전체 항목과 각 값의 DB 저장 위치는 [에디터·뷰어 전체 JSON 저장 계약과 DB 설계](../viewer/viewer-json-database-contract.md)에 정리했다.** 해당 문서에서 공간·설비·센서·영상·ROI·카메라·사용자 자산의 필드 사전, 템플릿별 기본값, SQL, 실제 직렬화 예제를 확인할 수 있다. 2026-11-18 검토·보완.

일반 저장 시 사용자가 ZIP을 직접 만들어 업로드하는 절차는 없다. 에디터 설정은 JSON으로 저장하며, 이 문서의 ZIP은 프론트가 원본 모델·텍스처 파일을 서버로 전달할 때 사용하는 내부 전송 방식이다.

## 요청 요약

현재 프로젝트 목록·구성 조회와 표시 자산 조회는 응답한다. 하지만 목업의 `layout`은 실제 에디터 저장본이 아니며, 기존 `/display-assets`의 glTF/GLB 표시 자산만으로는 OBJ/PLY/MTL·텍스처·커스텀 편집 정의를 원형 그대로 복원할 수 없다.

**아래 원본 자산 ZIP 계약을 프론트에서 먼저 정의하고 클라이언트를 구현했다. 백엔드에서 신규 API와 프로젝트 검증 확장을 구현해 달라.** 기존 API 경로를 임의로 다른 형식으로 바꾸지 않는다. 이 문서의 신규 경로는 아직 실서버 구현이 확인되지 않은 요청 사항이다.

| 우선순위 | 요청 | 프론트 상태 | 백엔드 작업 |
| --- | --- | --- | --- |
| P0 | 정상 에디터 `layout`으로 목업 재게시 | 누락 필드 안내 구현 | 현재 축약 목업을 실제 전체 저장본으로 교체 |
| P0 | `POST /project-assets` | ZIP 생성·multipart 업로드·응답 검증 구현 | 신규 영속 저장 API 구현 |
| P0 | `GET /project-assets/{asset_id}/file` | 다운로드·SHA-256·ZIP 복원 구현 | 업로드한 ZIP 원본 바이트 제공 |
| P0 | 프로젝트 `assetManifest`의 `NATIVE_BUNDLE` 지원 | 업로드 결과를 초안 저장에 전달 | 저장·검증·게시·조회 전체 경로에서 아래 참조 형식 지원 |
| P0 | 전체 `layout`의 무손실 왕복 | 기존 version 18 사용 | 서버가 모르는 필드도 보존; UUID·revision·자산 참조를 일관되게 반환 |
| 기존 API 연동 | `GET /display-assets/{id}` 및 `/files/{member_id}` | 파일 해시 검증·설비 연결·glTF/GLB 로딩 구현 | 모델과 설비의 연결을 포함한 정상 layout 제공 |

프로젝트 생성·초안 저장·게시·조회용 API를 별도로 다시 만들 필요는 없다. 기존 `/projects`, `/projects/{id}/draft`, `/validate`, `/publish`, `?mode=editor|viewer`를 유지한다.

## 1. 실서버에서 확인한 문제

프로젝트 `67cda6e0-f19f-4b59-a0cf-7995a3d8ef1b` (`DEMO_FE_H55_V1 SYNTHETIC`)의 editor/viewer GET이 반환하는 layout:

```json
{
  "version": 18,
  "synthetic_demo": "DEMO_FE_H55_V1",
  "equipment_id": "DEMO_FE_H55_V1_EQUIPMENT",
  "enclosure_uid": "3900fb49-9ac1-501f-9cc4-84526f4ee13d"
}
```

`hierarchy.nodes`가 없고, 설비 인스턴스·배치·모델 연결도 없다. `version: 18`만 있으면 호환되는 것이 아니다. 현재 프론트에서 이 응답은 구성 검사에서 거절되며, 검사 없이 트리를 만들더라도 설비 0개가 된다. 서버 `validation.valid: true`, `validationScope: FIXED_DISPLAY_ONLY`는 프론트 구성 완전성까지 검증한 결과로 취급할 수 없다.

표시 자산 `528158c6-522b-4267-931b-e857f2e47130`의 명세와 model(508 bytes), front(76 bytes)는 실제 GET 및 SHA-256 검증에 성공했다. 즉, 파일 조회 기능 자체가 없는 상황은 아니다. 목업의 모델은 삼각형 1개짜리 합성 glTF이며 실제 설비 모델과는 구분해야 한다.

### 정상 layout 공급 원칙

- 프론트 `serializeLayout()`이 만드는 version 18 JSON을 그대로 저장하고 반환한다. 파일 위치: `src/features/digitalTwin/editor/api/layoutRepository.js`.
- `hierarchy.nodes`, `observationWorkflow`, `equipmentByFloorId`/`roomScenes`, `equipmentAssetBindings`, `viewerPreset`, 배치·좌표·정합·센서·관측점 등을 임의로 축약하거나 snake_case로 변환하지 않는다.
- 표시 범위는 `layout.observationWorkflow.scopeType`, 모델 연결은 `layout.equipmentAssetBindings`에 저장한다. 프로젝트 최상위 `scope`나 `equipment_id`만으로 대신할 수 없다.
- 아래 예시는 **자산 연결 필드만 발췌**한 것이며 완전한 에디터 layout이 아니다. 실사용 목업은 실제 에디터 저장본을 사용한다.

```json
{
  "equipmentAssetBindings": [
    {
      "id": "binding-1",
      "equipmentId": "equipment-1",
      "assetId": "frontend-model-1",
      "backendAsset": {
        "asset_id": "528158c6-522b-4267-931b-e857f2e47130",
        "manifest_sha256": "565387d69798c254555b73b043b2f8f985904b6ee5f86c98a5344af229c42420"
      },
      "assetType": "GLTF",
      "sourceType": "UPLOAD",
      "displayMode": "ACTUAL",
      "alignmentTransform": {
        "unit": "M",
        "position": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 }
      }
    }
  ]
}
```

`equipmentId`는 layout의 실제 설비 ID와 같아야 한다. `backendAsset` 없이 binding의 `assetId`를 서버 표시 자산 ID와 같게 보내는 형식도 지원한다. 별도 프론트 ID를 쓰면 위 `backendAsset` 매핑을 포함한다. 정합 설정의 나머지 필드는 실제 에디터 저장본을 유지한다.

## 2. 신규 POST /api/v1/project-assets

용도: 프론트 원본 파일과 편집 정의를 변환 없이 불변 자산으로 보관한다. glTF 표시 모델 변환 API와 역할을 분리한다.

### 요청

`Content-Type: multipart/form-data; boundary=...` (브라우저가 boundary를 설정)

| 필드 | 종류 | 값 |
| --- | --- | --- |
| `file` | 바이너리 | `project-assets.zip`, `application/zip` |
| `metadata` | JSON 문자열 | 아래 구조 |

```json
{
  "externalProjectId": "프론트-프로젝트-ID",
  "format": "digital-twin-assets",
  "version": 2,
  "archive_sha256": "업로드 ZIP 전체 바이트의 소문자 SHA-256 64자리",
  "clientRequestId": "요청 UUID"
}
```

- 원본 자산 업로드는 `POST /projects`보다 먼저 호출될 수 있다. `externalProjectId`를 서버 UUID로 가정하지 않는다.
- 동일 `clientRequestId`와 동일 본문은 같은 결과를 반환한다. 같은 키의 다른 본문은 409.
- 같은 archive 해시의 업로드는 소유권 범위 안에서 중복 저장을 줄일 수 있다. 소유권 확인 없이 다른 사용자의 자산을 재사용하지 않는다.
- 프론트 상한: ZIP 512MiB. 서버도 이 한도를 지원하거나 실제 한도와 오류 코드를 확정해 달라. 업로드 클라이언트 제한 시간은 120초이다.

### 성공 응답 (201 또는 200)

```json
{
  "request_id": "요청 추적 ID",
  "data": {
    "asset": {
      "kind": "NATIVE_BUNDLE",
      "asset_id": "서버 UUID",
      "manifest_sha256": "ZIP 내부 project.json 원본 UTF-8 바이트의 SHA-256 64자리",
      "archive_sha256": "업로드 ZIP 전체 바이트의 SHA-256 64자리"
    }
  }
}
```

파일 영속 저장과 ZIP 검증이 완료된 뒤에만 성공을 반환한다. `asset_id`의 파일은 불변이며 변경은 새로운 자산 ID로 저장한다. 프론트는 반환된 archive 해시와 업로드 파일 해시를 비교한 후 초안 저장을 진행한다.

### ZIP 내용 (기존 프론트 인코더의 실제 규격)

```text
project-assets.zip
├── project.json
└── files/
    ├── 00001-model.obj
    ├── 00002-model.mtl
    └── 00003-front.png
```

`project.json` 예시 (설명용 축약, 실제 크기는 파일 바이트 수 사용):

```json
{
  "format": "digital-twin-assets",
  "version": 2,
  "projectId": "프론트-프로젝트-ID",
  "assets": {
    "equipment": [
      {
        "id": "frontend-model-1",
        "primaryFileName": "model.obj",
        "primaryFilePath": "model.obj",
        "files": [
          { "name": "model.obj", "path": "model.obj", "type": "", "size": 32,
            "blob": { "$file": "files/00001-model.obj" } }
        ]
      }
    ],
    "textures": [],
    "custom": []
  },
  "files": [
    { "path": "files/00001-model.obj", "name": "model.obj", "size": 32, "type": "" }
  ]
}
```

- `equipment`: OBJ/PLY/MTL·이미지와 연결 파일, 서버에서 복원한 GLTF/GLB를 포함한 원본 레코드. `primaryFilePath`가 가리키는 파일이 반드시 있어야 한다.
- `textures`: `{id, blob: {$file: ...}, ...메타데이터}` 형태의 별도 텍스처 원본.
- `custom`: 기존 커스텀 설비·건축물 정의(JSON). 부품·재질·식별자·revision 등 미지의 필드도 그대로 보존한다.
- 중첩 Blob은 모두 `{$file: "files/..."}`로 치환한다. data URL은 `{$file, encoding: "data-url", header, base64}`로 저장될 수 있다. 현재 serializer/decoder를 규격 근거로 사용한다: `projectBundleFiles.js`, `projectArchive.js`.
- 파일 경로는 상대경로만 허용한다. 절대경로·`..`·역슬래시·중복 경로·암호화 ZIP·ZIP bomb·목록 불일치는 거절한다. 다운로드 ZIP에는 `project.json`과 명세에 선언된 파일만 존재해야 한다.
- ZIP은 STORE 방식으로 생성한다. 다운로드 시 STORE/DEFLATE를 지원한다. 압축 해제 합계 최대 1GiB, project.json 최대 64MiB, 엔트리 최대 10,000개를 검증한다.
- `$file`의 경로·실제 크기·CRC·존재 여부와 자산 ID 중복을 검증한다. 바이너리를 서버에서 실행하거나 임의 외부 URL에서 파일을 받아오지 않는다.
- 자산의 프론트 ID를 서버 UUID로 바꾸지 않는다. layout은 프론트 자산 ID를 참조하고, API `asset_id`는 ZIP 전체를 식별한다.
- 이 ZIP에는 프로젝트 layout이나 실측 데이터·ROI 서비스 저장본이 들어가지 않는다. layout은 별도 `/draft` 요청으로 저장한다.

## 3. 신규 GET /api/v1/project-assets/{asset_id}/file

- JSON 포장이 아닌 원본 ZIP 바이트를 반환한다.
- `Content-Type: application/zip`, 정확한 `Content-Length`, `ETag`를 제공한다.
- `archive_sha256`가 일치하도록 업로드 ZIP을 재압축·수정하지 않는다.
- 인증/프로젝트 접근 권한 및 게시된 자산의 조회 정책을 적용한다. 누락 404, 권한 부족 403.
- 응답 리다이렉트는 현재 프론트에서 거절한다. 같은 API 경로에서 바이트를 제공한다. presigned URL이 필요하면 별도 계약 변경이 필요하다.
- 프론트는 전체 해시 → ZIP 목록/CRC → 자산 의존성 검증 후 IndexedDB에 복원한다. 복원 중 실패하면 이번 쓰기를 되돌리고 프로젝트 열기 성공을 표시하지 않는다.

## 4. 기존 프로젝트 API의 확장

`PUT /projects/{서버 UUID}/draft`:

```json
{
  "baseRevision": 0,
  "layout": { "version": 18, "hierarchy": { "nodes": [] } },
  "assetManifest": [
    {
      "kind": "NATIVE_BUNDLE",
      "asset_id": "서버 UUID",
      "manifest_sha256": "project.json SHA-256 64자리",
      "archive_sha256": "ZIP SHA-256 64자리"
    }
  ],
  "clientRequestId": "UUID"
}
```

위 layout은 요청 봉투 설명을 위한 축약이다. 실제로는 전체 에디터 저장본이 들어간다.

- `NATIVE_BUNDLE`은 한 프로젝트 revision당 최대 하나. 기존 표시 자산은 `kind` 생략 또는 `DISPLAY_ASSET`이며 `{asset_id, manifest_sha256}`를 유지한다.
- 자산 종류에 따라 저장소를 구분해 존재·소유권·해시·준비 상태를 검증한다. `kind`를 버리거나 모든 참조를 `/display-assets`에만 조회하면 안 된다.
- layout과 assetManifest는 같은 revision으로 원자적으로 저장한다. optimistic lock `baseRevision` 불일치는 409/412.
- `/validate`, `/publish`도 원본 자산 참조를 지원한다. geometry 분석의 지원 여부와 파일·구성 저장/표시 가능 여부를 분리한다.
- `GET ?mode=editor`는 최신 초안의 전체 layout과 manifest, `?mode=viewer`는 **게시된 동일 revision**의 layout과 manifest를 반환한다.
- 저장 실패 시 이미 업로드된 미참조 자산을 안전한 유예기간 후 정리한다. 게시본·과거 revision이 참조하는 자산을 삭제하지 않는다.

오류 형식은 기존 규칙을 유지한다:

```json
{ "request_id": "...", "error": { "code": "ASSET_HASH_MISMATCH", "message": "원본 파일의 SHA-256이 일치하지 않습니다." } }
```

권장 코드: `INVALID_ARCHIVE`, `ASSET_HASH_MISMATCH`, `ASSET_NOT_READY`, `ASSET_NOT_FOUND`, `ASSET_ACCESS_DENIED`, `LAYOUT_SCHEMA_INVALID`, `REVISION_CONFLICT`, `PAYLOAD_TOO_LARGE`.

## 5. 기존 display-assets 지원 범위

프론트는 현행 응답의 `manifest.format_version=1.0`, `model_member`, `materials[{material_index,texture_member}]`, 각 멤버의 `kind/size_bytes/sha256`을 검사한다. 실제 API 경로로 각 파일을 조회하고 해시 검증 후 glTF 2.0/GLB 모델을 복원한다. 명세에 없는 외부 파일은 불러오지 않는다.

별도 DRACO/KTX2/Meshopt 디코더는 이번에 추가하지 않았다. 해당 확장 없이 읽을 수 있는 모델과 PNG/JPEG를 제공한다. 모델의 UV·재질 번호·단위·축·정합은 원본 계약에 맞아야 하며, 프론트가 빠진 UV나 설비 배치를 만들어 내지 않는다. GLTF/GLB를 원본 ZIP에 보관해 다시 여는 것은 지원하지만, 기존 OBJ/PLY 업로드 UI의 형식 확대나 OBJ→GLB 자동 변환은 이번 범위가 아니다.

## 6. 실시간 관제는 별도 후속 계약

프로젝트를 표시하는 것과 실측 데이터가 동작하는 것은 별도 완료 기준이다. 기존 설비 매핑·함체 snapshot·WSS는 유지한다. ROI별 KPI가 필요하면 프론트 `equipmentId/sensorBindingId/roiId`와 백엔드 `enclosure_uid/slot/roi_id`의 명시적 매핑, 측정 시각·품질·구성 버전을 확정해야 한다. 현재 문서에 있는 `/slots/{slot}/rois`, `/rois/{id}`, `/equipment-mappings`를 우선 연결하며, 동일 목적의 새 경로를 중복 생성하지 않는다.

## 7. 공동 완료 기준

1. 파일 없는 에디터 프로젝트: 생성 → 초안 저장 → 게시 → 새 브라우저에서 열기.
2. OBJ+MTL+텍스처, PLY, 별도 텍스처, 커스텀 설비가 있는 프로젝트: ZIP 업로드 → manifest 포함 저장 → 게시 → 로컬 저장소가 없는 브라우저에서 같은 모델·재질·배치·편집 정의로 복원.
3. 복원한 프로젝트를 다시 편집·저장해 새 revision으로 게시하고 원본 파일이 보존되는지 확인.
4. 기존 glTF 목업: 전체 layout과 설비 binding을 공급한 뒤 모델/텍스처 표시 확인.
5. 해시 불일치·파일 누락·업로드 중단·409 revision 충돌은 성공으로 표시하지 않고 로컬 저장을 유지.
6. 실제 개발/운영 출처에서 GET·POST·PUT·OPTIONS CORS, WSS Origin, 필요한 인증 정책 확인. HTTP 200 HTML이나 로컬 모의 테스트만으로 이 항목들을 완료 처리하지 않는다.

## 검증 기록

- 실제 서버: 위 표시 자산 metadata/model/front 조회 및 크기·SHA-256 일치 확인.
- 로컬 테스트: ZIP 바이너리 왕복, multipart 요청/해시, 초안 manifest 전달, 누락 자산 거절, 복원 취소 시 되돌리기, 표시 자산 해시 불일치 거절, 목업 hierarchy 누락 진단.
- 최종 관련 테스트 39개 통과. 모의 서버를 사용한 업로드→초안 저장→빈 파일 캐시에서 복원 및 Three.js glTF 로딩/원본 노드 위치 보존을 확인했다. 실제 백엔드 신규 API의 성공을 의미하지 않는다.
- 프로덕션 빌드 성공(큰 번들 경고). 전체 테스트 실행에서는 기존 건축물 층 강조 테스트 1개가 실패했고, 수정 전 HEAD 소스를 별도로 로드해 동일 실패를 확인했다.
- 브라우저 화면 검증은 도구의 연결 호스트가 응답하지 않아 미완료. 실제 WebGL 화면·이미지 텍스처 표시와 다른 브라우저 IndexedDB 복원은 공동 검증에 포함한다.
- 신규 원본 자산 API에 대한 실서버 업로드·게시·다른 PC 복원은 백엔드 구현 후 공동 검증해야 한다.
