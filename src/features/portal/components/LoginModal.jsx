import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons/actionIcons";
import { LockIcon } from "@/components/icons/toolbarIcons";
import { portalContent } from "../portalContent";
import styles from "./LoginModal.module.css";

function AuthForm({ mode, onChangeMode, onLogin }) {
  const emailRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const isSignup = mode === "signup";

  useEffect(() => { emailRef.current?.focus(); }, []);

  function handleSubmit(event) {
    event.preventDefault();
    if (isSignup) {
      setError("현재 회원가입을 이용할 수 없습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const data = new FormData(event.currentTarget);
    if (data.get("email") === portalContent.demoEmail && data.get("password") === portalContent.demoPassword) {
      onLogin();
      return;
    }
    setError("아이디 또는 비밀번호를 확인해주세요.");
  }

  return <>
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="portal-email">{isSignup ? "이메일 주소" : "아이디"}</label>
        <input ref={emailRef} id="portal-email" name="email" type={isSignup ? "email" : "text"} autoComplete="username" placeholder={isSignup ? "이메일을 입력해주세요" : "아이디를 입력해주세요"} required />
      </div>
      <div className={styles.field}>
        <label htmlFor="portal-password">비밀번호</label>
        <div className={styles.password}>
          <input id="portal-password" name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder="비밀번호를 입력해주세요" required />
          <button type="button" aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"} aria-controls="portal-password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "숨기기" : "보기"}</button>
        </div>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.primary}>{isSignup ? "회원가입" : "로그인"}</button>
    </form>
    <div className={styles.switchMode}>
      <p>{isSignup ? "이미 계정이 있으신가요?" : "아직 계정이 없으신가요?"}</p>
      <button type="button" className={styles.secondary} onClick={() => onChangeMode(isSignup ? "login" : "signup")}>{isSignup ? "로그인" : "회원가입"}</button>
    </div>
  </>;
}

export default function LoginModal({ onClose, onLogin }) {
  const dialogRef = useRef(null);
  const primaryRef = useRef(null);
  const [mode, setMode] = useState("prompt");
  const isPrompt = mode === "prompt";
  const isSignup = mode === "signup";

  function handleKeyDown(event) {
    if (event.key !== "Tab") return;
    const controls = dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    primaryRef.current?.focus();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="portal-login-title" aria-describedby="portal-auth-guidance" onKeyDown={handleKeyDown}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.card}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="인증 팝업 닫기"><CloseIcon size={20} /></button>
      <div className={styles.icon} aria-hidden="true"><LockIcon size={26} /></div>
      <h2 id="portal-login-title" className={styles.title}>{isPrompt ? "로그인이 필요합니다." : isSignup ? "회원가입" : "로그인"}</h2>
      <p id="portal-auth-guidance" className={styles.guidance}>{isPrompt ? "디지털 트윈 월드 및 주요 기능을 이용하려면 로그인해주세요." : isSignup ? "계정을 만들고 디지털 트윈 월드를 시작하세요." : "계정으로 로그인하고 디지털 트윈 월드를 이용하세요."}</p>
      {isPrompt ? <div className={styles.actions}>
        <button ref={primaryRef} type="button" className={styles.primary} onClick={() => setMode("login")}>로그인</button>
        <button type="button" className={styles.secondary} onClick={() => setMode("signup")}>회원가입</button>
      </div> : <AuthForm key={mode} mode={mode} onChangeMode={setMode} onLogin={onLogin} />}
    </div>
  </dialog>;
}
