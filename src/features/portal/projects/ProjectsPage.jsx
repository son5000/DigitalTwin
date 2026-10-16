import { useEffect, useState } from "react";
import Brand from "../components/Brand";
import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { createProject, getProjectDetails, openProject, readProjects } from "./projectRepository";
import styles from "./ProjectsPage.module.css";
import { exportProjectBundle, importProjectBundle } from "./projectBundle";

export default function ProjectsPage() {
  const [result, setResult] = useState({ projects: [], loading: true, error: "" });
  const [bundleState, setBundleState] = useState({ busy: false, message: "", error: false });
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

  function enterProject(id) {
    try {
      if (id) openProject(id);
      else createProject();
      navigateTo("/editor");
    } catch (error) { setResult((value) => ({ ...value, error: `프로젝트를 열지 못했습니다. ${error.message}` })); }
  }

  async function exportBundle(project) {
    setBundleState({ busy: true, message: "모델·텍스처와 ROI 구성을 묶고 있습니다.", error: false });
    try {
      const blob = await exportProjectBundle(project);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `${project.id}.digital-twin.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBundleState({ busy: false, message: "구성을 내보냈습니다. 설치 시 같은 버전의 뷰어 실행 파일과 함께 사용하세요. 외부 센서 주소는 설치 환경에서 연결해야 합니다.", error: false });
    } catch (error) { setBundleState({ busy: false, message: error.message, error: true }); }
  }
  async function importBundle(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBundleState({ busy: true, message: "구성과 첨부 파일을 가져오고 있습니다.", error: false });
    try {
      await importProjectBundle(file);
      setResult({ projects: readProjects().projects, loading: false, error: "" });
      setBundleState({ busy: false, message: "구성을 새 프로젝트로 가져왔습니다. 기존 프로젝트는 유지됩니다.", error: false });
    } catch (error) { setBundleState({ busy: false, message: error.message, error: true }); }
  }

  return <div className={styles.page}>
    <header className={styles.header}><Brand /><a href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>홈으로</a></header>
    <main className={styles.main}>
      <div className={styles.heading}><span>나의 디지털 트윈</span><h1>프로젝트</h1><p>저장한 월드를 관측하거나 새로운 현장을 만들어 보세요.</p></div>
      <section className={styles.bundleImport} aria-labelledby="bundle-import-title">
        <div className={styles.bundleRow}>
          <div className={styles.bundleCopy}>
            <h2 id="bundle-import-title">설치 구성 가져오기</h2>
            <p>내보낸 모델·센서·ROI 설정을 새 프로젝트로 가져옵니다.</p>
            <small id="bundle-import-format">이 서비스에서 내보낸 .digital-twin.json 파일 · 최대 150MB</small>
          </div>
          <label className={styles.filePicker} data-disabled={bundleState.busy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg>
            <span>{bundleState.busy ? "처리 중…" : "구성 파일 선택"}</span>
            <input className={styles.fileInput} type="file" accept=".json,application/json" aria-label="설치 구성 파일 선택" aria-describedby="bundle-import-format" disabled={bundleState.busy} onChange={importBundle} />
          </label>
        </div>
        {bundleState.message && <p className={styles.bundleMessage} data-error={bundleState.error} role={bundleState.error ? "alert" : "status"}>{bundleState.message}</p>}
      </section>
      {result.loading ? <p role="status">저장된 프로젝트를 확인하는 중입니다.</p> : result.error ? <p className={styles.notice} role="alert">{result.error}</p> : <>
        {!result.projects.length && <div className={styles.empty}><h2>아직 저장된 프로젝트나 뷰어가 없습니다</h2><p>새 월드를 만들고 관측할 부지, 건축물 또는 설비를 선택하세요.</p></div>}
        <div className={styles.grid}>
          {result.projects.map((project) => {
            const details = getProjectDetails(project);
            return <article key={project.id} className={styles.card} aria-label={details.name}>
              <img className={styles.thumbnail} src={details.thumbnail} alt={`${details.scope} 미리보기`} width="800" height="480" />
              <div className={styles.cardBody}><span className={styles.status}>{details.status}</span><h2>{details.name}</h2><p>{details.scope}</p><small>최근 수정 · {details.modified}</small>
                <div className={styles.actions}><button className={styles.primary} onClick={() => navigateTo(`/viewer?project=${encodeURIComponent(project.id)}`)}>뷰어 열기</button><button onClick={() => enterProject(project.id)}>편집하기</button><button disabled={bundleState.busy} onClick={() => exportBundle(project)}>구성 내보내기</button></div>
              </div>
            </article>;
          })}
          <button className={`${styles.card} ${styles.newCard}`} onClick={() => enterProject()}><span aria-hidden="true">＋</span><strong>새 월드 만들기</strong><small>관측 범위 선택부터 시작하세요</small></button>
        </div>
      </>}
    </main>
  </div>;
}
