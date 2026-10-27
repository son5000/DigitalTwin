# 설비·공간 뷰어와 ROI 연동

센서 보정, 비전·열화상 텍스처, 영상 변화율, 위치별 음원, 실시간 경고 계약은 [frontend-monitoring-contract.md](frontend-monitoring-contract.md)를 함께 참조합니다. ROI의 새 측정 항목은 `vision.changePercent`(%), 조건 연산자는 `gte`(이상), `gt`(초과), `lt`(미만)입니다. 관측 뷰어는 설비별 SSE 스냅샷의 ROI 판정을 우선하며, 아래 3초 조회는 기존 ROI 저장소의 조회 계약입니다. 예시 모드는 별도 활성화한 동안만 샘플 규칙을 평가합니다.

## 구현된 동작

- 운영자 에디터의 설비 상세 3D 화면과 고객 뷰어에 `ROI 조회·설정`을 제공합니다.
- 표면을 드래그하거나 두 모서리를 클릭하면 화면상의 사각형을 설비 메시로 투영합니다. 설비 밖이나 표면이 없는 곳을 포함한 사각형은 저장하지 않습니다. Esc는 지정을 취소합니다.
- 새 ROI는 표면 한 곳을 클릭해 배치하는 구체입니다. 패널의 +/−로 반경을 조절합니다. 좌표는 설비 로컬 좌표(m)이며 `surface: { type: "SPHERE", coordinateSpace: "EQUIPMENT_LOCAL", representation, center: [x,y,z], radius, model? }`로 전달합니다. 기존 9×9 표면 샘플 ROI도 조회·저장을 지원합니다.
- 구체의 항목별 `measurements`(센서 바인딩, 표시 여부, 경보 조건), `opacity`, `revision`은 에디터와 뷰어가 공유합니다. 로컬 저장 시 프로젝트의 `observationPoints`와 `observationConfig.observationPoints`에 동일하게 반영하며, 별도 ROI 저장소에는 기존 표면 ROI만 보관합니다. 프로젝트 내보내기·가져오기도 이 구성을 유지합니다.
- 서버 연결 시 `/rois` API는 구체와 기존 표면 ROI를 함께 지원해야 합니다. 구체를 프로젝트의 관측 영역 구성으로도 반환하고, 항목별 측정값은 `frontend-monitoring-contract.md`의 `measurementId` 계약을 따릅니다. 브라우저에서 서버 DB를 변경하거나 이 동기화를 대신 구현하지 않습니다.
- 임시 ROI는 저장 없이 조회하고 닫을 수 있습니다. 저장된 ROI는 표시 항목, 감시 여부, 항목별 초과/미만 기준, 주의/위험, 지속 시간을 설정합니다. 표시 항목과 감시 조건은 독립입니다.
- 상태는 서버가 전달한 판정을 사용합니다. 현재 프론트는 실제 경보를 생성·전송하지 않습니다. 미수신, 품질 불량, 오래된 측정값, 설정 버전 불일치는 정상으로 표시하지 않습니다.
- 모델은 원래 색상을 유지하며 ROI 윤곽선과 목록에 상태를 표시합니다. 목록을 눌렀을 때만 설비/ROI로 이동합니다.
- `?project=<id>`는 공간/프로젝트, `?project=<id>&equipment=<id>`는 개별 설비 상세로 진입합니다. 링크는 접근 권한을 부여하는 토큰이 아닙니다.

## 실행 환경

`VITE_MONITORING_API_BASE=/api/digital-twin`을 설정하고 빌드하면 아래 API를 사용합니다. 내부망과 인터넷 환경 모두 같은 계약을 사용하며, 웹 서버에서 같은 출처의 API로 프록시하는 구성을 권장합니다. 요청은 same-origin 세션 쿠키를 사용합니다. CSRF 방어와 인증·프로젝트별 권한 확인은 서버가 담당해야 합니다.

환경변수가 없으면 기존 프로젝트와 ROI를 브라우저에 저장하는 제작/확인 모드입니다. 이 모드는 다른 PC와 공유하지 않으며 상시 감시도 수행하지 않습니다. 서버 오류가 발생했을 때 로컬 저장으로 자동 전환하지 않습니다.

프로젝트 목록의 `구성 내보내기`는 저장된 공간/설비/센서 구성, ROI, 참조하는 커스텀 모델, 업로드한 OBJ·PLY 및 동반 파일, 텍스처를 JSON 패키지로 만듭니다. `구성 가져오기`는 기존 프로젝트/자산을 덮어쓰지 않습니다. 업로드 첨부 합계 100MB, 구성 파일 150MB 제한이 있습니다. 상대 경로의 기본 제공 자산은 동일 버전의 `dist/`에 포함됩니다. 외부 URL은 `externalReferences`로 명시하며 자동으로 다운로드하지 않습니다. 임시 object URL만 있는 파일은 정식 등록한 후 내보내야 합니다.

이 구성 파일은 설치 프로그램이 아닙니다. 고객 사이트에는 `dist/`를 웹 서버에 설치하고, 서버가 패키지의 프로젝트·자산·ROI를 읽어 제공하도록 이관해야 합니다. 브라우저 가져오기는 제작/검토용입니다. 서버 연결 모드의 뷰어는 브라우저 프로젝트가 아니라 `GET /projects/:id` 결과를 읽습니다. 실제 설치에서는 서버가 업로드 자산을 파일로 풀고 `sourceType: URL` 및 현장용 `sourceKey/relatedSourceKey/textureSourceKey`로 변환하거나 자산 제공 계층을 구현해야 합니다. 커스텀 모델/사용자 텍스처의 공용 자산 로딩도 서버 연동 대상입니다. 현재 계정 로그인, 고객 계정 할당, 서버 자산 이관, 감시 워커, 관제 알림 수신처는 아직 구현되지 않았습니다.

## API 제안 (백엔드 합의 필요)

모든 경로는 API base 하위이며 JSON을 사용합니다.

| 메서드·경로 | 응답 / 의미 |
| --- | --- |
| GET `/projects/:projectId` | `{ project: { id, layout } }`, 권한 있는 고객에게 제공할 전체 구성 |
| GET `/sensors/by-serial?serialNumber=...&equipmentId=...` | `{ sensor: { id, serialNumber, equipmentId, serverKey } }`, 운영자만 조회·연결 |
| GET `/projects/:projectId/rois` | `{ rois: Roi[] }`, 프로젝트 공동 설정 |
| PUT `/projects/:projectId/rois/:roiId` | ROI 전체 본문, `If-Match: revision`; `{ roi: 저장된 ROI }`, 서버가 revision 증가 |
| DELETE `/projects/:projectId/rois/:roiId` | `If-Match: revision`; 성공 204, 감시도 중지 |
| POST `/projects/:projectId/rois/preview` | 임시 ROI 본문; `{ reading }`, 저장·감시 등록 없이 측정만 수행 |
| GET `/projects/:projectId/rois/readings` | `{ readings: Reading[] }`, 최근 측정/서버 판정; 현재 3초 주기 조회 |

신규 ROI의 revision은 0입니다. 변경 충돌은 409 또는 412, 로그인/권한 오류는 401/403을 반환합니다. 서버는 클라이언트가 보낸 projectId, equipmentId, ROI 소유권을 검증하고 계정에서 고객 범위를 판별해야 합니다. 고객은 ROI와 임계치만 수정할 수 있고, 모델/센서/설비 소속 수정은 운영자에게만 허용해야 합니다. URL이나 프론트 버튼 숨김은 권한 검사가 아닙니다.

```json
{
  "id": "ROI_example",
  "equipmentId": "equipment-1",
  "name": "모터 베어링",
  "revision": 1,
  "surface": {
    "coordinateSpace": "EQUIPMENT_LOCAL",
    "representation": "ACTUAL",
    "vertices": [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
    "triangles": [0, 1, 2, 0, 2, 3],
    "outline": [0, 1, 2, 3]
  },
  "displayMetrics": ["temperature.max", "temperature.min", "ultrasound.db"],
  "monitoringEnabled": true,
  "rules": [{ "metric": "temperature.max", "operator": "gt", "threshold": 80, "severity": "DANGER", "durationSeconds": 5 }]
}
```

예시 수치는 운영 기준이 아닙니다. 온도 단위는 ℃, 초음파는 dB입니다. 메트릭 키는 `temperature.max`, `temperature.min`, `temperature.avg`, `ultrasound.db`, `vision.changePercent`입니다. 현재 UI는 ROI별 측정·감시를 지원하며 설비 전체 전용 임계치 편집은 별도 구현 대상입니다.

```json
{
  "roiId": "ROI_example",
  "equipmentId": "equipment-1",
  "revision": 1,
  "measuredAt": "2026-10-14T01:00:00.000Z",
  "staleAfterMs": 15000,
  "quality": "GOOD",
  "values": { "temperature.max": 83.2, "temperature.min": 48.1, "temperature.avg": 61.4, "ultrasound.db": null },
  "status": "DANGER",
  "alarm": { "id": "alarm-1", "ruleIndex": 0, "startedAt": "2026-10-14T01:00:00.000Z" }
}
```

값이 없으면 null/미제공으로 표현하고 0으로 대체하지 않습니다. `quality`는 유효할 때만 GOOD을 반환합니다. `measuredAt`은 측정 시각이며 응답 시각으로 덮어쓰지 않습니다. 센서 전체 latestValue를 모든 ROI 값으로 복사하지 않습니다. 초음파 센서가 위치별 측정을 제공하지 않으면 ROI별 dB는 미제공으로 처리합니다.

## 센서·서버 책임

- 센서 시리얼과 서버 센서 ID는 고유하며 센서 하나는 설비 하나에만 소속됩니다. 한 설비는 여러 센서를 가집니다. 기존 로컬 배치 ID는 유지하고 서버 ID는 `serverSensorId`, 시리얼은 `serialNumber`, 기존 서버 조회 키는 `serverKey`로 구분합니다.
- 운영자는 센서의 실제 위치·방향·보정값과 센서 데이터의 공간 대응을 구축해야 합니다. 표면 좌표를 열화상 픽셀/초음파 공간 좌표로 변환하는 것은 센서와 백엔드 계약입니다. PROXY와 ACTUAL ROI는 서로 다른 모델 표현이므로 변환 없이 혼용하지 않습니다. 모델 교체·크기·정합값 변경 시 기존 ROI를 재검증해야 합니다.
- 서버 워커는 저장된 감시 ROI를 상시 평가합니다. 브라우저 연결, 탭 수, 페이지 조회 주기와 독립적으로 실행해야 합니다. 지속 시간은 측정 시각 기준으로 평가하고 연결 단절/품질 불량 시 정상으로 판정하지 않습니다.
- 알림은 정상 값마다 보내지 않고 주의·위험 진입/단계 상승 등 의미 있는 변화에 생성합니다. 중복 방지키, 사건 ID, 설비·ROI·항목·값·임계치·발생 시각을 저장하고 관제 연계 어댑터로 전달합니다. 수신처/확인/재알림 정책은 이후 합의 대상입니다.
- DB 영향: 고객-프로젝트 접근권한, 센서 소속/시리얼 unique, ROI의 표면/표시/규칙/revision, 시계열 측정값, 경보 사건 및 전송 상태 보관이 필요합니다. 이 작업에서는 SQL이나 마이그레이션을 적용하지 않았습니다.

## 확인 범위

### 평면 ROI와 초음파 히트맵 표시 설정

- 에디터 관측 영역은 `geometryType: SPHERE | PLANE`을 저장합니다. 평면은 중심, 가로·세로(m), 법선, 면내 회전(rad)으로 편집하며 API 변환 시 `surface.type: PLANE`, `center`, `width`, `height`, 네 `vertices`, `outline: [0,1,2,3]`, `triangles: [0,1,2,0,2,3]`를 보냅니다. 기준좌표가 있으면 중심과 꼭짓점 모두 같은 기준으로 변환됩니다. 원래 구체와 기존 표면 다각형 형식도 계속 지원합니다.
- 평면의 `measurements[].sensorId`는 기존 센서 배치 ID입니다. 백엔드에서 프로젝트의 `sensorBindings`를 통해 `serverSensorId`와 카메라 보정값을 찾습니다. `vision.gaugeValue`와 `vision.switchState`는 평면 영역의 측정 항목이며 스위치 값 계약은 0=OFF, 1=ON입니다. 네 3D 꼭짓점은 영상 픽셀 좌표가 아닙니다. 카메라 내·외부 보정 및 왜곡 보정으로 영상 사각형에 투영하고, 화면 밖/카메라 뒤 영역은 서버에서 거절해야 합니다. 픽셀 좌표를 프론트에서 추정하지 않습니다.
- 기존 ROI 저장/미리보기 API가 평면 payload를 사용합니다. API 미설정 시 로컬 저장만 동작합니다. 서버도 `PLANE` 형식 지원이 필요하며 실제 영상 분석기는 별도 백엔드 책임입니다.
- 센서별 `heatmap`은 `radius`(표시 반경 m), `palette`(SPECTRUM/EMBER/VIRIDIS), `style`(SOFT/BANDS/RINGS), `opacity`, `falloff`를 프로젝트에 저장합니다. `preview`, `position`, `normal`, `equipmentId`는 에디터 샘플 배치용이며 측정 데이터·경보·보정 요청으로 전송하지 않습니다. 샘플은 선택 센서의 센서 설정 단계에만 표시합니다.
- 실제 `hotspots`는 기존 freshness/모델 버전/표현/기준좌표 검사를 통과해야 합니다. `bindingId` 또는 서버 `sensorId`로 센서 표시 설정을 찾고, `position: [x,y,z]`에 적용합니다. 선택적 `normal: [nx,ny,nz]`은 위치와 같은 기준좌표의 표면 법선이며 기준좌표의 회전만 적용합니다. 법선 미제공 시 저장된 표시 방향을 사용합니다. 센서를 찾지 못하면 기본 디자인과 수신 `radius`를 사용합니다.
- 히트맵은 표면 방향의 평면 마커입니다. 색은 중심에서 외곽으로의 표시 효과이며 실제 dB 분포나 곡면의 소음 전파 범위를 계산하지 않습니다. 실제 측정값, 발생 위치, 법선과 영상 판독 결과는 백엔드에서 제공해야 합니다.

프론트의 ROI 작성·설정·저장, 링크, 내보내기/가져오기와 서버 연동 코드를 확인합니다. 실제 센서 공간 매핑, 고객 인증, 여러 PC 공동 사용, 뷰어 종료 중 서버 감시, 관제 알림 전달은 위 백엔드 구현과 현장 검증이 필요합니다.
