import {
  MAX_TREE_COUNT,
  SITE_CREATION_TEMPLATE_MAP,
  SITE_MATERIAL_OPTIONS,
  SITE_OBJECT_GEOMETRY_MODES,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";

import NumericField from "./NumericField";
import styles from "./SiteObjectProperties.module.css";

export default function SiteObjectProperties({ object, onChange, onDelete }) {
  if (!object) return null;
  const template = SITE_CREATION_TEMPLATE_MAP[object.type];
  const isRepeated = object.type === "TREE" || object.type === "STREETLIGHT";
  const hasSpacing = object.type === "FENCE";
  const isLinear = object.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR;

  return (
    <section className={styles.panel} aria-label={`${template.name} 속성`}>
      <header className={styles.heading}>
        <span>환경 요소 / {template.name}</span>
        <h2>{object.name}</h2>
      </header>

      <div className={styles.section}>
        <h3>기본 정보</h3>
        <label><span>이름</span><input value={object.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        <label><span>재질</span><select value={object.appearance.material} onChange={(event) => onChange({ appearance: { material: event.target.value } })}>{SITE_MATERIAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className={styles.color}><span>색상</span><input type="color" value={object.appearance.color} onChange={(event) => onChange({ appearance: { color: event.target.value } })} /></label>
      </div>

      <div className={styles.section}>
        <h3>{isLinear ? "경로와 폭" : "크기"}</h3>
        <div className={styles.fields}>
          <NumericField label={isLinear ? "경로 영역 가로" : "가로"} value={object.dimensions.width} min={0.1} unit="m" onChange={(width) => onChange({ dimensions: { width } })} />
          <NumericField label={isLinear ? "폭" : "세로"} value={isLinear ? object.path.width : object.dimensions.depth} min={0.1} unit="m" onChange={(value) => onChange(isLinear ? { path: { width: value } } : { dimensions: { depth: value } })} />
          <NumericField label="높이" value={object.dimensions.height} min={0.02} unit="m" onChange={(height) => onChange({ dimensions: { height } })} />
          {isRepeated && <NumericField
            label="개수"
            value={object.parameters.count}
            min={1}
            max={object.type === "TREE" ? MAX_TREE_COUNT : 24}
            step={1}
            unit="개"
            onChange={(count) => onChange({ parameters: { count } })}
          />}
          {hasSpacing && <NumericField label="기둥 간격" value={object.parameters.spacing} min={0.5} unit="m" onChange={(spacing) => onChange({ parameters: { spacing } })} />}
        </div>
        {isLinear && <p>내부 데이터는 경로 점과 폭으로 유지되어 곡선·다중 경로로 확장할 수 있습니다.</p>}
      </div>

      <div className={styles.section}>
        <h3>위치와 회전</h3>
        <div className={styles.fields}>
          <NumericField label="위치 X" value={object.position.x} unit="m" onChange={(x) => onChange({ position: { x } })} />
          <NumericField label="위치 Y" value={object.position.y} unit="m" onChange={(y) => onChange({ position: { y } })} />
          <NumericField label="위치 Z" value={object.position.z} unit="m" onChange={(z) => onChange({ position: { z } })} />
          <NumericField label="회전 Y" value={object.rotation.y * 180 / Math.PI} unit="°" onChange={(degrees) => onChange({ rotation: { y: degrees * Math.PI / 180 } })} />
        </div>
      </div>

      <button type="button" className={styles.deleteButton} onClick={onDelete}>환경 요소 삭제</button>
    </section>
  );
}
