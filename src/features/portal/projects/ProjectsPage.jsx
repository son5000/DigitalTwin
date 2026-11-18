import { useEffect, useRef, useState } from "react";
import { GridViewIcon, ListViewIcon } from "@/components/icons";
import Brand from "../components/Brand";
import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { canOpenProjectViewer, createProject, getProjectDetails, openProject, openRemoteProject, readProjects, removeProject } from "./projectRepository";
import styles from "./ProjectsPage.module.css";
import { downloadProjectBundle, exportProjectBundle, importProjectBundle } from "./projectBundle";
import { projectApiBase } from "./projectConfigurationApi";
import { listProjectConfigurations } from "./projectListApi";
import { loadEditableProject } from "./projectEditApi";
import ProjectDeleteDialog from "./ProjectDeleteDialog";
import ProjectViewerLinksDialog from "./ProjectViewerLinksDialog";
import { canUseDeveloperViewer } from "../portalSession.js";

const PROJECT_VIEW_STORAGE_KEY = "digital-twin-projects-view-v1";

function readProjectView() {
  try { return window.localStorage.getItem(PROJECT_VIEW_STORAGE_KEY) === "list" ? "list" : "grid"; }
  catch { return "grid"; }
}

export default function ProjectsPage() {
  const developerViewerAvailable = canUseDeveloperViewer();
  const [result, setResult] = useState({ projects: [], loading: true, error: "" });
  const [serverResult, setServerResult] = useState({ items: [], nextCursor: null, loading: Boolean(projectApiBase), error: "" });
  const [bundleState, setBundleState] = useState({ busy: false, message: "", error: false });
  const [viewMode, setViewMode] = useState(readProjectView);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const editControllerRef = useRef(null);
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
    if (editingId) return;
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

  function requestDelete(id, name, localOnly = false, hasLocal = false) {
    setDeleteError("");
    setDeleteTarget({ id, name, localOnly, hasLocal });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    const { id, hasLocal } = deleteTarget;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const local = hasLocal && readProjects().projects.some((project) => project.id === id);
      if (local) removeProject(id);
      if (hasLocal) setResult({ projects: readProjects().projects, loading: false, error: "" });
      setDeleteTarget(null);
    } catch (error) { setDeleteError(`로컬 저장본을 삭제하지 못했습니다. ${error.message}`); }
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
  async function importBundle(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBundleState({ busy: true, message: "구성과 첨부 파일을 가져오고 있습니다.", error: false });
    try {
      await importProjectBundle(file, window.localStorage, { onProgress: (message) => setBundleState({ busy: true, message, error: false }) });
      setResult({ projects: readProjects().projects, loading: false, error: "" });
      setBundleState({ busy: false, message: "구성을 새 프로젝트로 가져왔습니다. 기존 프로젝트는 유지됩니다.", error: false });
    } catch (error) { setBundleState({ busy: false, message: error.message, error: true }); }
  }

  function changeViewMode(mode) {
    setViewMode(mode);
    try { window.localStorage.setItem(PROJECT_VIEW_STORAGE_KEY, mode); }
    catch { /* Keep the selected view for this session when storage is unavailable. */ }
  }

  const localIds = new Set(result.projects.flatMap((project) => [project.id, project.serverProjectId].filter(Boolean)));
  const serverOnlyProjects = serverResult.items.filter((project) => !localIds.has(project.projectId) && !localIds.has(project.externalProjectId));
  const scopeNames = { SITE: "전체 공간·부지", BUILDING: "건물 중심 관측", SINGLE_EQUIPMENT: "단일 설비 관측", MULTI_EQUIPMENT: "다중 설비 관측", CUSTOM: "사용자 정의" };

  return <div className={styles.page}>
    <header className={styles.header}><Brand /><a href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>홈으로</a></header>
    <main className={styles.main}>
      <div className={styles.heading}><span>나의 디지털 트윈</span><h1>프로젝트</h1><p>저장한 월드를 관측하거나 새로운 현장을 만들어 보세요.</p></div>
      <section className={styles.bundleImport} aria-labelledby="bundle-import-title">
        <div className={styles.bundleRow}>
          <div className={styles.bundleCopy}>
            <h2 id="bundle-import-title">설치 구성 가져오기</h2>
            <p>설정 JSON과 대표 이미지·스캔·텍스처가 포함된 ZIP을 새 프로젝트로 가져옵니다.</p>
            <small id="bundle-import-format">.digital-twin.zip · 최대 1GB · 기존 JSON 구성 파일도 지원</small>
          </div>
          <label className={styles.filePicker} data-disabled={bundleState.busy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg>
            <span>{bundleState.busy ? "처리 중…" : "구성 파일 선택"}</span>
            <input className={styles.fileInput} type="file" accept=".zip,.json,application/zip,application/json" aria-label="설치 구성 파일 선택" aria-describedby="bundle-import-format" disabled={bundleState.busy || Boolean(editingId)} onChange={importBundle} />
          </label>
        </div>
        {bundleState.message && <p className={styles.bundleMessage} data-error={bundleState.error} role={bundleState.error ? "alert" : "status"}>{bundleState.message}</p>}
      </section>
      {result.loading ? <p role="status">저장된 프로젝트를 확인하는 중입니다.</p> : <>
        {result.error && <p className={styles.notice} role="alert">{result.error}</p>}
        {serverResult.error && <p className={styles.notice} role="alert">서버 프로젝트 목록을 불러오지 못했습니다. {serverResult.error}</p>}
        {serverResult.loading && <p role="status">서버 프로젝트 목록을 확인하는 중입니다.</p>}
        <div className={styles.listToolbar}>
          <span>저장된 프로젝트 <strong>{result.projects.length + serverOnlyProjects.length}</strong></span>
          <div className={styles.viewToggle} role="group" aria-label="프로젝트 보기 방식">
            <button type="button" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon size={17} /><span>카드 보기</span></button>
            <button type="button" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon size={17} /><span>리스트 보기</span></button>
          </div>
        </div>
        {!result.projects.length && !serverOnlyProjects.length && !serverResult.loading && <div className={styles.empty}><h2>아직 저장된 프로젝트나 뷰어가 없습니다</h2><p>새 월드를 만들고 관측할 부지, 건축물 또는 설비를 선택하세요.</p></div>}
        <div className={styles.grid} data-view={viewMode}>
          {serverOnlyProjects.map((project) => {
            const scope = scopeNames[project.scopeType] ?? scopeNames.SITE;
            const image = project.scopeType.includes("EQUIPMENT") ? "sensors" : project.scopeType === "BUILDING" ? "building" : "site";
            const modified = new Date(project.updatedAt);
            return <article key={project.projectId} className={styles.card} aria-label={project.name}>
              <img className={styles.thumbnail} src={project.thumbnailUrl || `/portal/workflow-${image}.svg`} alt={`${scope} 미리보기`} width="800" height="480" />
              <div className={styles.cardBody}><div className={styles.cardInfo}><span className={styles.status} data-draft={project.status === "DRAFT"}>{project.status === "DRAFT" ? "작업 중" : "저장 완료"}</span><h2>{project.name}</h2><p>{scope}</p><small>최근 수정 · {Number.isNaN(modified.getTime()) ? "수정일 정보 없음" : modified.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}</small></div>
                <div className={styles.actions}>
                  <button className={project.status === "DRAFT" ? styles.primary : undefined} disabled={Boolean(editingId)} onClick={() => enterProject(project)}>{editingId === project.projectId ? "불러오는 중…" : project.status === "DRAFT" ? "이어서 편집" : "편집하기"}</button>
                  {project.publishedRevision ? <button className={project.status === "DRAFT" ? undefined : styles.primary} disabled={Boolean(editingId)} onClick={() => navigateTo(`/viewer?project=${encodeURIComponent(project.projectId)}`)}>뷰어 열기</button> : null}
                  {project.publishedRevision ? <button disabled={Boolean(editingId)} onClick={() => setLinkTarget({ id: project.projectId, name: project.name, localOnly: false, draft: project.status === "DRAFT" })}>직접 링크</button> : null}
                  {developerViewerAvailable && project.publishedRevision ? <button className={styles.developer} disabled={Boolean(editingId)} onClick={() => navigateTo(`/viewer?project=${encodeURIComponent(project.projectId)}&developer=1`)} aria-label={`${project.name} 개발자 뷰어 열기`} title="테스트 데이터를 주입할 수 있는 뷰어">개발자 뷰어</button> : null}
                  <button className={styles.danger} disabled title="백엔드 프로젝트 삭제 API가 제공되지 않습니다.">삭제 불가</button>
                </div>
              </div>
            </article>;
          })}
          {result.projects.map((project) => {
            const details = getProjectDetails(project);
            const serverProject = serverResult.items.find((item) => item.projectId === (project.serverProjectId ?? project.id)
              || item.externalProjectId === project.id);
            const viewerProjectId = projectApiBase && project.storageMode === "SERVER"
              ? project.serverProjectId ?? project.id : project.id;
            const canOpenViewer = canOpenProjectViewer(project, serverProject, Boolean(projectApiBase));
            return <article key={project.id} className={styles.card} aria-label={details.name}>
              <img className={styles.thumbnail} src={details.thumbnail} alt={`${details.scope} 미리보기`} width="800" height="480" />
              <div className={styles.cardBody}><div className={styles.cardInfo}><span className={styles.status} data-draft={details.isDraft}>{details.status}</span><h2>{details.name}</h2><p>{details.scope}</p><small>최근 수정 · {details.modified}</small></div>
                <div className={styles.actions}>
                  {details.isDraft ? <button className={styles.primary} disabled={Boolean(editingId)} onClick={() => enterProject(project)}>{editingId === project.id ? "불러오는 중…" : "이어서 편집"}</button> : null}
                  {canOpenViewer ? <button className={details.isDraft ? undefined : styles.primary} disabled={Boolean(editingId)} onClick={() => navigateTo(`/viewer?project=${encodeURIComponent(viewerProjectId)}`)}>{details.isDraft && !serverProject?.publishedRevision ? "현재 구성 미리보기" : "뷰어 열기"}</button> : null}
                  {canOpenViewer ? <button disabled={Boolean(editingId)} onClick={() => setLinkTarget({ id: viewerProjectId, name: details.name, layout: !projectApiBase || project.storageMode !== "SERVER" ? project.layout : null, localOnly: !projectApiBase || project.storageMode !== "SERVER", draft: details.isDraft })}>직접 링크</button> : null}
                  {developerViewerAvailable && <button className={styles.developer} disabled={Boolean(editingId)} onClick={() => navigateTo(`/viewer?project=${encodeURIComponent(viewerProjectId)}&developer=1`)} aria-label={`${details.name} 개발자 뷰어 열기`} title="테스트 데이터를 주입할 수 있는 뷰어">개발자 뷰어</button>}
                  {!details.isDraft ? <button disabled={Boolean(editingId)} onClick={() => enterProject(project)}>{editingId === project.id ? "불러오는 중…" : "편집하기"}</button> : null}
                  <button disabled={bundleState.busy || Boolean(editingId)} onClick={() => exportBundle(project)}>ZIP 내보내기</button>
                  <button className={styles.danger} aria-label={`${details.name} 로컬 저장본 삭제`} disabled={Boolean(editingId)} onClick={() => requestDelete(project.id, details.name, true, true)}>로컬 삭제</button>
                </div>
              </div>
            </article>;
          })}
          <button className={`${styles.card} ${styles.newCard}`} disabled={Boolean(editingId)} onClick={() => enterProject()}><span aria-hidden="true">＋</span><strong>새 월드 만들기</strong><small>관측 범위 선택부터 시작하세요</small></button>
        </div>
        {serverResult.nextCursor && <button type="button" disabled={serverResult.loading || Boolean(editingId) || deleteBusy} onClick={loadMoreProjects}>{serverResult.loading ? "불러오는 중…" : "프로젝트 더 보기"}</button>}
      </>}
    </main>
    {deleteTarget && <ProjectDeleteDialog name={deleteTarget.name} serverDelete={false} serverCopy={Boolean(projectApiBase && result.projects.find((item) => item.id === deleteTarget.id)?.serverProjectId)} busy={deleteBusy} error={deleteError}
      onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }} onConfirm={confirmDelete} />}
    {linkTarget && <ProjectViewerLinksDialog key={linkTarget.id} projectId={linkTarget.id} name={linkTarget.name}
      layout={linkTarget.layout} localOnly={linkTarget.localOnly} draft={linkTarget.draft} onClose={() => setLinkTarget(null)} />}
  </div>;
}
