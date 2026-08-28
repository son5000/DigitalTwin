import { useMemo, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import { createBuildingThumbnail } from "../building/buildingThumbnail";
import { getCustomBuildingEditPath, navigateTo } from "../core/customAssetNavigation";
import { CUSTOM_ASSET_TYPES } from "../core/customAssetTypes";
import { useCustomAssets } from "./customAssetContext";
import styles from "./CustomWorkshopPage.module.css";

const CATEGORIES = [
  [CUSTOM_ASSET_TYPES.BUILDING, "건축물", "직접 제작하고 도면에 배치"],
  [CUSTOM_ASSET_TYPES.FURNITURE, "가구", "준비 중"],
  [CUSTOM_ASSET_TYPES.EQUIPMENT, "설비", "준비 중"],
  [CUSTOM_ASSET_TYPES.LANDSCAPE, "조경", "준비 중"],
  [CUSTOM_ASSET_TYPES.USER_ASSET, "사용자 에셋", "준비 중"],
];

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function CustomWorkshopPage() {
  const { assets, loading, error, duplicate, remove, repository } = useCustomAssets();
  const { theme, toggleTheme } = useEditorTheme();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("UPDATED_DESC");
  const buildings = useMemo(() => assets
    .filter((asset) => asset.type === CUSTOM_ASSET_TYPES.BUILDING)
    .filter((asset) => `${asset.name} ${asset.description} ${(asset.tags ?? []).join(" ")}`.toLocaleLowerCase("ko-KR").includes(query.trim().toLocaleLowerCase("ko-KR")))
    .toSorted((left, right) => sort === "NAME" ? left.name.localeCompare(right.name, "ko-KR") : String(right.updatedAt).localeCompare(String(left.updatedAt))), [assets, query, sort]);
  const lastOpenedAsset = assets.find((asset) => asset.id === repository.getLastOpenedId() && asset.type === CUSTOM_ASSET_TYPES.BUILDING) ?? null;

  async function deleteAsset(asset) {
    if (!window.confirm(`'${asset.name}'을 삭제하시겠습니까? 배치된 인스턴스는 참조 누락 상태가 됩니다.`)) return;
    await remove(asset.id);
  }

  async function duplicateAsset(asset) {
    const copy = await duplicate(asset);
    navigateTo(getCustomBuildingEditPath(copy.id));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigateTo("/")}>← 도면으로</button>
        <div className={styles.headerTitle}><span>Custom Asset Studio</span><h1>커스텀 제작소</h1></div>
        <div className={styles.headerActions}>
          {lastOpenedAsset ? <button type="button" onClick={() => navigateTo(getCustomBuildingEditPath(lastOpenedAsset.id))}>마지막 작업 계속</button> : null}
          <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`} title={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`}>
            <span aria-hidden="true">{theme === EDITOR_THEMES.DARK ? <MoonIcon size={18} /> : <SunIcon size={18} />}</span>
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => navigateTo("/custom/buildings/new")}>새 건축물 만들기</button>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.categoryRail} aria-label="커스텀 에셋 유형">
          {CATEGORIES.map(([id, name, status], index) => (
            <button key={id} type="button" disabled={index > 0} aria-current={index === 0 ? "page" : undefined}>
              <strong>{name}</strong><small>{status}</small>
            </button>
          ))}
        </nav>

        <section className={styles.content} aria-labelledby="building-assets-title">
          <div className={styles.contentHeader}>
            <div><span>BUILDING ASSETS</span><h2 id="building-assets-title">내 커스텀 건축물</h2></div>
            <div className={styles.filters}>
              <input type="search" value={query} placeholder="이름·태그 검색" aria-label="커스텀 건축물 검색" onChange={(event) => setQuery(event.target.value)} />
              <select value={sort} aria-label="커스텀 건축물 정렬" onChange={(event) => setSort(event.target.value)}>
                <option value="UPDATED_DESC">최근 수정 순</option><option value="NAME">이름 순</option>
              </select>
            </div>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {loading ? <p className={styles.state}>로컬 에셋을 불러오는 중…</p> : null}
          {!loading && buildings.length === 0 ? (
            <div className={styles.emptyState}>
              <span aria-hidden="true">⌂</span><h3>{query ? "검색 결과가 없습니다" : "첫 커스텀 건축물을 만들어보세요"}</h3>
              <p>기본 직사각형에서 시작해 층 구간과 평면을 바로 편집할 수 있습니다.</p>
              <button type="button" className={styles.primaryButton} onClick={() => navigateTo("/custom/buildings/new")}>건축물 제작 시작</button>
            </div>
          ) : null}
          <div className={styles.assetGrid}>
            {buildings.map((asset) => (
              <article key={asset.id} className={styles.assetCard}>
                <button type="button" className={styles.thumbnailButton} onClick={() => navigateTo(getCustomBuildingEditPath(asset.id))}>
                  {asset.sections?.length ? <img src={createBuildingThumbnail(asset, theme)} alt={`${asset.name} 평면 미리보기`} loading="lazy" /> : <span>미리보기 준비 중</span>}
                </button>
                <div className={styles.cardBody}>
                  <div className={styles.badges}><span data-status={asset.status}>{asset.status === "ready" ? "도면 사용 가능" : "초안"}</span><small>v{asset.revision}</small></div>
                  <h3>{asset.name}</h3>
                  <p>{asset.metrics.floorCount}층 · {asset.metrics.totalFloorAreaPyeong.toFixed(1)}평 · {asset.bounds.width.toFixed(1)} × {asset.bounds.depth.toFixed(1)}m</p>
                  <dl><div><dt>생성</dt><dd>{formatDate(asset.createdAt)}</dd></div><div><dt>수정</dt><dd>{formatDate(asset.updatedAt)}</dd></div></dl>
                  <div className={styles.cardActions}>
                    <button type="button" onClick={() => navigateTo(getCustomBuildingEditPath(asset.id))}>수정</button>
                    <button type="button" onClick={() => duplicateAsset(asset)}>복제</button>
                    <button type="button" className={styles.dangerButton} onClick={() => deleteAsset(asset)}>삭제</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
