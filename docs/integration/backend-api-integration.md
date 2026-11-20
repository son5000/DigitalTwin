# 백엔드 연동 현황 (2026-11-17)

기능별 연결 여부, 프론트에만 있는 계약, 백엔드에만 있는 경로는 [프론트·백엔드 API 대응표](backend-api-coverage.md)에 정리했다.

2026-11-19 보완: 저장·게시·조회·신규 삭제는 [백엔드 전달용 통합 계약](project-save-publish-delete-handoff.md)을 먼저 본다. 삭제는 프론트 요청을 구현했으며 실제 백엔드 지원·배포는 미확인이다.

근거: 백엔드 개발자가 전달한 `[프론트전달] 백엔드_접속과_기능별_연동_안내.docx`. 아래 경로는 실제 문서 계약이다. 기존 `project-*-api.md`의 `/projects/{id}/configuration`, `/viewer`, `/assets`, `/viewer/live` 및 프로젝트 `DELETE` 설명은 이전 프론트 제안으로, 현재 백엔드 구현 경로가 아니다.

## 주소와 응답

- 프로젝트·함체: `https://checklab.co.kr/api/v1` (`VITE_PROJECT_API_BASE`). 설정이 없으면 `VITE_MONITORING_API_BASE`가 `/api/fe/v1`로 끝날 때 같은 호스트의 `/api/v1`을 사용한다.
- 기존 센서 시리얼·영상: `https://checklab.co.kr/api/fe/v1` (`VITE_MONITORING_API_BASE`). 서버가 반환하는 `/api/v1/media` 주소는 백엔드 호스트로 해석한다.
- 프로젝트 REST 성공은 `{ "request_id": "...", "data": { ... } }`, 오류는 `{ "request_id": "...", "error": { "code": "...", "message": "..." } }` 형식이다. 현재 문서 기준 로그인·권한 처리는 제공되지 않는다.

## 프론트 호출 대응

| 사용자 동작 | 실제 백엔드 호출 | 프론트 코드 |
| --- | --- | --- |
| 새 프로젝트 저장 | `POST /projects` → `PUT /projects/{서버 UUID}/draft` | `projectConfigurationApi.js`, `DigitalTwinEditorPage.jsx` |
| 뷰어로 공개 | `POST /projects/{id}/validate` → `POST /projects/{id}/publish` | `projectConfigurationApi.js` |
| 목록과 추가 페이지 | `GET /projects?limit=20&cursor=...` | `projectListApi.js`, `ProjectsPage.jsx` |
| 이어서 편집 | `GET /projects/{id}?mode=editor` | `projectEditApi.js` |
| 공개 뷰어 열기 | `GET /projects/{id}?mode=viewer` | `projectViewerApi.js`, `ProjectViewerPage.jsx` |
| 설비와 함체 연결 | `GET /equipment-mappings?projectId={외부 프로젝트 ID}&equipmentId={프론트 설비 ID}` | `projectViewerLiveApi.js` |
| 최신 함체 상태 | `GET /enclosures/{uid}/snapshot?view_type=VISION|THERMAL|ULTRASONIC` | `projectViewerLiveApi.js`, `useViewerLiveStatus.js` |
| 변경 통지 | `wss://checklab.co.kr/api/v1/events`, 연결 후 `{"op":"SUBSCRIBE","enclosure_uid":"..."}` | `useViewerLiveStatus.js` |
| 센서 원본 영상 | `GET /api/fe/v1/sensors/{sensorId}/frame?kind=VISION|THERMAL` | `monitoringClient.js` |

프론트의 로컬 `projectId`는 `externalProjectId`로 보내고, 서버가 발급한 `data.project.id`를 이후 프로젝트 경로에 쓴다. 초안 저장 본문은 `{baseRevision,layout,assetManifest,clientRequestId}`이며 `layout.version`은 18이다. 공개 뷰어는 게시본을, 이어서 편집은 최신 초안을 각각 조회한다. 실시간 WebSocket은 변경 사실만 알리므로 수신 후 REST 스냅샷을 다시 조회한다. 연결이 끊기면 15초 간격 재조회로 복구한다. 서버의 관찰값과 프론트 ROI 측정값 사이에 확정된 결합 키가 없어 KPI 숫자는 임의로 만들어 표시하지 않는다.

## 현재 연동 제한

- 기존 표시 자산의 명세·파일 조회, 해시 검사, glTF/GLB 모델 복원을 구현했다. 원본 OBJ/PLY/MTL·텍스처·커스텀 정의는 신규 제안 `/project-assets` ZIP 업로드/다운로드로 보존한다. 업로드 결과를 `assetManifest`에 전달하는 프론트는 구현했고, 해당 API와 `NATIVE_BUNDLE` 검증·게시 지원은 백엔드 작업이 필요하다. 상세 요청은 [백엔드 전달 문서](backend-viewer-asset-handoff.md)를 참조한다.
- 현재 SYNTHETIC 목업은 `layout.hierarchy.nodes` 및 설비/모델 연결 정보가 없다. 실제 에디터 전체 저장본으로 다시 게시해야 하며 프론트는 누락된 구성을 임의 생성하지 않는다.
- 기존 백엔드 문서에 프로젝트 삭제 API가 없었다. 현재 목록은 신규 DELETE를 호출하고 서버 성공 후 로컬 사본을 정리한다. 서버의 논리 삭제·게시본 접근 차단·자산 정책은 통합 계약에 따라 구현해야 한다.
- 기존 프론트 전용 `/projects/{id}/rois`, 설비별 `/monitoring` SSE, 센서 보정 PUT 경로는 백엔드 문서에서 미구현이다. 서버 프로젝트에서는 이 경로로 관측값을 요청하지 않는다. 백엔드 ROI·임계치·오디오·평가 API는 별도 모델 매핑이 필요하다.
- `WSS /events`의 실제 브라우저 handshake·Origin 허용 여부와 서버 저장·게시·뷰어 전체 흐름은 백엔드 환경에서 아직 검증되지 않았다. 로컬 검증은 요청 형식과 빌드에 한정된다.
