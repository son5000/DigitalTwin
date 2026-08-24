import {
  EditIcon,
  GridViewIcon,
  ListViewIcon,
  SelectIcon,
} from "@/components/icons";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";

import styles from "./WorldPanelRail.module.css";

const SPACE_PANEL_ITEMS = [
  { id: WORLD_PANEL_IDS.OBJECTS, label: "오브젝트", icon: GridViewIcon },
  { id: WORLD_PANEL_IDS.SETTINGS, label: "월드 설정", icon: EditIcon },
  { id: WORLD_PANEL_IDS.HIERARCHY, label: "계층", icon: ListViewIcon },
  { id: WORLD_PANEL_IDS.DETAILS, label: "상세 설정", icon: SelectIcon, requiresSelection: true },
];

const INTERIOR_PANEL_ITEMS = [
  { id: WORLD_PANEL_IDS.OBJECTS, label: "구조물", icon: GridViewIcon },
  { id: WORLD_PANEL_IDS.DETAILS, label: "구조 상세", icon: SelectIcon, requiresSelection: true },
];

const EQUIPMENT_PANEL_ITEMS = [
  { id: WORLD_PANEL_IDS.OBJECTS, label: "설비", icon: GridViewIcon },
  { id: WORLD_PANEL_IDS.DETAILS, label: "설비 상세", icon: SelectIcon, requiresSelection: true },
];

export default function WorldPanelRail({ activePanelId, hasSelection, mode = "SPACE", onPanelChange }) {
  const panelItems = mode === "INTERIOR"
    ? INTERIOR_PANEL_ITEMS
    : mode === "EQUIPMENT"
      ? EQUIPMENT_PANEL_ITEMS
      : SPACE_PANEL_ITEMS;
  return (
    <nav className={styles.rail} aria-label="월드 패널">
      {panelItems.map((item) => {
        const Icon = item.icon;
        const active = activePanelId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={active ? styles.active : ""}
            aria-pressed={active}
            disabled={item.requiresSelection && !hasSelection}
            title={item.label}
            onClick={() => onPanelChange(active ? null : item.id)}
          >
            <Icon size={19} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
