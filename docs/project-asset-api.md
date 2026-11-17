# 프로젝트 파일 자산 API

현재 백엔드 계약: `POST /api/v1/display-assets`(multipart `file`), `GET /api/v1/display-assets/{asset_id}`, `GET /api/v1/display-assets/{asset_id}/files/{member_id}`. 공통 응답·식별자 규칙과 전체 연동 상태는 [백엔드 API 대응표](backend-api-coverage.md)를 참조한다.

## 현재 프론트 상태

[projectAssetApi.js](../src/features/portal/projects/projectAssetApi.js)는 기존 에디터가 만든 OBJ/PLY/MTL·커스텀 에셋 ZIP을 백엔드에 전송하지 않는다. 백엔드가 승인하는 표시 자산 ZIP의 멤버는 glTF/GLB 및 JPEG/PNG이며, 기존 `digital-twin-assets` ZIP과 구조가 다르기 때문이다. 업로드 자산이 없는 프로젝트는 `assetManifest: []`로 저장한다. 업로드 자산이 있으면 원격 저장·뷰어 열기를 명시적으로 중단하고 로컬 ZIP 보관을 안내한다. 자산을 잃은 상태로 게시 성공을 표시하지 않는다.

## 연결하려면

1. 프론트의 모델 원본 형식(OBJ/PLY/MTL), 텍스처, 커스텀 에셋을 백엔드가 승인하는 표시 자산 형식으로 변환하거나 백엔드가 기존 형식을 지원해야 한다. 현재 자동 변환은 없다.
2. `POST /display-assets`가 돌려주는 불변 `asset_id`와 해시를 프론트의 자산 ID에 연결하고, `PUT /projects/{id}/draft`의 `assetManifest`에 넣는다. 프론트 자산 ID를 서버 UUID로 임의 변경하지 않는다.
3. 편집/뷰어의 프로젝트 GET이 돌려준 `assetManifest`를 따라 각 `GET /display-assets/{asset_id}`와 멤버 URL을 조회한 뒤 렌더링한다. 현재 Three.js의 OBJ/PLY 복원 경로와 glTF/GLB 로더 연결도 필요하다.
4. 대표 이미지 data URL이 구성 JSON 제한을 넘으면 별도 자산으로 저장하고 참조 URL을 사용해야 한다. 프론트는 지금 큰 구성의 서버 저장을 차단한다.

기존 `PUT/GET /projects/{id}/assets`, `assetUploadId`, `digital-twin-assets` 서버 계약은 프론트 제안이었으며 전달된 백엔드 문서에는 없다. 로컬 프로젝트 ZIP 내보내기/가져오기는 별도 기능으로 유지한다.
