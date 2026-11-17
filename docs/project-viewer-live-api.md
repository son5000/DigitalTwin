# 뷰어 실시간 상태 API

프론트 구현: [projectViewerLiveApi.js](../src/features/portal/projects/projectViewerLiveApi.js), [useViewerLiveStatus.js](../src/features/portal/projects/useViewerLiveStatus.js). 호출 화면: [ProjectViewerPage.jsx](../src/features/portal/projects/ProjectViewerPage.jsx). 공통 주소·ID 규칙은 [API 대응표](backend-api-coverage.md)를 따른다.

## 호출 흐름

1. 게시된 프로젝트 layout의 각 설비에 `GET /api/v1/equipment-mappings?projectId={externalProjectId}&equipmentId={설비 ID}`를 호출한다. 404는 매핑 없음으로 표시한다.
2. 받은 `enclosureUid`에 `GET /api/v1/enclosures/{uid}/snapshot?view_type=VISION|THERMAL|ULTRASONIC`을 호출한다. `data.{enclosure,view,slots,rois,observations,alarms,models,server_time}` 중 슬롯 상태, 최근 관찰, 활성 경고를 화면 요약 상태에 사용한다. 원본 측정 시각을 수신 시각으로 바꾸지 않는다.
3. `wss://checklab.co.kr/api/v1/events`에 연결해 함체별 `{"op":"SUBSCRIBE","enclosure_uid":"..."}`를 보낸다. `texture.changed`, `observation.changed`, `alarm.changed`, `command.changed`는 변경 통지이므로 스냅샷을 다시 조회한다. 문자열 `seq`는 BigInt로 비교한다.
4. 연결이 끊기면 다시 구독하고, 15초 주기 재조회로 상태를 복구한다. 화면을 떠나면 요청·타이머·소켓을 정리한다.

W02 관찰·경고와 프론트 ROI KPI를 결합하는 검증된 ID 계약이 없어 KPI 숫자를 임의로 채우지 않는다. 현재 화면의 설비 상태 요약은 ROI별 측정값을 대체하지 않는다. 기존 프론트 제안의 `GET /projects/{id}/viewer/live` 및 SSE 경로는 백엔드에 없으며 사용하지 않는다. WSS handshake/Origin과 실제 서버 데이터는 별도 검증이 필요하다.
