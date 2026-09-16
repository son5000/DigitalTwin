import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon } from "@/components/icons/actionIcons";
import { getTreeAncestors, toggleTreeNode } from "./worldTreeModel";
import styles from "./WorldTreePanel.module.css";

function Snapshot({ tree, snapshot, representativeImage }) {
  const [failed, setFailed] = useState(false);
  const source = !failed && (representativeImage || snapshot?.url)
    ? representativeImage || snapshot.url
    : tree.config.placeholder;
  return <div className={styles.snapshot}>
    <img src={source} alt={`${tree.root?.label ?? tree.config.label} 대표 이미지`} onError={() => setFailed(true)} />
    <div className={styles.snapshotCaption}>{representativeImage && !failed ? `${tree.config.label} · 대표 이미지` : snapshot?.url && !failed ? `${tree.config.label} · 실제 월드 스냅샷` : snapshot?.failed || failed ? "스냅샷을 불러오지 못했습니다" : "월드 스냅샷 준비 중"}</div>
  </div>;
}

export default function WorldTreePanel({ tree, snapshot, representativeImage, selectedKey, selectionVersion, onSelect }) {
  const [expansion, setExpansion] = useState(() => ({ selectedKey, selectionVersion, keys: new Set([...tree.roots.map((node) => node.key), ...getTreeAncestors(tree, selectedKey)]) }));
  const containerRef = useRef(null);
  let expanded = expansion.keys;
  if (expansion.selectedKey !== selectedKey || expansion.selectionVersion !== selectionVersion) {
    expanded = new Set([...expanded, ...getTreeAncestors(tree, selectedKey)]);
    setExpansion({ selectedKey, selectionVersion, keys: expanded });
  }
  useEffect(() => {
    containerRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedKey, selectionVersion]);
  function renderNode(node) {
    const open = expanded.has(node.key);
    return <li key={node.key}>
      <div className={`${styles.row} ${selectedKey === node.key ? styles.selected : ""}`}>
        {node.children.length ? <button type="button" className={styles.toggle} aria-label={`${node.label} ${open ? "접기" : "펼치기"}`} aria-expanded={open}
          onClick={() => setExpansion({ selectedKey, selectionVersion, keys: toggleTreeNode(expanded, node.key) })}><ChevronRightIcon size={13} /></button> : <span className={styles.spacer} />}
        <button type="button" className={styles.label} aria-current={selectedKey === node.key ? "true" : undefined} title={node.label}
          disabled={node.synthetic && !node.selectable} onClick={() => onSelect(node)}>{node.label}</button>
      </div>
      {open && node.children.length > 0 && <ul>{node.children.map(renderNode)}</ul>}
    </li>;
  }
  return <section className={styles.panel} aria-label="월드 계층">
    <Snapshot key={representativeImage ?? snapshot?.url ?? tree.scope} tree={tree} snapshot={snapshot} representativeImage={representativeImage} />
    <div ref={containerRef} className={styles.scroll}>
      {tree.roots.length ? <ul className={styles.tree} aria-label={`${tree.config.label} 계층`}>{tree.roots.map(renderNode)}</ul> : <p className={styles.empty}>등록된 월드 객체가 없습니다.</p>}
    </div>
  </section>;
}
