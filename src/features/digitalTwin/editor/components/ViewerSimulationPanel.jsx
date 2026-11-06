import { useState } from "react";
import { LED_COLORS } from "../model/observationProfiles.js";
import { isObservationRoi, roiToObservationPoint } from "../model/roiMonitoring.js";
import styles from "./ViewerSimulationPanel.module.css";

export default function ViewerSimulationPanel({ simulation }) {
  const [expanded, setExpanded] = useState(false);
  const target = simulation.scoped.find((roi) => roi.id === simulation.targetId);
  const measurements = target && isObservationRoi(target) ? roiToObservationPoint(target).measurements : [];
  const hasVision = measurements.some((item) => item.metric?.startsWith("vision."));
  return <aside className={styles.dock} data-camera-safe-ui="left" aria-label="개발자 데이터 테스트">
    <button type="button" className={styles.trigger} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>데이터 테스트 <span>{simulation.active ? "사용 중" : "꺼짐"}</span></button>
    {expanded && <div className={styles.panel}>
      <header><div><strong>개발자 데이터 테스트</strong><small>이 화면에서만 표시 · 서버 전송 없음</small></div><button type="button" aria-label="데이터 테스트 닫기" onClick={() => setExpanded(false)}>닫기</button></header>
      <label className={styles.switch}><input type="checkbox" checked={simulation.active} onChange={(event) => { simulation.setActive(event.target.checked); if (event.target.checked) simulation.inject(); else simulation.clear(); }} />목데이터 사용</label>
      {simulation.active && <div className={styles.content}>
        <label>관측 영역<select value={simulation.targetId} onChange={(event) => simulation.setSelectedRoiId(event.target.value)} disabled={!simulation.scoped.length}>
          {!simulation.scoped.length && <option value="">저장된 영역 없음</option>}
          {simulation.scoped.map((roi) => <option key={roi.id} value={roi.id}>{roi.name}</option>)}
        </select></label>
        {!simulation.scoped.length && <p className={styles.note}>관측 영역을 저장하면 이 위치의 초음파, 온도, 판정 결과와 월드 히트맵을 함께 시험할 수 있습니다.</p>}
        {!simulation.projectedThermalCount && <p className={styles.note}>월드의 열화상 텍스쳐를 보려면 에디터에서 열화상 카메라의 텍스쳐 투영을 먼저 설정하세요.</p>}
        <div className={styles.fields}>
          <label>초음파 <span>dB</span><input type="number" min="0" max="140" step="1" value={simulation.levelDb} onChange={(event) => simulation.setLevelDb(Number(event.target.value))} /></label>
          <label>평균 온도 <span>℃</span><input type="number" min="-40" max="250" step="0.5" value={simulation.averageTemperature} onChange={(event) => simulation.setAverageTemperature(Number(event.target.value))} /></label>
          <label>주파수 피크 <span>Hz</span><input type="number" min="0" max="100000" step="500" value={simulation.peakHz} onChange={(event) => simulation.setPeakHz(Number(event.target.value))} /></label>
          {hasVision && <label>게이지 값<input type="number" step="1" value={simulation.gaugeValue} onChange={(event) => simulation.setGaugeValue(Number(event.target.value))} /></label>}
        </div>
        {measurements.some((item) => ["vision.switchState", "vision.valveState"].includes(item.metric)) && <label className={styles.switch}><input type="checkbox" checked={simulation.alternateState} onChange={(event) => simulation.setAlternateState(event.target.checked)} />기준 사진과 다른 상태</label>}
        {measurements.some((item) => item.metric === "vision.ledState") && <label>LED 색상<select value={simulation.ledColor} onChange={(event) => simulation.setLedColor(event.target.value)}>{LED_COLORS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}</select></label>}
        <p className={styles.note}>영역의 판정은 에디터에서 저장한 임계치와 상태 기준을 따릅니다.</p>
        <div className={styles.actions}><button type="button" className={styles.primary} onClick={simulation.inject}>새 데이터 주입</button><label className={styles.switch}><input type="checkbox" checked={simulation.automatic} onChange={(event) => simulation.setAutomatic(event.target.checked)} />3초마다 갱신</label></div>
        <div className={styles.actions}><button type="button" onClick={() => simulation.triggerAlarm("WARNING")}>주의 경고</button><button type="button" onClick={() => simulation.triggerAlarm("DANGER")}>이상 경고</button><button type="button" onClick={simulation.clear}>수신 중단</button></div>
        <output role="status">{simulation.pulse.measuredAt ? `마지막 주입 ${new Date(simulation.pulse.measuredAt).toLocaleTimeString("ko-KR")}` : "수신된 테스트 데이터 없음"}</output>
      </div>}
    </div>}
  </aside>;
}
