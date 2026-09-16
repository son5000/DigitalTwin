import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons/actionIcons";
import { ASSET_STATUSES, createOperationsReport, PRIORITIES, reportCsv, saveOperationRecord, SERVICE_TITLES, TICKET_STATUSES, updateNotification } from "./operationsModel.js";
import styles from "./ViewerOperationsPage.module.css";

const dateText = (value) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString("ko-KR") : "—";
const EMPTY_RECORD = {};
function Field({ label, children, ...props }) {
  return <label className={styles.field}><span>{label}</span>{children || <input {...props} />}</label>;
}
function Choices({ label, name, value = "", items, required = false, multiple = false }) {
  const values = multiple ? value : value ? [value] : [];
  const missing = values.filter((entry) => !items.some((item) => (item.id ?? item) === entry));
  return <Field label={label}><select name={name} defaultValue={value} required={required} multiple={multiple}>
    {!multiple && <option value="">선택 안 함</option>}
    {missing.map((entry) => <option key={entry} value={entry}>이전 연결 정보 (현재 목록에 없음)</option>)}
    {items.map((item) => <option key={item.id ?? item} value={item.id ?? item}>{item.name ?? item}</option>)}
  </select></Field>;
}
function History({ items = [] }) {
  return items.length > 0 && <details className={styles.history}><summary>변경 이력 · {items.length}건</summary><ol>{[...items].reverse().map((item, index) => <li key={`${item.at}-${index}`}><strong>{item.action}</strong><span>{dateText(item.at)} · {item.actor}</span>{item.note && <p>{item.note}</p>}</li>)}</ol></details>;
}
function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ViewerOperationsPage({ active, initialRecord = null, onClose, onNavigate, operations, assets, locations, projectName, onLocate, settings, operatorName }) {
  const headingRef = useRef(null);
  const dirtyRef = useRef(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [editing, setEditing] = useState(initialRecord);
  const [notice, setNotice] = useState("");
  const { data, change, error } = operations;
  const actor = data.profile.name || operatorName || "운영자";
  useEffect(() => {
    headingRef.current?.focus();
    const protectDraft = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, []);
  function leave(action) {
    if (dirtyRef.current && !window.confirm("저장하지 않은 입력을 버리고 이동하시겠습니까?")) return;
    dirtyRef.current = false; action();
  }
  function persist(update, message = "저장했습니다.") {
    const ok = change(update);
    if (ok) { dirtyRef.current = false; setEditing(null); setNotice(message); }
    return ok;
  }
  const people = data.people.filter((item) => !item.archived);
  const targets = [...locations, ...assets.map((item) => ({ id: item.id, name: `${item.name} · ${item.location || "위치 미지정"}` }))];
  const collection = { assets, people: data.people, tickets: data.tickets, notifications: data.notifications, reports: data.reports }[active] ?? [];
  const filtered = collection.filter((item) => {
    const matches = `${item.name || item.title} ${item.location ?? ""} ${item.company ?? ""} ${item.description ?? item.message ?? ""} ${item.assetName ?? ""} ${item.locationName ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matches && (!filter || (active === "people" ? item.archived ? "중지" : item.kind : active === "reports" ? "" : item.status) === filter);
  }).sort((a, b) => sort === "name" ? (a.name || a.title).localeCompare(b.name || b.title, "ko")
    : sort === "priority" ? PRIORITIES.indexOf(a.priority || "보통") - PRIORITIES.indexOf(b.priority || "보통")
      : (sort === "oldest" ? 1 : -1) * ((Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)));
  const filterItems = { assets: ASSET_STATUSES, people: ["담당자", "AS센터", "중지"], tickets: TICKET_STATUSES, notifications: ["미확인", "확인", "종결"] }[active];
  function edit(item) { leave(() => { setEditing(item); setNotice(""); }); }
  function submitRecord(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const fields = Object.fromEntries(values);
    Object.keys(fields).forEach((key) => { if (typeof fields[key] === "string") fields[key] = fields[key].trim(); });
    if (active === "people") { fields.targets = values.getAll("targets"); fields.archived = values.has("archived"); }
    const source = assets.find((item) => item.id === fields.assetId);
    if (active === "tickets") {
      fields.assetName = source?.name || "";
      fields.locationId = fields.locationId || source?.locationId || "";
      fields.locationName = locations.find((item) => item.id === fields.locationId)?.name || source?.location || "";
    }
    persist((current) => saveOperationRecord(current, active, { ...editing, ...fields }, actor));
  }
  const selected = editing ? collection.find((item) => item.id === editing.id) ?? editing : null;
  const closedTickets = data.tickets.filter((item) => item.status === "완료").length;
  return <main className={styles.page} aria-labelledby="operations-title">
    <header className={styles.header}><div><span>{projectName} · 운영 워크스페이스</span><h1 ref={headingRef} tabIndex={-1} id="operations-title">{SERVICE_TITLES[active]}</h1></div><button type="button" onClick={() => leave(onClose)} aria-label="관리 페이지 닫고 월드로 돌아가기"><CloseIcon size={20} /> 월드로 돌아가기</button></header>
    <nav className={styles.navigation} aria-label="운영 관리 메뉴">{Object.entries(SERVICE_TITLES).map(([id, title]) => <button type="button" key={id} aria-current={active === id ? "page" : undefined} onClick={() => leave(() => onNavigate(id))}>{title}</button>)}</nav>
    <div className={styles.content}>
      <p className={styles.storageNote}>이 브라우저의 프로젝트별 관리대장입니다. 다른 사용자와 공유하거나 AS센터에 자동 전송하지 않습니다.</p>
      {(error || notice) && <p role={error ? "alert" : "status"} className={styles.notice}>{error || notice}</p>}
      {["assets", "people", "tickets", "reports", "notifications"].includes(active) && <>
        <div className={styles.metrics}><div><span>등록 자산</span><strong>{assets.length}</strong></div><div><span>미완료 접수</span><strong>{data.tickets.length - closedTickets}</strong></div><div><span>미확인 알림</span><strong>{data.notifications.filter((item) => item.status === "미확인").length}</strong></div></div>
        <div className={styles.controls}><Field label="검색" placeholder="이름, 위치 또는 내용 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          {filterItems && <Field label="상태 필터"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">전체</option>{filterItems.map((item) => <option key={item}>{item}</option>)}</select></Field>}
          <Field label="정렬"><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">최신순</option><option value="oldest">오래된순</option><option value="name">이름순</option>{active === "tickets" && <option value="priority">우선순위</option>}</select></Field>
          {active !== "notifications" && <button className={styles.primary} type="button" onClick={() => edit(EMPTY_RECORD)}>{active === "reports" ? "보고서 생성" : active === "tickets" ? "고장 접수" : "신규 등록"}</button>}
        </div>
        <div className={styles.split}>
          <section aria-label={`${SERVICE_TITLES[active]} 목록`} className={styles.list}><p className={styles.count}>{filtered.length}건 · 항목을 선택해 상세 내용을 확인하세요.</p>
            {!filtered.length && <div className={styles.empty}>표시할 항목이 없습니다.{active !== "notifications" ? " 신규 등록하거나 검색 조건을 변경하세요." : "뷰어에서 수신한 알림이 자동으로 이력에 보관됩니다."}</div>}
            {filtered.map((item) => <button type="button" key={item.id} className={styles.record} aria-pressed={selected?.id === item.id} onClick={() => edit(item)}>
              <span><strong>{item.name || item.title}</strong><small>{item.location || item.company || item.assetName || item.message || `${item.from} ~ ${item.to}`}</small></span>
              <span className={styles.recordMeta}><b>{item.archived ? "중지" : item.status || item.kind || "저장됨"}</b><small>{item.priority || dateText(item.createdAt)}</small>{item.missing && <small>월드에서 제거된 자산</small>}</span>
            </button>)}
          </section>
          <section className={styles.detail} aria-label="항목 상세">
            {!selected ? <div className={styles.empty}>목록에서 항목을 선택하거나 새로 등록하세요.</div> : <>
              <h2>{selected.name || selected.title || `${SERVICE_TITLES[active]} 등록`}</h2>
              {["assets", "people", "tickets"].includes(active) && <form key={selected.id || "new"} onSubmit={submitRecord} onChange={() => { dirtyRef.current = true; }} className={styles.form}>
                {active === "assets" && <>
                  <Field label="자산명 *" name="name" required maxLength={120} defaultValue={selected.name} readOnly={Boolean(selected.worldKey)} />
                  {selected.worldKey ? <p className={styles.hint}>월드 위치: {selected.location} · 이름과 위치는 에디터에서 수정합니다.</p> : <Field label="설치 위치" name="location" defaultValue={selected.location} maxLength={160} />}
                  <Field label="관리 번호" name="code" defaultValue={selected.code} maxLength={80} /><Field label="제조사 / 모델" name="model" defaultValue={selected.model} maxLength={120} />
                  <Choices label="운영 상태 *" name="status" value={selected.status || "정상"} items={ASSET_STATUSES} required />
                  <Choices label="담당자" name="managerId" value={selected.managerId} items={people.filter((item) => item.kind === "담당자")} />
                  <Choices label="AS센터" name="centerId" value={selected.centerId} items={people.filter((item) => item.kind === "AS센터")} />
                  <Field label="다음 점검일" type="date" name="inspectionDate" defaultValue={selected.inspectionDate} /><Field label="보증 만료일" type="date" name="warrantyDate" defaultValue={selected.warrantyDate} />
                  <Field label="관리 메모"><textarea name="note" defaultValue={selected.note} maxLength={4000} /></Field>
                  <button type="button" onClick={() => leave(() => onNavigate("tickets", { assetId: selected.id, assetName: selected.name, locationId: selected.locationId, managerId: selected.managerId, centerId: selected.centerId, title: `${selected.name} 점검 요청` }))} disabled={!selected.id}>이 자산으로 고장·정비 접수</button>
                  {selected.worldKey && !selected.missing && onLocate && <button type="button" onClick={() => leave(() => onLocate(selected.worldKey))}>월드에서 위치 보기</button>}
                </>}
                {active === "people" && <>
                  <Choices label="유형 *" name="kind" value={selected.kind || "담당자"} items={["담당자", "AS센터"]} required />
                  <Field label="담당자 / 센터명 *" name="name" defaultValue={selected.name} required maxLength={120} />
                  <Field label="소속 / 회사" name="company" defaultValue={selected.company} maxLength={120} /><Field label="직무 / 담당 업무" name="role" defaultValue={selected.role} maxLength={120} />
                  <Field label="연락처" name="phone" type="tel" defaultValue={selected.phone} maxLength={60} /><Field label="이메일" name="email" type="email" defaultValue={selected.email} maxLength={160} />
                  <Field label="근무 / 대응 시간" name="hours" defaultValue={selected.hours} placeholder="평일 09:00~18:00 / 긴급 대응 번호" maxLength={160} />
                  <Choices label="담당 설비·위치 (Ctrl 또는 ⌘로 여러 항목 선택)" name="targets" value={selected.targets || []} items={targets} multiple />
                  {selected.targets?.length > 0 && <p className={styles.hint}>현재 담당: {selected.targets.map((id) => targets.find((item) => item.id === id)?.name || "현재 월드에 없는 대상").join(", ")}</p>}
                  <Field label="업무 메모"><textarea name="note" defaultValue={selected.note} maxLength={4000} /></Field>
                  <label className={styles.check}><input type="checkbox" name="archived" value="true" defaultChecked={selected.archived} /> 사용 중지 (기존 이력 보존)</label>
                </>}
                {active === "tickets" && <>
                  <Field label="접수 제목 *" name="title" defaultValue={selected.title} required maxLength={160} />
                  <Choices label="대상 설비 (설비 또는 위치 필수)" name="assetId" value={selected.assetId} items={assets} />
                  <Choices label="발생 위치" name="locationId" value={selected.locationId} items={locations} />
                  <Choices label="우선순위 *" name="priority" value={selected.priority || "보통"} items={PRIORITIES} required />
                  <Choices label="상태 *" name="status" value={selected.status || "접수"} items={TICKET_STATUSES} required />
                  <Choices label="처리 담당자" name="managerId" value={selected.managerId} items={people.filter((item) => item.kind === "담당자")} />
                  <Choices label="AS센터" name="centerId" value={selected.centerId} items={people.filter((item) => item.kind === "AS센터")} />
                  <Field label="처리 예정일" name="dueDate" type="date" defaultValue={selected.dueDate} />
                  <Field label="증상 / 요청 내용 *"><textarea name="description" defaultValue={selected.description} required maxLength={4000} /></Field>
                  <Field label="조치 내용 (완료 시 필수)"><textarea name="resolution" defaultValue={selected.resolution} maxLength={4000} /></Field>
                  {selected.assetId && onLocate && assets.find((item) => item.id === selected.assetId && item.worldKey && !item.missing) && <button type="button" onClick={() => leave(() => onLocate(assets.find((item) => item.id === selected.assetId).worldKey))}>대상 설비 위치 보기</button>}
                </>}
                <div className={styles.actions}><button className={styles.primary} type="submit">저장</button><button type="button" onClick={() => leave(() => setEditing(null))}>취소</button></div>
              </form>}
              {active === "notifications" && <>
                <p>{selected.message}</p><p className={styles.hint}>수신: {dateText(selected.createdAt)} · {selected.severity} · {selected.status}</p>
                <button type="button" onClick={() => leave(() => onNavigate("tickets", { title: selected.title, description: selected.message, notificationId: selected.id, assetId: selected.assetId || "" }))}>이 알림으로 고장 접수</button>
                <form key={selected.id} className={styles.form} onChange={() => { dirtyRef.current = true; }} onSubmit={(event) => { event.preventDefault(); const fields = new FormData(event.currentTarget); persist((current) => updateNotification(current, selected.id, fields.get("status"), actor, fields.get("note"))); }}>
                  <Choices label="처리 상태" name="status" value={selected.status} items={["미확인", "확인", "종결"]} required /><Field label="처리 메모 (종결 시 필수)"><textarea name="note" maxLength={2000} /></Field><button className={styles.primary} type="submit">처리 이력 저장</button>
                </form>
              </>}
              {active === "reports" && (selected.id ? <>
                <p className={styles.hint}>{selected.from} ~ {selected.to} · 작성자 {selected.author} · {dateText(selected.createdAt)}</p>
                <p>자산 {selected.assets.length}건 · 접수 {selected.tickets.length}건 (완료 {selected.tickets.filter((item) => item.status === "완료").length}건) · 알림 {selected.notifications.length}건</p>
                <p className={styles.hint}>접수·알림은 기간 내 등록 건의 보고서 생성 시점 상태입니다. 자산은 생성 시점 전체 현황입니다.</p>
                <div className={styles.actions}><button type="button" onClick={() => download(reportCsv(selected), `운영보고서-${selected.from}-${selected.to}.csv`, "text/csv;charset=utf-8")}>CSV 내려받기</button><button type="button" onClick={() => download(JSON.stringify(selected, null, 2), `운영보고서-${selected.from}-${selected.to}.json`, "application/json")}>이력 포함 JSON</button></div>
                <h3>접수 내역</h3>{selected.tickets.length ? selected.tickets.map((item) => <p key={item.id}>{item.title} · {item.assetName || item.locationName} · {item.status}</p>) : <p>해당 기간 접수가 없습니다.</p>}
                <h3>알림 내역</h3>{selected.notifications.map((item) => <p key={item.id}>{item.title} · {item.status}</p>)}
              </> : <form className={styles.form} onChange={() => { dirtyRef.current = true; }} onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); persist((current) => ({ ...current, reports: [...current.reports, createOperationsReport(current, assets, { ...fields, author: actor })] }), "보고서를 생성했습니다. 목록에서 확인하거나 내려받으세요."); }}>
                <Field label="보고서 제목 *" name="title" required maxLength={160} placeholder="월간 설비 운영 보고서" /><Field label="조회 시작일 *" name="from" type="date" required /><Field label="조회 종료일 *" name="to" type="date" required /><p className={styles.hint}>등록·수신일 기준으로 집계하며 생성한 보고서는 이후 상태 변경에도 유지됩니다.</p><button className={styles.primary} type="submit">보고서 생성 및 저장</button>
              </form>)}
              <History items={selected.history} />
            </>}
          </section>
        </div>
      </>}
      {active === "profile" && <section className={styles.settings}><h2>내 운영자 정보</h2><p className={styles.hint}>이름은 접수·알림 처리 이력의 작성자로 사용됩니다. 로그인 계정이나 권한을 변경하지 않습니다.</p><form className={styles.form} onChange={() => { dirtyRef.current = true; }} onSubmit={(event) => { event.preventDefault(); const profile = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, value.trim()])); persist((current) => { if (!profile.name) throw new Error("표시 이름을 입력하세요."); return { ...current, profile }; }); }}>
        <Field label="표시 이름 *" name="name" defaultValue={data.profile.name || operatorName} required maxLength={80} /><Field label="부서" name="department" defaultValue={data.profile.department} maxLength={100} /><Field label="직무" name="role" defaultValue={data.profile.role} maxLength={100} /><Field label="연락처" name="phone" type="tel" defaultValue={data.profile.phone} maxLength={60} /><Field label="이메일" name="email" type="email" defaultValue={data.profile.email} maxLength={160} /><button className={styles.primary} type="submit">내 정보 저장</button>
      </form></section>}
      {active === "settings" && <section className={styles.settings}><h2>기본 보기 설정</h2><p className={styles.hint}>저장하면 현재 화면에 적용되고 다음 접속에도 유지됩니다.</p><form className={styles.form} onChange={() => { dirtyRef.current = true; }} onSubmit={(event) => { event.preventDefault(); const fields = new FormData(event.currentTarget); const preferences = { theme: fields.get("theme"), viewMode: fields.get("viewMode") || "3D", movementEnabled: fields.has("movementEnabled") }; if (persist((current) => ({ ...current, preferences }))) { settings.onThemeChange(preferences.theme); settings.onViewModeChange?.(preferences.viewMode); settings.onMovementToggle?.(preferences.movementEnabled); } }}>
        <Choices label="화면 테마" name="theme" value={settings.theme} items={[{ id: "light", name: "라이트" }, { id: "dark", name: "다크" }]} required />
        {settings.onViewModeChange && <Choices label="기본 월드 표시" name="viewMode" value={settings.viewMode} items={[{ id: "3D", name: "3D 월드" }, { id: "2D", name: "2D 도면" }]} required />}
        {settings.onMovementToggle && <label className={styles.check}><input type="checkbox" name="movementEnabled" defaultChecked={settings.movementEnabled} /> 차량·사람 이동 애니메이션</label>}
        <button className={styles.primary} type="submit">설정 저장 및 적용</button>
      </form></section>}
    </div>
  </main>;
}
