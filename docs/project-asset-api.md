# 프로젝트 파일 자산 API

프론트 함수: [projectAssetApi.js](../src/features/portal/projects/projectAssetApi.js)의 `uploadProjectAssets`, `loadViewerProjectAssets`. 기존 [ZIP 인코더](../src/features/portal/projects/projectBundleFiles.js)와 로컬 자산 저장소를 재사용한다. 백엔드와 DB는 이 계약에 맞춰 별도로 구현한다.

## 저장: `PUT /projects/{projectId}/assets`

에디터 저장 시 업로드 모델·텍스처·커스텀 에셋이 있을 때만 호출한다. `Content-Type: application/zip`이며 본문은 `digital-twin-assets` 형식 ZIP이다. `project.json`에는 `format`, `version: 2`, `projectId`, `assets.equipment[]`, `assets.textures[]`, `assets.custom[]`, `files[]`가 들어간다. Blob과 data URL은 `files/`의 파일로 분리되고 `project.json`에는 `$file` 참조가 들어간다. 기존 자산 ID는 변경하지 않는다. 업로드 제한 시간은 10분, ZIP 크기 제한은 기존 인코더 기준 1GB다.

서버 응답 예시:

```json
{"projectId":"8d5df511-b7cd-441e-b56d-919e793c552e","assetUploadId":"0bf90776-1939-4b8f-a1eb-44f9e6948d8c"}
```

`assetUploadId`는 이번 업로드 묶음의 불변 ID다. 이어지는 [구성 저장 PUT](project-configuration-api.md)이 이 ID를 넘기면 서버는 참조된 모든 자산을 검사하고 해당 revision에 고정한다. 구성 PUT이 실패하면 업로드 묶음은 미공개 상태로 두고 만료·정리할 수 있다. 서버는 로그인 사용자와 프로젝트 권한을 검사하고 파일 종류·크기·ZIP 경로를 검증해야 한다.

## 조회: `GET /projects/{projectId}/assets?revision={revision}`

[뷰어 구성 GET](project-viewer-api.md)이 반환한 **공개 revision**을 그대로 사용한다. 응답은 그 revision에 고정된 동일 형식 ZIP (`Content-Type: application/zip`, `X-Project-Revision: {revision}`)이며 자산이 없으면 `204 No Content`다. 프론트는 버전·프로젝트 ID·형식·파일 참조·필수 자산 ID를 검사하고 기존 IndexedDB 저장소에 복원한 뒤 화면을 연다. 공개 revision과 다른 최신 업로드를 반환하면 안 된다. 접근 권한이 없으면 403, 공개 revision이 없으면 404다.

API가 다른 출처에 있다면 CORS에서 `X-Project-Revision`을 노출하고, 실제 쿠키 인증을 사용할 때는 프론트의 자격 증명 정책도 같은 출처 배포 방식에 맞춰 조정해야 한다.

## 권장 DB 연결

| 값 | 의미 | 권장 위치 |
| --- | --- | --- |
| `projectId` | 자산 소유 프로젝트 | `dt_project.project_id` 및 업로드 레코드의 `project_id` |
| `assetUploadId` | 구성 revision에 결합할 업로드 묶음 | `dt_project_revision.asset_upload_id` → 업로드 레코드 PK |
| `assets.*[].id` | 기존 프론트 모델·텍스처·커스텀 에셋 참조 ID | `dt_asset.asset_id`; 종류·메타데이터는 `asset_kind/metadata_json` |
| `files[]` | 모델·재질·텍스처 원본 파일과 MIME·크기 | `dt_asset_file.storage_key/mime_type/size_bytes`; 파일 본문은 객체 저장소 |
| `revision` | 조회할 공개 스냅샷 번호 | `dt_project_revision.revision_no` → `asset_upload_id` |

대표 이미지 data URL도 구성 JSON에 남을 수 있다. 백엔드는 이를 이미지 자산으로 저장하고 목록의 `thumbnailUrl`에 접근 가능한 URL을 반환한다. 외부 URL과 실시간 센서 데이터는 이 ZIP에 포함되지 않는다.
