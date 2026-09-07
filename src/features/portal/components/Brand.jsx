import styles from "./Brand.module.css";

export default function Brand({ onClick }) {
  return <a className={styles.brand} href="/" onClick={onClick} aria-label="Check Guard 홈">
    <img src="/portal/check-guard-logo.png" alt="Check Guard — The Pathway of Safety" width="180" height="49" />
  </a>;
}
