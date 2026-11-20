# ZIP 자동 서버 저장·재접속 적용 결과

기준일 **2026-11-20**. BE 전달서 `[프론트전달] 설정_ZIP_서버저장과_재접속_연동계약.md` v1.0(참조 FE ce2a99d)과 대조했다. BE 격리 시험과 이번 FE 검증은 별개다. 기존 상세 계약은 [통합 전달서](project-save-publish-delete-handoff.md)를 따른다.

## 적용 흐름

설정 ZIP/JSON 로컬 가져오기 → 자산 업로드 → 서버 생성 또는 명시 연결 → draft 저장 → UUID·revision 기록 → 목록 갱신을 연결했다. API 미설정이면 로컬 성공/서버 미저장을 구분한다.

- `POST /project-assets`: digital-twin-assets v2 ZIP multipart. 신규는 로컬 ID, 연결된 프로젝트는 서버 UUID를 namespace로 사용.
- `POST /projects`: name/scope/externalProjectId/clientRequestId 전송. 응답 ID·동일 externalProjectId·revision=0 검증.
- `PUT /projects/{id}/draft`: baseRevision/layout/assetManifest/clientRequestId. 가져온 layout을 재직렬화하지 않고 고정 snapshot 저장.
- 가져오기는 게시하지 않는다. 편집기에서 명시적으로 READY 저장할 때만 validate/publish를 이어간다.
- 새 브라우저에서 사용자가 서버 카드를 선택하면 editor snapshot과 해당 manifest의 자산을 조회·해시 검증·복원한다.

구현: [공용 저장](../../src/features/portal/projects/projectPersistence.js), [목록](../../src/features/portal/projects/ProjectsPage.jsx), [편집기](../../src/features/digitalTwin/editor/DigitalTwinEditorPage.jsx).

## 실패·재시도

로컬 레코드의 pendingSave에 localId/layout/serverProjectId/expectedRevision/assetManifest/createAttempted/draftAttempted/saved를 보관한다. 인증정보와 Blob은 넣지 않는다. 새로고침 후 카드의 서버 저장 재시도로 이어간다.

| 상황 | 처리 |
|---|---|
| 로컬 해독 실패 | 서버 호출 없음, 기존 데이터 유지 |
| 업로드 성공 후 실패 | 성공 manifest 재사용, 재가져오기 불필요 |
| 생성 응답 유실 | 전체 목록 페이지에서 externalProjectId가 정확히 일치하는 하나만 연결. 없거나 모호하면 재생성하지 않음 |
| 생성 성공 후 로컬 연결 실패 | 알려진 서버 UUID로 연결부터 재개 |
| draft 응답 유실·409 | editor 조회 후 revision/layout/manifest 대조. 기대 revision+1과 두 원문이 같으면 기존 성공 인정 |
| 서버 revision이 기대값과 같음 | 같은 기대 revision으로 재시도, 서버 동시성 검사 유지 |
| 다른 저장본/더 높은 revision | VERSION_CONFLICT로 중단. 기준 revision 자동 교체 없음 |
| 성공 응답 후 로컬 기록 실패 | saved 응답으로 로컬 상태만 복구 |
| 목록 갱신 실패 | 저장 성공과 별도 안내 |

새 편집 snapshot을 이전 pendingSave에 섞지 않는다. 충돌 시 ZIP 내보내기로 로컬 내용을 보관한 뒤 서버본 확인으로 원격본을 연다. 로컬/서버 ID가 다르면 원래 로컬 프로젝트는 별도 유지된다. 같은 ID의 원격 캐시는 교체되므로 먼저 ZIP을 보관한다.

H52 clientRequestId는 추적용이다. 생성/draft를 멱등 API로 간주하지 않는다. 업로드 응답 유실로 manifest를 받지 못하면 업로드 재사용을 보장하지 않는다. 자동 무한 재시도는 없다. 오류 status/code/fields/requestId를 유지한다. 미게시 viewer의 409는 동기화된 초안으로 대체하지 않는다.

## 원문·ROI 보존

편집 상태에 최초 snapshot을 유지하고 known 필드만 현재 값으로 교체한다. 최상위·observationConfig 미지 키와 null/false/0을 보존한다. known 배열은 교체하며 삭제된 항목을 과거 배열 병합으로 되살리지 않는다. objectUrl/selectedSpatialEntity/storageMode 등 명시적 임시 값 제거는 유지한다.

별도 표면 ROI는 선택형 layout.importedRois 원문 배열에 포함한다. 관측점과 동일 ID는 중복하지 않는다. 편집 저장은 현재 로컬 ROI 저장소를 반영하므로 삭제를 보존한다. editor 재조회 후 로컬 저장소에 직접 기록하며 ROI save/감시 등록 API를 호출하거나 revision·좌표·시각을 바꾸지 않는다.

**계약 상태:** importedRois는 BE 문서 8.3의 승인 대기 최소안을 FE에서 구현한 확장이다. FE 구현이 BE 공개 계약 승인을 뜻하지 않는다. BE는 기존 layout 원문 저장 경로의 선택 필드 수용·재조회 보존을 확인해야 한다. 새 테이블/API/DDL은 요구하지 않으며 원문 보존은 감시 활성화가 아니다.

구현: [serializer](../../src/features/digitalTwin/editor/api/layoutRepository.js), [ROI 원문](../../src/features/portal/projects/projectRawRois.js), [저장소](../../src/features/portal/projects/projectRepository.js).

## 한도·실접속 확인

제공 API는 https://checklab.co.kr/api/v1 이다. VITE_PROJECT_API_BASE 우선과 monitoring base 유도 규칙을 유지한다. 로컬·배포 환경변수는 임의 변경하지 않았다. native ZIP 512MiB, JSON 요청 전체 1MiB 한도를 유지한다. layout 외 manifest/baseRevision/requestId 크기도 검사한다. 804MiB 원본은 native 한도 밖이며 자동 축소·변환하지 않는다.

| 2026-11-20 읽기 전용 확인 | 결과 |
|---|---|
| GET /projects?limit=1, localhost:3000 Origin | 200, data.items 배열, 허용 Origin localhost:3000 |
| POST 사전 요청 OPTIONS /projects, localhost:3000 Origin | 204, 허용 Origin localhost:3000 |
| 같은 OPTIONS, https://digitaltwin-beige.vercel.app Origin | 204이나 허용 Origin이 localhost:3000. 배포 FE와 불일치 |

**BE 조치:** https://digitaltwin-beige.vercel.app 을 허용 목록에 포함하고 요청 Origin에 맞는 Access-Control-Allow-Origin 및 Vary: Origin을 반환한다. OPTIONS뿐 아니라 실제 JSON·ZIP·오류 응답에도 적용한다. localhost와 127.0.0.1은 별개다. FE no-cors나 임의 프록시로 우회하지 않는다.

## 검증과 인수

FE 검증 결과: 회귀 테스트 38개, 변경 파일 ESLint, Vite 프로덕션 빌드(406 모듈) 통과. 격리 브라우저의 실제 ZIP 파일 선택 → 자산 upload/create/draft → 저장 응답 유실 → 새로고침·재시도에서 각 변경 요청은 한 번만 실행됐고 게시 요청은 없었다. 로컬 저장소가 비어 있는 새 브라우저에서 서버 카드를 선택해 모델과 원문 ROI를 복원했다. 모바일 375px 가로 넘침과 페이지 오류도 없었다. 이 브라우저 시험은 격리 HTTP 응답을 사용했으며 운영 백엔드 성공을 뜻하지 않는다.

[회귀 테스트](../../tests/projectPersistence.test.js)는 고정 snapshot, checkpoint 복구, 생성 응답 유실과 ID 대조, draft 응답 유실, 충돌 방지, 로컬 기록 실패, 서버 UUID 업로드, 미지 값·배열 삭제·임시 URL 제거, 표면 ROI 원문 복원을 다룬다. 기존 모델 바이트 복원 테스트도 유지한다.

운영 ZIP 저장·새 브라우저 복원·importedRois echo는 GET/OPTIONS 성공만으로 입증되지 않는다. 작은 ZIP의 실제 upload/create/draft 성공 revision, FE Origin/commit, 새 브라우저의 같은 서버 ID 및 layout/manifest/모델/texture/ROI 대조, 충돌 검증이 필요하다. importedRois 수용과 배포 CORS를 BE와 확인해야 한다.

원본 ZIP 컨테이너 다운로드, H64 If-Match, Pi/Edge 명령은 이번 변경 범위가 아니다.
