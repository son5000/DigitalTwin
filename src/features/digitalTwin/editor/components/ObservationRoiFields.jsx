import ObservationReadout from "./ObservationReadout";
import { createId } from "../model/equipmentDetailModel";
import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";

const METRICS = { TEMPERATURE: ["온도", "°C"], "temperature.max": ["최고 온도", "°C"], "temperature.min": ["최저 온도", "°C"], "temperature.avg": ["평균 온도", "°C"], "ultrasound.db": ["초음파", "dB"], "vision.changePercent": ["영상 변화율", "%"], PRESSURE: ["압력", "Pa"], VIBRATION: ["진동", "mm/s"], NOISE: ["소음", "dB"], POWER: ["전력", "W"], FLOW: ["유량", "L/min"], VIDEO: ["영상", ""] };

export default function ObservationRoiFields({ points, selectedPoint, sensors, onSelect, onChange, onRemove, onPlace }) {
  function updateMeasurement(index, changes) {
    onChange(selectedPoint.id, { measurements: selectedPoint.measurements.map((item, i) => i === index ? { ...item, ...changes } : item) });
  }
  return <>
    <button type="button" className={styles.primaryAction} onClick={onPlace}>모델에서 관측 영역 추가</button>
    <p className={styles.help}>모델을 클릭한 뒤 구체의 위치와 크기를 맞추세요. 관측 영역은 센서가 측정할 대상입니다.</p>
    <div className={styles.itemList}>{points.map((point, index) => <button type="button" key={point.id} aria-pressed={selectedPoint?.id === point.id} onClick={() => onSelect(point.id)}><span>{index + 1}. {point.name}</span><small>표시 {point.measurements.filter((item) => item.visible).length} · 경보 {point.measurements.reduce((n, item) => n + item.rules.length, 0)}</small></button>)}</div>
    {selectedPoint && <>
      <label className={styles.field}><span>영역 이름</span><input value={selectedPoint.name} onChange={(event) => onChange(selectedPoint.id, { name: event.target.value })} /></label>
      <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField key={axis} label={`영역 ${axis.toUpperCase()} 위치`} unit="m" step={.01} value={selectedPoint.localPosition[axis]} onChange={(value) => onChange(selectedPoint.id, { localPosition: { [axis]: value } })} />)}</div>
      <NumericField label="관측 반경" unit="m" min={.01} step={.01} value={selectedPoint.radius} onChange={(radius) => onChange(selectedPoint.id, { radius })} />
      <label className={styles.field}><span>구체 불투명도 · {Math.round(selectedPoint.opacity * 100)}%</span><input type="range" min="5" max="80" value={selectedPoint.opacity * 100} onChange={(event) => onChange(selectedPoint.id, { opacity: Number(event.target.value) / 100 })} /></label>
      <p className={styles.help}>화면에는 영역 번호를 표시합니다. 선택하거나 마우스를 올리면 이름과 상태가 보입니다.</p>
      <details className={styles.settingsGroup}><summary>측정값 미리보기</summary><ObservationReadout point={selectedPoint} sensors={sensors} preview /></details>
      {selectedPoint.measurements.map((item, index) => <fieldset key={item.id} className={styles.settingsGroup}><legend>관측 항목 {index + 1}</legend>
        <label className={styles.field}><span>표시 이름</span><input value={item.name} onChange={(event) => updateMeasurement(index, { name: event.target.value })} /></label>
        <label className={styles.field}><span>측정 센서</span><select value={item.sensorId} onChange={(event) => updateMeasurement(index, { sensorId: event.target.value })}><option value="">센서 선택</option>{sensors.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.name}</option>)}</select></label>
        <label className={styles.field}><span>측정 항목</span><select value={item.metric} onChange={(event) => updateMeasurement(index, { metric: event.target.value, unit: METRICS[event.target.value][1], ...(item.name === METRICS[item.metric]?.[0] ? { name: METRICS[event.target.value][0] } : {}) })}>{Object.entries(METRICS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span>단위</span><input value={item.unit} onChange={(event) => updateMeasurement(index, { unit: event.target.value })} /></label>
        <label className={styles.check}><input type="checkbox" checked={item.visible} onChange={(event) => updateMeasurement(index, { visible: event.target.checked })} />관제 화면에 표시</label>
        {item.rules.map((rule, ruleIndex) => <div key={ruleIndex} className={styles.settingsGroup} role="group" aria-label={`경보 조건 ${ruleIndex + 1}`}>
          <div className={styles.rangeGrid}>
            <NumericField label="기준값" unit={item.unit} value={rule.threshold} onChange={(threshold) => updateMeasurement(index, { rules: item.rules.map((entry, i) => i === ruleIndex ? { ...entry, threshold } : entry) })} />
            <label className={styles.field}><span>조건</span><select value={rule.operator} onChange={(event) => updateMeasurement(index, { rules: item.rules.map((entry, i) => i === ruleIndex ? { ...entry, operator: event.target.value } : entry) })}><option value="gte">이상</option><option value="gt">초과</option><option value="lte">이하</option><option value="lt">미만</option></select></label>
            <label className={styles.field}><span>경보</span><select value={rule.severity} onChange={(event) => updateMeasurement(index, { rules: item.rules.map((entry, i) => i === ruleIndex ? { ...entry, severity: event.target.value } : entry) })}><option value="WARNING">주의</option><option value="DANGER">위험</option></select></label>
          </div><button type="button" onClick={() => updateMeasurement(index, { rules: item.rules.filter((_, i) => i !== ruleIndex) })}>조건 삭제</button>
        </div>)}
        <div className={styles.actionRow}><button type="button" onClick={() => updateMeasurement(index, { rules: [...item.rules, { threshold: 60, operator: "gte", severity: "WARNING" }] })}>경보 조건 추가</button><button type="button" onClick={() => onChange(selectedPoint.id, { measurements: selectedPoint.measurements.filter((_, i) => i !== index) })}>항목 삭제</button></div>
        <details><summary>표시 효과 미리보기</summary><NumericField label="테스트 값 · 실측 아님" value={item.previewValue ?? 0} onChange={(previewValue) => updateMeasurement(index, { previewValue })} /></details>
      </fieldset>)}
      <button type="button" onClick={() => onChange(selectedPoint.id, { measurements: [...selectedPoint.measurements, { id: createId("ROI_VALUE"), name: "온도", metric: "TEMPERATURE", unit: "°C", sensorId: sensors[0]?.id ?? "", visible: true, rules: [] }] })}>관측 항목 추가</button>
      <button type="button" onClick={() => onRemove(selectedPoint.id)}>관측 영역 삭제</button>
    </>}
  </>;
}
