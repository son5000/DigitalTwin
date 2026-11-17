import { SearchIcon } from "@/components/icons";

import styles from "./ObjectLibrary.module.css";

export default function ObjectLibrarySearch({ value, resultCount, onChange, label = "오브젝트 검색", placeholder = "건축물, pump, 주차…" }) {
  return (
    <label className={styles.search}>
      <SearchIcon size={17} />
      <span className={styles.visuallyHidden}>{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={styles.searchCount}>{value ? resultCount : ""}</span>
    </label>
  );
}
