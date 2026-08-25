import { useEffect, useId, useMemo, useRef, useState } from "react";

import { ArrowRightIcon, CheckIcon, ChevronDownIcon, DuplicateIcon, EditIcon, FloorIcon } from "@/components/icons";
import {
  FLOOR_SURFACE_PRESETS,
  getFloorSurfacePreset,
  normalizeFloorSurfaceStyle,
} from "@/features/digitalTwin/editor/constants/floorSurfaceStyles";

import MaterialAppearanceEditor from "./MaterialAppearanceEditor";
import styles from "./FloorPlanNavigator.module.css";

function CompactDropdown({ ariaLabel, valueLabel, valueId, options, onSelect, placeholder = "선택" }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => option.id === valueId);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutside(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={styles.compactDropdown}>
      <button
        type="button"
        className={styles.compactDropdownTrigger}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.compactDropdownValue}>
          {selectedOption?.swatch ? <span className={styles.presetSwatch} style={{ "--floor-preset-color": selectedOption.swatch }} aria-hidden="true" /> : null}
          <strong>{valueLabel ?? selectedOption?.label ?? placeholder}</strong>
        </span>
        <ChevronDownIcon className={`${styles.floorChevron} ${isOpen ? styles.floorChevronOpen : ""}`} size={15} />
      </button>
      {isOpen ? (
        <div id={menuId} className={styles.compactDropdownMenu} role="menu" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = valueId != null && option.id === valueId;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                disabled={option.disabled}
                onClick={() => {
                  onSelect(option.id);
                  setIsOpen(false);
                }}
              >
                <span className={styles.optionMarker} aria-hidden="true">
                  {option.swatch ? <span className={styles.presetSwatch} style={{ "--floor-preset-color": option.swatch }} /> : null}
                </span>
                <span className={styles.optionLabel}>{option.label}</span>
                {option.meta ? <small>{option.meta}</small> : null}
                {selected ? <CheckIcon size={13} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FloorFinishEditor({ currentFloor, currentStyle, selectedFloorIds, allFloorIds, onApply }) {
  const [draft, setDraft] = useState(() => normalizeFloorSurfaceStyle(currentStyle));
  const draftRef = useRef(draft);
  const [applyStatus, setApplyStatus] = useState("");

  function updateCurrentFloor(nextStyle) {
    const normalized = normalizeFloorSurfaceStyle(nextStyle);
    draftRef.current = normalized;
    setDraft(normalized);
    if (currentFloor && onApply?.([currentFloor.id], normalized)) {
      setApplyStatus(`${currentFloor.name}에 바로 적용했습니다.`);
    } else {
      setApplyStatus("");
    }
  }

  function selectPreset(presetId) {
    updateCurrentFloor({ presetId });
  }

  function applyStyle(targetFloorIds, targetLabel) {
    if (!targetFloorIds.length || !onApply?.(targetFloorIds, draft)) return;
    setApplyStatus(`${targetLabel}에 ${getFloorSurfacePreset(draft.presetId).label} 마감을 적용했습니다.`);
  }

  return (
    <section className={styles.finishSection} aria-label="층 바닥 마감 설정">
      <div className={styles.sectionHeading}><strong>바닥 마감</strong></div>
      <CompactDropdown
        ariaLabel="바닥 재질 프리셋"
        valueId={draft.presetId}
        options={FLOOR_SURFACE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, swatch: preset.color }))}
        onSelect={selectPreset}
      />
      <MaterialAppearanceEditor
        appearance={draft}
        hidePresetSelector
        compact
        onChange={(changes) => {
          updateCurrentFloor({ ...draftRef.current, ...changes });
        }}
      />
      <CompactDropdown
        ariaLabel="바닥 마감 추가 적용 범위"
        valueLabel="다른 층에 적용"
        options={[
          { id: "SELECTED", label: "선택 층", meta: `${selectedFloorIds.length}`, disabled: !selectedFloorIds.length },
          { id: "ALL", label: "전체 층", meta: `${allFloorIds.length}`, disabled: !allFloorIds.length },
        ]}
        onSelect={(scope) => {
          if (scope === "SELECTED") applyStyle(selectedFloorIds, `선택 ${selectedFloorIds.length}개 층`);
          if (scope === "ALL") applyStyle(allFloorIds, "전체 층");
        }}
      />
      {applyStatus ? <p className={styles.applyStatus} role="status">{applyStatus}</p> : null}
    </section>
  );
}

export default function FloorPlanNavigator({
  building,
  floors,
  embedded = false,
  currentFloorId,
  floorPlansById,
  showFloorReference,
  referenceFloorId,
  onFloorChange,
  onCopyFloorPlan,
  onApplyToFloors,
  onApplyFloorStyle,
  onReferenceFloorChange,
  onShowFloorReferenceChange,
}) {
  const [selectedFloorIds, setSelectedFloorIds] = useState([]);
  const [copySourceFloorId, setCopySourceFloorId] = useState(null);
  const [isFloorMenuOpen, setIsFloorMenuOpen] = useState(false);
  const orderedFloors = useMemo(
    () => [...floors].sort((left, right) => (left.level ?? 0) - (right.level ?? 0)),
    [floors],
  );
  const currentIndex = orderedFloors.findIndex((floor) => floor.id === currentFloorId);
  const currentFloor = orderedFloors[currentIndex];
  const reusableFloors = orderedFloors.filter((floor) => floor.id !== currentFloorId);
  const copySourceFloor = reusableFloors.find((floor) => floor.id === copySourceFloorId) ?? reusableFloors[0] ?? null;

  const validSelectedFloorIds = selectedFloorIds.filter((id) => (
    id !== currentFloorId && orderedFloors.some((floor) => floor.id === id)
  ));

  function toggleTarget(floorId) {
    setSelectedFloorIds((ids) => ids.includes(floorId) ? ids.filter((id) => id !== floorId) : [...ids, floorId]);
  }

  return (
    <aside className={`${styles.panel} ${embedded ? styles.embedded : ""}`} data-editor-panel={!embedded ? "true" : undefined} aria-label="층 목록과 도면 적용 범위">
      <header className={styles.panelHeader}>
        <h2>{building?.name ?? "건축물 미선택"}</h2>
      </header>

      <div className={styles.floorDropdown}>
        <button
          type="button"
          className={styles.floorDropdownTrigger}
          aria-expanded={isFloorMenuOpen}
          aria-controls="floor-selection-menu"
          onClick={() => setIsFloorMenuOpen((open) => !open)}
        >
          <span className={styles.floorTriggerIcon} aria-hidden="true"><FloorIcon size={17} /></span>
          <span className={styles.floorTriggerText} aria-live="polite">
            <strong>{currentFloor?.name ?? "층 미선택"}</strong>
            <span>{currentFloor ? `EL ${Number(currentFloor.elevation ?? 0).toFixed(1)} m` : "층 선택"}</span>
          </span>
          <span className={styles.floorTriggerCount}>{orderedFloors.length}층</span>
          <ChevronDownIcon className={`${styles.floorChevron} ${isFloorMenuOpen ? styles.floorChevronOpen : ""}`} size={16} />
        </button>

        {isFloorMenuOpen ? (
          <div id="floor-selection-menu" className={styles.floorList} role="group" aria-label="편집할 층과 다중 적용 대상 선택">
            {orderedFloors.map((floor) => {
              const configured = (floorPlansById[floor.id]?.structures?.length ?? 0) > 0;
              const active = floor.id === currentFloorId;
              const selectedForApply = validSelectedFloorIds.includes(floor.id);
              return (
                <div key={floor.id} className={`${styles.floorRow} ${active ? styles.active : ""}`}>
                  <button type="button" aria-pressed={active} aria-current={active ? "page" : undefined} onClick={() => { onFloorChange(floor.id); setIsFloorMenuOpen(false); }}>
                    <span className={styles.floorName}><FloorIcon size={15} /><strong>{floor.name}</strong>{active ? <em>편집 중</em> : null}</span>
                    <small>{configured ? "도면 있음" : "미작성"} · EL {Number(floor.elevation ?? 0).toFixed(1)} m</small>
                  </button>
                  {active ? (
                    <span className={styles.editingMarker} title="현재 편집 중인 층"><EditIcon size={14} /></span>
                  ) : (
                    <label className={styles.targetToggle} title={`${floor.name}을(를) 적용 대상으로 ${selectedForApply ? "해제" : "선택"}`}>
                      <input type="checkbox" checked={selectedForApply} onChange={() => toggleTarget(floor.id)} />
                      <span className={styles.checkBox} aria-hidden="true">{selectedForApply ? <CheckIcon size={14} /> : null}</span>
                      <span className={styles.srOnly}>{floor.name} 적용 대상 선택</span>
                    </label>
                  )}
                </div>
              );
            })}
            {!orderedFloors.length ? <p className={styles.emptyState}>표시할 층이 없습니다.</p> : null}
          </div>
        ) : null}
      </div>

      <FloorFinishEditor
        key={currentFloorId}
        currentFloor={currentFloor}
        currentStyle={floorPlansById[currentFloorId]?.floorStyle}
        selectedFloorIds={validSelectedFloorIds}
        allFloorIds={orderedFloors.map((floor) => floor.id)}
        onApply={onApplyFloorStyle}
      />

      <section className={styles.reuseSection}>
        <div className={styles.sectionHeading}><strong>도면 재사용</strong></div>
        {copySourceFloor ? (
          <div className={styles.copyBox}>
            <label className={styles.floorPicker}>
              <span>가져올 층</span>
              <CompactDropdown
                ariaLabel="가져올 층"
                valueId={copySourceFloor.id}
                options={reusableFloors.map((floor) => ({ id: floor.id, label: floor.name, meta: `EL ${Number(floor.elevation ?? 0).toFixed(1)} m` }))}
                onSelect={setCopySourceFloorId}
              />
            </label>
            <button className={styles.copyButton} type="button" onClick={() => onCopyFloorPlan(copySourceFloor.id)}>
              <DuplicateIcon size={17} />
              <strong>현재 층에 덮어쓰기</strong>
            </button>
          </div>
        ) : null}
        <div className={`${styles.applyBox} ${validSelectedFloorIds.length ? styles.hasTargets : ""}`}>
          <button type="button" disabled={!validSelectedFloorIds.length} onClick={() => onApplyToFloors(validSelectedFloorIds)}>
            <span>{validSelectedFloorIds.length ? `선택 ${validSelectedFloorIds.length}개 층에 적용` : "적용 대상 없음"}</span><ArrowRightIcon size={15} />
          </button>
        </div>
      </section>

      {reusableFloors.length ? (
        <section className={styles.referenceSection}>
          <label className={styles.floorPicker}>
            <span>참조할 층</span>
            <CompactDropdown
              ariaLabel="참조할 층"
              valueId={referenceFloorId}
              options={reusableFloors.map((floor) => ({ id: floor.id, label: floor.name, meta: `EL ${Number(floor.elevation ?? 0).toFixed(1)} m` }))}
              onSelect={onReferenceFloorChange}
            />
          </label>
          <label className={styles.referenceToggle}>
            <input type="checkbox" checked={showFloorReference} onChange={(event) => onShowFloorReferenceChange(event.target.checked)} />
            <span className={styles.switchTrack} aria-hidden="true"><span /></span>
            <span>참조선 표시</span>
          </label>
        </section>
      ) : null}
    </aside>
  );
}
