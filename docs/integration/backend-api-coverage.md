# 프론트·백엔드 API 대응표

기준: 백엔드 전달 문서 `[프론트전달] 백엔드_접속과_기능별_연동_안내.docx`와 현재 DigitalTwin 프론트 소스(2026-11-17). 이 표의 **연결**은 프론트 호출 코드가 해당 계약을 사용한다는 뜻이다. 실서버 왕복 성공을 뜻하지 않는다. [연동 흐름](backend-api-integration.md), 신규 API의 [백엔드 구현 요청](backend-viewer-asset-handoff.md)도 함께 본다.

2026-11-19 보완: 프로젝트 DELETE 프론트 요청·화면 연결을 구현했다. 서버 지원은 미확인이며 [저장·게시·삭제 통합 계약](project-save-publish-delete-handoff.md)에 신규 서버 구현 요구사항을 정의했다.

## 공통 규칙

2026-11-20: BE v1.0 전달서에서 native 자산 API 운영 반영을 보고했다. FE ZIP 자동 초안 저장·재시도·미지 키와 ROI 원문 보존 및 실제 GET/OPTIONS 결과는 [ZIP 적용 결과](zip-import-persistence-integration.md)를 따른다. 아래 신규 제안 표기는 당시 요청 이력이며 운영 ZIP 왕복 완료를 뜻하지 않는다.

| 항목 | 적용 규칙 |
| --- | --- |
| 기본 주소 | 프로젝트·운영 API: `VITE_PROJECT_API_BASE=https://checklab.co.kr/api/v1`; FE 센서 호환 API: `VITE_MONITORING_API_BASE=https://checklab.co.kr/api/fe/v1`. 전자가 비어 있고 후자가 `/api/fe/v1`로 끝나면 같은 호스트의 `/api/v1`을 사용한다. |
| JSON | `/api/v1` 성공 `{request_id,data}`, 실패 `{request_id,error:{code,message}}`에서 `data`와 오류를 읽는다. `/api/fe/v1`의 두 센서 GET은 `{sensor:...}`, `{sensorId,kind,measuredAt,url}` 직접 응답이다. |
| 식별자 | 브라우저의 로컬 프로젝트 ID는 `externalProjectId`, 서버 발급 UUID는 이후 `/projects/{id}` 경로에 사용한다. 실시간 매핑 조회의 `projectId`에는 저장된 외부 ID, `equipmentId`에는 프론트 설비 원문 ID를 보낸다. |
| 버전 | 초안 PUT은 현재 `baseRevision`과 `layout.version=18`을 보낸다. 공개 뷰어 GET은 게시본, 편집 GET은 최신 초안을 돌려받는다. 게시 전에 해당 revision을 검증한다. |
| 전송·갱신 | JSON 본문이 있을 때만 `Content-Type: application/json`을 지정한다. GET 프레임·스냅샷은 캐시를 쓰지 않는다. `/api/v1/events`는 변경 통지이므로 수신 뒤 REST를 재조회한다. |
| 접근 | 전달 문서상 사용자 로그인·권한 구현은 아직 없다. 프론트는 임의 토큰이나 권한을 만들어 넣지 않는다. 다른 출처 배포에서는 CORS와 향후 쿠키 정책을 백엔드와 함께 확인해야 한다. |

## 1. 프론트에서 백엔드 계약으로 호출하는 API

| 계약 | 프론트 진입·함수 | 상태·한계 |
| --- | --- | --- |
| `POST /api/v1/projects` | 에디터 저장 → `createBackendProject` | 연결. 서버 UUID를 로컬 ID와 분리해 보관. |
| `PUT /api/v1/projects/{id}/draft` | 에디터 저장 → `saveProjectConfiguration` | 연결. 업로드 결과의 manifest 전달 구현. NATIVE_BUNDLE은 백엔드 확장 필요. |
| `POST /api/v1/projects/{id}/validate`, `POST .../publish` | READY 저장 → `publishProjectConfiguration` | 연결. 고정 표시 검증/게시이며 운영 분석 활성화가 아니다. |
| `GET /api/v1/projects` | 프로젝트 목록 → `listProjectConfigurations` | 연결. `nextCursor`로 추가 조회. |
| `GET /api/v1/projects/{id}?mode=editor` | 이어서 편집 → `loadEditableProject` | 연결. 최신 초안과 자산 복원. 축약 목업은 전체 layout 재게시 필요. |
| `GET /api/v1/projects/{id}?mode=viewer` | 뷰어·직접 링크 → `loadViewerProjectConfiguration` | 연결. 게시본과 자산 복원. hierarchy/설비-모델 매핑이 없으면 구체적 오류 표시. |
| `GET /api/v1/display-assets/{id}`, `GET .../files/{member_id}` | `loadDisplayAsset` | 연결. 실제 목업 파일 크기·해시 검증 성공. glTF/GLB와 설비 binding 복원. |
| `GET /api/v1/equipment-mappings?projectId=...&equipmentId=...` (H51) | 뷰어 → `loadEquipmentMapping` | 연결. 미등록 404는 매핑 필요로 표시. 매핑 생성/변경 UI는 없음. |
| `GET /api/v1/enclosures/{uid}/snapshot?view_type=...` (W02) | 뷰어 → `loadEnclosureSnapshot` | 연결. 함체·슬롯·최근 관찰·활성 경고로 요약 상태를 표시. ROI별 KPI와 모델 바인딩은 아직 연결 안 됨. |
| `WSS /api/v1/events` (W03) | 뷰어 → `useViewerLiveStatus` | 연결. 함체별 SUBSCRIBE, seq 중복 배제, 알림 후 W02 재조회, 폴링 복구. 브라우저 handshake/Origin 실검증 필요. |
| `GET /api/fe/v1/sensors/by-serial` (FE01) | 센서 연결 → `lookupSensor` | 2026-11-23 최소 확인: id/serialNumber/equipmentId만 검증. 에디터는 배치 구성, 실시간 조회는 뷰어. 미소속 정상 응답·저장 시 소속 재검사·운영 CORS 보완 필요. [단일 전달 계약](../api/sensor-serial-lookup-api.md) 참고. |
| `GET /api/fe/v1/sensors/{id}/frame?kind=...` (FE02) | 영상·텍스처 → `getSensorFrame` | 연결. 서버가 주는 `/api/v1/media` 상대 경로를 백엔드 호스트로 해석. |
| `GET /api/v1/media` (W14) | FE02가 반환한 URL을 브라우저가 사용 | 간접 연결. 프레임·CSV 본문 접근과 CORS 실검증 필요. |

## 2. 프론트에 있지만 현재 백엔드 문서와 직접 맞지 않는 계약

| 프론트 경로·기능 | 현재 처리 | 맞추기 위해 필요한 작업 |
| --- | --- | --- |
| 기존 `VITE_MONITORING_API_BASE`의 `PUT /projects/{id}/bundle` · `digital-twin-project` ZIP | 새 백엔드 설정 시 버튼을 숨기고 호출을 차단. 로컬 ZIP 내보내기는 유지 | 백엔드의 표시 자산 업로드와 프로젝트 초안 저장 절차로 변환. 기존 단일 ZIP PUT은 문서에 없음. |
| `POST /api/v1/project-assets`, `GET /api/v1/project-assets/{id}/file` (신규 제안) | 원본 ZIP 업로드·해시 검증·복원 구현 | 백엔드 신규 구현 및 프로젝트 NATIVE_BUNDLE 참조 지원 필요. 이전 `/projects/{id}/assets`, `assetUploadId`는 사용하지 않음. |
| `DELETE /projects/{id}` (신규 서버 구현 요구) | 프론트 요청·확인창·서버 성공 후 로컬 정리 구현 | 통합 계약의 204/200 응답, 논리 삭제·동시성·게시본 접근 차단 정책 구현 필요. 실서버 미확인. |
| 기존 `VITE_MONITORING_API_BASE`의 `/projects/{id}/rois` 목록·저장·삭제·`/readings`·`/preview`·기준 사진 업로드 | 새 백엔드 프로젝트에서는 호출하지 않음. 로컬 ROI는 브라우저에만 남음 | 백엔드의 `slots/{slot}/rois`, `rois/{id}`, `baseline`, W02/W11 관찰을 프론트 ROI·설비 ID와 연결. 서버 ROI 삭제/미리보기/이미지 업로드는 문서상 동일 경로 없음. |
| 기존 `VITE_MONITORING_API_BASE`의 `/projects/{id}/equipment/{equipmentId}/monitoring` 및 `/events` SSE | 새 백엔드 프로젝트에서 호출 중단 | W02/W11/W12와 WSS로 설비·ROI별 데이터 모델 변환. WSS는 완전한 SSE 스냅샷이 아님. |
| 기존 `VITE_MONITORING_API_BASE`의 `/projects/{id}/sensors/{sensorId}/calibration` PUT | 새 백엔드에서는 로컬 보정 저장으로 표시 | 현재 백엔드에 센서별 calibration revision API 없음. 운영 장치 적용과 편집기 보정 저장을 구분해 계약 결정. |
| 설비별 `/audio`, `/alarms/{id}/acknowledge` | 새 FE 경로에서는 잘못된 요청을 보내지 않고 미연동 오류 표시 | W17/W18 청취 세션 및 W13 `POST /alarms/{id}/ack`에 맞는 UI·식별자 연결. |
| `/projects/{id}/viewer/live` GET/SSE (이전 프론트 제안) | 호출 제거 | 현재 W02 + WSS 방식 사용. 별도 뷰어 SSE를 백엔드에 요구하지 않음. |

## 3. 백엔드에 있으나 현재 프론트 화면과 연결되지 않은 API

아래는 전달 문서에 제공 경로가 명시된 API다. 프론트에는 이에 대응하는 완성된 요청·응답 모델과 사용자 흐름이 없다. **무조건 새 API를 요청할 항목이 아니라 프론트 연결 작업**이다.

| 영역 | 백엔드 경로 | 프론트에서 필요한 연결 |
| --- | --- | --- |
| 함체·설비 관리 | `GET /enclosures`; `POST/PUT /equipment-mappings`; `GET /sensors/by-serial` | 함체 선택, 명시적 매핑 생성/변경, 현재 센서 검증. H51 GET만 현재 사용. |
| 관측 영역·기준 | `GET/POST /slots/{slot}/rois`; `PUT /rois/{id}`; `POST /rois/{id}/baseline` | 프론트 ROI 좌표·측정 항목을 slot/ROI 원문 ID와 양방향 변환. 삭제·프리뷰의 백엔드 대응 여부는 별도 결정. |
| 임계치·센서 조작 | `GET/POST /enclosures/{uid}/thresholds`; `PUT /thresholds/{id}`; `POST /slots/{id}/configurations`; `POST /slots/{id}/swaps`; `GET /commands/{id}` | 편집 저장과 실제 장치 적용을 분리하고 접수된 명령의 완료 상태 표시. |
| 경고·관찰 이력 | `GET /enclosures/{uid}/alarms`; `GET /enclosures/{uid}/observations`; `POST /alarms/{id}/ack` | 목록/추이/확인 UI를 서버 alarm·observation ID에 연결. W02는 최근 스냅샷만 사용 중. |
| 표시 자산 생성·별도 표시 구성 | `POST /display-assets`; `POST/GET /display-configurations`; `POST /display-configurations/validate` | 기존 표시 ZIP 생성·업로드는 미연결. 표시 자산 GET/멤버 복원은 위 1절에 구현됨. 에디터 원본은 신규 원본 ZIP 계약을 사용. |
| 영상 변화 판독 | `GET/PUT /rois/{id}/change-analysis`; `GET/POST .../evaluations` | 분석 설정 버전·원본 JPEG·평가 결과를 서버 모델로 연결. |
| 레버·게이지 판독 | 각각 `GET/PUT /rois/{id}/lever-analysis` 및 `/gauge-analysis`, `GET/POST .../evaluations` | 각 판독 UI의 설정·평가·이력을 서버 응답으로 연결. WSS 통지로 평가 결과를 추정하지 않음. |
| 청취 | `POST /enclosures/{uid}/listen-sessions`; `DELETE /listen-sessions/{session_id}` | 세션 응답의 오디오 URL/명령 상태를 이용한 시작·종료. 기존 위치별 `/audio`와 본문이 다름. |

## 우선 결정할 계약

1. **자산**: [원본 ZIP 계약](backend-viewer-asset-handoff.md)의 신규 API와 프로젝트 manifest 지원을 백엔드에서 구현한다. 프론트 업로드·복원은 구현했지만, 실서버의 타 브라우저 저장·조회는 공동 검증이 필요하다.
2. **ROI/실측**: 프론트 설비·센서·ROI ID와 백엔드 enclosure/slot/ROI ID의 매핑, 측정값의 시각·품질·구성 버전을 합의한다. 연결 전에는 KPI 숫자를 실제 측정값처럼 만들지 않는다.
3. **삭제·보정·프리뷰**: 백엔드 문서에 없는 동일 기능은 새 경로를 만들지, 프론트의 기능을 로컬 전용으로 유지할지 결정한다.
4. **운영 환경**: 브라우저에서 `/api/v1/events` WSS handshake/Origin, `/api/v1/media` CORS, 프로젝트 저장→게시→조회, FE01/FE02를 실제 서버로 확인한다. 코드 검사·빌드는 이 검증을 대신하지 않는다.
