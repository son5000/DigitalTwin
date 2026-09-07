// 임시 브랜드, 프로젝트와 모든 관측 예시 데이터는 이 파일에서 변경합니다.
export const portalContent = {
  brand: "ARCLINE",
  brandSubtitle: "디지털 트윈",
  project: "창원 스마트 팩토리",
  customer: "한빛모터스",
  operator: "김",
  heroImage: "/portal/digital-twin-hero.jpg",
  landingHeroImage: "/portal/digital-twin-hero-light.png",
  sampleTime: "2026. 09. 07 · 14:32:18",
  demoEmail: "dev",
  demoPassword: "123",
  metrics: [
    { value: "24/7", label: "상시 관측" },
    { value: "99.98%", label: "데이터 가용성" },
    { value: "1,240+", label: "연결 센서" },
  ],
  operationRate: "98.4%",
  trust: [
    { title: "빠른 인지", description: "상태·영향도·위치를 같은 문장으로 읽습니다.", example: "정상 216 · 주의 29 · 위험 3" },
    { title: "안전한 확장", description: "작은 설비부터 복합 부지까지 같은 언어를 사용합니다.", example: "설비 248개 · 구역 12개" },
    { title: "명확한 다음 단계", description: "이벤트에서 상세 패널과 조치 이력으로 이어집니다.", example: "평균 확인 시간 01:42" },
  ],
};

export const assetStatuses = {
  normal: { label: "정상", color: "#48d493" },
  warning: { label: "주의", color: "#f4b759" },
  danger: { label: "위험", color: "#f06767" },
};

export const demoAssets = [
  { id: "production-a", name: "생산동 A", location: "생산동 A · 1층", floor: "1층", status: "normal", summary: "모든 센서가 정상 범위에서 작동하고 있습니다.", event: "26.3°C · 정상 범위", vibration: 1.8, temperature: 26.3, utilization: 98.4, change: "안정적", inspected: "09. 02", sensorPrefix: "01", position: { left: "43%", top: "49%" }, trend: [1.7, 1.8, 1.6, 1.9, 1.8, 1.7, 1.9, 1.8], history: "9월 2일 정기 점검 완료. 이상 없음." },
  { id: "hvac-02", name: "공조 설비 02", location: "생산동 A · 2층 · 공조", floor: "2층", status: "warning", summary: "최근 10분간 진동 값이 기준보다 12.4% 높습니다.", event: "진동 +12.4% · 8분 전", vibration: 4.8, temperature: 26.3, utilization: 92.4, change: "12.4% 상승", inspected: "08. 28", sensorPrefix: "02", position: { left: "63%", top: "32%" }, trend: [1.8, 2.4, 2.1, 3.6, 2.9, 3.8, 3.4, 4.8], history: "8월 28일 정기 점검 완료. 진동 추이를 확인해 주세요." },
  { id: "compressor", name: "압축기 라인", location: "생산동 B · 1층 · 압축기", floor: "1층", status: "danger", summary: "진동 값이 위험 기준을 초과했습니다. 현장 점검이 필요합니다.", event: "진동 6.2 mm/s · 2분 전", vibration: 6.2, temperature: 38.7, utilization: 78.1, change: "28.6% 상승", inspected: "08. 25", sensorPrefix: "03", position: { left: "66%", top: "66%" }, trend: [2.7, 3.1, 3.8, 3.4, 4.6, 4.2, 5.5, 6.2], history: "8월 25일 정기 점검 완료. 담당자의 추가 확인이 필요합니다." },
];
