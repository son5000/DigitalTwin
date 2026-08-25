import NumericField from "./NumericField";
import { AddIcon, EnterIcon, SpaceIcon } from "@/components/icons";
import styles from "./RoomLayoutProperties.module.css";

export default function RoomLayoutProperties({ room, scene, roomCount, showEnterAction = true, onChange, onAddRoom, onEnterRoom }) {
  if (!room || !scene) {
    return (
      <section className={styles.emptyState}>
        <span aria-hidden="true"><SpaceIcon size={38} /></span>
        <h2>공간 구획</h2>
        <button type="button" onClick={onAddRoom}><AddIcon size={16} /> 공간 추가</button>
        <small>이 층의 공간 {roomCount}개</small>
      </section>
    );
  }

  const equipmentCount = scene.equipment?.length ?? 0;
  const structureCount = scene.worldStructures?.length ?? 0;

  return (
    <section className={styles.panel}>
      <header className={styles.heading}>
        <span>층 / 공간</span>
        <h2>{room.name}</h2>
      </header>

      <div className={styles.actions}>
        {showEnterAction ? <button type="button" className={styles.primaryButton} onClick={() => onEnterRoom(room.id)}><EnterIcon size={16} /> 상세 월드 열기</button> : null}
        <button type="button" onClick={onAddRoom}><AddIcon size={16} /> 공간</button>
      </div>

      <div className={styles.summary}>
        <div><span>설비</span><strong>{equipmentCount}</strong></div>
        <div><span>구조물</span><strong>{structureCount}</strong></div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h3>공간 크기</h3>
          <span>미터</span>
        </div>
        <div className={styles.fields}>
          <NumericField label="가로" value={scene.world.width} min={3} unit="m" onChange={(width) => onChange({ world: { width } })} />
          <NumericField label="세로" value={scene.world.depth} min={3} unit="m" onChange={(depth) => onChange({ world: { depth } })} />
          <NumericField label="벽 높이" value={scene.world.wallHeight} min={1} unit="m" onChange={(wallHeight) => onChange({ world: { wallHeight } })} />
        </div>
      </div>

      <div className={styles.section}>
        <h3>층 내 위치</h3>
        <div className={styles.fields}>
          <NumericField label="위치 X" value={room.position.x} unit="m" onChange={(x) => onChange({ position: { x } })} />
          <NumericField label="위치 Z" value={room.position.z} unit="m" onChange={(z) => onChange({ position: { z } })} />
          <NumericField
            label="회전 Y"
            value={room.rotation.y * 180 / Math.PI}
            step={1}
            unit="°"
            onChange={(degrees) => onChange({ rotation: { y: degrees * Math.PI / 180 } })}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3>표시</h3>
        <label className={styles.colorField}>
          <span>평면도 색상</span>
          <span>
            <input type="color" value={room.appearance.color} onChange={(event) => onChange({ appearance: { color: event.target.value } })} />
            <code>{room.appearance.color.toUpperCase()}</code>
          </span>
        </label>
      </div>
    </section>
  );
}
