# 센서 보정·관측 프론트 연동 준비

## 구현 범위

| 기능정의서 | 프론트 동작 | 백엔드·장치에서 필요한 결과 |
| --- | --- | --- |
| 1, 2 | 센서 시리얼 조회, 촬영 영상 비교, 위치·방향·화각 보정, 비전/열화상 UV 텍스처 적용 | 센서 조회, 영상, 카메라 내부 보정 정보, 모델 UV에 맞춘 텍스처 |
| 3, 4 | 표면 ROI 임시 조회·저장, 온도 최저/최고/평균 표시 선택 | ROI를 센서 측정 영역에 대응시키고 통계 계산 |
| 5 | 영상 변화율 표시 선택, 변화율 임계치 설정 | 기준 영상 및 변화율 분석 (`vision.changePercent`, %) |
| 6 | 초음파 표시 모드는 제거. 향후 표시 모드와 독립적인 실시간 표면 히트맵으로 구현 예정 | 위치별 좌표·센서 ID·값·측정 시각 |
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
6. 고객 뷰어의 `관측 데이터` 퀵 메뉴에서 모델/비전/열화상을 전환한다. 에디터에서 영상 투사를 설정한 센서의 신선한 비전 프레임 또는 유효한 비전 UV 텍스처가 있으면 기본값은 비전, 없으면 모델이다. 사용자가 명시적으로 고른 모드는 유지한다. 모델 모드에서는 센서 영상을 투사하지 않는다. 센서 위치·방향·화각·적용면은 에디터에서 설정하며, 프레임은 해당 카메라 시점에서 보이는 표면에 투사한다.
7. `예시 데이터로 기능 확인`은 명시적으로 켜야 한다. 연결 실패 시 자동으로 예시 데이터로 바꾸지 않는다. 예시 상태는 화면을 떠나면 해제된다.
8. ROI 패널에서 온도·dB·변화율을 선택한다. 저장된 ROI 규칙은 예시 모드에서만 샘플 값으로 평가한다. 지속 시간을 충족한 주의·위험 진입 시 예시 경고를 만든다. 실서비스 경고는 서버 판정만 사용한다.
9. 소리듣기의 기본 선택 방식은 `3D 표면에서 위치 선택`이다. 옵션으로 `ROI 목록에서 영역 선택`을 제공한다. 영역 요청은 같은 음원 API의 `selection`에 `{type:"ROI", roiId, revision, coordinateSpace:"EQUIPMENT_LOCAL", representation, surface, model}`을 전달한다. 서버는 영역 전체의 음원을 추출해야 하며 중심점 음원으로 대체하지 않는다. 위치·영역·처리·설비 변경 시 이전 요청과 음원은 폐기된다. 예시 음원은 합성 테스트 톤이다. 표면 선택을 시작하면 화면 중앙 위쪽에 2.5초 안내를 표시한다.

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

- `mapping: UV` 텍스처는 서버에서 만든 UV 매핑 결과를 받는다. `meshPath`는 관측 장면의 proxy/actual 모델 루트부터 child index를 `/`로 연결한 경로다. 생략하면 UV가 있는 전체 메쉬에 공통 atlas를 적용한다. glTF 등 다른 로더 추가 시 안정적인 서버 메쉬 ID 계약으로 교체하는 것이 좋다.
- 모델/표현 불일치, 오래된 프레임, GOOD이 아닌 품질은 표시하지 않는다. 프레임 URL은 변경된 영상마다 버전이 다른 URL을 제공한다. 텍스처 다운로드 실패와 UV 누락은 화면 오류로 표시한다. 한 프레임에 최대 8개 텍스처를 적용한다.
- hotspot 위치는 설비 로컬 m. 위치별 측정이 불가능한 센서에는 임의 위치를 채우지 않는다.
- `readings`는 기존 ROI 응답 계약을 사용한다. `vision.changePercent`가 추가되며 연산자는 `gte`(이상), `gt`(초과), `lt`(미만)이다. revision, 측정 시각, 품질이 맞아야 표시한다.
- 음원 `selection`은 `{coordinateSpace:"EQUIPMENT_LOCAL",representation,position:[x,y,z],equipmentId,modelVersion,model:{assetId,version}}`. 서버는 보정된 센서 위치·동기화된 원신호를 기반으로 처리해야 한다. 음원 URL은 브라우저가 재생 가능한 코덱/컨테이너로 제공한다. 프론트에서 비동기 요청 중 지점이 바뀌면 취소한다.
- 열화상 이미지만으로 ROI 온도를 추정하지 않는다. 비전 변화율·dB·음원도 서버 결과를 사용한다.

## 센서 영상의 텍스처 편집

### 설치 위치와 이미지 적용면의 분리 (schemaVersion 3)

비전 센서의 `position`, `rotation`, `surfaceMount`, 화각·종횡비·관측 거리는 월드의 장치 표시용이다. 비전 이미지 가공과 표면 배치는 이 값에 의존하지 않는다. 열화상은 기존 센서 카메라 투영을 유지한다.

`textureProjection.equipmentId`로 적용 설비를 지정한다. 도형은 `surfaceId`의 표면 프레임을 사용하며 문 개폐를 따른다. 기본은 정면이며 `imagePlane`으로 FRONT/BACK/LEFT/RIGHT/TOP/BOTTOM을 고른다. 스캔 부분을 선택하면 정합된 메시 경계와 선택면 법선에서 `surfaceMapping`을 생성해 저장한다.

**이미지 가공 JSON 내보내기**는 독립 계약 `{schemaVersion:3, projectId, sensorId, bindingId, serialNumber, imageTransform, target}`을 내보낸다. `target`은 equipmentId, model, representation, surfaceId, meshPath, meshName, enabled, opacity와 `mapping:OBJECT_SURFACE_PLANAR`, `surface`를 포함한다. `surface`는 `{space:EQUIPMENT_MODEL_LOCAL, unit:m, origin:[x,y,z], right:[x,y,z], up:[x,y,z], normal:[x,y,z], width,height}`다. origin은 적용면 왼쪽 아래, right/up은 직교 단위 벡터다. 표면 점은 `origin + right * width * u + up * height * v`로 재현한다. 월드 배치는 설비 변환을 별도로 적용하며 센서 pose/FOV를 사용하지 않는다.

3단계 패널은 센서 연결 / 설치 위치 / 이미지·텍스처로 나뉜다. 정밀 편집창은 드래그 이동·영역 자르기, 픽셀 crop(왼쪽 위 기준), 축별 크기·비율 잠금·확대, 회전·반전, 9점 기준점과 수치 입력을 제공한다. 조정 간격은 0.001~10이며 입력은 Enter/포커스 이동으로 반영한다. 보기 배율·격자는 작업 표시용으로 내보내지 않는다. 되돌리기/다시 실행은 해당 세션의 이미지 값에만 적용하고, 편집 취소/Escape는 창을 열기 전 이미지 값으로 복원한다. 적용값은 프로젝트 저장으로 보관한다.

### 샘플 영상과 재현 가능한 이미지 변환

- 센서 등록에서 **비전카메라 추가 → 샘플 불러오기**를 선택하면 `/samples/cabinet-vision.jpg`를 HTTP 요청으로 읽고 원본 크기를 확인한다. 사용자 제공 JPG 원본을 그대로 보관한다. `projectionSample: { enabled, url, width, height, loadedAt }`는 테스트 소스이며 서버 센서 ID·시리얼·연결 상태·실측 시각을 생성하거나 덮어쓰지 않는다. 샘플은 수동 해제 전까지 표시하며 실제 프레임의 신선도 검사는 그대로 유지한다. 샘플 선택 중 비전 프레임 폴링은 중단하고 해제하면 재개한다.
- `textureProjection`에 `zoom` (전체 배율), `flipX/Y`, `pivotX/Y`를 추가한다. 과거 설정은 각각 `1`, `false`, `0.5`로 복원한다. `scaleX/Y`와 `zoom`은 0.01~100, 이동은 -10~10, 회전은 -3600~3600도, 기준점은 0~1이다. crop은 원본 경계 안으로 정규화하며 최소 크기는 0.000001 UV다. 해상도를 아는 편집창은 최소 1픽셀을 사용한다.
- 기준 좌표는 **왼쪽 아래 (0,0), 오른쪽 위 (1,1)**. 양의 이동은 오른쪽/위쪽, 양의 회전은 반시계 방향이다. 이동 1은 적용면(열화상은 카메라 투영 영역)의 폭/높이 100%다. 기준점은 **잘라내기·원근 보정 후 정규화 좌표**다. 회전은 픽셀 공간이 아닌 정규화 UV 공간에서 수행하므로 적용면 폭/높이도 재현에 필요하다.
- 순서는 원본 crop → 원근 보정 → 기준점 기준 반전·축별 배율·전체 확대 → 회전 → 이동 → 표면 배치(열화상은 센서 카메라 투영)다. `c = (sourceUV - cropOrigin) / cropSize`, `h = perspective.matrix × [c.x,c.y,1]`, `q = pivot + offset + R(rotation) × diag(scaleX × zoom × signX, scaleY × zoom × signY) × (h.xy / h.z - pivot)`.
- 보정 payload 및 이미지 가공 내보내기는 `imageTransform`을 포함한다. `source`에는 소스 종류 `SAMPLE | SERVER | DEMO`, URL, 원본 width/height, 수신/실측 시각을 분리한다. 해상도를 제공하지 않으면 width/height 및 cropPixels는 null이다. 프레임 응답의 `resolution:{width,height}`가 있으면 센서 기본 해상도보다 우선한다. `parameters`는 정규화된 입력값, `effectiveScale`은 반전을 포함한 최종 축 배율이다. `cropPixels`는 **왼쪽 위 픽셀 원점**으로 환산한 원본 잘라내기 영역이다(반올림하지 않음).
- `targetUvToCropUv`, `targetUvToSourceUv`, `sourceUvToTargetUv`는 길이 9의 **행 우선(row-major)** 행렬이며 열벡터 `[u,v,1]`에 곱한다. 3D 셰이더와 미리보기는 이 행렬과 동일한 계산을 사용한다. 비전은 표면 UV/crop 밖을 버리고 선택면 법선과 내적 0.9 이상인 면에 적용한다(점군은 법선 검사 제외). 센서 시점 가림 검사는 하지 않는다. 열화상은 기존 센서 깊이 검사를 유지한다. 원본 파일은 수정하지 않는다.
- 독립 이미지 가공 payload는 모델 버전, 적용 대상/면/메시 경로와 적용면 기준을 포함한다. 센서 설치 보정 payload는 별도이며 기존 호환을 위해 이미지 가공값도 함께 포함한다. 백엔드는 이미지 행렬과 적용면 프레임, 원본 모델을 함께 사용한다. 샘플 파일 경로는 현재 웹 앱의 경로이며 백엔드 서버 파일 경로가 아니다. 실제 서버 저장 및 DB 반영은 별도 연동이다.

### 네 점 원근 보정

- `textureProjection.perspective = {enabled, source, target}`. source/target 각각 4개의 `[u,v]`이며 순서는 왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래다. 저장 UV의 Y는 위쪽으로 증가한다. 기본은 `[[0,1],[1,1],[1,0],[0,0]]`, enabled=false다. 과거 설정을 열면 원근 보정을 끈 상태로 기존 결과를 유지한다.
- source는 **잘라낸 이미지**의 UV(0~1), target은 크기·회전·이동 **이전** 보정 결과 UV(-2~3)다. 원본 네 점을 캐비넷 꼭짓점에 맞추고 target을 기본 직사각형으로 두면 사다리꼴 영역을 펼친다. target의 아래 두 점을 벌리면 사진을 눕히듯 아래쪽을 펼친다. UI의 좌표 입력은 편의를 위해 왼쪽 위 원점의 %이며 저장 시 아래쪽 원점 UV로 환산한다. ‘아래쪽 좁음’ 시작값은 자동 감지 결과가 아니다.
- 네 점은 지정 순서의 볼록 사각형이어야 한다. 교차·오목·겹침·퇴화 영역은 적용하지 않고 마지막 유효값을 유지한다. 잘못된 저장값은 원근 보정을 끈 기본값으로 복원한다. 드래그, 각 점의 X/Y 수치, 기준점 버튼의 방향키가 같은 값을 수정한다. 되돌리기·다시 실행·편집 취소·전체 초기화에 원근 보정값도 포함한다.
- `imageTransform.schemaVersion=3`. `perspective`는 입력값과 함께 `matrix`(crop UV → 보정 UV), `inverseMatrix`, `sourcePixels`(원본 왼쪽 위 원점 픽셀), `finalTargetUv`(크기·회전·이동까지 적용한 결과 네 점), 두 좌표 공간 및 점 순서를 내보낸다. 원본 해상도가 없으면 sourcePixels=null이다. 비활성 상태의 matrix/inverseMatrix는 항등행렬이다.
- 모든 3×3 행렬은 행 우선/열벡터 방식이다. **반드시 `[x,y,w] = H × [u,v,1]` 계산 후 `[x/w,y/w]`로 나눈다.** 세 번째 행을 `[0,0,1]`로 가정하면 원근 보정이 재현되지 않는다. `sourceUvToTargetUv`와 역행렬 `targetUvToSourceUv`에는 crop/원근/일반 변환을 모두 합성한다. `targetUvToRectifiedUv`와 `rectifiedUvToTargetUv`는 원근 뒤의 일반 변환만 나타낸다.
- 활성화하면 원본 사각형 바깥을 제외하고, 최종 적용면 0~1 밖도 제외한다. 미리보기는 같은 행렬을 CSS matrix3d로 환산하고 원본 사각형을 clip-path로 제한한다. 3D 셰이더는 역행렬의 동차 나눗셈과 같은 사각형 경계 검사를 사용한다. 이는 평면 원근 보정이며 곡면 복원이나 렌즈 왜곡 추정은 아니다.

설정은 센서의 `textureProjection`에 저장하며 보정 내보내기에도 포함한다. `enabled`, `kind: VISION | THERMAL`, `target: ACTUAL | PROXY | BOTH`, 도형의 `surfaceId`, 스캔의 `meshPath`로 적용 대상을 고른다. `scaleX/Y`는 영상 늘림, `offsetX/Y`는 정규화 영상 이동, `rotation`은 도 단위 회전이다. `cropX/Y/Width/Height`는 0~1 범위이며 아래쪽이 Y 원점이다. `opacity`는 0~1이다. 비전은 오브젝트 기준 평면 매핑이며 열화상만 센서 카메라를 통해 투영한다. UV 자동 보정이나 렌즈 왜곡 추정은 수행하지 않는다.

활성화한 센서는 `GET /sensors/:id/frame?kind=VISION|THERMAL`을 5초 간격으로 조회한다. 기존 monitoring SSE의 `textures`에도 아래 원본 프레임을 보낼 수 있다. 센서 ID가 일치하고 유효 시간이 남은 프레임만 표시한다. 영상 조회 실패나 오래된 프레임은 수신 대기로 바뀐다.

`{ sensorId, kind, url, measuredAt, quality: "GOOD", staleAfterMs: 15000 }`

온도 배열 응답은 URL 대신 `temperatureGrid: { width, height, values }`를 포함한다. values는 섭씨 온도의 행 우선 배열이며 첫 행이 위쪽이다. 누락 픽셀은 null로 보내면 투명하게 표시한다. 최대 1,048,576개 픽셀, 가로·세로 최대 2048을 받는다. `temperatureMin/Max`는 표시 색상 범위이며 측정값을 변경하지 않는다. 단일 온도 값을 면 전체의 온도 분포로 만들어내지 않는다. 열화상 이미지로 수치 온도를 역산하지 않는다.

캐비넷 앞문은 기존 `enclosure.doorCount/doorLayout/doors`, 뒷문은 같은 구조의 `enclosure.rear`를 사용한다. 표면 ID `door-0-inside` 등은 그대로 유지하며 뒷문은 `rear-door-0-inside` 형태다. 문 설치 시 해당 앞판·뒷판은 제외한다. 센서의 `surfaceMount`는 문 로컬 좌표를 유지하며 문 개폐와 숨김 후에도 위치·방향을 계산한다. 스캔의 개별 문은 별도 가동 부품으로 분리되지 않은 경우 전체 스캔 형상으로 유지한다.

모델 표시 조절은 현재 뷰어의 보기 상태이며 저장된 설치 구성을 덮어쓰지 않는다. 서버 이미지 제공·온도 배열 제공과 실제 카메라 보정 정확도는 현장 연동 검증이 필요하다.

## 열화상 CSV 샘플과 카메라 정합

- 3단계 **일반 센서 추가 → 측정 기능: 열화상 → 이미지·텍스처 → 열화상 CSV 샘플 불러오기**로 서버 없이 시험한다. 사용자 제공 원본 `/samples/thermal_sample.csv`는 공백 구분 640×480 행렬이며 25.25~112.70°C다. 원본 미리보기에서 픽셀을 클릭하거나 X/Y를 입력해 온도를 확인한다. 색상 범위와 `SPECTRUM | IRON | GRAY` 팔레트는 미리보기와 3D 투영에 동일하게 적용한다. 표시 범위 밖은 양 끝 색상으로 포화되며 원본 값은 유지한다.
- 일반 센서에 열화상을 처음 선택하면 기본 직사각 모형을 산업용 카메라로 전환한다. 자유 시점에서 설비를 바라본 뒤 **현재 3D 시점에 카메라 배치**를 누르면 카메라의 위치·방향을 설비 로컬 좌표로 변환하고 세로 화각을 저장한다. 센서 정면 시점에서 영상과 설비의 모서리를 비교하며 위치·방향·화각을 수동으로 맞춘다. `fieldOfView`는 세로 화각(도), 회전은 XYZ 오일러(라디안), 거리·위치는 m다. 샘플 종횡비는 4:3이다.
- 실측 치수 보조 기능은 `verticalFov = 2 atan(화면 전체 실제 높이 / (2 × 평면까지 수직 거리))`를 사용한다. 평면을 정면으로 촬영한 조건에서의 초기 추정이며, 한 장의 온도 영상만으로 실제 설치 위치·내부 파라미터를 자동 복원하지 않는다. 장치 사양과 현장 실측으로 확인한다.
- 스캔/도형/둘 모두를 대상으로 지정할 수 있다. 열화상은 센서 카메라의 절두체·근/원거리·깊이 검사로 보이는 표면에 투영하며 기존 crop·크기·회전·원근 보정과 불투명도 설정을 함께 적용한다. 픽셀 조회는 변환 전 원본 기준(왼쪽 위 (0,0), X 오른쪽, Y 아래쪽)이며 3D GL 텍스처 생성 시 행 방향을 뒤집는다.
- `thermalSample: {enabled,url,width,height,loadedAt}`는 에디터 테스트 소스다. 프로젝트에 원본 온도 배열이나 생성 PNG를 저장하지 않고 이 참조와 카메라 pose, `textureProjection.temperatureMin/Max/palette` 및 이미지 보정값을 보관한다. 다시 열면 번들에 포함된 샘플을 로드한다. 샘플은 서버 식별자·시리얼·접속 상태·실측 시각을 만들지 않으며 실제 뷰어에서는 비활성화한다. 샘플을 해제하면 서버 프레임 조회로 돌아간다.

### 서버 프레임 어댑터

열화상 투영의 근거리 기준(`near`)은 렌더링 클리핑 상한이다. 대상 표면이 더 가까우면 모델 경계에 맞춰 자동 축소하며 센서 정면 보기에도 같은 계산을 적용한다. 저장된 위치·화각·`near` 값은 변경하지 않는다. `far` 및 화각 제한은 유지한다.

스캔의 뒤집힌 정점 법선을 이유로 열화상을 제거하지 않고 양면 깊이 렌더링으로 첫 표면을 판정한다. 가림은 선형 카메라 거리와 수신 표면의 기울기를 보정해 비교하며, 스캔과 도형의 깊이 버퍼를 분리해 서로의 대체 외형이 투영을 차단하지 않도록 한다. 같은 모델 안의 실제 가림은 유지한다. 하위 메시의 위치·회전·가시성이 바뀌면 깊이 버퍼를 갱신한다.

기존 `GET /sensors/{sensorId}/frame?kind=THERMAL` JSON 응답에서 `sensorId`, `kind:THERMAL`, `measuredAt`(ISO 실측 시각), `quality:GOOD`를 제공한다. 온도 데이터는 다음 셋 중 하나를 사용한다. 현재 프론트엔드에서 지원하는 계약이며 실제 서버는 별도 구현한다.

```json
{
  "sensorId": "thermal-001",
  "kind": "THERMAL",
  "measuredAt": "2026-10-27T00:00:00.000Z",
  "quality": "GOOD",
  "temperatureCsv": "25.1,25.2\n26.0,26.4"
}
```

- `temperatureCsv`: 헤더 없는 °C 텍스트 행렬. 쉼표·공백·탭·세미콜론을 지원한다. 행 길이가 다르거나 숫자가 아닌 값이면 거부한다. 빈 CSV 셀, `null`, `NaN`은 결측 픽셀(투명)로 처리한다. 픽셀 전체가 결측이면 거부한다.
- `temperatureCsvUrl`: 위 텍스트를 내려주는 HTTP(S) 또는 같은 앱의 상대 URL. 다른 출처는 CORS 허용이 필요하다. 요청 제한 시간은 10초, 텍스트 제한은 16MB, 가로/세로 최대 2048, 전체 최대 1,048,576픽셀이다.
- `temperatureGrid: {width,height,values:[...]}`: 기존 행 우선 평탄 배열도 유지한다. 파싱된 CSV 역시 같은 형태로 변환하므로 미리보기·3D 투영 경로가 동일하다. 온도 배열의 크기를 해상도로 사용한다. 색상이 완성된 `url` 이미지 응답도 기존처럼 지원하되 수치 온도를 역산하지 않는다.

서버 프레임은 5초 간격 조회와 기존 실측 시각·품질 검사를 사용한다. 샘플은 시간 경과로 만료되지 않으며, 샘플 선택 중에는 해당 센서의 서버 폴링을 중단한다. 온도 배열·생성 텍스처는 프레임 교체 시 갱신하고 카메라·모델은 재생성하지 않는다.

## 성능·운영 경계

- 관측 데이터 갱신은 Three.js 장면/카메라를 재생성하지 않고 별도 레이어만 갱신한다. 기존 모델/설정 변경의 카메라 보존 로직을 유지한다. 텍스처·음원 object URL·SSE·타이머는 교체/종료 시 정리한다.
- 관측 패널은 현재 화면의 FPS를 약 1초 단위로 표시한다. 이는 화면 성능 확인 수단이며 모든 PC·모델에서 30fps를 보증하는 결과는 아니다. 대상 PC, 브라우저, 해상도, 모델 삼각형/텍스처/센서 수를 확정하고 측정해야 한다.
- 경고는 SSE 수신 후 즉시 UI에 반영한다. 실제 1초 이내 기준은 센서 측정 → 수집 → 판정 → 전송 → 표출 중 어느 구간인지 합의하고 통합 측정해야 한다. `durationSeconds`가 1초보다 크면 해당 조건의 의도적인 대기 시간도 구분해야 한다.
- 브라우저 종료 중 이상 감지·관제 알림은 서버 워커 책임이다. 예시 모드의 타이머는 개발 확인용이며 상시 감시가 아니다.
- 인증/운영자·고객 권한 집행, DB 공유 저장, 실제 텍스처 생성, 영상 변화 분석, 음원 합성, 외부 관제 전송은 백엔드 구현 및 현장 검증이 남아 있다.

## 설비 설정 단계와 구형 관측 영역

- 3단계는 센서 기능, 시리얼 조회, 배치·방향·화각 보정, 데이터 수신 설정을 담당한다. 4단계는 측정 대상인 관측 영역(ROI)과 그 영역의 표시 항목·경보 기준을 담당한다. 5단계는 확인만 수행한다.
- 에디터는 단계 전환 시 동일한 장면을 유지한다. detailSetup 메타데이터와 센서 시점은 모델 재생성 조건에서 제외하며, 센서 시점 복귀 시 직전 자유 카메라를 복원한다. 에디터의 중복 ROI/관측 데이터 도구는 숨긴다. 뷰어의 표면 ROI 조회 기능은 유지한다.
- 기존 observationPoints 저장 키를 유지하되 각 항목을 geometryType: SPHERE인 설비 로컬 좌표 ROI로 취급한다. localPosition, radius(m), opacity(0.05~0.8), revision을 저장하며 센서 식별자와 혼용하지 않는다.
- measurements 배열은 항목별 id, name, metric, unit, sensorId(프로젝트 내 센서 바인딩 ID), visible, rules[]를 가진다. 각 rule에는 operator(gt/gte/lt/lte), threshold, severity(WARNING/DANGER)를 저장한다. 표시 여부와 경보 조건 수는 독립적이다. 기존 단일 관측 항목은 한 개의 measurement로 복원된다.
- 실측 readings는 roiId(또는 observationPointId), equipmentId, revision, measurementId, sensorId(서버 센서 ID), value, measuredAt, quality, staleAfterMs를 포함해야 한다. 현재 영역 버전과 센서가 일치하고 신선도가 유효할 때만 표시한다. 센서 전체 latestValue를 영역별 실측값으로 대체하지 않는다. 테스트 값은 에디터에서만 테스트로 표시한다.
- 구형 ROI 구성은 프로젝트 저장 데이터에 포함된다. 서버의 영역별 집계·상시 경보 처리는 이 계약에 대한 별도 서버 지원이 필요하며, 프런트엔드 설정만으로 상시 감시가 시작되지는 않는다. DB 변경은 수행하지 않는다.

- 구형 ROI의 월드 표시는 화면 기준 24px 번호 배지다. 선택하거나 마우스를 올리면 이름·상태만 한 줄(최대 180px)로 펼친다. 확대·축소와 설비 배율에 따라 배지가 커지지 않으며, 상세 측정값은 에디터의 측정값 미리보기 또는 뷰어의 관측 영역 패널에서 확인한다. 화면 표시를 끈 항목의 경보 조건도 영역 상태에 반영한다.

## 프로젝트 ZIP 내보내기·복원

- 에디터의 `ZIP 내보내기`는 클릭 시점의 현재 설정(저장 전 변경 포함)을, 프로젝트 목록의 같은 버튼은 저장된 설정을 내보낸다. 프로젝트 목록의 `설치 구성 가져오기`에서 ZIP을 선택하면 기존 프로젝트를 유지하고 새 프로젝트를 생성한다.
- `<프로젝트명>.digital-twin.zip` 안의 `project.json`은 `format: digital-twin-project`, `version: 2`, `project`, `rois`, `assets`, `files`, `externalReferences`, `requires`를 포함한다. `project.layout` 전체를 보존하며 계층·지형·층/방·배치·커스텀 모델·정합·센서 위치/화각/연결·이미지 보정·히트맵·열화상 샘플 설정·구/평면 ROI·임계치·뷰어 프리셋을 일부 필드만 선택하여 내보내지 않는다.
- 대표 사진과 인라인 이미지도 `files/`의 실제 이미지로 분리한다. 스캔 원본과 MTL/관련 이미지, 사용자 텍스처, 커스텀 자산 의존 파일을 포함한다. JSON에는 `{ "$file": "files/00001-Scan.obj" }` 형태의 연결을 저장하고 `files[]`에 경로·원래 이름·크기·MIME을 기록한다. 자산 레코드의 원래 파일명과 상대 경로는 유지하여 OBJ/MTL 내부 참조가 복원되며, 파일명이 같아도 ZIP 경로와 자산 ID로 구분한다.
- ZIP은 대형 스캔의 CPU 부하와 base64 용량 증가를 피하기 위해 STORE 방식으로 생성한다. ZIP 및 풀린 파일 합계는 1GB, JSON은 64MB 이하이다. 원본 파일이 없거나 임시 파일 주소만 있으면 내보내기를 실패 처리한다. 외부 URL의 파일은 임의로 다운로드하지 않으며 기본 제공 리소스는 동일 버전의 앱 배포 파일에 있어야 한다.
- 가져오기는 ZIP 경로·중복·크기·CRC32와 의존 파일을 검사한 뒤 파일 저장소에 등록한다. 프로젝트와 파일 자산 ID는 새로 발급하고 관련 참조를 함께 치환한다. 원본 파일 바이트, 설비/센서/ROI ID, 좌표 및 사용자 설정은 유지한다. 기존 JSON v1도 가져올 수 있다. 파일 저장 또는 프로젝트 등록 실패 시 이번에 생성한 파일과 ROI 기록을 정리한다.
- 가져온 프로젝트는 `storageMode: LOCAL`로 저장하여 모니터링 API 주소가 있는 환경에서도 로컬 구성과 ROI를 열 수 있다. 이후 편집·저장·재내보내기에도 이 구분을 유지한다. 실제 운영 서버에 등록된 프로젝트가 되었다는 뜻은 아니다. 서버 납품 시에는 별도의 ZIP 수신 API가 JSON·파일을 서버 저장소에 영구 등록하고 권한·파일 경로·센서 연결을 관리해야 한다.

## 비전 이미지에 연결된 관측 영역

### ROI 온도 행렬 수신

`TEMPERATURE` reading은 기존 `roiId`, `equipmentId`, `revision`, `measurementId`, 서버 `sensorId`, `measuredAt`, `quality`, `staleAfterMs`와 함께 `temperatureScope: "ROI"`를 포함한다. `temperatureCsv`(헤더 없는 °C 행렬 문자열) 또는 `temperatureGrid: {width, height, values}`(행 우선 배열)를 전달한다. 백엔드는 해당 ROI에 속한 픽셀만 제공하며 영역 밖·결측 픽셀은 null로 표시한다. 카메라 전체 프레임을 ROI 행렬로 전달하지 않는다.

프런트는 유효한 픽셀의 최고·최저·평균을 모두 표시하고 온도 경보 조건을 각각 평가한다. 잘못된/빈 행렬, 다른 센서·영역·버전의 데이터, 오래된 수신값은 수신 대기로 표시한다. 서버의 공간별 픽셀 추출과 실시간 전달은 별도 백엔드 구현 사항이다.

- 생성 순서는 **관측 항목 → 영역 형태 → 월드에 배치**다. 새 항목은 TEMPERATURE(온도), ultrasound.db(초음파), vision.gaugeValue(게이지), vision.switchState(스위치 상태)다. 온도·초음파는 복수 선택 가능하며 게이지·스위치는 활성 비전 텍스처의 평면에서 단독 선택한다. 이전 파일의 측정 설정은 보존하되 새 선택지에서는 제공하지 않는다.
- `observationPoints[].imageBinding`은 원본 이미지에 대한 고정 참조다. `sensorId`는 프런트 센서 바인딩 ID이고, `sourceRect`의 `x/y/width/height`는 **가공 전 원본 이미지, 왼쪽 위 원점, 0~1 정규 좌표**다. 월드 좌표는 고정 기준이 아니다. 이미지 확대·이동·회전·반전·원근 보정과 부착면 이동 시 매번 계산한다.
- `imageBinding.originalImage`에는 원본 파일의 `textureAssetId`, 파일명, 폭·높이(px), 카메라 바인딩/서버 ID·시리얼, 원본 URL, 촬영 및 보관 시간을 기록한다. 이미지를 등록할 때 원본 바이트를 IndexedDB 파일 자산에 보관한다. ZIP은 이를 `assets.textures`와 `files/`에 포함한다. JSON에 이미지 바이트를 넣지 않는다. ZIP 가져오기는 파일 ID와 모든 연결 참조를 함께 바꾼다.
- `imageAnalysis.schemaVersion: 2`, `imageTransform.schemaVersion: 4`는 공개 이미지 좌표를 왼쪽 위 원점, X 오른쪽/Y 아래 기준으로 기록한다. 원본/가공 영역에 정규·픽셀 좌표, 경계 상자, 네 변 길이, 면적을 저장한다. 꼭짓점은 원본 좌상→우상→우하→좌하 대응 순서를 유지한다. stages에는 자르기→원근 보정→피벗/반전/배율/줌/회전/이동의 정·역행렬을 기록하며 sourceToProcessed, processedToSource 및 픽셀 변환 행렬을 제공한다. 행 우선 행렬에 열 벡터를 곱하고 xy/w를 적용한다. 가공 픽셀은 원본 해상도와 같은 참조 격자 기준이며 실제 렌더링 해상도가 아니다. world.vertices는 설비 모델 로컬 m 좌표다. 렌더러 내부 및 복원용 textureProjection UV 규약은 유지하고, 백엔드는 schema 4 계약을 사용한다. 한 자리 소수점 표시는 UI에만 적용하며 저장 수치는 반올림하지 않는다.
- 예: 1920×1080 원본의 sourceRect {x:0.45,y:0.45,width:0.1,height:0.1}은 [[864,486],[1056,486],[1056,594],[864,594]] 픽셀 경계 좌표다. 백엔드는 원본 범위를 분석하고 가공 변환을 다시 적용하지 않는다. 픽셀 중심은 (열+0.5, 행+0.5)이며 원본 사각형의 좌상 포함/우하 제외 규칙으로 선택한다. 월드 이동은 역변환으로 원본 sourceRect에 기록하며 표시 범위를 벗어난 이동은 취소한다.
- ROI 저장 API의 JSON과 프로젝트 ZIP에 `imageBinding`/`imageAnalysis`를 포함한다. `roiToReferencePayload`가 설비 기준좌표를 적용하더라도 원본/가공 이미지 좌표는 변하지 않으며 `imageAnalysis.world.space`는 계속 `EQUIPMENT_MODEL_LOCAL`이다. 영상 변경 이벤트는 기존 `roiId`, `revision`, `measurementId`, 서버 `sensorId` 계약으로 연결한다.
- 카메라가 제거되거나 텍스처가 꺼진 경우, 자르기로 ROI가 이미지 밖으로 나간 경우에는 해당 ROI를 월드에 표시하지 않고 재설정 안내를 제공한다. 예전 게이지·스위치 ROI는 자동으로 임의 카메라에 연결하지 않는다. 비전 이미지에 다시 연결해야 설정 완료 처리가 가능하다.
- **서버 연동 경계:** 로컬 `textureAssetId`만으로 서버가 파일을 읽을 수는 없다. 납품 ZIP 등록 API에서 `assets.textures[].id → 서버 파일 키`를 등록하고 원본 파일을 보관해야 한다. 공동 저장 API를 사용하는 경우에도 동일 자산 등록 과정이 선행되어야 한다. 본 변경은 프런트 저장·내보내기 및 전달 데이터 계약을 구현하며 서버 파일 업로드 API나 영상 분석 엔진을 추가하지 않는다.
- 브라우저의 임시 선택/패널 열림/카메라 조작 상태, 편집 이력, 실측 데이터 스트림 및 API 인증 설정은 프로젝트 설정 파일의 대상이 아니다. 저장한 최초 카메라·조명·환경 등 뷰어 프리셋은 포함한다. 샘플 수치와 실제 서버 수신값은 구분하며 뷰어의 샘플 비활성화 동작은 유지한다.
