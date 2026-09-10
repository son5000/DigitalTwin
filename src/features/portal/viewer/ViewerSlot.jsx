import { useState } from "react";

import { GridViewIcon, ListViewIcon } from "@/components/icons/actionIcons";
import { Layout2DIcon, View3DIcon } from "@/components/icons/toolbarIcons";
import { assetStatuses, portalContent } from "@/features/portal/portalContent";

import portalStyles from "./ObservationPage.module.css";
import styles from "./ViewerSlot.module.css";

const LEVELS = ["전체", "옥외", "1층", "2층", "3층"];

export default function ViewerSlot({ assets, zoom, onZoomChange, topOpen, bottomOpen, selectedAssetId, onAssetSelect }) {
  const [level, setLevel] = useState("전체");
  const [viewType, setViewType] = useState("3D");
  const visibleAssets = level === "전체" || level === "옥외" ? assets : assets.filter((asset) => asset.floor === level);

  return <main className={styles.main} aria-label="디지털 트윈 관측 뷰어">
    <div className={styles.toolbar} hidden={!topOpen}>
      <div className={styles.segmented}>
        <button type="button" className={viewType === "3D" ? styles.active : ""} onClick={() => setViewType("3D")} aria-pressed={viewType === "3D"}><View3DIcon size={16} /> 3D 월드</button>
        <button type="button" className={viewType === "2D" ? styles.active : ""} onClick={() => setViewType("2D")} aria-pressed={viewType === "2D"}><Layout2DIcon size={16} /> 2D 도면</button>
      </div>
      <div className={styles.toolActions}>
        <button type="button"><GridViewIcon size={15} /> 레이어</button>
        <button type="button"><ListViewIcon size={15} /> 필터</button>
      </div>
    </div>
    <div className={`${styles.stage} ${viewType === "2D" ? styles.stage2d : ""}`}>
      <div className={styles.worldContent} style={{ transform: `scale(${zoom})` }}>
      <img src={portalContent.heroImage} alt="" className={styles.worldImage} />
      <div className={styles.overlay} />
      {visibleAssets.map((asset) => <button type="button" key={asset.id} className={`${styles.pin} ${selectedAssetId === asset.id ? styles.pinSelected : ""}`} style={{ left: asset.position.left, top: asset.position.top, "--status": assetStatuses[asset.status].color }} onClick={() => onAssetSelect(asset.id)} aria-pressed={selectedAssetId === asset.id} aria-label={`${asset.name}, ${assetStatuses[asset.status].label}`}>
        <i /><span><strong>{asset.name}</strong><small>{assetStatuses[asset.status].label} · {asset.status === "normal" ? `${asset.utilization}%` : asset.change}</small></span>
      </button>)}
      </div>
      <div className={portalStyles.zoom} aria-label="월드 줌"><button type="button" title="확대" onClick={() => onZoomChange((value) => Math.min(3, value + 0.25))} disabled={zoom >= 3} aria-label="확대">+</button><output aria-label="현재 줌 비율">{Math.round(zoom * 100)}%</output><button type="button" title="축소" onClick={() => onZoomChange((value) => Math.max(0.5, value - 0.25))} disabled={zoom <= 0.5} aria-label="축소">−</button></div>
    </div>
    <footer className={styles.bottomBar} hidden={!bottomOpen}>
      <div className={styles.levels}><span>층 선택</span>{LEVELS.map((item) => <button type="button" key={item} className={level === item ? styles.active : ""} onClick={() => setLevel(item)} aria-pressed={level === item}>{item}</button>)}</div>
      <div className={styles.legend}>{Object.entries(assetStatuses).map(([id, status]) => <span key={id}><i style={{ "--status": status.color }} />{status.label}</span>)}</div>
    </footer>
  </main>;
}
