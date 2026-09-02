import { useMemo, useState } from "react";

import { WORLD_WIZARD_STEPS } from "@/features/digitalTwin/editor/constants/worldWizard";
import {
  OBSERVATION_ALL_STEP_IDS,
  OBSERVATION_SCOPE_DEFINITIONS,
  OBSERVATION_SCOPE_TYPES,
} from "@/features/digitalTwin/editor/model/observationWorkflow";

import styles from "./ObservationScopeSelector.module.css";

export default function ObservationScopeSelector({ onSelect, currentScopeType = null, expansion = false, onCancel }) {
  const [customSteps, setCustomSteps] = useState(OBSERVATION_ALL_STEP_IDS);
  const labels = useMemo(() => new Map(WORLD_WIZARD_STEPS.map((step) => [step.id, step.shortLabel])), []);

  const toggleCustomStep = (stepId) => {
    setCustomSteps((current) => current.includes(stepId)
      ? current.filter((id) => id !== stepId)
      : OBSERVATION_ALL_STEP_IDS.filter((id) => [...current, stepId].includes(id)));
  };

  return (
    <section className={styles.screen} aria-labelledby="observation-scope-title">
      <div className={styles.heading}>
        <span>관측 범위 설정</span>
        <h1 id="observation-scope-title">무엇을 관측하시겠습니까?</h1>
        <p>{expansion ? "현재 데이터는 그대로 유지됩니다. 필요한 범위와 단계를 추가하세요." : "관측 대상에 맞는 편집 화면만 열어 더 빠르게 시작할 수 있습니다."}</p>
      </div>
      <div className={styles.grid}>
        {OBSERVATION_SCOPE_DEFINITIONS.map((definition) => {
          const isCurrent = definition.id === currentScopeType;
          return (
            <article key={definition.id} className={`${styles.card} ${isCurrent ? styles.current : ""}`}>
              <div className={styles.cardHeader}>
                <h2>{definition.title}</h2>
                {isCurrent ? <span className={styles.currentBadge}>현재 범위</span> : null}
              </div>
              <p>{definition.description}</p>
              <div className={styles.steps} aria-label={`${definition.title} 진행 단계`}>
                {(definition.id === OBSERVATION_SCOPE_TYPES.CUSTOM ? customSteps : definition.steps).map((stepId, index) => (
                  <span key={stepId}>{index ? <b aria-hidden="true">→</b> : null}{labels.get(stepId)}</span>
                ))}
              </div>
              {definition.id === OBSERVATION_SCOPE_TYPES.CUSTOM ? (
                <fieldset className={styles.customSteps}>
                  <legend>사용할 단계</legend>
                  {OBSERVATION_ALL_STEP_IDS.map((stepId) => (
                    <label key={stepId}>
                      <input type="checkbox" checked={customSteps.includes(stepId)} onChange={() => toggleCustomStep(stepId)} />
                      <span>{labels.get(stepId)}</span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div className={styles.result}><strong>결과</strong><span>{definition.result}</span></div>
              <button
                type="button"
                disabled={isCurrent || (definition.id === OBSERVATION_SCOPE_TYPES.CUSTOM && customSteps.length === 0)}
                onClick={() => onSelect(definition.id, { activeStepIds: customSteps })}
              >
                {expansion ? "이 범위로 확장" : "이 유형으로 시작"}
              </button>
            </article>
          );
        })}
      </div>
      {expansion ? <button type="button" className={styles.cancel} onClick={onCancel}>돌아가기</button> : null}
    </section>
  );
}
