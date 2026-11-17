import { useEffect, useMemo, useRef, useState } from "react";
import { viewerLink } from "@/features/digitalTwin/editor/model/roiMonitoring";
import { createWorldTree, getViewerEquipmentContext } from "../viewer/worldTreeModel";
import { loadViewerProjectConfiguration } from "./projectViewerApi";
import styles from "./ProjectsPage.module.css";

export default function ProjectViewerLinksDialog({ projectId, name, layout = null, localOnly, draft, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const linkRef = useRef(null);
  const [viewerLayout, setViewerLayout] = useState(layout);
  const [loading, setLoading] = useState(!layout);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLink, setSelectedLink] = useState(() => viewerLink(projectId));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    if (layout) return;
    const controller = new AbortController();
    loadViewerProjectConfiguration(projectId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setViewerLayout(result.layout); setLoading(false); } })
      .catch((cause) => { if (!controller.signal.aborted) { setError(cause.message); setLoading(false); } });
    return () => controller.abort();
  }, [layout, projectId]);

  const equipment = useMemo(() => {
    if (!viewerLayout) return [];
    const tree = createWorldTree(viewerLayout);
    return [...tree.nodes.values()]
      .filter((node) => ["EQUIPMENT", "SITE_OBJECT"].includes(node.type) && getViewerEquipmentContext(tree, node)?.node === node)
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  }, [viewerLayout]);
  const visibleEquipment = equipment.filter((node) => `${node.label} ${node.id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  async function copyLink(link, label) {
    setSelectedLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setNotice(`${label} 링크를 복사했습니다.`);
    } catch {
      setNotice("자동 복사가 차단되었습니다. 아래 링크를 선택해 복사하세요.");
      requestAnimationFrame(() => { linkRef.current?.focus(); linkRef.current?.select(); });
    }
  }

  return <dialog ref={dialogRef} className={styles.linkDialog} aria-labelledby="viewer-links-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className={styles.linkHeading}><div><h2 id="viewer-links-title">뷰어 직접 링크</h2><p><strong>{name}</strong>의 3D 관제 화면을 외부 프로그램의 버튼에서 바로 열 수 있습니다.</p></div>
      <button ref={closeRef} type="button" onClick={onClose} aria-label="링크 창 닫기">닫기</button></div>
    <p className={styles.linkHint}>{localOnly
      ? "현재 구성은 이 브라우저에만 저장되어 있습니다. 다른 기기에서 열려면 서버에 게시해야 합니다."
      : draft ? "링크는 현재 편집 중인 내용이 아닌 마지막 공개본을 엽니다." : "링크는 서버에 공개된 최신 뷰어 구성을 엽니다."}</p>
    <section className={styles.linkSection} aria-label="프로젝트 뷰어 링크">
      <div className={styles.linkRow}><span>기본 관측 화면</span><button type="button" aria-label="기본 관측 화면 링크 복사" onClick={() => copyLink(viewerLink(projectId), "기본 관측 화면")}>링크 복사</button></div>
    </section>
    <section className={styles.linkSection} aria-label="설비별 뷰어 링크">
      <h3>설비 상세 바로 열기</h3>
      {loading ? <p role="status">공개본의 설비 목록을 불러오는 중입니다.</p>
        : error ? <p role="alert">설비 목록을 불러오지 못했습니다. {error}</p>
          : equipment.length ? <>
            <input className={styles.linkSearch} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="설비 이름 검색" aria-label="설비 링크 검색" />
            <ul className={styles.linkEquipmentList}>{visibleEquipment.map((node) => <li key={node.key} className={styles.linkRow}>
              <span title={node.id}>{node.label}</span><button type="button" aria-label={`${node.label} 상세 뷰어 링크 복사`} onClick={() => copyLink(viewerLink(projectId, node.id), node.label)}>링크 복사</button>
            </li>)}</ul>
            {!visibleEquipment.length && <p>검색 결과가 없습니다.</p>}
          </> : <p>이 뷰어에 등록된 설비가 없습니다.</p>}
    </section>
    <label className={styles.linkSelected}>선택한 링크<input ref={linkRef} readOnly value={selectedLink} onFocus={(event) => event.target.select()} /></label>
    {notice && <p className={styles.linkNotice} role="status">{notice}</p>}
  </dialog>;
}
