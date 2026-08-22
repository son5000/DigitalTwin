import { CheckIcon } from "@/components/icons";
import { WORLD_WIZARD_STEPS } from "@/features/digitalTwin/editor/constants/worldWizard";

import styles from "./WorldWizardStepper.module.css";

export default function WorldWizardStepper({ activeStepId, furthestStepIndex, onStepChange }) {
  const activeIndex = WORLD_WIZARD_STEPS.findIndex((step) => step.id === activeStepId);

  return (
    <nav className={styles.stepper} aria-label="월드 구축 단계">
      <ol>
        {WORLD_WIZARD_STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          const isAccessible = index <= furthestStepIndex;
          return (
            <li key={step.id} className={`${isActive ? styles.active : ""} ${isComplete ? styles.complete : ""}`}>
              <button
                type="button"
                aria-current={isActive ? "step" : undefined}
                disabled={!isAccessible}
                onClick={() => onStepChange(step.id)}
              >
                <span className={styles.number}>{isComplete ? <CheckIcon size={14} /> : index + 1}</span>
                <strong>{step.label}</strong>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
