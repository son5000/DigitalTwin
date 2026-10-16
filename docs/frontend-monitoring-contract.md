# 센서 보정·관측 프론트 연동 준비

## 구현 범위

| 기능정의서 | 프론트 동작 | 백엔드·장치에서 필요한 결과 |
| --- | --- | --- |
| 1, 2 | 센서 시리얼 조회, 촬영 영상 비교, 위치·방향·화각 보정, 비전/열화상 UV 텍스처 적용 | 센서 조회, 영상, 카메라 내부 보정 정보, 모델 UV에 맞춘 텍스처 |
| 3, 4 | 표면 ROI 임시 조회·저장, 온도 최저/최고/평균 표시 선택 | ROI를 센서 측정 영역에 대응시키고 통계 계산 |
| 5 | 영상 변화율 표시 선택, 변화율 임계치 설정 | 기준 영상 및 변화율 분석 (`vision.changePercent`, %) |
| 6 | 설비 로컬 좌표의 초음파 발생 위치 마커 | 위치별 좌표·dB·측정 시각 |
| 7, 8 | 메쉬 지점 선택, 가청/초음파 가청 변환 음원 요청·재생 | 해당 위치의 음원 추출·합성·주파수 변환 |
| 9 | 기존 프로젝트/설비별 링크 뷰어에 관측 패널 추가 | 접근권한이 확인된 프로젝트·자산·측정 데이터 |
| 10 | 이상/초과/미만, 지속 시간, 경고 목록·배지·확인 | 브라우저와 독립적인 판정, 사건 저장, 실시간 전송 |
| 11, 12 | 장치 조명 제어·물리적 핫스왑은 구현 범위 밖. 웹 센서 연결 변경·재보정만 제공 | 조명/촬영 제어, 장치 교체·재연결·설정 적용 |

기존 ROI, 프로젝트 패키지, 계정 권한 관련 계약은 `roi-monitoring-contract.md`를 함께 참조한다. DB 또는 마이그레이션은 적용하지 않는다.

## 사용 흐름

1. 설비 상세 → 센서 위치에서 센서를 추가하고 시리얼 번호를 입력한다.
2. 실제 서버가 없으면 `입력한 번호로 예시 센서 연결`로 화면만 확인한다. 예시 센서 ID는 `demo:` 접두사를 쓰며 실제 서버 보정 저장에 사용할 수 없다.
3. 관측 이미지 패널의 `센서 시점으로 비교`를 누른다. 위치·회전·화각을 바꾸며 실제 영상과 비교한다. 센서 시점에서는 자유 궤도 조작과 ROI/지점 선택을 제한한다.
4. `위치·화각 수동 보정 확인` 후 `보정값 저장`을 누른다. 배치값 변경은 확인을 해제한다. 모델/정합/설비 위치 변경은 저장한 서명과 달라져 재저장 필요 상태가 된다.
5. `보정 좌표 내보내기`는 현재 좌표 계약을 JSON으로 내려받는다. 로컬 저장은 프로젝트 센서 구성에 보관되며 패키지 내보내기에 포함된다. 로컬 결과를 서버 성공으로 표시하지 않는다.
6. 센서 배치 화면 또는 고객 뷰어의 `관측 데이터`에서 모델/비전/열화상/초음파를 전환한다.
7. `예시 데이터로 기능 확인`은 명시적으로 켜야 한다. 연결 실패 시 자동으로 예시 데이터로 바꾸지 않는다. 예시 상태는 화면을 떠나면 해제된다.
8. ROI 패널에서 온도·dB·변화율을 선택한다. 저장된 ROI 규칙은 예시 모드에서만 샘플 값으로 평가한다. 지속 시간을 충족한 주의·위험 진입 시 예시 경고를 만든다. 실서비스 경고는 서버 판정만 사용한다.
9. 자유 시점에서 `3D 표면에서 위치 선택` → 표면 클릭 → 음원 처리 선택 → 요청 → 재생한다. 위치/모드/설비 변경 시 이전 요청과 음원은 폐기된다. 예시 음원은 작은 합성 테스트 톤이며 실제 위치 소리나 실제 초음파 변환 결과가 아니다.

## 연결 방식

`VITE_MONITORING_API_BASE=/api/digital-twin`을 빌드 환경에 설정한다. 새 API는 `api/monitoringClient.js`에 모았다. 같은 출처의 리버스 프록시·세션 쿠키를 전제로 한다. 향후 응답 형식 변경은 이 어댑터와 `model/monitoringContract.js`에서 수용한다. 권한/CSRF/센서 중복 소속 검사 및 프로젝트 소유권은 서버가 검증한다.

| 메서드·경로 (API base 하위) | 요청/응답 |
| --- | --- |
| GET `/sensors/by-serial?serialNumber=...&equipmentId=...` | `{sensor:{id,serialNumber,equipmentId,deviceKind,sensorType,frameUrl,frameMeasuredAt,fieldOfView,aspectRatio,resolution,intrinsics,intrinsicCalibrationId,capabilities,connectionStatus}}` |
| GET `/sensors/:sensorId/frame` | `{sensorId,url,measuredAt}`. url은 HTTP(S) 또는 같은 출처의 `/...` 경로 |
| PUT `/projects/:projectId/sensors/:sensorId/calibration` | 아래 보정 본문, `If-Match` 숫자 revision. 응답 `{revision}`은 요청 버전보다 커야 함. 신규 0 |
| GET `/projects/:projectId/equipment/:equipmentId/monitoring` | 아래 관측 스냅샷 |
| GET `/projects/:projectId/equipment/:equipmentId/events` | SSE 기본 `message` 이벤트의 data에 완전한 관측 스냅샷 JSON. 부분 patch가 아님 |
| POST `/projects/:projectId/equipment/:equipmentId/audio` | `{selection,processing:"AUDIBLE" 또는 "HETERODYNE"}` → `{equipmentId,url,measuredAt?,expiresAt?}` |
| POST `/projects/:projectId/equipment/:equipmentId/alarms/:alarmId/acknowledge` | 서버 확인 처리 완료 후 204 또는 JSON |

SSE 연결 시 최신 스냅샷을 다시 조회한다. 재연결 시 미확인 사건을 최신 스냅샷에 포함시켜 누락을 복구한다. 프론트는 사건 ID로 중복을 제거하고 최근 100건을 보관한다. 연결 종료·설비 변경 시 EventSource와 요청을 정리한다. 경고 확인은 서버 성공 후 반영하며 단순 화면 닫기는 확인으로 취급하지 않는다.

## 좌표·보정 계약

`calibrationPayload()`가 아래 구조를 생성한다. 단위 m, 오른손 좌표계, +Y가 위, Euler XYZ 라디안이다. **기존 센서 배치 데이터와 호환되도록 센서 로컬 정면은 -Y, 영상의 위쪽은 -Z**다. 일반 카메라의 -Z 전방 관례와 다르므로 서버에서 반드시 변환해야 한다.

```json
{
  "schemaVersion": 1,
  "projectId": "project-1", "equipmentId": "equipment-1", "sensorId": "sensor-1",
  "bindingId": "local-binding-1", "serialNumber": "CAM-001",
  "model": {"assetId": "asset-1", "version": "geometry-xxxxxxxx"},
  "coordinateSystem": {"unit":"m","handedness":"RIGHT","up":"+Y","rotationUnit":"rad","rotationOrder":"XYZ","sensorForward":"-Y","sensorUp":"-Z"},
  "pose": {"space":"EQUIPMENT_LOCAL","position":[2,2,2],"rotation":[0,-0.7,0]},
  "equipmentTransform": {"position":[0,0,0],"rotation":[0,0,0]},
  "camera": {"fieldOfView":50,"aspectRatio":1.7777778,"near":0.1,"far":10,"resolution":{"width":1920,"height":1080},"calibrationId":null,"intrinsics":null},
  "method":"MANUAL", "dataSource":"SERVER"
}
```

`fieldOfView`는 수직 화각이다. `pose.space=WORLD`이면 월드 기준 위치·회전, `EQUIPMENT_LOCAL`이면 설비 변환 이전 좌표다. 센서 시점 화면은 화각·종횡비를 사용하는 근사 비교이며 렌즈 왜곡/내부 파라미터 전체를 반영한 정밀 보정이 아니다. backend는 `intrinsics`, 카메라 간 보정 및 실측 정보로 정밀 매핑을 수행해야 한다. 비전/열화상/음향 장치의 위치가 다르면 각각 등록·보정한다.

`model.version`은 현재 프론트 형상/자산/정합값의 변경 감지용 fingerprint이며 서버 모델 revision을 대체하는 영구 식별자가 아니다. 서버 모델 버전 확정 시 어댑터에서 치환한다. 모델이나 정합을 변경한 기존 ROI는 새 표면에 다시 지정해야 한다.

## 관측 스냅샷

```json
{
  "equipmentId":"equipment-1",
  "textures":[{
    "equipmentId":"equipment-1", "kind":"THERMAL", "mapping":"UV",
    "url":"/media/thermal-frame-123.png", "meshPath":"0/1",
    "modelVersion":"geometry-xxxxxxxx", "representation":"ACTUAL",
    "measuredAt":"2026-10-14T03:00:00.000Z", "quality":"GOOD", "staleAfterMs":15000
  }],
  "hotspots":[{
    "equipmentId":"equipment-1", "position":[0,1.5,1], "db":65.4, "radius":0.08,
    "modelVersion":"geometry-xxxxxxxx", "representation":"ACTUAL",
    "measuredAt":"2026-10-14T03:00:00.000Z", "quality":"GOOD", "staleAfterMs":15000
  }],
  "legend":{"min":20,"max":100},
  "readings":[],
  "alarms":[{
    "id":"alarm-123","roiId":"roi-1","name":"베어링","severity":"WARNING",
    "occurredAt":"2026-10-14T03:00:00.000Z","message":"최고 온도 기준 초과","acknowledgedAt":null
  }]
}
```

- 텍스처는 서버에서 만든 UV 매핑 결과를 받는다. 프론트가 촬영 사진으로 UV/정합을 추측하지 않는다. `meshPath`는 관측 장면의 proxy/actual 모델 루트부터 child index를 `/`로 연결한 경로다. 생략하면 UV가 있는 전체 메쉬에 공통 atlas를 적용한다. glTF 등 다른 로더 추가 시 안정적인 서버 메쉬 ID 계약으로 교체하는 것이 좋다.
- 모델/표현 불일치, 오래된 프레임, GOOD이 아닌 품질은 표시하지 않는다. 프레임 URL은 변경된 영상마다 버전이 다른 URL을 제공한다. 텍스처 다운로드 실패와 UV 누락은 화면 오류로 표시한다. 한 프레임에 최대 8개 텍스처를 적용한다.
- hotspot 위치는 설비 로컬 m. 위치별 측정이 불가능한 센서에는 임의 위치를 채우지 않는다.
- `readings`는 기존 ROI 응답 계약을 사용한다. `vision.changePercent`가 추가되며 연산자는 `gte`(이상), `gt`(초과), `lt`(미만)이다. revision, 측정 시각, 품질이 맞아야 표시한다.
- 음원 `selection`은 `{coordinateSpace:"EQUIPMENT_LOCAL",representation,position:[x,y,z],equipmentId,modelVersion,model:{assetId,version}}`. 서버는 보정된 센서 위치·동기화된 원신호를 기반으로 처리해야 한다. 음원 URL은 브라우저가 재생 가능한 코덱/컨테이너로 제공한다. 프론트에서 비동기 요청 중 지점이 바뀌면 취소한다.
- 열화상 이미지만으로 ROI 온도를 추정하지 않는다. 비전 변화율·dB·음원도 서버 결과를 사용한다.

## 성능·운영 경계

- 관측 데이터 갱신은 Three.js 장면/카메라를 재생성하지 않고 별도 레이어만 갱신한다. 기존 모델/설정 변경의 카메라 보존 로직을 유지한다. 텍스처·음원 object URL·SSE·타이머는 교체/종료 시 정리한다.
- 관측 패널은 현재 화면의 FPS를 약 1초 단위로 표시한다. 이는 화면 성능 확인 수단이며 모든 PC·모델에서 30fps를 보증하는 결과는 아니다. 대상 PC, 브라우저, 해상도, 모델 삼각형/텍스처/센서 수를 확정하고 측정해야 한다.
- 경고는 SSE 수신 후 즉시 UI에 반영한다. 실제 1초 이내 기준은 센서 측정 → 수집 → 판정 → 전송 → 표출 중 어느 구간인지 합의하고 통합 측정해야 한다. `durationSeconds`가 1초보다 크면 해당 조건의 의도적인 대기 시간도 구분해야 한다.
- 브라우저 종료 중 이상 감지·관제 알림은 서버 워커 책임이다. 예시 모드의 타이머는 개발 확인용이며 상시 감시가 아니다.
- 인증/운영자·고객 권한 집행, DB 공유 저장, 실제 텍스처 생성, 영상 변화 분석, 음원 합성, 외부 관제 전송은 백엔드 구현 및 현장 검증이 남아 있다.
