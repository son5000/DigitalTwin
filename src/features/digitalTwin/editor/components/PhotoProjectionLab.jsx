import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createPhotoProjectionScene } from "@/features/digitalTwin/editor/three/photoProjectionScene";
import styles from "./PhotoProjectionLab.module.css";

const FACES = ["오른쪽 (+X)", "왼쪽 (−X)", "위 (+Y)", "아래 (−Y)", "앞 (+Z)", "뒤 (−Z)"];
const preset = () => ({ position: [0, 0.1 + 0.3 / Math.sqrt(2), 0.3 / Math.sqrt(2)], target: [0, 0.1, 0], fov: 45, enabled: true, faces: [false, false, true, false, true, false], crop: [0, 0, 1, 1], zoom: 1, pan: [0, 0], showPlane: false, planeOpacity: 0.4 });

function CropPreview({ photo, crop, onChange, index }) {
  const drag = useRef(null);
  function point(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
  }
  return <div className={styles.cropPreview} aria-label={`사진 ${index + 1} 사용 영역 드래그 선택`} style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); drag.current = point(event); event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={(event) => { if (!drag.current) return; const end = point(event); const start = drag.current;
      if (Math.abs(end[0] - start[0]) < 0.01 || Math.abs(end[1] - start[1]) < 0.01) return;
      onChange([Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1])]); }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
    <img src={photo.url} alt={`사진 ${index + 1} 미리보기`} draggable={false} />
    <div className={styles.cropSelection} style={{ left: `${crop[0] * 100}%`, top: `${crop[1] * 100}%`, width: `${crop[2] * 100}%`, height: `${crop[3] * 100}%` }} />
  </div>;
}

function NumberControl({ label, value, min, max, step = 0.01, onChange }) {
  function change(event) {
    if (event.target.value === "") return;
    const next = Number(event.target.value);
    if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
  }
  return <label className={styles.numberRow}><span>{label}</span>
    <input type="range" aria-label={`${label} 슬라이더`} min={min} max={max} step={step} value={value} onChange={change} />
    <input type="number" aria-label={label} min={min} max={max} step={step} value={value} onChange={change} />
  </label>;
}

export default function PhotoProjectionLab({ onClose }) {
  const [shape, setShape] = useState("CUBE");
  const [dimensions, setDimensions] = useState({ x: 20, y: 20, z: 20 });
  const [photos, setPhotos] = useState([null, null]);
  const [projectors, setProjectors] = useState(() => [preset(0), preset(1)]);
  const [priority, setPriority] = useState(0);
  const [showGuides, setShowGuides] = useState(false);
  const [messages, setMessages] = useState(["", ""]);
  const [viewerError, setViewerError] = useState("");
  const [photoView, setPhotoView] = useState(null);
  const containerRef = useRef(null);
  const dialogRef = useRef(null);
  const sceneRef = useRef(null);
  const uploadsRef = useRef([0, 0]);
  const urlsRef = useRef(new Set());
  const photoRefs = useRef([null, null]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    const keyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      // Keep editor shortcuts and the focus cycle inside the temporary test.
      else {
        event.stopPropagation();
        if (event.key === "Tab") {
          const items = [...dialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled), select")];
          const first = items[0]; const last = items.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }
    };
    dialogRef.current.addEventListener("keydown", keyDown);
    const dialog = dialogRef.current;
    return () => {
      dialog.removeEventListener("keydown", keyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    try { sceneRef.current = createPhotoProjectionScene(containerRef.current, setViewerError); }
    catch (error) { console.error("[사진 투영 테스트 초기화]", error); queueMicrotask(() => setViewerError("WebGL을 시작하지 못했습니다. 브라우저의 그래픽 가속을 확인하세요.")); }
    return () => { sceneRef.current?.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => {
    sceneRef.current?.update({ dimensions, photos, projectors, priority, showGuides });
  }, [dimensions, photos, projectors, priority, showGuides]);
  useEffect(() => {
    const urls = urlsRef.current;
    const requests = uploadsRef.current;
    return () => { requests[0] += 1; requests[1] += 1; urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  function message(index, text) { setMessages((current) => current.map((old, i) => i === index ? text : old)); }
  function revoke(url) { if (url && urlsRef.current.delete(url)) URL.revokeObjectURL(url); }
  function remove(index) {
    uploadsRef.current[index] += 1;
    revoke(photoRefs.current[index]?.url);
    photoRefs.current[index] = null;
    setPhotos((current) => current.map((photo, i) => i === index ? null : photo));
    message(index, "");
  }
  async function upload(index, event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    const request = ++uploadsRef.current[index];
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { message(index, "JPG·PNG·WebP 사진만 사용할 수 있습니다."); return; }
    if (file.size > 12 * 1024 * 1024) { message(index, "사진은 한 장당 12MB 이하로 선택하세요."); return; }
    const url = URL.createObjectURL(file);
    urlsRef.current.add(url);
    message(index, "사진을 불러오는 중입니다.");
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (uploadsRef.current[index] !== request) { revoke(url); return; }
      const ratio = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const photo = { url, canvas, width: image.naturalWidth, height: image.naturalHeight, name: file.name };
      revoke(photoRefs.current[index]?.url);
      photoRefs.current[index] = photo;
      setPhotos((current) => current.map((old, i) => i === index ? photo : old));
      message(index, "사진 적용 완료 · 종료 시 삭제됩니다.");
    } catch {
      revoke(url);
      if (uploadsRef.current[index] === request) message(index, "사진을 읽지 못했습니다. 손상되지 않은 이미지로 다시 선택하세요.");
    }
  }
  function update(index, changes) { setProjectors((current) => current.map((p, i) => i === index ? { ...p, ...changes } : p)); }
  function viewPhoto(index) { setPhotoView(index); sceneRef.current?.viewPhoto(index); }
  function setDistance(index, centimetres) {
    const p = projectors[index];
    const delta = p.position.map((v, a) => v - p.target[a]);
    const length = Math.hypot(...delta);
    const direction = length > 0.0001 ? delta.map((v) => v / length) : [0, 1 / Math.sqrt(2), 1 / Math.sqrt(2)];
    update(index, { position: p.target.map((v, a) => v + direction[a] * centimetres / 100) });
  }
  function facePreset(index, face) {
    const target = [0, dimensions.y / 200, 0];
    const position = [...target];
    position[1] += 0.3 / Math.sqrt(2);
    position[face < 2 ? 0 : 2] += (face === 1 || face === 5 ? -1 : 1) * 0.3 / Math.sqrt(2);
    update(index, { target, position, faces: FACES.map((_, f) => f === 2 || f === face) });
    setShowGuides(true);
  }
  function dimension(axis, value) { setDimensions((current) => shape === "CUBE" ? { x: value, y: value, z: value } : { ...current, [axis]: value }); }

  return createPortal(<section ref={dialogRef} className={styles.lab} role="dialog" aria-modal="true" aria-labelledby="photo-projection-title" tabIndex={-1} data-editor-panel>
    <header className={styles.header}><div><h2 id="photo-projection-title">개발자모드 · 사진 투영 테스트</h2><span>임시 테스트 · 사진과 설정은 저장되지 않습니다</span></div><button type="button" onClick={onClose}>테스트 종료</button></header>
    <div className={styles.content}>
      <div className={styles.viewport}><div ref={containerRef} className={styles.canvas} aria-label="사진 투영 3D 뷰어" /><div className={styles.viewerTools}><button type="button" onClick={() => { viewPhoto(null); sceneRef.current?.fit(); }}>도형 맞춤 보기</button>{photoView !== null && <button type="button" onClick={() => viewPhoto(null)}>자유 보기로 돌아가기</button>}<span>{photoView === null ? "드래그: 회전 · 휠/두 손가락: 확대" : `사진 ${photoView + 1} 촬영 시점 · 오른쪽 카메라 설정으로 조절`}</span></div>{viewerError && <p role="alert" className={styles.error}>{viewerError}</p>}</div>
      <aside className={styles.settings} aria-label="사진 투영 설정">
        <section><h3>테스트 도형</h3><label>도형<select aria-label="테스트 도형" value={shape} onChange={(e) => { setShape(e.target.value); setDimensions(e.target.value === "CUBE" ? { x: 20, y: 20, z: 20 } : { x: 30, y: 20, z: 15 }); }}><option value="CUBE">정육면체</option><option value="BOX">직육면체</option></select></label>
          {(shape === "CUBE" ? [["x", "한 변"]] : [["x", "가로"], ["y", "높이"], ["z", "깊이"]]).map(([axis, label]) => <NumberControl key={axis} label={`${label} (cm)`} value={dimensions[axis]} min={1} max={100} step={1} onChange={(v) => dimension(axis, v)} />)}
          <p>초기 정육면체: 20 × 20 × 20cm (0.2m). 각 사진의 바라보는 지점을 도형 중심에 맞춰 조절하세요.</p>
          <p>사진만으로 촬영 좌표를 자동 역산하지 않습니다. 실제 크기와 거리·화각을 기준으로 사진 윤곽과 도형을 수동 정렬하세요. 자르기는 사각 영역 제외이며 배경 자동 제거는 아닙니다.</p>
          <label>겹치는 영역 우선순위<select aria-label="사진 우선순위" value={priority} onChange={(e) => setPriority(Number(e.target.value))}><option value={0}>사진 1 우선</option><option value={1}>사진 2 우선</option></select></label>
          <label className={styles.check}><input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />투영 카메라 보조선 표시</label>
        </section>
        {projectors.map((p, i) => <section key={i} aria-label={`사진 ${i + 1} 설정`}><h3>사진 {i + 1} · 촬영 위치 및 사용 영역</h3>
          <label className={styles.upload}>{photos[i] ? "사진 교체" : "사진 업로드"}<input aria-label={`사진 ${i + 1} 업로드`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(i, e)} /></label>
          {photos[i] && <><CropPreview photo={photos[i]} crop={p.crop} index={i} onChange={(crop) => update(i, { crop })} /><p className={styles.filename}>{photos[i].name} · {photos[i].width} × {photos[i].height}</p><p>사진 위를 드래그해 사용할 사각 영역을 선택하세요. 어두운 부분은 투영하지 않습니다. 아래 숫자로도 조절할 수 있습니다.</p>
            <fieldset><legend>사진 사용 영역 · 원본 기준</legend>{["왼쪽", "위쪽", "가로", "세로"].map((label, a) => <NumberControl key={label} label={`사진 ${i + 1} 자르기 ${label} (%)`} value={Number((p.crop[a] * 100).toFixed(2))} min={a < 2 ? 0 : 1} max={(a < 2 ? 1 - p.crop[a + 2] : 1 - p.crop[a - 2]) * 100} step={0.1} onChange={(v) => update(i, { crop: p.crop.map((old, j) => j === a ? v / 100 : old) })} />)}
              <NumberControl label={`사진 ${i + 1} 사진 확대`} value={p.zoom} min={0.25} max={5} step={0.05} onChange={(zoom) => update(i, { zoom })} />
              {["가로", "세로"].map((label, a) => <NumberControl key={label} label={`사진 ${i + 1} 사진 중심 ${label} (%)`} value={Number((p.pan[a] * 100).toFixed(2))} min={-100} max={100} step={1} onChange={(v) => update(i, { pan: p.pan.map((old, j) => j === a ? v / 100 : old) })} />)}
              <button type="button" onClick={() => update(i, { crop: [0, 0, 1, 1], pan: [0, 0], zoom: 1 })}>사진 {i + 1} 영역 초기화</button>
              <p>가로·세로는 원본의 사용 비율입니다. 확대는 원본 비율을 유지합니다. 촬영 위치를 추정할 때는 확대 1, 중심 0으로 먼저 맞추세요.</p>
            </fieldset></>}
          <p role="status">{messages[i]}</p>
          <div className={styles.actions}><label className={styles.check}><input type="checkbox" aria-label={`사진 ${i + 1} 표시`} checked={p.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />사진 표시</label><button type="button" disabled={!photos[i]} onClick={() => remove(i)}>사진 {i + 1} 제거</button><button type="button" onClick={() => update(i, preset(i))}>사진 {i + 1} 설정 초기화</button></div>
          <fieldset><legend>촬영 위치 맞추기</legend><p>사진에 보이는 두 면을 고르면 해당 방향의 윗사선 30cm로 맞추고, 나머지 면의 투영을 끕니다.</p>
            <div className={styles.actions}>{[[4, "위+앞"], [5, "위+뒤"], [1, "위+왼쪽"], [0, "위+오른쪽"]].map(([face, label]) => <button key={face} type="button" onClick={() => facePreset(i, face)}>{`사진 ${i + 1} ${label} 두 면 맞춤`}</button>)}</div>
            <NumberControl label={`사진 ${i + 1} 대상까지 거리 (cm)`} value={Number((Math.hypot(...p.position.map((v, a) => v - p.target[a])) * 100).toFixed(2))} min={5} max={300} step={1} onChange={(v) => setDistance(i, v)} />
            <p>거리는 표면이 아닌 ‘바라보는 지점’ 기준입니다. 촬영 좌표: X {(p.position[0] * 100).toFixed(1)} · Y {(p.position[1] * 100).toFixed(1)} · Z {(p.position[2] * 100).toFixed(1)}cm. 도형 바닥 중심이 (0, 0, 0)입니다.</p>
            <label className={styles.check}><input type="checkbox" aria-label={`사진 ${i + 1} 월드 사진 평면`} checked={p.showPlane} onChange={(e) => update(i, { showPlane: e.target.checked })} />월드에 반투명 사진 평면 표시</label>
            <NumberControl label={`사진 ${i + 1} 겹쳐보기 불투명도`} value={p.planeOpacity} min={0} max={1} step={0.05} onChange={(planeOpacity) => update(i, { planeOpacity })} />
            <button type="button" disabled={!photos[i]} aria-pressed={photoView === i} onClick={() => { update(i, { showPlane: true }); viewPhoto(i); }}>사진 {i + 1} 촬영 시점으로 보기</button>
            <p>사진 평면은 광선 중간의 참고 이미지이며 실제 촬영 위치가 아닙니다. 촬영 시점에서 불투명도를 바꾸며 도형과 사진 윤곽을 겹쳐 맞추세요.</p>
          </fieldset>
          {["position", "target"].map((key) => <fieldset key={key}><legend>{key === "position" ? "카메라 위치" : "바라보는 지점"} (m)</legend>{["X", "Y", "Z"].map((axis, a) => <NumberControl key={axis} label={`사진 ${i + 1} ${key === "position" ? "위치" : "대상"} ${axis}`} value={p[key][a]} min={-3} max={3} onChange={(v) => update(i, { [key]: p[key].map((old, j) => j === a ? v : old) })} />)}</fieldset>)}
          <NumberControl label={`사진 ${i + 1} 화각 (°)`} value={p.fov} min={5} max={120} step={1} onChange={(v) => update(i, { fov: v })} />
          {p.position.every((v, a) => Math.abs(v - p.target[a]) < 0.001) && <p role="alert">카메라 위치와 바라보는 지점을 다르게 설정하세요.</p>}
          <fieldset><legend>적용할 면 · 기본은 위+앞 두 면만</legend><p>사진 속 면은 자동 인식하지 않습니다. 실제로 찍힌 면만 선택하세요. 두 사진의 허용 면이 합쳐져 표시되므로 각 사진을 따로 확인하세요.</p><div className={styles.faces}>{FACES.map((face, f) => <label key={face} className={styles.check}><input type="checkbox" aria-label={`사진 ${i + 1} ${face}`} checked={p.faces[f]} onChange={(e) => update(i, { faces: p.faces.map((old, j) => j === f ? e.target.checked : old) })} />{face}</label>)}</div></fieldset>
        </section>)}
      </aside>
    </div>
  </section>, document.body);
}
