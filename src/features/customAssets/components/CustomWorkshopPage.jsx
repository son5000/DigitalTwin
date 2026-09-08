import { useMemo, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import { createBuildingThumbnail } from "../building/buildingThumbnail";
import { createEquipmentThumbnail } from "../equipment/equipmentThumbnail";
import { getCustomBuildingEditPath, getCustomEquipmentEditPath, navigateTo } from "../core/customAssetNavigation";
import { CUSTOM_ASSET_TYPES } from "../core/customAssetTypes";
import { useCustomAssets } from "./customAssetContext";
import styles from "./CustomWorkshopPage.module.css";

const CATEGORIES = [
  [CUSTOM_ASSET_TYPES.BUILDING, "건축물", "직접 제작하고 도면에 배치"],
  [CUSTOM_ASSET_TYPES.FURNITURE, "가구", "준비 중"],
  [CUSTOM_ASSET_TYPES.EQUIPMENT, "설비", "배관 시스템 직접 제작"],
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
  const [activeType, setActiveType] = useState(() => window.location.pathname.startsWith("/custom/equipment") ? CUSTOM_ASSET_TYPES.EQUIPMENT : CUSTOM_ASSET_TYPES.BUILDING);
  const visibleAssets = useMemo(() => assets
    .filter((asset) => asset.type === activeType)
    .filter((asset) => `${asset.name} ${asset.description} ${(asset.tags ?? []).join(" ")}`.toLocaleLowerCase("ko-KR").includes(query.trim().toLocaleLowerCase("ko-KR")))
    .toSorted((left, right) => sort === "NAME" ? left.name.localeCompare(right.name, "ko-KR") : String(right.updatedAt).localeCompare(String(left.updatedAt))), [activeType, assets, query, sort]);
  const lastOpenedAsset = assets.find((asset) => asset.id === repository.getLastOpenedId() && asset.type === activeType) ?? null;
  const isEquipment = activeType === CUSTOM_ASSET_TYPES.EQUIPMENT;
  const editPath = (asset) => isEquipment ? getCustomEquipmentEditPath(asset.id) : getCustomBuildingEditPath(asset.id);
  const createPath = isEquipment ? "/custom/equipment/new" : "/custom/buildings/new";

  async function deleteAsset(asset) {
    if (!window.confirm(`'${asset.name}'을 삭제하시겠습니까? 배치된 인스턴스는 참조 누락 상태가 됩니다.`)) return;
    await remove(asset.id);
  }

  async function duplicateAsset(asset) {
    const copy = await duplicate(asset);
    navigateTo(activeType === CUSTOM_ASSET_TYPES.EQUIPMENT ? getCustomEquipmentEditPath(copy.id) : getCustomBuildingEditPath(copy.id));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigateTo("/editor")}>← 도면으로</button>
        <div className={styles.headerTitle}><span>Custom Asset Studio</span><h1>커스텀 제작소</h1></div>
        <div className={styles.headerActions}>
          {lastOpenedAsset ? <button type="button" onClick={() => navigateTo(editPath(lastOpenedAsset))}>마지막 작업 계속</button> : null}
          <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`} title={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`}>
            <span aria-hidden="true">{theme === EDITOR_THEMES.DARK ? <MoonIcon size={18} /> : <SunIcon size={18} />}</span>
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => navigateTo(createPath)}>새 {isEquipment ? "커스텀 설비" : "건축물"} 만들기</button>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.categoryRail} aria-label="커스텀 에셋 유형">
          {CATEGORIES.map(([id, name, status]) => (
            <button key={id} type="button" disabled={!([CUSTOM_ASSET_TYPES.BUILDING, CUSTOM_ASSET_TYPES.EQUIPMENT].includes(id))} aria-current={id === activeType ? "page" : undefined} onClick={() => { setActiveType(id); window.history.replaceState({}, "", id === CUSTOM_ASSET_TYPES.EQUIPMENT ? "/custom/equipment" : "/custom/buildings"); }}>
              <strong>{name}</strong><small>{status}</small>
            </button>
          ))}
        </nav>

        <section className={styles.content} aria-labelledby="custom-assets-title">
          <div className={styles.contentHeader}>
            <div><span>{isEquipment ? "EQUIPMENT ASSETS" : "BUILDING ASSETS"}</span><h2 id="custom-assets-title">내 커스텀 {isEquipment ? "설비" : "건축물"}</h2></div>
            <div className={styles.filters}>
              <input type="search" value={query} placeholder="이름·태그 검색" aria-label={`커스텀 ${isEquipment ? "설비" : "건축물"} 검색`} onChange={(event) => setQuery(event.target.value)} />
              <select value={sort} aria-label={`커스텀 ${isEquipment ? "설비" : "건축물"} 정렬`} onChange={(event) => setSort(event.target.value)}>
                <option value="UPDATED_DESC">최근 수정 순</option><option value="NAME">이름 순</option>
              </select>
            </div>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {loading ? <p className={styles.state}>로컬 에셋을 불러오는 중…</p> : null}
          {!loading && visibleAssets.length === 0 ? (
            <div className={styles.emptyState}>
              <span aria-hidden="true">{isEquipment ? "⌁" : "⌂"}</span><h3>{query ? "검색 결과가 없습니다" : `첫 커스텀 ${isEquipment ? "설비" : "건축물"}를 만들어보세요`}</h3>
              <p>{isEquipment ? "직선 배관과 곡관·접합부·밸브를 연결해 하나의 설비로 완성합니다." : "기본 직사각형에서 시작해 층 구간과 평면을 바로 편집할 수 있습니다."}</p>
              <button type="button" className={styles.primaryButton} onClick={() => navigateTo(createPath)}>{isEquipment ? "설비" : "건축물"} 제작 시작</button>
            </div>
          ) : null}
          <div className={styles.assetGrid}>
            {visibleAssets.map((asset) => (
              <article key={asset.id} className={styles.assetCard}>
                <button type="button" className={styles.thumbnailButton} onClick={() => navigateTo(editPath(asset))}>
                  {isEquipment || asset.sections?.length || asset.entities?.length ? <img src={isEquipment ? (asset.thumbnail || createEquipmentThumbnail(asset, theme)) : createBuildingThumbnail(asset, theme)} alt={`${asset.name} 미리보기`} loading="lazy" /> : <span>미리보기 준비 중</span>}
                </button>
                <div className={styles.cardBody}>
                  <div className={styles.badges}><span data-status={asset.status}>{asset.status === "ready" ? "사용 가능" : "초안"}</span><small>{isEquipment ? "커스텀 설비" : `v${asset.revision}`}</small></div>
                  <h3>{asset.name}</h3>
                  <p>{isEquipment ? `${asset.metrics.partCount}개 부품 · ${asset.metrics.connectionCount}개 연결 · ` : `${asset.metrics.floorCount}층 · ${asset.metrics.totalFloorAreaPyeong.toFixed(1)}평 · `}{asset.bounds.width.toFixed(1)} × {asset.bounds.depth.toFixed(1)} × {asset.bounds.height.toFixed(1)}m</p>
                  <dl><div><dt>생성</dt><dd>{formatDate(asset.createdAt)}</dd></div><div><dt>수정</dt><dd>{formatDate(asset.updatedAt)}</dd></div></dl>
                  <div className={styles.cardActions}>
                    <button type="button" onClick={() => navigateTo(editPath(asset))}>수정</button>
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
