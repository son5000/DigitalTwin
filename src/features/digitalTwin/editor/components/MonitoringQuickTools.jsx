import { IconBase } from "@/components/icons/IconBase";
import { BellIcon } from "@/components/icons/actionIcons";
import styles from "./MonitoringRoiWorkspace.module.css";

function RegionIcon() { return <IconBase><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="4" /></IconBase>; }
function ThermalIcon() { return <IconBase><path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0Z" /><path d="M12 8v9m7-11h2m-2 4h2" /><circle cx="12" cy="18" r="1" /></IconBase>; }
function UltrasonicIcon() { return <IconBase><path d="M3 8h7v8H3z" /><circle cx="6.5" cy="12" r="2" /><path d="M13 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" /></IconBase>; }

export default function MonitoringQuickTools({ panel, thermalActive, alarmCount, disabled, onPanelChange, onThermalToggle }) {
  return <div className={styles.panelTools} role="group" aria-label="관측 도구">
    <button type="button" className={styles.quickTool} aria-expanded={panel === "AUDIO"} disabled={disabled} onClick={() => onPanelChange(panel === "AUDIO" ? null : "AUDIO")} title="위치 또는 관측 영역의 초음파 데이터"><UltrasonicIcon /><span>초음파</span></button>
    <button type="button" className={styles.quickTool} aria-pressed={thermalActive} aria-expanded={panel === "THERMAL"} disabled={disabled} onClick={onThermalToggle} title={thermalActive ? "열화상 끄기" : "열화상 켜기"}><ThermalIcon /><span>열화상</span></button>
    <button type="button" className={styles.quickTool} aria-expanded={panel === "ROI"} disabled={disabled} onClick={() => onPanelChange(panel === "ROI" ? null : "ROI")} title="관측 영역의 측정값과 설정"><RegionIcon /><span>관측 영역</span></button>
    <button type="button" className={styles.quickTool} aria-expanded={panel === "ALARMS"} disabled={disabled} onClick={() => onPanelChange(panel === "ALARMS" ? null : "ALARMS")} title={`미확인 경고 ${alarmCount}건`}><BellIcon /><span>경고</span>{alarmCount > 0 && <small className={styles.alarmCount}>{alarmCount}</small>}</button>
  </div>;
}
