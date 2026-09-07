import { useEffect, useState } from "react";
import { ArrowRightIcon, ListViewIcon } from "@/components/icons/actionIcons";
import { View3DIcon } from "@/components/icons/toolbarIcons";
import { assetStatuses, demoAssets, portalContent } from "../portalContent";
import styles from "./LandingPage.module.css";

const workflowSteps = [
  { title: "부지", description: "전체 운영 상태와 건축물 분포", image: "/portal/workflow-site.svg", alt: "부지 경계 안에 배치된 생산동과 연결 도로" },
  { title: "건축물 · 층", description: "공간별 핵심 지표와 이벤트 밀도", image: "/portal/workflow-building.svg", alt: "건축물을 층별로 펼쳐 보여 주는 공간 계층도" },
  { title: "설비 · 센서", description: "개별 상태와 최근 측정값", image: "/portal/workflow-sensors.svg", alt: "설비에 연결된 온도와 진동 센서의 측정값" },
];

function useRotatingItems(count) {
  const [selection, setSelection] = useState({ index: 0 });
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => setSelection({ index: (selection.index + 1) % count }), 4000);
    return () => window.clearTimeout(timer);
  }, [count, paused, reducedMotion, selection]);

  return {
    activeIndex: selection.index,
    select: (index) => setSelection({ index }),
    paused,
    reducedMotion,
    togglePaused: () => setPaused((value) => !value),
  };
}

function RotationControl({ rotation, label }) {
  if (rotation.reducedMotion) return null;
  return <button type="button" className={styles.rotationControl} onClick={rotation.togglePaused} aria-label={`${label} 자동 전환 ${rotation.paused ? "재생" : "일시정지"}`}>
    {rotation.paused ? "자동 전환 재생" : "자동 전환 일시정지"}
  </button>;
}

export function Hero({ onLogin, onScroll }) {
  return <section className={styles.hero}>
    <div className={styles.heroCopy}>
      <div className={styles.eyebrow}><i />산업 현장을 위한 관측 플랫폼</div>
      <h1>보이는 현장을 넘어,<br /><span>예측하는</span> 현장으로.</h1>
      <p>부지·건축물·설비·센서 데이터를 하나의 3D 월드로 연결해, 운영팀이 더 빠르고 정확하게 판단하도록 돕습니다.</p>
      <div className={styles.heroActions}><button className={styles.darkButton} onClick={onLogin}>시작하기 <ArrowRightIcon size={17} /></button><a href="#workflow" className={styles.linkButton} onClick={(event) => onScroll(event, "workflow")}>서비스 둘러보기 <ArrowRightIcon size={15} /></a></div>
      <div className={styles.heroMeta}>{portalContent.metrics.map((metric) => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>
      <small className={styles.exampleNote}>화면과 수치는 서비스 이해를 위한 예시입니다.</small>
    </div>
    <div className={styles.heroVisual}>
      <div className={styles.heroFrame}>
        <img src={portalContent.landingHeroImage} alt="부지에서 설비와 센서까지 연결된 산업용 디지털 트윈 월드" width="2560" height="1440" fetchPriority="high" />
        <div className={styles.glassTop}><span>월드 미리보기</span><b>{portalContent.project}</b><small>관측 데이터 예시</small></div>
        <div className={styles.glassBottom}><span>● 정상 운영</span><strong>{portalContent.operationRate}</strong><small>설비 가동률</small></div>
        <div className={styles.crosshair} aria-hidden="true" />
      </div>
      <div className={styles.caption}><span>01 / 04</span><b>부지에서 센서까지, 하나의 맥락으로</b><i /></div>
    </div>
  </section>;
}

export function Capabilities({ onScroll }) {
  return <section id="capabilities" className={styles.capabilities}>
    <div className={styles.eyebrow}>Check Guard를 선택하는 이유</div>
    <div className={styles.sectionHeading}><h2>보이는 데이터는<br /><em>움직이는 운영</em>이 됩니다.</h2><p>분산된 시스템의 신호를 공간의 맥락으로 바꾸면, 문제를 발견하는 시간을 넘어 다음 행동까지 설계할 수 있습니다.</p></div>
    <div className={styles.cards}>
      <article className={`${styles.card} ${styles.blueCard}`}><span className={styles.index}>01</span><View3DIcon size={28} /><h3>공간 맥락화</h3><p>현장 구조와 설비 계층을 3D 월드에 정렬합니다.</p><a href="#workflow" onClick={(event) => onScroll(event, "workflow")}>월드 구조 보기 <ArrowRightIcon size={15} /></a></article>
      <article className={styles.card}><span className={styles.index}>02</span><ListViewIcon size={28} /><h3>상태 한눈에 보기</h3><p>센서 상태, 핵심 지표, 이벤트를 같은 시선 안에 배치합니다.</p><a href="#workflow" onClick={(event) => onScroll(event, "workflow")}>관측 흐름 보기 <ArrowRightIcon size={15} /></a></article>
      <article className={`${styles.card} ${styles.eventCard}`}>
        <div className={styles.eventHeader}><span>이벤트 흐름 / 03</span><b>최근 이벤트</b></div>
        {[...demoAssets].reverse().map((asset) => <div key={asset.id} className={styles.event} style={{ "--status-color": assetStatuses[asset.status].color }}><i /><div><b>{asset.name}</b><small>{asset.event}</small></div><em>{assetStatuses[asset.status].label}</em></div>)}
        <h3>다음 행동으로 연결</h3><p>이상 징후에서 상세 정보와 조치 이력까지 바로 이동합니다.</p>
      </article>
    </div>
  </section>;
}

export function Workflow() {
  const rotation = useRotatingItems(workflowSteps.length);
  return <section id="workflow" className={styles.workflow}>
    <div className={styles.workflowCopy}><div className={styles.eyebrow}>월드 탐색 흐름</div><h2>확대할수록<br /><em>선명해지는 현장</em></h2><p>부지 전체의 흐름에서 개별 센서의 값까지, 운영자가 필요한 깊이로 자연스럽게 확대합니다.</p>
      <ol>{workflowSteps.map((step, index) => <li key={step.title}>
        <button type="button" className={styles.workflowItem} aria-pressed={rotation.activeIndex === index} aria-controls="workflow-blueprint" onClick={() => rotation.select(index)}>
          <span>0{index + 1}</span><span><b>{step.title}</b><small>{step.description}</small></span>
        </button>
      </li>)}</ol>
      <RotationControl rotation={rotation} label="월드 탐색" />
    </div>
    <div id="workflow-blueprint" className={styles.blueprint}>
      {workflowSteps.map((step, index) => <figure key={step.title} className={`${styles.workflowSlide} ${rotation.activeIndex === index ? styles.visibleSlide : ""}`} aria-hidden={rotation.activeIndex !== index}>
        <img src={step.image} alt={step.alt} width="800" height="480" />
        <figcaption><b>{step.title}</b><span>0{index + 1} / 03</span></figcaption>
      </figure>)}
    </div>
  </section>;
}

export function Trust() {
  const rotation = useRotatingItems(portalContent.trust.length);
  return <section id="trust" className={styles.trust}>
    <div><div className={styles.eyebrow}>운영팀을 위한 설계</div><h2>운영팀의 판단을<br /><em>방해하지 않는 화면</em></h2></div>
    <div>
      <div className={styles.trustItems}>{portalContent.trust.map((item, index) => <button type="button" key={item.title} className={styles.trustItem} aria-pressed={rotation.activeIndex === index} onClick={() => rotation.select(index)}>
        <b>{item.title}<small>0{index + 1} / 03</small></b><span className={styles.trustDescription}>{item.description}<em>{item.example}</em></span>
      </button>)}</div>
      <RotationControl rotation={rotation} label="운영팀 설계" />
    </div>
  </section>;
}
