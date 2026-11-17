# 프로젝트 생성·저장·게시 API

현재 백엔드 계약의 기본 주소는 `/api/v1`이다. 프론트 구현: [projectConfigurationApi.js](../src/features/portal/projects/projectConfigurationApi.js), 호출 화면: [DigitalTwinEditorPage.jsx](../src/features/digitalTwin/editor/DigitalTwinEditorPage.jsx). 공통 주소·응답·식별자 규칙은 [API 대응표](backend-api-coverage.md)를 따른다.

## 호출 순서

1. 처음 저장할 때 `POST /projects`에 `{name,scope,externalProjectId,clientRequestId}`를 전송한다. 응답 `data.project.id`는 서버 UUID이며 로컬 프로젝트 ID와 구분해 보관한다. `initialLayout`은 보내지 않으므로 생성 직후 revision은 0이다.
2. `PUT /projects/{서버 UUID}/draft`에 `{baseRevision,layout,assetManifest:[],clientRequestId}`를 전송한다. `layout`은 기존 에디터의 전체 version 18 저장본이다. 성공한 `data.revision`을 다음 저장의 `baseRevision`으로 사용한다. 서버는 같은 본문을 다시 저장해도 새 revision을 만든다.
3. 뷰어 공개가 가능한 READY 저장은 `POST /projects/{id}/validate`에 `{revision}`을 보낸 후 `data.valid === true`일 때만 `POST /projects/{id}/publish`에 `{revision,clientRequestId}`를 보낸다. 성공한 `publishedRevision`을 목록과 뷰어에 사용한다.

요청 예시:

```json
{"baseRevision":2,"layout":{"version":18,"name":"펌프 관측","hierarchy":{"nodes":[]}},"assetManifest":[],"clientRequestId":"f4f03928-1eaf-46fb-ae84-596ca8ae9a04"}
```

이 예시는 필드 구조 설명용이며 실제 요청에는 전체 에디터 layout이 들어간다. 현재 자산 ZIP 형식이 백엔드와 달라 업로드 자산이 있으면 원격 저장을 중단한다. 로컬 저장본은 유지한다. 기존 `PUT /projects/{id}/configuration`과 `assetUploadId`는 현재 백엔드 경로·필드가 아니다. 게시 검증은 고정 화면 구성만 검사하며 운영 센서 분석을 활성화하지 않는다.
