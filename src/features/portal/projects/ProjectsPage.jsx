import { useEffect, useRef, useState } from "react";
import { GridViewIcon, ListViewIcon } from "@/components/icons";
import Brand from "../components/Brand";
import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { canOpenProjectViewer, createProject, getProjectDetails, openProject, openRemoteProject, readProjects, removeProject } from "./projectRepository";
import styles from "./ProjectsPage.module.css";
import { downloadProjectBundle, exportProjectBundle, importProjectBundle } from "./projectBundle";
import { projectApiBase } from "./projectConfigurationApi";
import { listProjectConfigurations } from "./projectListApi";
import { selectProjectList } from "./projectListView";
import { loadEditableProject } from "./projectEditApi";
import { deleteProjectConfiguration } from "./projectDeleteApi";
import ProjectThumbnail from "./ProjectThumbnail";
import ProjectDeleteDialog from "./ProjectDeleteDialog";
import ProjectViewerLinksDialog from "./ProjectViewerLinksDialog";
import { persistImportedProject } from "./projectPersistence.js";

const PROJECT_VIEW_STORAGE_KEY = "digital-twin-projects-view-v1";

function readProjectView() {
  try { return window.localStorage.getItem(PROJECT_VIEW_STORAGE_KEY) === "list" ? "list" : "grid"; }
  catch { return "grid"; }
}

export default function ProjectsPage() {
  const [result, setResult] = useState({ projects: [], loading: true, error: "" });
  const [serverResult, setServerResult] = useState({ items: [], nextCursor: null, loading: Boolean(projectApiBase), error: "" });
  const [bundleState, setBundleState] = useState({ busy: false, message: "", error: false });
  const [viewMode, setViewMode] = useState(readProjectView);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("updated-desc");
  const [expandedProjectKey, setExpandedProjectKey] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const editControllerRef = useRef(null);
  const importControllerRef = useRef(null);
  const importBusyRef = useRef(false);
  const importAttemptRef = useRef(null);
  useEffect(() => () => importControllerRef.current?.abort(), []);
  useEffect(() => () => editControllerRef.current?.abort(), []);
  useEffect(() => {
    const refresh = () => {
      try { setResult({ projects: readProjects().projects, loading: false, error: "" }); }
      catch (error) { setResult({ projects: [], loading: false, error: error.message }); }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (!projectApiBase) return;
    const controller = new AbortController();
    listProjectConfigurations({ signal: controller.signal })
      .then((page) => { if (!controller.signal.aborted) setServerResult({ items: page.items, nextCursor: page.nextCursor, loading: false, error: "" }); })
      .catch((error) => { if (!controller.signal.aborted) setServerResult((value) => ({ ...value, loading: false, error: error.message })); });
    return () => controller.abort();
  }, []);

  async function loadMoreProjects() {
    if (!serverResult.nextCursor || serverResult.loading) return;
    setServerResult((value) => ({ ...value, loading: true, error: "" }));
    try {
      const page = await listProjectConfigurations({ cursor: serverResult.nextCursor });
      setServerResult((value) => ({ items: [...value.items, ...page.items.filter((item) => !value.items.some((existing) => existing.projectId === item.projectId))], nextCursor: page.nextCursor, loading: false, error: "" }));
    } catch (error) { setServerResult((value) => ({ ...value, loading: false, error: error.message })); }
  }

  async function enterProject(project = null) {
    if (editingId || importBusyRef.current) return;
    const id = project?.id ?? project?.projectId;
    setEditingId(id ?? "new");
    try {
      if (!project) createProject();
      else if (project.projectId || project.storageMode === "SERVER"
        && project.layout.savedAt === project.serverSavedAt && projectApiBase) {
        const controller = new AbortController();
        editControllerRef.current = controller;
        const serverId = project.projectId ?? project.serverProjectId ?? id;
        const loaded = await loadEditableProject(serverId, controller.signal);
        openRemoteProject(id, loaded.layout, loaded.revision, window.localStorage, serverId);
      } else openProject(id);
      navigateTo("/editor");
    } catch (error) { setResult((value) => ({ ...value, error: `프로젝트를 열지 못했습니다. ${error.message}` })); }
    finally { editControllerRef.current = null; setEditingId(null); }
  }

  function requestDelete(id, name, serverId = null) {
    setDeleteError("");
    setDeleteTarget({ id, name, serverId, serverDeleted: false });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy || importBusyRef.current) return;
    const { id, serverId } = deleteTarget;
    let serverDeleted = deleteTarget.serverDeleted;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      // Never discard the browser copy until the server confirms deletion.
      if (serverId && !serverDeleted) {
        await deleteProjectConfiguration(serverId);
        serverDeleted = true;
        setDeleteTarget((target) => ({ ...target, serverDeleted: true }));
      }
      if (serverId) setServerResult((value) => ({ ...value, items: value.items.filter((item) => item.projectId !== serverId) }));
      const localCopies = readProjects().projects.filter((project) => project.id === id
        || serverId && (project.id === serverId || project.serverProjectId === serverId));
      for (const project of localCopies) removeProject(project.id);
      setResult({ projects: readProjects().projects, loading: false, error: "" });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(`${serverDeleted ? "서버 삭제는 완료됐지만 이 브라우저의 저장본을 정리하지 못했습니다. 다시 시도하면 로컬 정리만 진행합니다."
        : serverId ? "서버 삭제에 실패했습니다. 로컬 저장본은 유지됩니다." : "로컬 저장본을 삭제하지 못했습니다."} ${error.message}`);
    }
    finally { setDeleteBusy(false); }
  }

  async function exportBundle(project) {
    setBundleState({ busy: true, message: "모델·텍스처와 ROI 구성을 묶고 있습니다.", error: false });
    try {
      const blob = await exportProjectBundle(project, { onProgress: (message) => setBundleState({ busy: true, message, error: false }) });
      downloadProjectBundle(blob, project);
      setBundleState({ busy: false, message: "설정 JSON과 대표 이미지·스캔·텍스처를 ZIP으로 내보냈습니다. 실시간 센서 데이터는 설치 환경에서 연결하세요.", error: false });
    } catch (error) { setBundleState({ busy: false, message: error.message, error: true }); }
  }
  async function saveImportedProject(localId) {
    if (importBusyRef.current) return;
    const controller = new AbortController();
    importControllerRef.current = controller;
    importBusyRef.current = true;
    setBundleState({ busy: true, message: "서버 저장을 준비하는 중입니다.", error: false });
    let saved;
    try {
      saved = await persistImportedProject(localId, undefined, { signal: controller.signal,
        checkpoint: importAttemptRef.current?.localId === localId ? importAttemptRef.current : undefined,
        onProgress: (message) => setBundleState({ busy: true, message, error: false }) });
      importAttemptRef.current = null;
      setResult({ projects: readProjects().projects, loading: false, error: "" });
      setBundleState({ busy: false, message: `서버 초안 저장 완료 · 버전 ${saved.revision}. 게시되지 않았습니다.`, error: false });
      try {
        const page = await listProjectConfigurations({ signal: controller.signal });
        setServerResult({ ...page, loading: false, error: "" });
      } catch (error) { setServerResult((value) => ({ ...value, loading: false, error: `초안 저장은 완료됐지만 목록 갱신에 실패했습니다. ${error.message}` })); }
    } catch (error) {
      importAttemptRef.current = error.importCheckpoint ?? importAttemptRef.current;
      const revision = saved?.revision ?? error.importCheckpoint?.saved?.revision;
      setBundleState({ busy: false, error: true, retryId: localId,
        message: `${revision ? `서버 버전 ${revision} 저장 완료 · 브라우저 상태 갱신 실패` : "로컬 가져오기 완료 · 서버 저장 실패 또는 결과 미확인"}: ${error.message}${error.code ? ` (${error.code})` : ""}${error.requestId ? ` · 요청 ${error.requestId}` : ""}${error.fields ? ` · ${JSON.stringify(error.fields)}` : ""}` });
      try { setResult({ projects: readProjects().projects, loading: false, error: "" }); } catch { /* Retain the previous list. */ }
    } finally {
      importBusyRef.current = false;
      importControllerRef.current = null;
    }
  }

  async function importBundle(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || importBusyRef.current) return;
    importBusyRef.current = true;
    setBundleState({ busy: true, message: "구성과 첨부 파일을 가져오고 있습니다.", error: false });
    try {
      const localId = await importProjectBundle(file, window.localStorage, { onProgress: (message) => setBundleState({ busy: true, message, error: false }) });
      setResult({ projects: readProjects().projects, loading: false, error: "" });
      if (projectApiBase) {
        importBusyRef.current = false;
        await saveImportedProject(localId);
      }
      else setBundleState({ busy: false, message: "로컬 가져오기 완료 · 프로젝트 API 주소가 없어 서버에는 저장되지 않았습니다.", error: false });
    } catch (error) { setBundleState({ busy: false, message: error.message, error: true }); }
    finally { importBusyRef.current = false; }
  }

  function changeViewMode(mode) {
    setViewMode(mode);
    try { window.localStorage.setItem(PROJECT_VIEW_STORAGE_KEY, mode); }
    catch { /* Keep the selected view for this session when storage is unavailable. */ }
  }

  const projectList = selectProjectList(result.projects, serverResult.items, { query: searchQuery, sort: sortOrder });
  const scopeNames = { SITE: "공간·부지", BUILDING: "건물", SINGLE_EQUIPMENT: "단일 설비", MULTI_EQUIPMENT: "다중 설비", CUSTOM: "사용자 정의" };

  return <div className={styles.page}>
    <header className={styles.header}><Brand /><a href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>홈으로</a></header>
    <main className={styles.main}>
      <div className={styles.heading}><span>나의 디지털 트윈</span><h1>프로젝트</h1><p>저장한 월드를 관측하거나 새로운 현장을 만들어 보세요.</p></div>
      <section className={styles.bundleImport} aria-labelledby="bundle-import-title">
        <div className={styles.bundleRow}>
          <div className={styles.bundleCopy}>
            <h2 id="bundle-import-title">설치 구성 가져오기</h2>
            <p>설정 JSON과 대표 이미지·스캔·텍스처가 포함된 ZIP을 새 프로젝트로 가져옵니다.</p>
            <small id="bundle-import-format">로컬 가져오기 최대 1GiB · 서버 자산 ZIP 최대 512MiB · 서버 구성 요청 최대 1MiB</small>
          </div>
          <label className={styles.filePicker} data-disabled={bundleState.busy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg>
            <span>{bundleState.busy ? "처리 중…" : "구성 파일 선택"}</span>
            <input className={styles.fileInput} type="file" accept=".zip,.json,application/zip,application/json" aria-label="설치 구성 파일 선택" aria-describedby="bundle-import-format" disabled={bundleState.busy || Boolean(editingId)} onChange={importBundle} />
          </label>
        </div>
        {bundleState.message && <p className={styles.bundleMessage} data-error={bundleState.error} role={bundleState.error ? "alert" : "status"}>{bundleState.message}</p>}
        {bundleState.retryId && <button type="button" className={styles.filePicker} disabled={bundleState.busy} onClick={() => saveImportedProject(bundleState.retryId)}>서버 저장 재시도</button>}
      </section>
      {result.loading ? <p role="status">저장된 프로젝트를 확인하는 중입니다.</p> : <>
        {result.error && <p className={styles.notice} role="alert">{result.error}</p>}
        {serverResult.error && <p className={styles.notice} role="alert">서버 프로젝트 목록을 불러오지 못했습니다. {serverResult.error}</p>}
        {serverResult.loading && <p role="status">서버 프로젝트 목록을 확인하는 중입니다.</p>}
        <div className={styles.listToolbar}>
          <span role="status">저장된 프로젝트 <strong>{projectList.total}</strong>{searchQuery.trim() && <> · 검색 결과 <strong>{projectList.items.length}</strong></>}</span>
          <div className={styles.toolbarActions}>
            <div className={styles.viewToggle} role="group" aria-label="프로젝트 보기 방식">
              <button type="button" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon size={17} /><span>카드</span></button>
              <button type="button" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon size={17} /><span>리스트</span></button>
            </div>
            <button type="button" className={styles.createButton} disabled={Boolean(editingId)} onClick={() => enterProject()}>{editingId === "new" ? "생성 중…" : "새 프로젝트"}</button>
          </div>
          <div className={styles.listControls}>
            <label className={styles.searchField}><span>프로젝트 검색</span><input type="search" placeholder="프로젝트 이름 검색" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
            <label className={styles.sortField}><span>정렬</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="updated-desc">최근 수정순</option>
              <option value="updated-asc">오래된 수정순</option>
              <option value="name-asc">이름 오름차순</option>
              <option value="name-desc">이름 내림차순</option>
            </select></label>
          </div>
          {serverResult.nextCursor && <small>검색·정렬은 현재 불러온 프로젝트에 적용됩니다. 더 보기를 눌러 나머지 프로젝트를 불러올 수 있습니다.</small>}
        </div>
        {!projectList.total && !serverResult.loading && <div className={styles.empty}><h2>등록된 프로젝트가 없습니다</h2><p>새 프로젝트를 생성하거나 구성 파일을 가져오세요.</p></div>}
        {projectList.total > 0 && !projectList.items.length && <div className={styles.empty}><h2>검색 결과가 없습니다</h2><p>다른 프로젝트 이름으로 검색하거나 검색어를 지워 주세요.</p></div>}
        <div className={styles.grid} data-view={viewMode}>
          {projectList.items.map(({ project, isLocal, key }) => {
            const scopeType = isLocal ? project.layout.observationWorkflow?.scopeType ?? "SITE" : project.scopeType;
            const scope = scopeNames[scopeType] ?? scopeNames.SITE;
            const image = scopeType.includes("EQUIPMENT") ? "sensors" : scopeType === "BUILDING" ? "building" : "site";
            const modified = new Date(isLocal ? project.layout.savedAt : project.updatedAt);
            const details = isLocal ? getProjectDetails(project) : {
              name: project.name,
              thumbnail: project.thumbnailUrl || `/portal/workflow-${image}.svg`,
              isDraft: project.status === "DRAFT",
              status: project.status === "DRAFT" ? "작업 중" : "저장 완료",
              modified: Number.isNaN(modified.getTime()) ? "수정일 정보 없음" : modified.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }),
            };
            const localOnly = isLocal && (!projectApiBase || project.storageMode !== "SERVER");
            const viewerProjectId = isLocal ? localOnly ? project.id : project.serverProjectId ?? project.id : project.projectId;
            const canOpenViewer = isLocal ? canOpenProjectViewer(project) : Boolean(project.publishedRevision);
            const serverProject = isLocal ? serverResult.items.find((item) => item.projectId === (project.serverProjectId ?? project.id) || item.externalProjectId === project.id) : project;
            const deleteServerId = projectApiBase ? serverProject?.projectId ?? project.serverProjectId ?? (project.storageMode === "SERVER" ? project.id : null) : null;
            const expanded = expandedProjectKey === key;
            const toolsId = `project-tools-${key}`;
            return <article key={key} className={styles.card} aria-label={details.name}>
              <ProjectThumbnail key={viewMode} source={details.thumbnail} name={details.name} preview={viewMode === "list"} />
              <div className={styles.cardBody}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardHeading}><h2 title={details.name}>{details.name}</h2><span className={styles.status} data-draft={details.isDraft}>{details.status}</span></div>
                  <div className={styles.cardMeta}><span>{scope}</span><span>{Number.isNaN(modified.getTime()) ? details.modified : <>수정 <time dateTime={modified.toISOString()}>{details.modified}</time></>}</span></div>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.actions}>
                    {canOpenViewer && <button type="button" className={styles.primary} disabled={Boolean(editingId)} onClick={() => navigateTo(`/viewer?project=${encodeURIComponent(viewerProjectId)}`)}>뷰어</button>}
                    <button type="button" className={!canOpenViewer ? styles.primary : undefined} disabled={Boolean(editingId)} onClick={() => enterProject(project)}>{editingId === (isLocal ? project.id : project.projectId) ? "여는 중…" : "편집"}</button>
                    <button type="button" className={styles.moreButton} aria-label={`${details.name} 더보기`} aria-expanded={expanded} aria-controls={toolsId} onClick={() => setExpandedProjectKey(expanded ? null : key)}>더보기</button>
                  </div>
                  <div id={toolsId} className={styles.secondaryActions} hidden={!expanded} onKeyDown={(event) => { if (event.key === "Escape") { setExpandedProjectKey(null); event.currentTarget.previousElementSibling?.querySelector('[aria-expanded]')?.focus(); } }}>
                    {canOpenViewer && <button type="button" disabled={Boolean(editingId)} onClick={() => setLinkTarget({ id: viewerProjectId, name: details.name, layout: localOnly ? project.layout : null, localOnly, draft: details.isDraft })}>뷰어 링크</button>}
                    {isLocal && <button type="button" disabled={bundleState.busy || Boolean(editingId)} onClick={() => exportBundle(project)}>ZIP 내보내기</button>}
                    {isLocal && project.pendingSave && projectApiBase && <button type="button" disabled={bundleState.busy || Boolean(editingId)} onClick={() => saveImportedProject(project.id)}>서버 저장 재시도</button>}
                    {isLocal && project.pendingSave && project.serverProjectId && <button type="button" disabled={bundleState.busy || Boolean(editingId)} onClick={() => enterProject({ projectId: project.serverProjectId })}>서버본 확인</button>}
                    <button type="button" className={styles.danger} aria-label={`${details.name} ${deleteServerId ? "프로젝트" : "로컬 저장본"} 삭제`} disabled={Boolean(editingId)} onClick={() => requestDelete(isLocal ? project.id : project.projectId, details.name, deleteServerId)}>{deleteServerId ? "프로젝트 삭제" : "로컬 삭제"}</button>
                  </div>
                </div>
              </div>
            </article>;
          })}
        </div>
        {serverResult.nextCursor && <button type="button" disabled={serverResult.loading || Boolean(editingId) || deleteBusy} onClick={loadMoreProjects}>{serverResult.loading ? "불러오는 중…" : "프로젝트 더 보기"}</button>}
      </>}
    </main>
    {deleteTarget && <ProjectDeleteDialog name={deleteTarget.name} serverDelete={Boolean(deleteTarget.serverId)} serverCopy={Boolean(result.projects.find((item) => item.id === deleteTarget.id)?.serverProjectId)} busy={deleteBusy} error={deleteError}
      onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }} onConfirm={confirmDelete} />}
    {linkTarget && <ProjectViewerLinksDialog key={linkTarget.id} projectId={linkTarget.id} name={linkTarget.name}
      layout={linkTarget.layout} localOnly={linkTarget.localOnly} draft={linkTarget.draft} onClose={() => setLinkTarget(null)} />}
  </div>;
}
