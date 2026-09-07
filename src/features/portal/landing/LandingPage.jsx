import { useRef, useState } from "react";
import { ArrowRightIcon } from "@/components/icons/actionIcons";
import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import LoginModal from "../components/LoginModal";
import { portalContent } from "../portalContent";
import { Hero, Capabilities, Workflow, Trust } from "./LandingSections";
import styles from "./LandingPage.module.css";

export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const pageRef = useRef(null);
  function scrollToSection(event, id) {
    event.preventDefault();
    pageRef.current.querySelector(`#${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  const openLogin = () => setLoginOpen(true);
  return <div className={styles.page} ref={pageRef} aria-label="서비스 소개">
    <div>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Check Guard 홈" onClick={(event) => { event.preventDefault(); pageRef.current.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }}>
          <img src="/portal/check-guard-logo.png" alt="Check Guard — The Pathway of Safety" width="180" height="49" />
        </a>
        <nav aria-label="주요 메뉴" className={styles.nav}>
          {[ ["capabilities", "기능"], ["workflow", "작동 방식"], ["trust", "신뢰성"] ].map(([id, label]) => <a href={`#${id}`} key={id} onClick={(event) => scrollToSection(event, id)}>{label}</a>)}
        </nav>
        <div className={styles.headerActions}><button className={styles.login} onClick={openLogin}>로그인</button><button className={styles.primary} onClick={openLogin}>시작하기 <ArrowRightIcon size={17} /></button></div>
      </header>
      <main>
        <Hero onLogin={openLogin} onScroll={scrollToSection} />
        <Capabilities onScroll={scrollToSection} />
        <Workflow />
        <Trust />
      </main>
      <footer className={styles.footer}><span>© 2026 {portalContent.brand} {portalContent.brandSubtitle}</span><span>산업 현장을 위한 공간 데이터 플랫폼</span></footer>
    </div>
    {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={() => navigateTo("/projects")} />}
  </div>;
}
