import { DeleteIcon } from "@/components/icons";
import styles from "./ObservationRuleFields.module.css";

const OPERATORS = { gte: "이상", gt: "초과", lte: "이하", lt: "미만" };

export function ObservationRemoveButton({ label, onClick }) {
  return <button type="button" className={styles.removeButton} aria-label={label} title={label} onClick={onClick}><DeleteIcon size={16} /></button>;
}

export default function ObservationRuleFields({ rule, index, unit, onChange, onRemove, target, children, validationTarget, label = "경보 조건", dangerLabel = "위험" }) {
  const name = `${label} ${index + 1}`;
  const threshold = rule.threshold === "" || rule.threshold == null ? "기준값 필요" : `${rule.threshold}${unit ? ` ${unit}` : ""} ${OPERATORS[rule.operator] ?? rule.operator}`;
  return <div className={styles.rule} role="group" aria-label={name}>
    <div className={styles.heading}>
      {target ? <div className={styles.target}>{target}</div> : <span>{rule.severity === "DANGER" ? dangerLabel : "주의"} · {threshold}</span>}
      <ObservationRemoveButton label={`${name} 삭제`} onClick={onRemove} />
    </div>
    <div className={styles.fields}>
      <label data-setup-field={validationTarget}><span>기준값{unit ? ` (${unit})` : ""}</span><input aria-label={`${name} 값`} type="number" required step="any" value={rule.threshold ?? ""} onChange={(event) => onChange({ threshold: event.target.value === "" ? "" : Number(event.target.value) })} /></label>
      <label><span>조건</span><select aria-label={`${name} 조건`} value={rule.operator} onChange={(event) => onChange({ operator: event.target.value })}>
        {Object.entries(OPERATORS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select></label>
      <label><span>판정</span><select aria-label={`${name} 단계`} value={rule.severity} onChange={(event) => onChange({ severity: event.target.value })}>
        <option value="WARNING">주의</option><option value="DANGER">{dangerLabel}</option>
      </select></label>
    </div>
    {children}
  </div>;
}
