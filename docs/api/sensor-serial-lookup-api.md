# 센서 시리얼 확인·뷰어 연결 API 계약

작성일: **2026-11-23**. 대상: ‘스캔 + 도형’의 4단계 센서 설정. 다른 모드에서도 `SENSOR` 단계에 동일하게 적용한다.

## 1. 역할과 구현 상태

**에디터는 사용할 센서의 존재·소속을 확인하고 현실의 설치 위치를 배치한다. 실제 측정값·영상·통신 상태는 뷰어에서 조회한다.**

| 구분 | 책임 |
|---|---|
| 에디터 | 시리얼 확인 → 서버 센서 ID 연결 → 사용자가 기능·위치·회전·화각·부착면·ROI 설정 → 프로젝트 저장 |
| 백엔드 | 센서 원본과 소속 관리, 조회 시 소속 반환, 저장 시 경쟁 충돌 재검사, 뷰어 실시간 데이터 제공 |
| 뷰어 | 게시 구성의 센서 ID와 배치 복원 → 해당 센서 조회/구독 → 측정 시각·상태와 함께 화면 갱신 |

기존 FE01 `GET /api/fe/v1/sensors/by-serial`을 재사용한다. 이 저장소에서 별도 백엔드 서버를 만든 것은 아니다. 이전 전달서 `[프론트전달] 백엔드_접속과_기능별_연동_안내.docx`를 반영한 [연동 설정](../integration/backend-api-integration.md), [API 대응표](../integration/backend-api-coverage.md), [관제 계약](../monitoring/frontend-monitoring-contract.md)을 대조했다. 이번 실행 환경에는 이전 첨부 경로의 원본 파일이 없어 저장소에 보존된 계약과 실제 오류 응답을 근거로 했다.

- 프론트 구현: 식별자·명시적 소속만 검증/적용, 직접/봉투 응답 호환, 취소·시간 제한·중복 차단.
- 에디터 실시간 조회: 영상 5초 폴링, 설비 측정 조회/SSE, ROI 실측 미리보기, 최신 영상 조회 버튼을 실행하지 않는다.
- 배치용 샘플·사용자가 지정한 참고 이미지·로컬 원본 자산은 유지한다. 실시간 수신 성공으로 표시하지 않는다.
- 뷰어의 기존 W02/WSS·FE02 조회는 유지한다.
- **백엔드 추가 확인/구현:** 미소속 센서 정상 조회, 명시적인 equipmentId null, 저장 시 소속 충돌 검사, 운영 CORS.
- 운영 확인은 미등록 검증 번호의 GET 404/OPTIONS 204까지다. 실제 센서 정상 조회·저장·뷰어 수신 왕복은 미검증이다.

아래 백엔드 필요 동작은 구현 요청/인수 기준이다. 운영 서버에 이미 모두 구현됐다는 뜻이 아니다.

## 2. 요청

```http
GET https://checklab.co.kr/api/fe/v1/sensors/by-serial?serialNumber=CAM-001&equipmentId=equipment-1
```

| 항목 | 규칙 |
|---|---|
| 환경변수 | `VITE_MONITORING_API_BASE=https://checklab.co.kr/api/fe/v1` |
| serialNumber | 필수 string. 앞뒤 공백만 제거. 대소문자·선행 0·중간 공백 보존. URLSearchParams 인코딩 |
| equipmentId | 연결하려는 현재 프론트 `equipment.id`. 함체 UID나 센서 ID가 아니다 |
| HTTP | GET, 본문 없음, JSON Content-Type 강제 지정 없음, cache:no-store, 10초 제한, 화면 종료 시 취소 |
| 인증 | 현재 credentials:same-origin. 접근권한은 서버 검증. 교차 출처 쿠키 인증 도입은 별도 합의 |

GET은 읽기 전용이다. 조회만으로 센서를 생성하거나 설비 소속을 변경/예약하지 않는다. 실패를 DEMO 성공으로 바꾸지 않는다.

UI는 미확인 상태의 `센서 확인` 버튼 → `확인 중…` → 체크 아이콘과 `연결 확인 완료` 상태 표시로 전환한다. 완료 후 재조회 버튼은 표시하지 않으며, 시리얼을 변경하면 기존 연결을 해제하고 확인 버튼을 다시 표시한다. 저장된 센서를 다시 열어도 완료 상태를 유지한다. 이 표시는 센서 식별 연결이며 실시간 온라인 상태나 서버 저장 완료를 의미하지 않는다.

### 연결 UI 확인용 예약 시리얼

에디터에서 소문자 `testcase`를 입력하고 **센서 확인** 또는 Enter를 누르면 백엔드 요청 없이 가상 센서를 연결한다. 앞뒤 공백은 제거하며, 다른 대소문자나 시리얼은 실제 조회 경로를 사용한다. API 주소가 설정된 환경에서도 동작한다.

- 식별자: `serverSensorId`/`serverKey`는 `demo:testcase:{로컬 sensor.id}`, `dataSource`는 `DEMO`다. 여러 센서에 같은 예약값을 입력해도 각각 독립된 가상 센서로 연결되며 재확인 시 식별자는 유지된다. 실제 서버 센서 ID로 해석하거나 설비 소속을 확정하면 안 된다.
- 기존 연결 완료 UI와 배치 설정을 사용하며 **테스트 연결 완료**, **예시 센서** 및 가상 센서 안내를 표시한다. 위치·방향·화각·기능 설정을 유지하고 실측값·영상을 만들지 않는다.
- `testcase`만 시리얼 중복 검사에서 제외한다. 일반 시리얼의 중복 연결 검사는 유지한다. 실제 번호로 변경하면 예시 식별자를 해제하고 다시 서버 확인을 받아야 한다.
- 일반 시리얼의 서버 오류를 예시 성공으로 바꾸지 않는다. 이 예약값은 UI 검토용이며 실서버 정상 연결 검증에 포함하지 않는다.

## 3. 정상 응답: 필드 3개

미소속 센서:

```json
{
  "sensor": {
    "id": "sensor-42",
    "serialNumber": "CAM-001",
    "equipmentId": null
  }
}
```

현재 설비에 이미 연결된 센서:

```json
{
  "sensor": {
    "id": "sensor-42",
    "serialNumber": "CAM-001",
    "equipmentId": "equipment-1"
  }
}
```

공통 봉투 `{request_id, data: {sensor: ...}}`도 지원한다.

| 필드 | 필수·타입 | 처리 |
|---|---|---|
| id | 필수, 비어 있지 않은 string 권장 | 안정적인 서버 센서 ID. 호환상 0 이상 안전한 정수도 문자열로 변환. 긴 정수·선행 0 ID는 string 필수 |
| serialNumber | 필수 string | 요청 시리얼과 앞뒤 공백 제거 후 정확히 일치 |
| equipmentId | **필수 키**, string 또는 null | null: 미소속으로 사용 가능. 현재 ID: 재편집 가능. 다른 ID: 연결 거부 |

equipmentId 생략·빈 문자열·undefined는 미소속으로 해석하지 않는다. 확인할 수 없으므로 적용을 차단한다. 센서가 존재하고 소속을 확인할 수 있을 때만 200을 반환하면 되므로 별도 exists 플래그는 필요 없다.

`serverKey`, `capabilities`, `fieldOfView`, `resolution`, `frameUrl`, `frameMeasuredAt`, `connectionStatus`, `latestValue`, `intrinsics`는 최소 응답에 불필요하다. 구형 상세 응답은 위 3개 필드만 추출하고 나머지는 무시한다.

## 4. 백엔드 존재·소속 검사

1. 접근 가능한 센서 원본에서 시리얼을 조회한다. 실제 센서가 없으면 404.
2. 센서의 현재 설비 소속을 확인한다. **소속이 없다는 이유로 센서 자체를 404로 처리하지 않는다.**
3. 미소속이면 equipmentId:null, 소속이 있으면 실제 프론트 설비 ID를 반환한다. 요청 equipmentId를 무조건 응답에 복사하면 안 된다.
4. 타 설비 소속이면 실제 다른 ID를 반환하거나 409 오류를 반환한다. 프론트는 어느 경우에도 연결하지 않는다.
5. 같은 설비이면 다시 확인할 수 있다. 같은 센서 재확인은 기존 수동 배치·보정 확인을 초기화하지 않는다.

H51은 `GET /api/v1/equipment-mappings?projectId={externalProjectId}&equipmentId={equipment.id}`로 함체를 찾는다. 현재 FE01에는 projectId를 전송하지 않는다. 서버가 프로젝트 없이 equipmentId를 유일하게 해석할 수 없다면 **모호한 요청은 409로 차단**하고 프로젝트 문맥 추가를 합의해야 한다. 다른 프로젝트의 동일 equipmentId를 현재 설비로 간주하면 안 된다. 이번 프론트는 합의되지 않은 추가 파라미터를 임의로 보내지 않는다.

## 5. 편집 상태·저장 계약

확인 후 서버 식별 정보와 사용자 배치를 함께 저장한다.

```json
{
  "id": "local-sensor-binding-1",
  "serverSensorId": "sensor-42",
  "serverKey": "sensor-42",
  "serialNumber": "CAM-001",
  "equipmentIds": ["equipment-1"],
  "dataSource": "SERVER",
  "position": {"x": 0.15, "y": 1.2, "z": -0.1},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "capabilities": ["VISION"],
  "fieldOfView": 50
}
```

position/rotation/capabilities/fieldOfView는 **사용자가 설정한 구성값**이며 FE01에서 가져오지 않는다. 로컬 id는 배치·ROI 참조로 유지한다. serverSensorId는 실제 통신용 서버 ID, serverKey는 기존 코드 호환용 동일 ID다. dataSource:SERVER는 서버 센서 식별 연결을 뜻하며 온라인 상태가 아니다.

- 저장 위치: `layout.sensorBindings[]`, 호환 복제 `layout.observationConfig.sensorBindings[]`. 기존 `PUT /api/v1/projects/{serverProjectId}/draft`의 전체 layout에 포함한다.
- 수동 이름·위치·회전·화각·기능·부착면·서랍 슬롯·ROI 참조를 유지한다. 새 센서로 바꿀 때만 보정 확인을 해제한다.
- 시리얼 변경 시 이전 서버 식별·오래된 영상·통신 상태·보정 확인을 해제한다. 수동 배치·화각은 보존한다.
- 센서 확인 직후는 브라우저 편집 상태다. 프로젝트 저장 전 서버 소속 확정·장치 명령 성공으로 표시하지 않는다.
- 예전 저장 문서에 남은 영상·통신 상태 필드는 호환 데이터다. 이번 확인 API로 새로 채우지 않는다.

### 저장 시 소속 재검사: 백엔드 필수

확인과 저장 사이 다른 사용자가 센서를 연결할 수 있으므로 GET만으로 전역 중복을 보장할 수 없다. 백엔드는 저장/연결 확정 트랜잭션에서 센서 ID 존재, 시리얼 일치, 설비 접근권한, 현재 소속을 다시 검사한다. 미소속 → 대상 연결 또는 동일 소속 유지와 구성 저장을 원자적으로 처리하고 타 설비 소속이면 409로 거부한다. 센서 하나의 활성 설비 소속은 DB에서 유일성을 보장한다. 기존 함체/slot 소속이 있다면 그것을 권위 있는 원본으로 사용하고 상충하는 소속 저장소를 만들지 않는다.

권장 오류 예시(새 코드명은 백엔드 합의 필요):

```json
{
  "request_id": "...",
  "error": {
    "code": "SENSOR_ALREADY_ASSIGNED",
    "message": "다른 설비에 연결된 센서입니다.",
    "fields": [{"path": "layout.sensorBindings[0].serverSensorId"}]
  }
}
```

현재 draft가 단순 JSON 보관만 한다면 이 재검사·소속 확정은 **백엔드 추가 작업**이다. 별도 명시적 연결 API를 선택하면 그 경로와 트랜잭션을 합의해 연결해야 한다. 프론트는 임의 소속 변경 POST를 보내지 않는다. 저장 실패 시 로컬 초안을 보존하더라도 서버 연결 성공으로 간주하지 않는다.

## 6. 뷰어 실시간 흐름

게시본에서 serverSensorId·equipmentIds와 위치/회전/투영/ROI를 복원한다. FE01 시리얼 확인을 주기적으로 반복하지 않는다.

- 설비 상태: H51 → W02 `GET /api/v1/enclosures/{uid}/snapshot?view_type=...`.
- 변경 통지: W03 `wss://checklab.co.kr/api/v1/events` 함체 구독 → REST 재조회. 기존 폴링 복구 유지.
- 영상: FE02 `GET /api/fe/v1/sensors/{serverSensorId}/frame?kind=VISION|THERMAL`. 활성 표시 센서만 주기 조회.
- UI: 기존 측정 시각·연결/오류 상태·관측 표시를 사용한다. 미수신을 0 또는 정상으로 만들지 않고 ID·설비·ROI가 맞는 값만 표시한다.
- 최신 데이터는 뷰어 런타임 상태다. 매 프레임 저장 구성이나 센서 배치를 덮어쓰지 않는다.

W02 함체 상태가 모든 ROI 실측 연동을 의미하지는 않는다. 기존 sensor/slot/ROI 매핑과 timestamp/quality 계약 및 공동 검증은 계속 필요하다. 이번 변경이 모든 ROI 분석 API를 새로 완성했다는 뜻은 아니다.

에디터에서는 실제 센서 영상·측정 폴링/SSE와 실측 미리보기를 중단한다. 샘플·사용자가 지정한 참고 이미지 접근은 정적 배치 자료로 유지하고 실시간 값으로 표시하지 않는다.

## 7. 오류·CORS·실서버 확인 범위

오류 객체의 status/code/fields/requestId를 보존하고 요청 ID를 안내한다. 404는 센서 등록 확인 실패, 409는 소속 충돌, 10초 초과는 시간 초과로 표시한다.

2026-11-23 미등록 검증용 시리얼의 실제 GET은 404 NOT_FOUND, 메시지는 `Registered mapping, enclosure or sensor was not found`, fields.path는 equipmentId였다. 요청 ID는 `b4a8fe48-ae0d-4bcd-916d-b172850023c7`다. 매핑·함체·센서 없음이 합쳐진 오류이므로 **미소속 센서의 정상 확인은 별도로 구현/검증해야 한다.**

운영 Origin `https://digitaltwin-beige.vercel.app`의 GET과 OPTIONS 204 모두 `Access-Control-Allow-Origin: http://localhost:3000`을 반환했다. 운영 브라우저에서는 응답을 읽지 못할 수 있다. 개발/운영 출처와 Vary:Origin을 올바르게 설정하고 성공·오류 응답 모두 CORS를 적용해야 한다. 프론트 no-cors나 임의 프록시로 우회하지 않는다.

## 8. 인수 조건과 소스

- [ ] 미소속 센서: 200 + equipmentId null, 연결 가능.
- [ ] 같은 설비: 재확인 가능, 기존 배치·보정 보존.
- [ ] 타 설비/모호한 프로젝트 소속: 차단 또는 409.
- [ ] 센서 없음 404, 소속 필드 누락·시리얼 불일치 차단.
- [ ] 상세 응답의 측정·영상·사양을 에디터로 가져오지 않음.
- [ ] 센서 전환/취소/중복 입력 시 잘못된 바인딩 갱신 없음.
- [ ] 에디터 실측 폴링 없음, 뷰어만 저장 ID로 수신.
- [ ] 저장 시 소속 재검사·경쟁 방지, 재접속 후 ID/배치 복원.
- [ ] 운영 Origin에서 FE01/FE02/미디어 및 오류 CORS 확인.

| 파일 | 역할 |
|---|---|
| [SensorConnectionFields.jsx](../../src/features/digitalTwin/editor/components/SensorConnectionFields.jsx) | 최소 확인 UI, 중복/취소 |
| [sensorLookup.js](../../src/features/digitalTwin/editor/model/sensorLookup.js) | 3개 필드 검증, 식별자만 적용 |
| [monitoringClient.js](../../src/features/digitalTwin/editor/api/monitoringClient.js) | FE01 요청·오류 |
| [useSensorProjectionFrames.js](../../src/features/digitalTwin/editor/store/useSensorProjectionFrames.js), [useRoiMonitoring.js](../../src/features/digitalTwin/editor/store/useRoiMonitoring.js) | 편집/뷰어 조회 분리 |
| [MonitoringRoiWorkspace.jsx](../../src/features/digitalTwin/editor/components/MonitoringRoiWorkspace.jsx) | editorMode 실측 차단 |
| [sensorLookup.test.js](../../tests/sensorLookup.test.js) | 최소 계약·배치 보존·요청 테스트 |

검증 명령: `node --test tests/sensorLookup.test.js tests/equipmentDetailModel.test.js tests/projectViewerLiveApi.test.js`, 변경 파일 ESLint, `npm run build`, 문서 audit. 모의 API 검증은 실서버 정상 센서 왕복 완료의 증명이 아니다.
