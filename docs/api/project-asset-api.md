# 프로젝트 파일 자산 API

기존 백엔드 계약: `POST /api/v1/display-assets`(multipart `file`), `GET /api/v1/display-assets/{asset_id}`, `GET /api/v1/display-assets/{asset_id}/files/{member_id}`. 원본 ZIP 저장을 위한 신규 요청 계약과 구현 범위는 [백엔드 전달 문서](../integration/backend-viewer-asset-handoff.md)를 참조한다.

## 현재 프론트 상태

[projectAssetApi.js](../../src/features/portal/projects/projectAssetApi.js)는 자산이 없으면 `assetManifest: []`, 자산이 있으면 기존 원본을 `digital-twin-assets` v2 ZIP으로 묶어 **신규 제안 경로** `POST /api/v1/project-assets`에 전송한다. 성공한 불변 자산 참조를 초안 저장에 전달한다. 백엔드가 아직 경로를 구현하지 않았다면 저장 실패 원인을 명확하게 표시하고 로컬 저장을 유지한다.

`NATIVE_BUNDLE`은 `/project-assets/{asset_id}/file`에서 ZIP을 내려받아 archive/project.json SHA-256, ZIP 목록, 자산 의존성을 검증하고 설비·텍스처·커스텀 정의를 복원한다. 기존 표시 자산은 `/display-assets` 명세·파일을 조회하고 크기·해시 검증 후 연결된 설비의 glTF/GLB를 로드한다. 목업의 누락된 layout이나 모델-설비 연결을 임의 생성하지 않는다.

## 백엔드 작업

1. 전달 문서의 원본 ZIP 업로드·다운로드 API를 구현한다. OBJ/PLY를 glTF로 변환하지 않고 편집 원본을 보존한다.
2. 기존 프로젝트 저장·검증·게시·조회에서 `NATIVE_BUNDLE` 참조와 두 SHA-256 필드를 지원한다.
3. 실제 에디터의 전체 layout과 정확한 설비-자산 연결을 반환한다. 기존 glTF 표시 자산도 연결 설정이 있어야 렌더링할 수 있다.
4. 대표 이미지 data URL이 구성 JSON 제한을 넘으면 별도 자산으로 저장하고 참조 URL을 사용해야 한다. 프론트는 지금 큰 구성의 서버 저장을 차단한다.

기존 `PUT/GET /projects/{id}/assets`, `assetUploadId`, `digital-twin-assets` 서버 계약은 프론트 제안이었으며 전달된 백엔드 문서에는 없다. 로컬 프로젝트 ZIP 내보내기/가져오기는 별도 기능으로 유지한다.
