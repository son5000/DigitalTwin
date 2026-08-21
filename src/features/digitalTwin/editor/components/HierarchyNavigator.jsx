import { useMemo, useState } from "react";

import {
  HIERARCHY_CHILD_TYPES,
  HIERARCHY_TYPE_LABELS,
} from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";

import styles from "./HierarchyNavigator.module.css";

function flattenHierarchy(nodes, rootId) {
  const childrenByParent = new Map();
  nodes.forEach((node) => {
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  });

  const flattened = [];
  const visited = new Set();
  function visit(node, depth) {
    if (!node || visited.has(node.id)) return;
    visited.add(node.id);
    flattened.push({ node, depth });
    (childrenByParent.get(node.id) ?? []).forEach((child) => visit(child, depth + 1));
  }

  visit(nodes.find((node) => node.id === rootId), 0);
  return flattened;
}

export default function HierarchyNavigator({
  hierarchy,
  path,
  rooms,
  protectedNodeIds,
  showQuickAddRoom = true,
  onRoomChange,
  onNavigateNode,
  onAddRoom,
  onSelectNode,
  onAddChild,
  onRenameNode,
  onDeleteNode,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const treeItems = useMemo(
    () => flattenHierarchy(hierarchy.nodes, hierarchy.rootId),
    [hierarchy.nodes, hierarchy.rootId],
  );

  function beginRename(node) {
    setEditingNodeId(node.id);
    setDraftName(node.name);
  }

  function commitRename() {
    if (!editingNodeId || !draftName.trim()) return;
    onRenameNode(editingNodeId, draftName);
    setEditingNodeId(null);
  }

  function handleDelete(node) {
    if (window.confirm(`${node.name}과(와) 모든 하위 항목을 삭제할까요?`)) {
      onDeleteNode(node.id);
    }
  }

  return (
    <div className={styles.navigator} aria-label="디지털 트윈 계층">
      <div
        className={styles.pathButton}
        title={path.map((node) => node.name).join(" / ")}
      >
        <span className={styles.path}>
          {path.map((node, index) => (
            <span key={node.id} className={styles.pathItem}>
              {index > 0 ? <span className={styles.separator} aria-hidden="true">/</span> : null}
              <button type="button" onClick={() => onNavigateNode(node.id)}>{node.name}</button>
            </span>
          ))}
        </span>
        <button
          type="button"
          className={styles.treeToggle}
          aria-expanded={isOpen}
          aria-label="월드 계층 열기"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className={styles.chevron} aria-hidden="true">▾</span>
        </button>
      </div>
      <label className={styles.roomControl}>
        <span className={styles.srOnly}>현재 공간</span>
        <select value={hierarchy.activeRoomId ?? ""} disabled={!rooms.length} onChange={(event) => onRoomChange(event.target.value)}>
          {!rooms.length ? <option value="">공간 없음</option> : null}
          {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
        </select>
      </label>
      {showQuickAddRoom ? (
        <button type="button" className={styles.addButton} onClick={onAddRoom} title="현재 층에 공간 추가">
          + 공간
        </button>
      ) : null}

      {isOpen ? (
        <section className={styles.treePanel} aria-label="월드 계층 편집기">
          <div className={styles.panelHeader}>
            <div>
              <span>월드 구조</span>
              <strong>디지털 트윈 계층</strong>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="계층 패널 닫기">×</button>
          </div>
          <div className={styles.tree}>
            {treeItems.map(({ node, depth }) => {
              const childType = HIERARCHY_CHILD_TYPES[node.type];
              const isProtected = protectedNodeIds.has(node.id);
              const isSelected = hierarchy.selectedNodeId === node.id;

              return (
                <div key={node.id} className={`${styles.treeItem} ${isSelected ? styles.selectedItem : ""}`} style={{ "--tree-depth": depth }}>
                  {editingNodeId === node.id ? (
                    <form className={styles.renameForm} onSubmit={(event) => { event.preventDefault(); commitRename(); }}>
                      <input
                        autoFocus
                        value={draftName}
                        aria-label={`${HIERARCHY_TYPE_LABELS[node.type]} 이름`}
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditingNodeId(null);
                        }}
                      />
                      <button type="submit" disabled={!draftName.trim()} aria-label="이름 저장">✓</button>
                      <button type="button" onClick={() => setEditingNodeId(null)} aria-label="이름 변경 취소">×</button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.nodeButton}
                        onClick={() => onSelectNode(node.id)}
                        onDoubleClick={() => onNavigateNode(node.id)}
                        title="한 번 클릭: 선택 · 더블 클릭: 해당 단계로 이동"
                      >
                        <span className={styles.nodeType}>{node.type.slice(0, 1)}</span>
                        <span className={styles.nodeText}>
                          <strong>{node.name}</strong>
                          <small>{HIERARCHY_TYPE_LABELS[node.type]}</small>
                        </span>
                        {hierarchy.activeRoomId === node.id ? <span className={styles.liveBadge}>열림</span> : null}
                      </button>
                      <div className={styles.nodeActions}>
                        {childType ? (
                          <button type="button" onClick={() => onAddChild(node.id)} title={`${HIERARCHY_TYPE_LABELS[childType]} 추가`}>＋</button>
                        ) : null}
                        <button type="button" onClick={() => beginRename(node)} title="이름 변경">✎</button>
                        <button type="button" disabled={isProtected} onClick={() => handleDelete(node)} title={isProtected ? "현재 열린 경로는 삭제할 수 없습니다" : "삭제"}>−</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className={styles.panelHint}>한 번 클릭은 선택, 더블 클릭은 해당 편집 단계로 이동합니다.</p>
        </section>
      ) : null}
    </div>
  );
}
