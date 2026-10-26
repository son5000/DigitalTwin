import { useId, useRef, useState } from "react";
import { DEFAULT_IMAGE_TRANSFORM, normalizeSensorProjection, sensorImageTransform } from "../model/sensorImageTransform";
import { DEFAULT_PERSPECTIVE, IMAGE_CORNERS, UNIT_QUAD, homographyFromQuads, projectPoint } from "../model/imageHomography";
import ProjectiveImage from "./ProjectiveImage";
import styles from "./ImageTransformEditor.module.css";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const snapshot = (p) => Object.fromEntries([...Object.keys(DEFAULT_IMAGE_TRANSFORM), "opacity"].map((key) => [key, p[key]]));
const rounded = (value) => Number(value.toFixed(6));

function PrecisionField({ label, value, unit, step, min = -Infinity, max = Infinity, onChange }) {
  const inputId = useId();
  const [draft, setDraft] = useState(null);
  const commit = () => {
    const next = Number(draft);
    if (draft !== null && draft.trim() && Number.isFinite(next)) onChange(clamp(next, min, max));
    setDraft(null);
  };
  return <div className={styles.precisionField}>
    <label htmlFor={inputId}>{label} <small>{unit}</small></label>
    <span className={styles.numberControl}>
      <button type="button" aria-label={`${label} 감소`} disabled={value <= min} onClick={() => onChange(clamp(rounded(value - step), min, max))}>−</button>
      <input id={inputId} type="number" step={step} min={Number.isFinite(min) ? min : undefined} max={Number.isFinite(max) ? max : undefined}
        value={draft ?? rounded(value)} onChange={(event) => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.stopPropagation(); setDraft(null); } }} />
      <button type="button" aria-label={`${label} 증가`} disabled={value >= max} onClick={() => onChange(clamp(rounded(value + step), min, max))}>+</button>
    </span>
  </div>;
}

export default function ImageTransformEditor({ sensor, source, surface, onChange, onExport }) {
  const p = normalizeSensorProjection(sensor.textureProjection);
  const transform = sensorImageTransform(sensor);
  const dialog = useRef(null);
  const initial = useRef(null);
  const gesture = useRef(null);
  const id = useId();
  const [tab, setTab] = useState("TRANSFORM");
  const [step, setStep] = useState(.1);
  const [locked, setLocked] = useState(false);
  const [grid, setGrid] = useState(true);
  const [viewZoom, setViewZoom] = useState(1);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [perspectiveMode, setPerspectiveMode] = useState("source");
  const [perspectiveError, setPerspectiveError] = useState("");
  const [lockedBounds, setLockedBounds] = useState(null);
  const width = transform.source.width, height = transform.source.height;
  const pixelUnits = Boolean(width && height);
  const crop = transform.cropPixels ?? { x: p.cropX * 100, y: (1 - p.cropY - p.cropHeight) * 100, width: p.cropWidth * 100, height: p.cropHeight * 100 };
  const sourceWidth = width || 100, sourceHeight = height || 100;
  const ratio = surface.width / surface.height;
  const cropMode = tab === "CROP";
  const perspectiveModeActive = tab === "PERSPECTIVE";
  const sourceMode = cropMode || (perspectiveModeActive && perspectiveMode === "source");
  const cornerPoints = perspectiveMode === "source"
    ? p.perspective.source.map(([u, v]) => [p.cropX + u * p.cropWidth, p.cropY + v * p.cropHeight])
    : transform.perspective.finalTargetUv;
  const left = Math.min(0, ...cornerPoints.map(([u]) => u)) - .12, bottom = Math.min(0, ...cornerPoints.map(([, v]) => v)) - .12;
  const autoBounds = [left, bottom, Math.max(1, ...cornerPoints.map(([u]) => u)) + .12 - left, Math.max(1, ...cornerPoints.map(([, v]) => v)) + .12 - bottom];
  const bounds = !sourceMode && perspectiveModeActive ? lockedBounds ?? autoBounds : [0, 0, 1, 1];
  const previewRatio = sourceMode ? sourceWidth / sourceHeight : ratio * bounds[2] / bounds[3];
  const viewBox = `${bounds[0]} ${1 - bounds[1] - bounds[3]} ${bounds[2]} ${bounds[3]}`;

  function remember() { setHistory((state) => ({ past: [...state.past.slice(-79), snapshot(p)], future: [] })); }
  function change(values, record = true) {
    setPerspectiveError("");
    if (record) remember();
    onChange(values);
  }
  function undo() {
    if (!history.past.length) return;
    setPerspectiveError("");
    onChange(history.past.at(-1));
    setHistory({ past: history.past.slice(0, -1), future: [snapshot(p), ...history.future] });
  }
  function redo() {
    if (!history.future.length) return;
    setPerspectiveError("");
    onChange(history.future[0]);
    setHistory({ past: [...history.past, snapshot(p)], future: history.future.slice(1) });
  }
  function open() {
    initial.current = snapshot(p);
    setHistory({ past: [], future: [] });
    setPerspectiveError("");
    dialog.current.showModal();
  }
  function cancel() { onChange(initial.current); dialog.current.close(); }
  function scale(key, value) {
    const other = key === "scaleX" ? "scaleY" : "scaleX";
    if (!locked) { change({ [key]: value / 100 }); return; }
    const factor = clamp(value / 100 / p[key], Math.max(.01 / p[key], .01 / p[other]), Math.min(100 / p[key], 100 / p[other]));
    change({ [key]: p[key] * factor, [other]: p[other] * factor });
  }
  function cropChange(key, value) {
    const next = { ...crop, [key]: value };
    const min = pixelUnits ? 1 : .0001;
    next.x = clamp(next.x, 0, sourceWidth - min); next.y = clamp(next.y, 0, sourceHeight - min);
    next.width = clamp(next.width, min, sourceWidth - next.x); next.height = clamp(next.height, min, sourceHeight - next.y);
    change({ cropX: next.x / sourceWidth, cropY: 1 - (next.y + next.height) / sourceHeight,
      cropWidth: next.width / sourceWidth, cropHeight: next.height / sourceHeight });
  }
  function fit(mode) {
    const sourceRatio = sourceWidth * p.cropWidth / (sourceHeight * p.cropHeight);
    const relative = sourceRatio / ratio;
    const contain = mode === "contain";
    change({ scaleX: contain ? Math.min(1, relative) : Math.max(1, relative), scaleY: contain ? Math.min(1, 1 / relative) : Math.max(1, 1 / relative),
      zoom: 1, offsetX: 0, offsetY: 0, pivotX: .5, pivotY: .5, rotation: 0 });
  }
  function updatePerspective(values, record = true) {
    const next = { ...p.perspective, ...values };
    if (!homographyFromQuads(next.source, next.target)) {
      setPerspectiveError("네 점이 교차하거나 너무 가까이 붙었습니다. 왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래 순서를 유지하세요.");
      return;
    }
    change({ perspective: next }, record);
  }
  function updateCorner(index, point, record = true) {
    const min = perspectiveMode === "source" ? 0 : -2, max = perspectiveMode === "source" ? 1 : 3;
    const points = p.perspective[perspectiveMode].map((value, i) => i === index ? point.map((v) => clamp(v, min, max)) : value);
    updatePerspective({ enabled: true, [perspectiveMode]: points }, record);
  }
  function pointerDown(event) {
    if (event.button !== 0 || !source) return;
    const corner = event.target.closest("[data-corner]")?.dataset.corner;
    if (perspectiveModeActive && (corner === undefined || !p.perspective.enabled)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const u = clamp((event.clientX - rect.left) / rect.width, 0, 1), v = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    remember();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, u, v, rect, p, cropMode,
      corner: corner === undefined ? null : Number(corner), bounds };
    if (perspectiveModeActive && perspectiveMode === "target") setLockedBounds(bounds);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3) return;
    if (drag.corner !== null) {
      const u = drag.bounds[0] + (event.clientX - drag.rect.left) / drag.rect.width * drag.bounds[2];
      const v = drag.bounds[1] + (1 - (event.clientY - drag.rect.top) / drag.rect.height) * drag.bounds[3];
      const point = perspectiveMode === "source" ? [(u - p.cropX) / p.cropWidth, (v - p.cropY) / p.cropHeight]
        : projectPoint(transform.targetUvToRectifiedUv, [u, v]);
      if (point) updateCorner(drag.corner, point, false);
    } else if (drag.cropMode) {
      const u = clamp((event.clientX - drag.rect.left) / drag.rect.width, 0, 1), v = clamp((event.clientY - drag.rect.top) / drag.rect.height, 0, 1);
      const left = Math.min(drag.u, u), top = Math.min(drag.v, v);
      const w = Math.min(1 - left, Math.max(1 / sourceWidth, Math.abs(u - drag.u)));
      const h = Math.min(1 - top, Math.max(1 / sourceHeight, Math.abs(v - drag.v)));
      change({ cropX: left, cropY: 1 - top - h, cropWidth: w, cropHeight: h }, false);
    } else {
      change({ offsetX: drag.p.offsetX + (event.clientX - drag.x) / drag.rect.width,
        offsetY: drag.p.offsetY - (event.clientY - drag.y) / drag.rect.height }, false);
    }
  }
  function finishPointer(event) { if (gesture.current?.id === event.pointerId) { gesture.current = null; setLockedBounds(null); } }
  const field = (key, label, unit = "%", multiplier = 100, min = -1000, max = 1000) => <PrecisionField key={key} label={label} unit={unit} step={step}
    value={p[key] * multiplier} min={min} max={max} onChange={(value) => ["scaleX", "scaleY"].includes(key) ? scale(key, value) : change({ [key]: value / multiplier })} />;

  return <>
    <div className={styles.compactPreview}>
      {source && <div className={styles.editStage} role="img" aria-label="오브젝트 텍스처 미리보기" style={{ aspectRatio: ratio, width: `min(100%, ${190 * ratio}px)` }}>
        <ProjectiveImage source={source} transform={transform} opacity={p.opacity} />
      </div>}
      <p>가로 {rounded(p.scaleX * p.zoom * 100)}% · 세로 {rounded(p.scaleY * p.zoom * 100)}% · 회전 {rounded(p.rotation)}°{p.perspective.enabled ? " · 원근 보정 적용" : ""}</p>
      <button type="button" onClick={open}>정밀 이미지 편집 열기</button>
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); cancel(); }}>
      <header><div><h2 id={`${id}-title`}>텍스처 정밀 편집</h2><p>{sensor.name} · {width && height ? `${width} × ${height}px` : "원본 해상도 미확인"} · 오브젝트 표면 {rounded(surface.width)} × {rounded(surface.height)}m</p></div><button type="button" onClick={cancel} aria-label="편집 취소하고 닫기">닫기</button></header>
      <div className={styles.workspace}>
        <section className={styles.previewPane} aria-label="이미지 편집 미리보기">
          <div className={styles.previewToolbar}><strong>{perspectiveModeActive ? (sourceMode ? "원본 · 물체의 네 꼭짓점을 지정" : "적용 결과 · 네 모서리를 조절") : cropMode ? "원본 · 드래그로 자를 영역 지정" : "적용 결과 · 드래그로 이미지 이동"}</strong>
            <label><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} />격자</label>
            <label>보기 배율 <select value={viewZoom} onChange={(event) => setViewZoom(Number(event.target.value))}><option value={1}>맞춤</option><option value={1.5}>150%</option><option value={2}>200%</option><option value={4}>400%</option></select></label>
          </div>
          <div className={styles.previewScroll}>
            <div className={styles.previewSize} style={{ width: `${viewZoom * 100}%`, minHeight: "100%" }}>
              {source ? <div className={styles.editStage} aria-label={sourceMode ? "원본 이미지 편집" : "정밀 변환 미리보기"}
                style={{ aspectRatio: previewRatio, width: `min(100%, ${440 * viewZoom * previewRatio}px)` }}
                onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onLostPointerCapture={finishPointer}>
                {!sourceMode && <ProjectiveImage source={source} transform={transform} opacity={p.opacity} bounds={bounds} />}
                <svg className={styles.canvasOverlay} viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
                <defs><clipPath id={`${id}-large`}><rect x={p.cropX} y={1 - p.cropY - p.cropHeight} width={p.cropWidth} height={p.cropHeight} /></clipPath></defs>
                {sourceMode && <>
                  <image href={source} width="1" height="1" preserveAspectRatio="none" opacity=".35" />
                  <image href={source} width="1" height="1" preserveAspectRatio="none" clipPath={`url(#${id}-large)`} />
                  <rect x={p.cropX} y={1 - p.cropY - p.cropHeight} width={p.cropWidth} height={p.cropHeight} fill="none" stroke="#ffcc00" strokeWidth=".004" />
                </>}
                {!sourceMode && <rect x="0" y="0" width="1" height="1" fill="none" stroke="#fff" strokeWidth=".003" />}
                {grid && <path d="M .25 0 V 1 M .5 0 V 1 M .75 0 V 1 M 0 .25 H 1 M 0 .5 H 1 M 0 .75 H 1" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".0015" />}
                {!sourceMode && <path d={`M ${p.pivotX + p.offsetX - .025} ${1 - p.pivotY - p.offsetY} h .05 M ${p.pivotX + p.offsetX} ${1 - p.pivotY - p.offsetY - .025} v .05`} stroke="#ffcc00" strokeWidth=".004" />}
                {perspectiveModeActive && p.perspective.enabled && <polygon points={cornerPoints.map(([u, v]) => `${u},${1 - v}`).join(" ")} fill="none" stroke="#ffcc00" strokeWidth=".004" />}
                </svg>
                {perspectiveModeActive && p.perspective.enabled && cornerPoints.map(([u, v], index) => <button type="button" key={index} data-corner={index} className={styles.cornerHandle}
                  aria-label={`${IMAGE_CORNERS[index]} 원근 기준점`} style={{ left: `${(u - bounds[0]) / bounds[2] * 100}%`, top: `${(1 - (v - bounds[1]) / bounds[3]) * 100}%` }}
                  onKeyDown={(event) => {
                    const delta = { ArrowLeft: [-step / 100, 0], ArrowRight: [step / 100, 0], ArrowUp: [0, step / 100], ArrowDown: [0, -step / 100] }[event.key];
                    if (delta) { event.preventDefault(); updateCorner(index, p.perspective[perspectiveMode][index].map((value, axis) => value + delta[axis])); }
                  }}>{index + 1}</button>)}
              </div> : <p>수신 이미지 URL을 입력하거나 샘플을 먼저 불러오세요. 수치 설정은 이미지 없이도 가능합니다.</p>}
            </div>
          </div>
          <p className={styles.hint}>{perspectiveModeActive ? "1 왼쪽 위 · 2 오른쪽 위 · 3 오른쪽 아래 · 4 왼쪽 아래. 기준점을 드래그하거나 수치·방향키로 조절하세요. 결과의 흰 테두리 밖은 오브젝트에서 잘립니다." : cropMode ? "잘라내기: 원본 왼쪽 위가 (0, 0). 원본 파일은 보존됩니다." : "노란 십자 = 변환 기준점. 보기 배율은 작업 화면만 확대하며 텍스처 수치에 영향을 주지 않습니다."}</p>
        </section>
        <section className={styles.controls} aria-label="정밀 편집 값">
          <nav className={styles.tabs} aria-label="이미지 편집 항목">{[["TRANSFORM", "크기·배치"], ["CROP", "잘라내기"], ["PERSPECTIVE", "원근 보정"], ["PIVOT", "기준점"]].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
          <label className={styles.stepSelector}>미세 조정 간격 <select value={step} onChange={(event) => setStep(Number(event.target.value))}>{[.001, .01, .1, 1, 10].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <p className={styles.hint}>수치를 입력하고 Enter 또는 다른 항목을 누르면 반영됩니다. ± 버튼은 위 간격으로 조절합니다.</p>
          {perspectiveModeActive && <>
            <label className={styles.check}><input type="checkbox" checked={p.perspective.enabled} onChange={(event) => updatePerspective({ enabled: event.target.checked })} />원근 보정 사용</label>
            <p className={styles.hint}>위에서 내려찍은 사진은 ‘원본 네 점’에서 물체의 꼭짓점을 지정한 뒤 ‘직사각형으로 펴기’를 누르세요. 크기·회전·이동은 보정 후에 적용됩니다.</p>
            <div className={styles.buttons}>
              <button type="button" onClick={() => { updatePerspective({ enabled: true, source: [[0, 1], [1, 1], [.8, 0], [.2, 0]], target: UNIT_QUAD }); setPerspectiveMode("source"); }}>아래쪽 좁음 · 시작값</button>
              <button type="button" onClick={() => { updatePerspective({ enabled: true, target: UNIT_QUAD }); setPerspectiveMode("target"); }}>직사각형으로 펴기</button>
            </div>
            <nav className={styles.buttons} aria-label="원근 기준점 편집 대상">
              <button type="button" aria-pressed={perspectiveMode === "source"} onClick={() => setPerspectiveMode("source")}>원본 네 점</button>
              <button type="button" aria-pressed={perspectiveMode === "target"} onClick={() => setPerspectiveMode("target")}>결과 네 점</button>
            </nav>
            {perspectiveMode === "target" && <fieldset><legend>위·아래 폭 조절</legend>
              <p className={styles.hint}>아랫변 너비를 늘리면 아래쪽이 펼쳐집니다. 흰 적용면 밖으로 나간 부분은 잘리므로 필요하면 전체 확대·축소를 줄이세요.</p>
              <div className={styles.fields}>{[[0, 1, "윗변 너비"], [3, 2, "아랫변 너비"]].map(([a, b, label]) => <PrecisionField key={label} label={label} unit="%" step={step} min={1} max={500}
                value={(p.perspective.target[b][0] - p.perspective.target[a][0]) * 100} onChange={(value) => {
                  const middle = (p.perspective.target[a][0] + p.perspective.target[b][0]) / 2;
                  const target = p.perspective.target.map((point, i) => i === a ? [middle - value / 200, point[1]] : i === b ? [middle + value / 200, point[1]] : point);
                  updatePerspective({ enabled: true, target });
                }} />)}</div>
            </fieldset>}
            <p className={styles.hint}>{perspectiveMode === "source" ? "잘라낸 원본 영역" : "크기·회전 적용 전 결과 영역"} 기준: 왼쪽 위 (0%, 0%), 오른쪽 아래 (100%, 100%). 내보낸 JSON에는 아래쪽 원점 UV와 원본 픽셀 좌표를 구분해 기록합니다.</p>
            {IMAGE_CORNERS.map((label, index) => <fieldset key={`${perspectiveMode}-${index}`}><legend>{index + 1}. {label}</legend><div className={styles.fields}>
              {["X", "Y"].map((axis, coordinate) => <PrecisionField key={axis} label={`${label} ${axis}`} unit="%" step={step} min={perspectiveMode === "source" ? 0 : -200} max={perspectiveMode === "source" ? 100 : 300}
                value={(coordinate === 0 ? p.perspective[perspectiveMode][index][0] : 1 - p.perspective[perspectiveMode][index][1]) * 100}
                onChange={(value) => updateCorner(index, p.perspective[perspectiveMode][index].map((v, i) => i === coordinate ? (coordinate === 0 ? value / 100 : 1 - value / 100) : v))} />)}
            </div></fieldset>)}
            {perspectiveError && <p className={styles.error} role="alert">{perspectiveError}</p>}
            <button type="button" onClick={() => change({ perspective: DEFAULT_PERSPECTIVE })}>원근 보정만 초기화</button>
          </>}
          {tab === "TRANSFORM" && <>
            <fieldset><legend>크기·비율</legend><label className={styles.check}><input type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} />현재 가로·세로 비율 유지</label>
              <div className={styles.fields}>{field("scaleX", "가로 크기", "%", 100, 1, 10000)}{field("scaleY", "세로 크기", "%", 100, 1, 10000)}{field("zoom", "전체 확대·축소", "%", 100, 1, 10000)}</div>
              <div className={styles.buttons}><button type="button" disabled={!pixelUnits} onClick={() => fit("contain")}>비율 유지·맞춤</button><button type="button" disabled={!pixelUnits} onClick={() => fit("cover")}>비율 유지·채움</button><button type="button" onClick={() => change({ scaleX: 1, scaleY: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, pivotX: .5, pivotY: .5 })}>표면에 늘려 맞춤</button></div>
            </fieldset>
            <fieldset><legend>이동·회전</legend><div className={styles.fields}>{field("offsetX", "좌우 이동")}{field("offsetY", "상하 이동")}{field("rotation", "영상 회전", "°", 1, -3600, 3600)}{field("opacity", "불투명도", "%", 100, 0, 100)}</div>
              <div className={styles.buttons}><button type="button" onClick={() => change({ rotation: p.rotation - 90 })}>−90°</button><button type="button" onClick={() => change({ rotation: p.rotation + 90 })}>+90°</button><button type="button" onClick={() => change({ offsetX: 0, offsetY: 0 })}>이동 초기화</button></div>
              <p className={styles.hint}>이동 100% = 표면 폭·높이. +X 오른쪽, +Y 위쪽. 회전은 표면 UV 기준 반시계 방향입니다.</p>
            </fieldset>
            <fieldset><legend>반전</legend><div className={styles.buttons}><button type="button" aria-pressed={p.flipX} onClick={() => change({ flipX: !p.flipX })}>좌우 반전</button><button type="button" aria-pressed={p.flipY} onClick={() => change({ flipY: !p.flipY })}>상하 반전</button></div></fieldset>
          </>}
          {tab === "CROP" && <fieldset><legend>원본에서 사용할 영역 · {pixelUnits ? "픽셀" : "%"}</legend>
            <p className={styles.hint}>원본 위에서 드래그하거나 수치를 입력하세요. 선택 영역을 적용면에 맞춘 뒤 크기·회전·이동을 적용합니다.</p>
            <div className={styles.fields}>{[["x", "왼쪽 시작", sourceWidth - (pixelUnits ? 1 : .0001)], ["y", "위쪽 시작", sourceHeight - (pixelUnits ? 1 : .0001)], ["width", "사용 너비", sourceWidth - crop.x], ["height", "사용 높이", sourceHeight - crop.y]].map(([key, label, max]) => <PrecisionField key={key} label={label} unit={pixelUnits ? "px" : "%"} value={crop[key]} step={step} min={["width", "height"].includes(key) ? (pixelUnits ? 1 : .0001) : 0} max={max} onChange={(value) => cropChange(key, value)} />)}</div>
            <button type="button" onClick={() => change({ cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 })}>원본 전체 사용</button>
          </fieldset>}
          {tab === "PIVOT" && <fieldset><legend>크기·회전·반전 기준점</legend>
            <p className={styles.hint}>잘라내기·원근 보정 후 영역의 왼쪽 아래 (0%, 0%), 오른쪽 위 (100%, 100%). 기준점을 바꾸면 현재 변환 결과도 함께 달라집니다.</p>
            <div className={styles.anchorGrid}>{[1, .5, 0].flatMap((v, row) => [0, .5, 1].map((u, column) => <button type="button" key={`${u}-${v}`} aria-label={`기준점 ${["위", "중간", "아래"][row]} ${["왼쪽", "가운데", "오른쪽"][column]}`} aria-pressed={p.pivotX === u && p.pivotY === v} onClick={() => change({ pivotX: u, pivotY: v })}>＋</button>))}</div>
            <div className={styles.fields}>{field("pivotX", "기준점 X", "%", 100, 0, 100)}{field("pivotY", "기준점 Y", "%", 100, 0, 100)}</div>
          </fieldset>}
        </section>
      </div>
      <footer><div className={styles.buttons}><button type="button" onClick={undo} disabled={!history.past.length}>되돌리기</button><button type="button" onClick={redo} disabled={!history.future.length}>다시 실행</button><button type="button" onClick={() => change({ ...DEFAULT_IMAGE_TRANSFORM, opacity: 1 })}>변환 초기화</button><button type="button" onClick={onExport}>가공 JSON</button></div>
        <p>편집 중 오브젝트에 즉시 반영됩니다. 프로젝트 저장으로 보관하세요.</p>
        <div className={styles.buttons}><button type="button" onClick={cancel}>편집 취소</button><button className={styles.primary} type="button" onClick={() => dialog.current.close()}>적용하고 닫기</button></div>
      </footer>
    </dialog>
  </>;
}
