import { SearchIcon } from "@/components/icons";

import styles from "./ObjectLibrary.module.css";

export default function ObjectLibrarySearch({ value, resultCount, onChange }) {
  return (
    <label className={styles.search}>
      <SearchIcon size={17} />
      <span className={styles.visuallyHidden}>오브젝트 검색</span>
      <input
        type="search"
        value={value}
        placeholder="건축물, pump, 주차…"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={styles.searchCount}>{value ? resultCount : ""}</span>
    </label>
  );
}
