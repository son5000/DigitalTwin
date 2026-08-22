# DigitalTwin

React와 Three.js로 구현한 웹 기반 산업용 디지털 트윈 월드 에디터입니다. 부지와 건축물부터 층·공간·설비까지 하나의 상태 모델에서 구성하고, 2D와 3D 화면을 오가며 배치·편집할 수 있습니다.

## 주요 기능

- `월드 구성 → 건축물 상세 → 층별 설비 배치 → 설비 상세 설정` 4단계 Wizard
- 화면 전체를 활용하는 World View와 Object Library·Hierarchy·Settings·Detail 플로팅 패널
- 동일한 World State를 공유하는 2D Top View / 3D View 전환
- 검색·카테고리·세부 카테고리·Variant를 지원하는 데이터 기반 Object Library
- 오피스·주거·산업 건축물, 차량, 교통·도로 시설, 조경, 산업·전기 설비 등 확장형 오브젝트 카탈로그
- 지붕·외벽·창문·출입구 조합을 지원하는 건축물 Variant
- 클릭 단일 배치와 실제 Bounding Box·Scale·Rotation을 반영한 영역 다중 배치
- 배치 Preview, Grid Snap, Transform, 충돌 표시, 실행 취소·다시 실행
- 선택 객체 전용 상세 패널과 위치·회전·크기·재질·Metadata 편집
- GLB, GLTF, OBJ, PLY 형식의 상세 3D 스캔 모델 연결
- 브라우저 로컬 저장소 기반 레이아웃 저장·불러오기
- 공통 SVG 아이콘 Registry, Pretendard Typography, Neutral SaaS 컬러 시스템

## 최근 업데이트

### 2026-08-23

- 월드 편집 화면을 Canvas 중심의 Floating/Overlay UX로 개편
- 단계형 편집 흐름을 4단계로 통합하고 Stepper·단계 안내를 간소화
- 배치 후 모드를 자동 종료하고 생성된 객체를 즉시 선택하도록 개선
- Object Library를 데이터 중심 Accordion 구조로 모듈화하고 오브젝트·건축물 Variant 확장
- 실제 Footprint를 기준으로 하는 영역 다중 배치와 단일 History Action 구현
- 공통 SVG 아이콘 시스템과 객체 타입별 Registry 적용
- 네온·Glow를 제거한 Neutral 컬러 토큰과 Pretendard 전역 Typography 적용
- Grass·Tree 전용 아이콘과 전체 UI 상태 스타일 정비

## 기술 스택

- React 19
- Three.js
- Vite 8
- ESLint 10

## 시작하기

### 요구 사항

- Node.js
- npm

### 설치 및 실행

```bash
npm install
npm run dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 열어 편집기를 사용할 수 있습니다.

## 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버를 실행합니다. |
| `npm run build` | 배포용 결과물을 생성합니다. |
| `npm run lint` | ESLint로 코드를 검사합니다. |
| `npm run preview` | 빌드 결과를 로컬에서 미리 봅니다. |

## 프로젝트 구조

```text
src/
├─ components/icons/                 # 공통 SVG 아이콘과 타입 Registry
├─ features/digitalTwin/editor/
│  ├─ api/                            # 레이아웃 저장 및 불러오기
│  ├─ components/                     # 편집기 UI와 Floating Panel
│  │  └─ ObjectLibrary/               # 데이터 기반 오브젝트 선택 UI
│  ├─ constants/                      # 카탈로그, Wizard, 패널, 환경 설정
│  ├─ generators/                     # Three.js 형상 생성기
│  ├─ objects/                        # 3D 설비 객체 생성
│  ├─ store/                          # 편집기 상태와 History 관리
│  ├─ three/                          # 2D·3D 장면 및 상세 모델 렌더링
│  ├─ utils/                          # 배치·좌표·충돌·스냅 유틸리티
│  └─ world/                          # 건축물과 사이트 환경 생성 Factory
├─ App.jsx
└─ main.jsx
```

## 데이터 저장 안내

현재 레이아웃은 브라우저의 로컬 저장소에 보관됩니다. 브라우저 데이터를 삭제하거나 다른 브라우저·기기를 사용하면 저장된 레이아웃이 공유되지 않습니다. 업로드한 상세 3D 모델 파일은 현재 세션에서 사용되며 레이아웃 저장 데이터에는 파일 자체가 포함되지 않습니다.
