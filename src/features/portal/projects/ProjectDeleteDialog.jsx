import { useEffect, useRef } from "react";
import styles from "./ProjectsPage.module.css";

export default function ProjectDeleteDialog({ name, serverDelete, serverCopy = false, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return <dialog ref={dialogRef} className={styles.deleteDialog} aria-labelledby="project-delete-title" aria-describedby="project-delete-description"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="project-delete-title">프로젝트를 삭제할까요?</h2>
    <p id="project-delete-description"><strong>{name}</strong>{serverDelete
      ? "의 서버 저장본과 이 브라우저의 사본을 삭제합니다. 공개 뷰어도 더 이상 열 수 없습니다."
      : serverCopy ? "의 이 브라우저 저장본만 삭제합니다. 서버 게시본은 유지됩니다." : "의 이 브라우저 저장본을 삭제합니다."} 이 작업은 되돌릴 수 없습니다.</p>
    {error && <p className={styles.deleteError} role="alert">{error}</p>}
    <div className={styles.deleteActions}>
      <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}>취소</button>
      <button type="button" className={styles.dangerConfirm} disabled={busy} onClick={onConfirm}>{busy ? "삭제 중…" : serverDelete ? "프로젝트 삭제" : "로컬 저장본 삭제"}</button>
    </div>
  </dialog>;
}
