import { WORLD_WIZARD_STEPS } from "@/features/digitalTwin/editor/constants/worldWizard";

import styles from "./WorldWorkspaceNavigation.module.css";

export default function WorldWorkspaceNavigation({ activeViewId, onViewChange, steps = WORLD_WIZARD_STEPS }) {
  return (
    <nav className={styles.navigation} aria-label="에디터 화면 이동">
      <ul>
        {steps.map((view) => {
          const isActive = view.id === activeViewId;
          return (
            <li key={view.id}>
              <button
                type="button"
                className={isActive ? styles.active : ""}
                aria-current={isActive ? "page" : undefined}
                aria-pressed={isActive}
                onClick={() => onViewChange(view.id)}
              >
                {view.shortLabel ?? view.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
