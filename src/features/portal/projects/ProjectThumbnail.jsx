import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ProjectsPage.module.css";

export default function ProjectThumbnail({ source, name, preview }) {
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const closeTimer = useRef(null);
  const popupId = useId();
  const open = Boolean(position);

  function cancelClose() { window.clearTimeout(closeTimer.current); }
  function showPreview() {
    cancelClose();
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(440, window.innerWidth - 32);
    const height = Math.min(360, window.innerHeight - 32);
    const preferredLeft = rect.right + 12 + width <= window.innerWidth - 16 ? rect.right + 12 : rect.left - width - 12;
    setPosition({ width, height, left: Math.max(16, Math.min(preferredLeft, window.innerWidth - width - 16)),
      top: Math.max(16, Math.min(rect.top, window.innerHeight - height - 16)) });
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setPosition(null), 180);
  }
  function handleBlur(event) {
    if (!triggerRef.current?.contains(event.relatedTarget) && !popupRef.current?.contains(event.relatedTarget)) scheduleClose();
  }
  function closePreview() {
    cancelClose();
    if (popupRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true });
    setPosition(null);
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (triggerRef.current?.contains(event.target) || popupRef.current?.contains(event.target))) return;
      window.clearTimeout(closeTimer.current);
      if (popupRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true });
      setPosition(null);
    };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [open]);

  const image = <img className={styles.thumbnail} src={source} alt={`${name} 대표 이미지`} width="800" height="480" />;
  if (!preview) return image;
  return <>
    <button ref={triggerRef} type="button" className={styles.thumbnailButton} aria-label={`${name} 이미지 확대`}
      aria-expanded={open} aria-controls={open ? popupId : undefined} aria-haspopup="dialog"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") showPreview(); }} onPointerLeave={scheduleClose}
      onFocus={showPreview} onBlur={handleBlur} onClick={showPreview}>{image}</button>
    {position && createPortal(<div ref={popupRef} id={popupId} role="dialog" aria-label={`${name} 대표 이미지 확대`}
      className={styles.imagePreview} style={position} onPointerEnter={cancelClose} onPointerLeave={scheduleClose} onBlur={handleBlur}>
      <div className={styles.imagePreviewHeading}><span>{name}</span><button type="button" onClick={closePreview}>닫기</button></div>
      <img src={source} alt={`${name} 대표 이미지`} />
    </div>, document.body)}
  </>;
}
