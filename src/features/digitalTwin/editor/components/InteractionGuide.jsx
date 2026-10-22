import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./InteractionGuide.module.css";

export default function InteractionGuide({ message }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, []);
  return visible ? createPortal(<div className={styles.guide} role="status">{message}</div>, document.body) : null;
}
