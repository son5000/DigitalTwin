import { useState } from "react";
import { LED_COLORS } from "../model/observationProfiles.js";
import { isObservationRoi, roiToObservationPoint } from "../model/roiMonitoring.js";
import styles from "./ViewerSimulationPanel.module.css";

const STATUS_LABELS = { NORMAL: "정상", WARNING: "주의", DANGER: "이상", IDLE: "경보 기준 없음", EMPTY: "판정 대기" };

export default function ViewerSimulationPanel({ simulation }) {
  const [expanded, setExpanded] = useState(false);
  const target = simulation.scoped.find((roi) => roi.id === simulation.targetId);
  const measurements = target && isObservationRoi(target) ? roiToObservationPoint(target).measurements : [];
  const visionTargets = simulation.scoped.filter((roi) => isObservationRoi(roi)
    && roiToObservationPoint(roi).measurements.some((item) => item.metric?.startsWith("vision.")));
  const hasVision = measurements.some((item) => item.metric?.startsWith("vision."));
  const manual = simulation.pattern === "MANUAL";
  const manualEmpty = manual && !simulation.manualZoneIds.length;
  return <aside className={styles.dock} data-camera-safe-ui="left" aria-label="관제 시뮬레이션">
    {!expanded && <button type="button" className={styles.trigger} aria-expanded="false" onClick={() => setExpanded(true)}>
      관제 시뮬레이션 <span>{simulation.active ? simulation.automatic ? "자동 재생" : "실행 중" : "꺼짐"}</span>
    </button>}
    {expanded && <div className={styles.panel}>
      <header><div><strong>관제 시뮬레이션</strong><small>현재 화면에만 적용되며 저장되지 않습니다.</small></div>
        <button type="button" aria-label="관제 시뮬레이션 닫기" onClick={() => setExpanded(false)}>닫기</button></header>
      <label className={styles.switch}><input type="checkbox" checked={simulation.active}
        onChange={(event) => { simulation.setActive(event.target.checked); if (event.target.checked) simulation.inject(); else simulation.clear(); }} />시뮬레이션 사용</label>
      {simulation.active && <div className={styles.content}>
        <section className={styles.scenario} aria-label="초음파 신호">
          <label>발생 패턴<select value={simulation.pattern} onChange={(event) => {
            simulation.setPattern(event.target.value);
            if (event.target.value === "MANUAL" && !simulation.manualZoneIds.length) simulation.setAutomatic(false);
          }}>
            <option value="1">한 곳씩 순환</option><option value="2">두 곳 동시 순환</option>
            <option value="3">세 곳 동시 순환</option><option value="ALL">전체 동시 발생</option>
            <option value="MANUAL">직접 선택</option>
          </select></label>
          <div className={styles.zoneHeading}><strong>발생 구역</strong></div>
          <div className={styles.zoneList}>
            {simulation.zoneStatuses.map((zone) => <div key={zone.id} className={styles.zoneGroup}>
              <label className={styles.zone} data-active={zone.active} data-level={zone.state}>
              {manual ? <input type="checkbox" checked={simulation.manualZoneIds.includes(zone.id)}
                onChange={(event) => {
                  if (!event.target.checked && simulation.manualZoneIds.length === 1) simulation.setAutomatic(false);
                  simulation.setManualZoneIds((current) => event.target.checked
                    ? [...current, zone.id] : current.filter((id) => id !== zone.id));
                }} />
                : <span className={styles.signalDot} aria-hidden="true" />}
              <span className={styles.zoneName}><strong>{zone.label}</strong>{zone.roiIds.length > 0 && <small>관측 영역 {zone.roiIds.length}개</small>}</span>
              <span className={styles.zoneReading}><strong>{zone.active ? `${zone.levelDb?.toFixed(1) ?? simulation.levelDb} dB` : "대기"}</strong>
                {zone.active && zone.roiIds.length > 0 && <small>{STATUS_LABELS[zone.state]}</small>}</span>
              </label>
              {zone.assessments.length > 1 && <ul className={styles.roiStatuses}>{zone.assessments.map((item) => <li key={item.roiId} data-level={item.state}>
                <span>{item.name}</span><span>{Number.isFinite(item.value) ? `${item.value.toFixed(1)} dB` : "—"} · {STATUS_LABELS[item.state]}</span>
              </li>)}</ul>}
            </div>)}
          </div>
          {manualEmpty && <p className={styles.note}>발생 구역을 하나 이상 선택하세요.</p>}
          {!simulation.zoneStatuses.some((zone) => zone.roiIds.length) && <p className={styles.note}>관측 영역을 등록하면 경보 기준에 따른 상태도 표시됩니다.</p>}
        </section>
        <div className={styles.fields}>
          <label>초음파 세기<span>dB</span><input type="number" min="0" max="140" step="1" value={simulation.levelDb} onChange={(event) => simulation.setLevelDb(Number(event.target.value))} /></label>
          <label>주요 주파수<span>Hz</span><input type="number" min="0" max="48000" step="500" value={simulation.peakHz} onChange={(event) => simulation.setPeakHz(Number(event.target.value))} /></label>
          {!simulation.thermalCameras.length && <label>평균 온도<span>°C</span><input type="number" min="-40" max="250" step="0.5" value={simulation.averageTemperature} onChange={(event) => simulation.setAverageTemperature(Number(event.target.value))} /></label>}
        </div>
        {simulation.thermalCameras.length > 0 && <section className={styles.thermalGroup} aria-label="열화상 카메라">
          <div className={styles.zoneHeading}><strong>열화상 카메라</strong><small>{simulation.thermalCameras.length}대</small></div>
          <div className={styles.thermalList}>{simulation.thermalCameras.map((camera) => <div key={camera.id} className={styles.thermalCamera}>
            <div className={styles.thermalIdentity}><strong title={camera.identifier}>{camera.name}</strong>{!camera.projectionEnabled && <small>월드 표시 미설정</small>}</div>
            <label>평균 온도 <span>°C</span><input type="number" min="-40" max="250" step="0.5"
              defaultValue={camera.averageTemperature} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim() === "" ? NaN : Number(event.currentTarget.value);
                if (!Number.isFinite(value)) { event.currentTarget.value = String(camera.averageTemperature); return; }
                const limited = Math.max(-40, Math.min(250, value));
                event.currentTarget.value = String(limited);
                if (limited !== camera.averageTemperature) simulation.setCameraTemperature(camera.id, limited);
              }} /></label>
            <small className={styles.thermalRange}>최저 {camera.summary?.min.toFixed(1) ?? "—"} · 최고 {camera.summary?.max.toFixed(1) ?? "—"} °C</small>
          </div>)}</div>
        </section>}
        <div className={styles.actions}><button type="button" className={styles.primary} disabled={manualEmpty} onClick={simulation.inject}>신호 1회 표시</button>
          <label className={styles.switch}><input type="checkbox" checked={simulation.automatic} disabled={manualEmpty}
            onChange={(event) => simulation.setAutomatic(event.target.checked)} />자동 재생</label></div>
        <p className={styles.note}>자동 재생 중에는 1.5초마다 신호가 켜지고 꺼집니다.</p>
        {visionTargets.length > 0 && <label>영상 판독 영역<select value={visionTargets.some((roi) => roi.id === simulation.targetId) ? simulation.targetId : ""}
          onChange={(event) => simulation.setSelectedRoiId(event.target.value)}>
          <option value="" disabled>영역 선택</option>
          {visionTargets.map((roi) => <option key={roi.id} value={roi.id}>{roi.name}</option>)}
        </select></label>}
        {hasVision && <div className={styles.fields}>
          {measurements.some((item) => item.metric === "vision.gaugeValue") && <label>게이지 표시값<input type="number" step="1" value={simulation.gaugeValue} onChange={(event) => simulation.setGaugeValue(Number(event.target.value))} /></label>}
          {measurements.some((item) => ["vision.switchState", "vision.valveState"].includes(item.metric)) && <label className={styles.switch}><input type="checkbox" checked={simulation.alternateState} onChange={(event) => simulation.setAlternateState(event.target.checked)} />기준 상태와 다르게 표시</label>}
          {measurements.some((item) => item.metric === "vision.ledState") && <label>LED 색상<select value={simulation.ledColor} onChange={(event) => simulation.setLedColor(event.target.value)}>{LED_COLORS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}</select></label>}
        </div>}
        <div className={styles.actions}><button type="button" onClick={() => simulation.triggerAlarm("WARNING")}>주의 알림 표시</button>
          <button type="button" onClick={() => simulation.triggerAlarm("DANGER")}>이상 알림 표시</button>
          <button type="button" onClick={simulation.clear}>표시 지우기</button></div>
      </div>}
    </div>}
  </aside>;
}
