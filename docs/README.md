# 문서 안내

정리 기준일: **2026-11-18**. 기존 문서 27개를 주제별로 분류했다. 이 파일은 각 문서의 용도와 읽는 순서를 안내하는 전체 목록이다.

## 먼저 볼 문서

| 하고 싶은 일 | 읽는 순서 |
|---|---|
| 에디터의 모든 설정을 백엔드에 저장·복원하기 | [전체 JSON·DB 계약](viewer/viewer-json-database-contract.md) → `viewer/fields/`의 세부 필드 → [DB 스키마](viewer/schema/viewer-configuration-schema.sql) |
| 프론트와 백엔드의 연결 상태·부족한 API 확인하기 | [API 대응 현황](integration/backend-api-coverage.md) → [연동 설정](integration/backend-api-integration.md) → `api/`의 해당 기능 |
| 프로젝트가 열리지 않거나 모델 파일이 복원되지 않는 이유 확인하기 | [뷰어·자산 전달 사항](integration/backend-viewer-asset-handoff.md) → [뷰어 조회 API](api/project-viewer-api.md) → [파일 API](api/project-asset-api.md) |
| 센서·영상 보정·ROI·실시간 관제 구현하기 | [관제 공통 계약](monitoring/frontend-monitoring-contract.md) → 측정 항목·ROI·좌표계 문서 → [실시간 뷰어 API](api/project-viewer-live-api.md) |
| 실제 JSON 경로와 DB 컬럼을 프로그램으로 조회하기 | [필드 색인 JSON](viewer/data/viewer-json-field-index.json), [템플릿 카탈로그](viewer/data/viewer-template-catalog.json), [직렬화 예제](viewer/examples/viewer-layout-example.json) |

**일반 에디터 저장은 구성 JSON 저장이다.** 전체 프로젝트 ZIP 내보내기·가져오기와 원본 자산 파일의 내부 전송 방식은 별도 기능이다. 해당 구분은 전체 JSON·DB 계약과 프로젝트 번들 문서에서 설명한다.

## 폴더 분류

| 폴더 | 내용 | 문서 수 |
|---|---|---:|
| `integration/` | 현재 연동 상황, 차이점, 백엔드 전달 사항 | 3 |
| `api/` | 프로젝트 기능별 요청·응답 계약 | 7 |
| `monitoring/` | 센서·영상·ROI의 도메인 계약 | 4 |
| `viewer/` | 구성 저장·복원과 프로젝트 번들의 전체 설계 | 2 |
| `viewer/fields/` | 분야별 세부 JSON 필드 사전 | 5 |
| `viewer/schema/` | DB 테이블·컬럼·제약조건 제안 | 1 |
| `viewer/data/` | 기계가 읽는 필드 색인과 기본값 카탈로그 | 2 |
| `viewer/examples/` | 실제 serializer로 만든 예제 JSON | 1 |
| `archive/2026-10/` | 이전 설계의 검토 기록 | 2 |

아래에서 **수동 관리**는 사람이 소스·계약을 검토해 수정하는 문서, **자동 생성**은 생성 스크립트의 산출물, **이전 설계**는 참고용 기록을 뜻한다. 문서에 적힌 구현 제안과 실제 서버 지원 여부는 구분해야 한다. 각 문서의 기준일·확인 범위를 확인한다.

## 전체 파일 목록과 용도

### 연동 현황 — `integration/`

| 파일 | 정의하는 내용 / 언제 보는가 | 관리 |
|---|---|---|
| [backend-api-coverage.md](integration/backend-api-coverage.md) | 프론트 호출과 백엔드 API의 대응 관계, 미연결·누락·협의 항목. 전체 구현 범위를 점검할 때 본다. | 수동 관리 |
| [backend-api-integration.md](integration/backend-api-integration.md) | API 주소·환경 설정, 응답 처리, 연결 방식과 제한. 로컬/배포 환경의 연동을 설정할 때 본다. | 수동 관리 |
| [backend-viewer-asset-handoff.md](integration/backend-viewer-asset-handoff.md) | 목업 프로젝트의 구성 부족, 표시 자산·원본 파일의 저장/다운로드/복원 요구사항과 제안 API. 백엔드 개발자에게 전달한다. | 수동 관리 |

### 프로젝트 API — `api/`

| 파일 | 정의하는 내용 / 언제 보는가 | 관리 |
|---|---|---|
| [project-list-api.md](api/project-list-api.md) | 프로젝트 목록 조회, 목록 행의 필드와 페이지 처리. 목록 화면을 연결할 때 본다. | 수동 관리 |
| [project-configuration-api.md](api/project-configuration-api.md) | 프로젝트 생성, 구성 초안 저장, 검증, 발행과 리비전 처리. 에디터의 저장 흐름을 구현할 때 본다. | 수동 관리 |
| [project-edit-api.md](api/project-edit-api.md) | 기존 프로젝트를 편집기로 다시 열기 위한 조회·초안 복원 계약. 재편집 기능을 연결할 때 본다. | 수동 관리 |
| [project-viewer-api.md](api/project-viewer-api.md) | 발행된 뷰어 구성과 `assetManifest`의 조회·응답. 뷰어 진입과 복원을 구현할 때 본다. | 수동 관리 |
| [project-delete-api.md](api/project-delete-api.md) | 프로젝트 삭제 요청과 응답·오류 처리. 목록의 삭제 기능을 연결할 때 본다. | 수동 관리 |
| [project-asset-api.md](api/project-asset-api.md) | 프로젝트 자산 업로드·다운로드와 표시 자산 형식. 모델·텍스처 파일을 서버와 주고받을 때 본다. | 수동 관리 |
| [project-viewer-live-api.md](api/project-viewer-live-api.md) | W02 스냅샷, WSS 알림, REST 재조회로 관제 값을 갱신하는 흐름. 실시간 뷰어를 연결할 때 본다. | 수동 관리 |

### 관제 도메인 — `monitoring/`

| 파일 | 정의하는 내용 / 언제 보는가 | 관리 |
|---|---|---|
| [frontend-monitoring-contract.md](monitoring/frontend-monitoring-contract.md) | 프론트 관제의 공통 계약, 센서 조회·보정·영상 투영 및 데이터 구조. 관제 연동의 전체 흐름을 확인한다. | 수동 관리 |
| [observation-profile-contract.md](monitoring/observation-profile-contract.md) | 일반·초음파·온도·계기·스위치·LED·밸브 등의 측정 항목별 설정과 실시간 응답. 측정 종류별 처리에 사용한다. | 수동 관리 |
| [roi-monitoring-contract.md](monitoring/roi-monitoring-contract.md) | ROI 형상·표면·판정 규칙, 저장·미리보기·실시간 API와 미구현 요구사항. 영역 기반 관제를 구현할 때 본다. | 수동 관리 |
| [equipment-coordinate-frame.md](monitoring/equipment-coordinate-frame.md) | 설비 좌표계의 원점·축·단위·회전·버전, 센서/ROI 변환과 문 슬롯. 프론트·백엔드의 공간 좌표를 맞출 때 본다. | 수동 관리 |

### 뷰어 전체 설계 — `viewer/`

| 파일 | 정의하는 내용 / 언제 보는가 | 관리 |
|---|---|---|
| [viewer-json-database-contract.md](viewer/viewer-json-database-contract.md) | 현재 `layout.version=18`의 전체 JSON 저장 계약. 최상위 항목, 중첩 값의 DB 자리, 저장·검증·발행·복원, 보존/제외 규칙을 설명하는 기준 문서다. | 수동 관리 |
| [project-bundle-and-scan-runtime.md](viewer/project-bundle-and-scan-runtime.md) | 전체 프로젝트 내보내기/가져오기 번들, 서버 자산 전송과의 차이, 다중 스캔 파일의 의존성과 로딩·렌더링 수명. 파일 복원 흐름을 이해할 때 본다. | 수동 관리 |

### 세부 필드 사전 — `viewer/fields/`

각 사전은 JSON 경로, 자료형, 프론트의 생성·정규화 식, 저장 위치와 근거 소스를 제공한다. 필드 하나의 **정확한 행 키·DB 컬럼 내부 JSON Pointer**는 필드 색인 JSON에서 확인한다.

| 파일 | 정의하는 내용 | 관리 |
|---|---|---|
| [viewer-json-spatial-fields.md](viewer/fields/viewer-json-spatial-fields.md) | 최상위 구성, 공간 계층, 부지·지형·격자·도로·이동, 방·층·평면도·구조물. | 자동 생성 |
| [viewer-json-equipment-fields.md](viewer/fields/viewer-json-equipment-fields.md) | 설비의 치수·메타데이터·재질·부품·캐비넷·문·기준좌표와 뷰어 조명·카메라. | 자동 생성 |
| [viewer-json-monitoring-fields.md](viewer/fields/viewer-json-monitoring-fields.md) | 자산 연결, 센서, 보정·영상 변환, ROI·측정·분석·임계치와 서버 바인딩. | 자동 생성 |
| [viewer-json-assets-fields.md](viewer/fields/viewer-json-assets-fields.md) | 파일 레코드·manifest와 사용자 정의 설비/건물의 포트·블록·연결부·층·그룹. | 자동 생성 |
| [viewer-json-local-fields.md](viewer/fields/viewer-json-local-fields.md) | layout과 별도로 저장되는 ROI·운영 자산·담당자·정비·보고서·알림·개인 설정. 현재 서버 전송 값과 별도 제안을 구분한다. | 자동 생성 |

### DB·기계용 색인·예제 — `viewer/schema/`, `viewer/data/`, `viewer/examples/`

| 파일 | 정의하는 내용 / 주의점 | 관리 |
|---|---|---|
| [viewer-configuration-schema.sql](viewer/schema/viewer-configuration-schema.sql) | PostgreSQL 테이블 24개의 컬럼·자료형·키·제약조건. 구성 원본·리비전·자산·검색용 복제·별도 서비스 저장소를 제안한다. **운영 DB에 적용된 마이그레이션이 아니다.** | 수동 관리 |
| [viewer-json-field-index.json](viewer/data/viewer-json-field-index.json) | 모든 수록 경로의 자료형, 판정 식, 근거 소스, DB 컬럼·행 키·JSON Pointer, 검색용 복제 위치, 소스 해시. 프로그램으로 필드/DB 매핑을 조회할 때 사용한다. | 자동 생성 |
| [viewer-template-catalog.json](viewer/data/viewer-template-catalog.json) | 실제 프론트의 설비·부지·건축·구조물 템플릿별 기본값과 재질·선택지. 템플릿마다 달라지는 `parameters` 등을 해석할 때 사용한다. | 자동 생성 |
| [viewer-layout-example.json](viewer/examples/viewer-layout-example.json) | 현재 생성기와 serializer로 만든 구성 예제. 비기본값의 보존도 확인한다. 전체 선택 기능을 모두 포함한 샘플이나 서버 발행 검증의 증명은 아니다. | 스크립트로 생성, 명시적으로 갱신 |

### 이전 설계 — `archive/2026-10/`

| 파일 | 정의하는 내용 / 주의점 | 관리 |
|---|---|---|
| [frontend-configuration-database-design.md](archive/2026-10/frontend-configuration-database-design.md) | 2026-10-22에 백엔드 설계 자료와 프론트를 비교한 초기 DB 설계 기록. 현재 구현 시에는 `viewer/`의 최신 전체 계약을 우선한다. | 이전 설계 |
| [frontend-configuration-database-design.html](archive/2026-10/frontend-configuration-database-design.html) | 같은 초기 설계의 브라우저 열람·인쇄용 HTML. 현재 SQL 스키마의 설명 파일로 사용하지 않는다. | 이전 설계 |

## 문서끼리 역할이 겹쳐 보일 때

- `integration/`은 **연동 현황과 차이**, `api/`는 **요청·응답**, `monitoring/`은 **관제 도메인의 의미와 규칙**을 설명한다.
- 뷰어 전체 계약은 **무엇을 어디에 저장하는지**, 필드 사전은 **개별 값의 의미·형태**, SQL은 **DB의 테이블·컬럼·제약조건**을 정의한다.
- 필드 색인 JSON은 사전의 기계 판독용 매핑이고, 템플릿 카탈로그는 종류별 기본값이다. 예제 JSON은 이 구조로 직렬화한 한 프로젝트다.
- 현재 구성의 저장·복원과 DB 매핑은 `viewer/viewer-json-database-contract.md`를 먼저 본다. `archive/`는 설계 변경의 배경을 남긴 기록이다. 백엔드가 이미 구현했다는 근거로 사용하지 않는다.

## 생성 문서 갱신과 검증

저장소 루트에서 실행한다. 필드 사전과 색인은 프론트 소스 및 [보충 필드 명세](../scripts/viewer-contract-spec.mjs)를 입력으로 생성한다. 생성된 파일을 직접 수정하면 다음 생성 때 덮어쓰인다.

```sh
# 필드 사전 5개와 필드 색인 갱신
node scripts/generate-viewer-field-reference.mjs
# 템플릿 카탈로그 갱신
node scripts/generate-viewer-template-catalog.mjs
# 예제 JSON을 의도적으로 다시 만들 때만 실행
node scripts/audit-viewer-contract.mjs --write-example

# 현재 문서를 변경하지 않고 검사
node scripts/audit-docs.mjs
node scripts/generate-viewer-field-reference.mjs --check
node scripts/generate-viewer-template-catalog.mjs --check
node scripts/audit-viewer-contract.mjs
```

`audit-docs.mjs`는 인코딩·JSON 구문·문서 목록 누락·로컬 파일 링크를 검사한다. 외부 웹 주소의 응답, SQL 실행, 실제 백엔드 동작은 이 검사에 포함하지 않는다. `audit-viewer-contract.mjs`는 필드/테이블 매핑과 소스 해시, 실제 직렬화 예제를 확인한다.

## 인코딩과 문서 추가 규칙

- `.md`, `.sql`, `.html`은 **UTF-8 BOM**, `.json`은 **BOM 없는 UTF-8**로 저장한다. 줄바꿈은 LF다. [`.editorconfig`](.editorconfig)는 편집기의 저장 형식을 지정하고, [`.gitattributes`](.gitattributes)는 Git 체크아웃 시에도 LF를 유지한다.
- Windows에서 한글이 깨져 보이면 편집기의 **인코딩으로 다시 열기 → UTF-8**을 사용한다. PowerShell로 확인할 때는 `Get-Content -Encoding utf8 <경로>`를 사용한다. 잘못 해석된 화면 상태로 다시 저장하지 않는다.
- SQL의 영문 테이블·컬럼·enum 이름은 실제 식별자다. 설명은 한글 주석으로 제공하며 식별자를 번역하지 않는다.
- 새 문서는 해당 주제 폴더에 넣고 이 목록에 용도를 추가한다. 생성 문서의 위치를 바꾸면 생성/검증 스크립트와 문서 간 링크도 함께 수정한다.
- 오래된 설계는 `archive/<기준 연월>/`로 이동하고, 현재 기준 문서로 가는 링크를 남긴다.
