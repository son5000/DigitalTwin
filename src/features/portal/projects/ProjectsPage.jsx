import { useEffect, useState } from "react";
import Brand from "../components/Brand";
import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { createProject, getProjectDetails, openProject, readProjects } from "./projectRepository";
import styles from "./ProjectsPage.module.css";

export default function ProjectsPage() {
  const [result, setResult] = useState({ projects: [], loading: true, error: "" });
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

  return <div className={styles.page}>
    <header className={styles.header}><Brand /><a href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>홈으로</a></header>
    <main className={styles.main}>
      <div className={styles.heading}><span>나의 디지털 트윈</span><h1>프로젝트</h1><p>저장한 월드를 관측하거나 새로운 현장을 만들어 보세요.</p></div>
      {result.loading ? <p role="status">저장된 프로젝트를 확인하는 중입니다.</p> : result.error ? <p className={styles.notice} role="alert">{result.error}</p> : <>
        {!result.projects.length && <div className={styles.empty}><h2>아직 저장된 프로젝트나 뷰어가 없습니다</h2><p>새 월드를 만들고 관측할 부지, 건축물 또는 설비를 선택하세요.</p></div>}
        <div className={styles.grid}>
          {result.projects.map((project) => {
            const details = getProjectDetails(project);
            return <article key={project.id} className={styles.card} aria-label={details.name}>
              <img className={styles.thumbnail} src={details.thumbnail} alt={`${details.scope} 미리보기`} width="800" height="480" />
              <div className={styles.cardBody}><span className={styles.status}>{details.status}</span><h2>{details.name}</h2><p>{details.scope}</p><small>최근 수정 · {details.modified}</small>
                <div className={styles.actions}><button className={styles.primary} onClick={() => navigateTo(`/viewer?project=${encodeURIComponent(project.id)}`)}>뷰어 열기</button><button onClick={() => enterProject(project.id)}>편집하기</button></div>
              </div>
            </article>;
          })}
          <button className={`${styles.card} ${styles.newCard}`} onClick={() => enterProject()}><span aria-hidden="true">＋</span><strong>새 월드 만들기</strong><small>관측 범위 선택부터 시작하세요</small></button>
        </div>
      </>}
    </main>
  </div>;
}
