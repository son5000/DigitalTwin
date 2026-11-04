# 관측 영역별 판독 계약

현재 프론트는 관측 영역의 `measurements[].analysisConfig`를 프로젝트 JSON과 ROI 저장 요청에 보존합니다. 값은 설비별 ROI의 `id`, `revision`, `measurementId`에 연결됩니다. 실제 판독, FFT 산출, 원본 이미지 비교, 초음파 위치 추정은 백엔드가 구현해야 합니다. 아래 값이 없거나 유효하지 않으면 프론트는 수신 대기로 표시합니다.

## 저장 설정

| 항목 `metric` | 저장 정보 | 서버의 역할 |
| --- | --- | --- |
| `GENERAL` | `rules[]`: `metric`(`ultrasound.db`/`TEMPERATURE`), 온도 `statistic`(`min`/`average`/`max`), `operator`, `threshold`, `severity`; `analysisConfig.bands[]`: `id`, `name`, `fromHz`, `toHz` | 설비 기준 ROI 좌표에서 여러 초음파 센서를 융합하고 온도 데이터를 영역별로 집계합니다. 임계치 평가 결과를 주의/이상 이벤트로 보냅니다. |
| `vision.gaugeValue` | `analysisConfig.scale`: 시작/끝 `AngleDeg`, `Value`; `rules[]`: 기준값 `threshold`, 대응 바늘 각도 `angleDeg`, `severity` | 원본 비전 이미지의 ROI에서 바늘 각도와 값을 판독합니다. 두 보정점의 선형 대응을 기본으로 합니다. |
| `vision.switchState`, `vision.valveState` | `analysisConfig.pairId`, `referenceState`, 두 상태의 `levels`, `referenceFrame` | 기준 사진과 새 원본 프레임의 동일 ROI를 비교합니다. `value: 0`은 기준과 일치, `value: 1`은 다른 쌍 상태입니다. 정확한 상태 코드를 판독했다면 `stateCode`도 보낼 수 있습니다. |
| `vision.ledState` | `analysisConfig.colors[]`: `colorKey`, 기준 `hex`/HSV 범위, `stateCode`, `level`; 선택적 `referenceFrame` | ROI의 LED 색을 판독하고 `colorKey`를 보냅니다. 색상→상태/판정은 저장된 설정을 사용합니다. |

`referenceFrame`에는 원본 이미지의 `textureAssetId`, 서버 업로드 후 `serverAssetId`, `serverSensorId`, 촬영 시각, 원본 이미지 크기, 왼쪽 위 원점의 `sourceRect`/`sourceQuad`가 들어갑니다. 비전 ROI의 기존 `imageBinding`과 `imageAnalysis`는 가공 전 원본의 분석 좌표를 제공합니다. 서버는 화면에 투영된 3D 텍스처를 분석 기준으로 쓰지 않습니다.

로컬 프로젝트 내보내기 ZIP은 `textureAssetId`가 참조하는 원본 바이너리를 포함합니다. 공유 서버 모드에서는 ROI 저장 전에 `POST /projects/:projectId/equipment/:equipmentId/roi-reference-assets`로 `multipart/form-data`의 `image`, `roiId`, `measurementId`, `sourceRect`, `sourceQuad`를 전송합니다. 서버는 `{ "assetId": "..." }`를 반환하고 파일과 ROI의 소유권을 검증해야 합니다. 이미지 업로드가 실패하면 ROI 저장도 중단됩니다.

## 실시간 응답

기존 `GET /projects/:projectId/equipment/:equipmentId/monitoring`와 SSE `/events`의 `readings[]`에서 공통으로 `roiId`, `equipmentId`, `revision`, `measurementId`, `sensorId`(비전 항목), `measuredAt`, `quality: "GOOD"`, `staleAfterMs`를 전달합니다.

```json
{
  "roiId": "roi-id", "equipmentId": "equipment-id", "revision": 1,
  "measurementId": "general-measurement-id", "metric": "ultrasound.db",
  "value": 67.2, "measuredAt": "2026-11-02T01:00:00Z", "quality": "GOOD",
  "spectrum": { "bins": [{ "frequencyHz": 20000, "levelDb": 57.4 }] }
}
```

같은 일반 영역의 온도 응답은 `metric: "TEMPERATURE"`, `temperatureScope: "ROI"`와 ROI에 속한 `temperatureGrid` 또는 `temperatureSummary: { min, average, max }`를 포함합니다. 초음파와 온도 판정은 프론트에서 각각 표시하지만, 브라우저가 꺼져도 경보가 지속되도록 서버에서 동일 규칙을 평가해야 합니다. FFT 그래프는 실제 `spectrum.bins[]`가 있을 때만 표시합니다.

게이지 응답은 `metric: "vision.gaugeValue"`에 `value`와/또는 `needleAngleDeg`를 보냅니다. 스위치·밸브는 각 metric에 `value: 0|1` 또는 저장된 상태 쌍의 `stateCode`를 보냅니다. LED는 `metric: "vision.ledState"`와 `colorKey`를 보냅니다. 판독에 실패하거나 이미지가 바뀌었는지 확신할 수 없으면 정상값으로 대체하지 말고 품질 오류나 미수신으로 응답합니다.

소리 듣기는 기존 `POST /projects/:projectId/equipment/:equipmentId/audio`를 사용합니다. 요청 `selection`에는 ROI의 기준좌표 변환값과 선택한 대역의 `frequencyRangeHz: [fromHz, toHz]`가 포함될 수 있습니다. 서버가 이 대역을 필터링한 음원 URL과 `measuredAt`을 반환해야 합니다. 전체 대역일 때는 `frequencyRangeHz`를 생략합니다. 브라우저 오디오의 이퀄라이저를 원본 초음파 FFT 대신 사용하지 않습니다.
