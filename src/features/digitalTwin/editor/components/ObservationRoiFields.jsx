import ObservationReadout from "./ObservationReadout";
import { createId } from "../model/equipmentDetailModel";
import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";
import { clampRoiRadius } from "../model/roiMonitoring.js";
import { getEquipmentCoordinateFrame, modelToReference, referenceToModel } from "../model/equipmentCoordinateFrame.js";
import { observationPlane } from "../model/observationGeometry.js";
import ObservationMetricChoices from "./ObservationMetricChoices.jsx";
import { OBSERVATION_METRICS as METRICS } from "../model/observationMetrics.js";
import ObservationCreationFields from "./ObservationCreationFields.jsx";
import ObservationProfileFields from "./ObservationProfileFields.jsx";
import ImageObservationFields from "./ImageObservationFields.jsx";
import { hasImageObservation } from "../model/imageObservation.js";
import { bindObservationMeasurements, observationTextureKind, thermalObservationIssue } from "../model/observationSource.js";
import { gaugeAngleForValue, gaugeValueForAngle, withGaugeRuleAngles } from "../model/observationProfiles.js";

const OPERATORS = { gte: "이상", gt: "초과", lte: "이하", lt: "미만" };

export default function ObservationRoiFields({ equipment, points = [], selectedPoint, sensors = [], onSelect, onChange, onRemove, onPlace, onCaptureReference, captureBusy = false, compact = false, allowPositionEdit = false, virtualCameraOnly = false }) {
  const frame = getEquipmentCoordinateFrame(equipment);
  const position = selectedPoint ? modelToReference(selectedPoint.localPosition, frame) : null;
  const image = hasImageObservation(selectedPoint);
  const textureKind = observationTextureKind(selectedPoint?.measurements);
  const thermalIssue = selectedPoint && thermalObservationIssue(selectedPoint, equipment, sensors);
  function updateMeasurement(index, changes) {
    onChange(selectedPoint.id, { measurements: selectedPoint.measurements.map((item, i) => i === index ? withGaugeRuleAngles({ ...item, ...changes }) : item) });
  }
  function selectMeasurements(metrics) {
    const measurements = metrics.map((metric) => selectedPoint.measurements.find((m)=>m.metric===metric)
      ?? { id:createId("ROI_VALUE"), name:METRICS[metric][0], metric, unit:METRICS[metric][1], sensorId:"", visible:true, rules:[] });
    const nextKind = observationTextureKind(measurements);
    const bindings = { imageBinding: nextKind === "VISION" ? selectedPoint.imageBinding : null,
      thermalBinding: nextKind === "THERMAL" ? selectedPoint.thermalBinding : null };
    onChange(selectedPoint.id, { measurements: bindObservationMeasurements(measurements, bindings), ...bindings,
      ...(nextKind !== "VISION" ? { imageAnalysis:null } : { geometryType:"PLANE" }) });
  }
  return <div className={styles.roiEditor}>
    {!compact && (onSelect || onPlace) && <section className={styles.settingsGroup} aria-label="관측 영역 선택" data-setup-field="roi-add">
      <div className={styles.sectionHeading}><strong>{virtualCameraOnly ? "등록된 관측 영역" : "관측 영역"}</strong><span>{points.length}개</span></div>
      <label className={styles.field}><span>{virtualCameraOnly ? "영역 선택" : "편집할 영역"}</span><select value={selectedPoint?.id ?? ""} onChange={(event) => onSelect(event.target.value)}>
        <option value="" disabled>{points.length ? "영역을 선택하세요" : "등록된 영역이 없습니다"}</option>
        {points.map((point, index) => <option key={point.id} value={point.id}>{index + 1}. {point.name} · 항목 {point.measurements.length}개</option>)}
      </select></label>
      {onPlace && <details open={!points.length || undefined}><summary>새 관측 영역 추가</summary><ObservationCreationFields equipment={equipment} sensors={sensors} onPlace={onPlace} /></details>}
    </section>}
    {selectedPoint && <div key={selectedPoint.id} className={styles.roiEditor}>
      <section className={styles.settingsGroup} aria-label="관측 항목 선택" data-setup-field="roi-measurements">
        <strong>{virtualCameraOnly ? "관측 항목" : "1. 관측할 항목"}</strong>
        {virtualCameraOnly ? <p className={styles.help}>{selectedPoint.measurements.map((item) => METRICS[item.metric]?.[0] ?? item.metric).join(" · ") || "관측 항목 없음"}</p>
          : <ObservationMetricChoices values={selectedPoint.measurements.map((item)=>item.metric)} onChange={selectMeasurements} />}
      </section>
      <section className={styles.settingsGroup} aria-label="영역 이름과 크기">
        <div className={styles.sectionHeading}><strong>{virtualCameraOnly ? "영역 정보" : "2. 영역 이름·크기"}</strong></div>
        <label className={styles.field} data-setup-field="roi-name"><span>영역 이름 · 필수</span><input required value={selectedPoint.name} onChange={(event) => onChange(selectedPoint.id, { name: event.target.value })} /></label>
        {selectedPoint.virtualCameraRegion && <details className={styles.transformDetails}><summary>사진에서 지정한 위치</summary>
          <p className={styles.help}>{virtualCameraOnly ? "사진의 왼쪽 위를 기준으로 영역의 위치와 크기를 기록합니다." : "사진의 왼쪽 위를 기준으로 위치를 기록합니다. 3D 화면에서 옮기면 사진과의 연결이 해제됩니다."}</p>
          {selectedPoint.virtualCameraRegion.rect && <p className={styles.help}>왼쪽 {Math.round(selectedPoint.virtualCameraRegion.rect.x * 1000) / 10}% · 위 {Math.round(selectedPoint.virtualCameraRegion.rect.y * 1000) / 10}% · 가로 {Math.round(selectedPoint.virtualCameraRegion.rect.width * 1000) / 10}% · 세로 {Math.round(selectedPoint.virtualCameraRegion.rect.height * 1000) / 10}%</p>}
        </details>}
        {!virtualCameraOnly && <label className={styles.field} data-setup-field="roi-geometry-type"><span>관측 영역 형태</span><select disabled={image || !selectedPoint.measurements.length} value={image ? "PLANE" : selectedPoint.geometryType ?? "SPHERE"} onChange={(event) => onChange(selectedPoint.id, { geometryType: event.target.value })}><option value="SPHERE">구체 · 3차원 범위</option><option value="PLANE">평면 · 사각 영역</option></select></label>}
        {image && (virtualCameraOnly ? <details className={styles.transformDetails}><summary>카메라 원본에서의 위치</summary>
          <p className={styles.help}>{sensors.find((sensor) => sensor.id === selectedPoint.imageBinding?.sensorId)?.name ?? "연결된 카메라 없음"}</p>
          <ol className={styles.coordinateList}>{selectedPoint.imageAnalysis?.source?.pixels?.map(([x, y], index) => <li key={index}>X {x.toFixed(1)} · Y {y.toFixed(1)}px</li>)}</ol>
        </details>
          : <ImageObservationFields point={selectedPoint} equipment={equipment} sensors={sensors} onChange={onChange} />)}
        {!virtualCameraOnly && textureKind === "THERMAL" && <div data-setup-field="roi-thermal-binding">
          <p className={styles.help}>온도를 촬영한 카메라 · {sensors.find((s) => s.id === selectedPoint.thermalBinding?.sensorId)?.name ?? "열화상 영상에서 영역을 지정하세요"}</p>
          <p className={styles.help}>선택한 영역의 온도를 집계합니다. 카메라에 보이지 않거나 온도 정보가 없는 부분은 제외합니다.</p>
          {thermalIssue && <p role="alert" className={styles.requirements}>{thermalIssue}</p>}
        </div>}
        {!virtualCameraOnly && onPlace && !!selectedPoint.measurements.length && <button type="button" onClick={() => onPlace({ pointId: selectedPoint.id, textureKind,
          geometryType: image ? "PLANE" : selectedPoint.geometryType, measurements: selectedPoint.measurements })}>3D 화면에서 영역 다시 그리기</button>}
        {!virtualCameraOnly && !image && selectedPoint.geometryType === "PLANE" && <fieldset className={styles.settingsGroup} data-setup-field="roi-geometry"><legend>평면 크기·방향</legend>
          <div className={styles.rangeGrid}>{[["planeWidth", "가로"], ["planeHeight", "세로"]].map(([key, label]) => <NumericField displayPrecision={1} key={key} label={label} unit="m" min={.01} max={100} step={.01} value={selectedPoint[key] ?? .3} onChange={(value) => onChange(selectedPoint.id, { [key]: value })} />)}</div>
          <NumericField displayPrecision={1} label="평면 회전" unit="°" step={1} value={(selectedPoint.planeRotation ?? 0) * 180 / Math.PI} onChange={(value) => onChange(selectedPoint.id, { planeRotation: value * Math.PI / 180 })} />
          <div className={styles.actionRow}>{[["정면", { x: 0, y: 0, z: 1 }], ["윗면", { x: 0, y: 1, z: 0 }], ["옆면", { x: 1, y: 0, z: 0 }]].map(([label, targetNormal]) => <button key={label} type="button" onClick={() => onChange(selectedPoint.id, { targetNormal })}>{label}</button>)}</div>
          <details className={styles.transformDetails}><summary>영역의 네 모서리 위치</summary>
            <p className={styles.help}>설비를 기준으로 각 모서리의 위치를 기록합니다. 사진을 사용하는 영역은 촬영한 카메라와도 연결됩니다.</p>
            <ol className={styles.coordinateList}>{observationPlane(selectedPoint).vertices.map(([x, y, z], index) => { const p = modelToReference({ x, y, z }, frame); return <li key={index}>X {p.x.toFixed(3)} · Y {p.y.toFixed(3)} · Z {p.z.toFixed(3)}</li>; })}</ol>
          </details>
        </fieldset>}
        {!virtualCameraOnly && !image && !compact && selectedPoint.geometryType !== "PLANE" && <div className={styles.radiusControl}>
          <button type="button" aria-label="관측 범위 줄이기" disabled={selectedPoint.radius <= .01} onClick={() => onChange(selectedPoint.id, { radius: clampRoiRadius(selectedPoint.radius - .05) })}>−</button>
          <NumericField displayPrecision={1} label="관측 반경" unit="m" min={.01} step={.01} value={selectedPoint.radius} onChange={(radius) => onChange(selectedPoint.id, { radius: clampRoiRadius(radius) })} />
          <button type="button" aria-label="관측 범위 늘리기" disabled={selectedPoint.radius >= 100} onClick={() => onChange(selectedPoint.id, { radius: clampRoiRadius(selectedPoint.radius + .05) })}>+</button>
        </div>}
        <details className={styles.transformDetails}><summary>{virtualCameraOnly ? "화면 표시" : "위치와 화면 표시"}</summary>
          {!virtualCameraOnly && <p className={styles.help}>{frame ? "설비의 기준 위치가 적용되었습니다." : "2단계에서 설비의 기준 위치를 설정하세요."}</p>}
          {!virtualCameraOnly && !textureKind && (!compact || allowPositionEdit) && <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={1} key={axis} label={`영역 ${axis.toUpperCase()} 위치`} unit="m" step={.001} value={position[axis]} onChange={(value) => onChange(selectedPoint.id, { localPosition: referenceToModel({ ...position, [axis]: value }, frame) })} />)}</div>}
          <label className={styles.field}><span>영역 불투명도 · {Math.round(selectedPoint.opacity * 100)}%</span><input type="range" min="5" max="80" value={selectedPoint.opacity * 100} onChange={(event) => onChange(selectedPoint.id, { opacity: Number(event.target.value) / 100 })} /></label>
          <p className={styles.help}>화면에는 영역 번호가 표시됩니다. 선택하거나 마우스를 올리면 이름과 상태가 보입니다.</p>
        </details>
      </section>
      <section className={styles.roiEditor} aria-label="측정·감지 항목">
        <div className={styles.sectionHeading}><strong>{virtualCameraOnly ? "경보 기준" : "3. 관측 항목·경보 기준"}</strong><span>{selectedPoint.measurements.length}개 항목</span></div>
        {!virtualCameraOnly && <p className={styles.help}>일반 관측은 이 영역의 소리와 온도를 보여줍니다. 게이지·스위치·LED·밸브는 카메라 사진에서 지정한 부분을 읽습니다.</p>}
        {!selectedPoint.measurements.length && <p className={styles.requirements}>관측 항목을 하나 이상 추가하세요.</p>}
        {selectedPoint.measurements.map((item, index) => <details key={item.id} className={`${styles.settingsGroup} ${styles.measurementCard}`} open={index === 0 ? true : undefined}>
          <summary><span>{index + 1}. {item.name || "이름 없는 항목"}</span><small>{["GENERAL", "ultrasound.db"].includes(item.metric) ? "설비에서 감지" : sensors.find((sensor) => sensor.id === item.sensorId)?.name || "카메라 영상에서 위치를 지정하세요"}{item.metric !== "GENERAL" ? ` · 경보 ${item.rules.length}개` : ""}{item.visible ? " · 표시" : " · 숨김"}</small></summary>
          <div className={styles.roiEditor}>
            <label className={styles.field} data-setup-field={`measurement-${item.id}-name`}><span>표시 이름 · 필수</span><input required value={item.name} onChange={(event) => updateMeasurement(index, { name: event.target.value })} /></label>
            {!["GENERAL", "ultrasound.db"].includes(item.metric) && <p className={styles.help}>연결된 카메라 · {sensors.find((sensor) => sensor.id === item.sensorId)?.name || (virtualCameraOnly ? "가상 카메라 사진에서 영역을 그리세요." : "3D 화면의 카메라 영상에서 영역을 그리세요.")}</p>}
            {item.metric === "GENERAL" && <p className={styles.help}>이 영역으로 수신된 초음파·온도 값을 각각 표시합니다. 특정 센서 연결은 필요하지 않습니다.</p>}
            <div className={styles.rangeGrid}>
              <label className={styles.field}><span>확인할 항목</span><input readOnly value={METRICS[item.metric]?.[0] ?? item.metric} /></label>
              {item.metric !== "GENERAL" && <label className={styles.field}><span>단위</span><input aria-label="단위" value={item.unit} onChange={(event) => updateMeasurement(index, { unit: event.target.value })} /></label>}
            </div>
            {item.metric?.startsWith("vision.") && selectedPoint.geometryType !== "PLANE" && <p className={styles.help}>{virtualCameraOnly ? "가상 카메라 사진에서 영역을 다시 그려주세요." : "카메라 영상에서 사각형으로 지정해야 합니다."}</p>}
            {item.metric === "vision.switchState" && <p className={styles.help}>지금 보이는 스위치 상태를 기준으로 저장하면 이후 화면의 변화를 판독합니다.</p>}
            {item.metric === "vision.gaugeValue" && <p className={styles.help}>카메라 사진에서 게이지의 숫자를 읽습니다. 표시 단위와 경보 기준을 입력하세요.</p>}
            {item.metric === "vision.ledState" && <p className={styles.help}>LED 색상마다 표시할 상태와 판정을 지정하세요.</p>}
            {item.metric === "vision.valveState" && <p className={styles.help}>지금 보이는 밸브 상태를 기준으로 저장하면 이후 화면의 변화를 판독합니다.</p>}
            <ObservationProfileFields point={selectedPoint} item={item} onChange={(changes) => updateMeasurement(index, changes)} onCaptureReference={onCaptureReference} captureBusy={captureBusy} />
            <label className={styles.check}><input type="checkbox" checked={item.visible} onChange={(event) => updateMeasurement(index, { visible: event.target.checked })} />관제 화면에 표시</label>
            {!["GENERAL", "vision.switchState", "vision.valveState", "vision.ledState"].includes(item.metric) && <div className={styles.ruleSection}>
              <div className={styles.sectionHeading}><strong>경보 조건</strong><span>선택 사항</span></div>
              {!item.rules.length && <p className={styles.help}>현재는 측정값만 표시합니다. 경보가 필요하면 조건을 추가하세요.</p>}
              {item.rules.map((rule, ruleIndex) => <div key={ruleIndex} className={styles.ruleRow} role="group" aria-label={`경보 조건 ${ruleIndex + 1}`}>
                <div className={styles.ruleHeading}><span>{rule.severity === "DANGER" ? "위험" : "주의"} · {rule.threshold === "" ? "기준값 필요" : `${rule.threshold} ${item.unit} ${OPERATORS[rule.operator] ?? rule.operator}`}</span><button type="button" aria-label={`경보 조건 ${ruleIndex + 1} 삭제`} onClick={() => updateMeasurement(index, { rules: item.rules.filter((_, i) => i !== ruleIndex) })}>삭제</button></div>
                <label className={styles.field} data-setup-field={`measurement-${item.id}-rule-${ruleIndex}`}><span>기준값 · 필수{item.unit ? ` (${item.unit})` : ""}</span><input type="number" required step="any" value={rule.threshold ?? ""} onChange={(event) => updateMeasurement(index, { rules: item.rules.map((entry, i) => i === ruleIndex ? { ...entry, threshold: event.target.value === "" ? "" : Number(event.target.value) } : entry) })} /></label>
                {item.metric === "vision.gaugeValue" && <label className={styles.field}><span>바늘 각도 (°)</span><input type="number" step="any" disabled={!item.analysisConfig?.scale} value={gaugeAngleForValue(item.analysisConfig?.scale, rule.threshold)?.toFixed(1) ?? ""} onChange={(event) => {
                  const value = event.target.value === "" ? "" : gaugeValueForAngle(item.analysisConfig?.scale, Number(event.target.value));
                  if (value !== null) updateMeasurement(index, { rules: item.rules.map((entry, i) => i === ruleIndex ? { ...entry, threshold: value } : entry) });
                }} /></label>}
                <div className={styles.rangeGrid}>
                  <label className={styles.field}><span>조건</span><select value={rule.operator} onChange={(event) => updateMeasurement(index, { rules: item.rules.map((entry, i) => i === ruleIndex ? { ...entry, operator: event.target.value } : entry) })}>{Object.entries(OPERATORS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className={styles.field}><span>경보 단계</span><select value={rule.severity} onChange={(event) => updateMeasurement(index, { rules: item.rules.map((entry, i) => i === ruleIndex ? { ...entry, severity: event.target.value } : entry) })}><option value="WARNING">주의</option><option value="DANGER">위험</option></select></label>
                </div>
              </div>)}
              <button type="button" onClick={() => updateMeasurement(index, { rules: [...item.rules, { threshold: "", operator: "gte", severity: "WARNING" }] })}>경보 조건 추가</button>
            </div>}
            {item.metric !== "GENERAL" && <details className={styles.transformDetails}><summary>화면에 표시되는 모습 미리보기</summary><NumericField displayPrecision={1} label="예시 값" value={item.previewValue ?? 0} onChange={(previewValue) => updateMeasurement(index, { previewValue })} /></details>}
            <button type="button" className={styles.removeAction} onClick={() => selectMeasurements(selectedPoint.measurements.filter((_, i) => i !== index).map((m)=>m.metric))}>관측 항목 삭제</button>
          </div>
        </details>)}
      </section>
      <details className={styles.settingsGroup}><summary>관측 화면 미리보기</summary><ObservationReadout point={selectedPoint} sensors={sensors} preview /></details>
      {onRemove && <details className={styles.transformDetails}><summary>관측 영역 관리</summary><button className={styles.removeAction} type="button" onClick={() => onRemove(selectedPoint.id)}>관측 영역 삭제</button></details>}
    </div>}
  </div>;
}
