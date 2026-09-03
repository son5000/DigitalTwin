import { useMemo, useState } from "react";

import { WORLD_WIZARD_STEPS } from "@/features/digitalTwin/editor/constants/worldWizard";
import {
  applyObservationScopeImageFallback,
  OBSERVATION_SCOPE_IMAGES,
} from "@/features/digitalTwin/editor/constants/observationScopeImages";
import {
  OBSERVATION_ALL_STEP_IDS,
  OBSERVATION_SCOPE_DEFINITIONS,
  OBSERVATION_SCOPE_TYPES,
} from "@/features/digitalTwin/editor/model/observationWorkflow";

import styles from "./ObservationScopeSelector.module.css";

export default function ObservationScopeSelector({ onSelect, currentScopeType = null, expansion = false, onCancel }) {
  const [customSteps, setCustomSteps] = useState(OBSERVATION_ALL_STEP_IDS);
  const [customSelectionOpen, setCustomSelectionOpen] = useState(currentScopeType === OBSERVATION_SCOPE_TYPES.CUSTOM);
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
          const isCustom = definition.id === OBSERVATION_SCOPE_TYPES.CUSTOM;
          const selectScope = () => {
            if (isCustom) {
              setCustomSelectionOpen(true);
              return;
            }
            onSelect(definition.id, { activeStepIds: customSteps });
          };

          return (
            <button
              key={definition.id}
              type="button"
              className={`${styles.card} ${isCurrent ? styles.current : ""} ${customSelectionOpen && isCustom ? styles.pending : ""}`}
              disabled={isCurrent}
              aria-current={isCurrent ? "true" : undefined}
              aria-label={`${definition.title}: ${definition.description}${isCurrent ? ", 현재 관측 범위" : ""}`}
              onClick={selectScope}
            >
              <img
                className={styles.cardImage}
                src={OBSERVATION_SCOPE_IMAGES[definition.id]}
                alt={`${definition.title} 관측 범위 미리보기`}
                loading="eager"
                decoding="async"
                onError={applyObservationScopeImageFallback}
              />
              <span className={styles.cardOverlay} aria-hidden="true" />
              <span className={styles.cardContent}>
                <strong>{definition.title}</strong>
                <span>{definition.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      {customSelectionOpen ? (
        <section className={styles.customPanel} aria-labelledby="custom-step-title">
          <div>
            <strong id="custom-step-title">사용자 정의 단계</strong>
            <span>필요한 편집 단계만 선택하세요.</span>
          </div>
          <fieldset className={styles.customSteps}>
            <legend className={styles.visuallyHidden}>사용할 단계</legend>
            {OBSERVATION_ALL_STEP_IDS.map((stepId) => (
              <label key={stepId}>
                <input type="checkbox" checked={customSteps.includes(stepId)} onChange={() => toggleCustomStep(stepId)} />
                <span>{labels.get(stepId)}</span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={customSteps.length === 0 || currentScopeType === OBSERVATION_SCOPE_TYPES.CUSTOM}
            onClick={() => onSelect(OBSERVATION_SCOPE_TYPES.CUSTOM, { activeStepIds: customSteps })}
          >
            {expansion ? "선택한 단계로 확장" : "선택한 단계로 시작"}
          </button>
        </section>
      ) : null}
      {expansion ? <button type="button" className={styles.cancel} onClick={onCancel}>돌아가기</button> : null}
    </section>
  );
}