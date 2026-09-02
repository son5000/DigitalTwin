import { useCallback, useEffect, useMemo, useState } from "react";

import { ToolbarButton } from "@/features/digitalTwin/editor/components/ToolbarPrimitives";
import { TOOLBAR_ACTION_IDS } from "@/features/digitalTwin/editor/components/toolbarActionDefinitions";

import {
  MOVEMENT_PLAYBACK_STATES,
  MOVEMENT_REPEAT_MODES,
  getMovementDuration,
  normalizeMovementConfig,
} from "@/features/digitalTwin/editor/model/movementPath";

import styles from "./MovementTimeline.module.css";

export default function MovementTimeline({ object, playback, movementClockRef, error = "", onChange }) {
  const movement = useMemo(
    () => normalizeMovementConfig(object?.movement, object?.position),
    [object?.movement, object?.position],
  );
  const duration = useMemo(() => getMovementDuration(movement), [movement]);
  const clampTime = useCallback((value) => {
    const time = Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    if ([MOVEMENT_REPEAT_MODES.LOOP, MOVEMENT_REPEAT_MODES.PING_PONG].includes(movement.repeatMode) && duration > 0) {
      return time % duration;
    }
    return Math.min(duration, time);
  }, [duration, movement.repeatMode]);
  const [displayTime, setDisplayTime] = useState(() => clampTime(playback.currentTime));
  useEffect(() => {
    const clock = movementClockRef.current;
    const updateDisplayTime = (time) => setDisplayTime(clampTime(time));
    clock.onUiTimeChange = updateDisplayTime;
    return () => {
      if (clock.onUiTimeChange === updateDisplayTime) clock.onUiTimeChange = null;
    };
  }, [clampTime, movementClockRef]);
  if (!object?.movement) return null;
  const currentTime = clampTime(displayTime);
  const command = (status, time = currentTime) => {
    const nextTime = clampTime(time);
    setDisplayTime(nextTime);
    onChange({ status, currentTime: nextTime, revision: (playback.revision ?? 0) + 1 });
  };
  return (
    <section className={styles.timeline} aria-label="이동 애니메이션 타임라인">
      <div className={styles.controls} role="group" aria-label="재생 제어">
        <ToolbarButton actionId={TOOLBAR_ACTION_IDS.PLAY} active={playback.status === MOVEMENT_PLAYBACK_STATES.PLAYING} pressed={playback.status === MOVEMENT_PLAYBACK_STATES.PLAYING} onClick={() => command(MOVEMENT_PLAYBACK_STATES.PLAYING)} />
        <ToolbarButton actionId={TOOLBAR_ACTION_IDS.PAUSE} active={playback.status === MOVEMENT_PLAYBACK_STATES.PAUSED} pressed={playback.status === MOVEMENT_PLAYBACK_STATES.PAUSED} onClick={() => command(MOVEMENT_PLAYBACK_STATES.PAUSED)} />
        <ToolbarButton actionId={TOOLBAR_ACTION_IDS.STOP} active={playback.status === MOVEMENT_PLAYBACK_STATES.STOPPED} pressed={playback.status === MOVEMENT_PLAYBACK_STATES.STOPPED} onClick={() => command(MOVEMENT_PLAYBACK_STATES.STOPPED, 0)} />
        <ToolbarButton iconKey="reset" label="시간 초기화" showLabel onClick={() => command(MOVEMENT_PLAYBACK_STATES.PAUSED, 0)} />
      </div>
      <label>
        <span>시간</span>
        <input type="range" min="0" max={duration} step="0.05" value={currentTime} onChange={(event) => command(MOVEMENT_PLAYBACK_STATES.PAUSED, Number(event.target.value))} />
        <output>{currentTime.toFixed(1)} / {duration.toFixed(1)}초</output>
      </label>
      <span className={styles.state}>{({ PLAYING: "재생 중", PAUSED: "일시정지", STOPPED: "정지" })[playback.status]}</span>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </section>
  );
}
