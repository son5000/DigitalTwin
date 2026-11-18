import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";

const source = readFileSync(new URL("../src/features/digitalTwin/editor/DigitalTwinEditorPage.jsx", import.meta.url), "utf8");
function callback(name, context) {
  const start = source.indexOf("useCallback(", source.indexOf(`const ${name} =`)) + "useCallback(".length;
  const end = source.indexOf("\n  }, [", start) + 4;
  return runInNewContext(`(${source.slice(start, end)})`, context);
}

function harness({ failAt, pauseAt } = {}) {
  const calls = [];
  let resume;
  let savedLayout;
  const remote = async (stage, signal, result) => {
    calls.push(stage);
    assert.ok(savedLayout, "Local save must finish before any remote work");
    assert.ok(signal instanceof AbortSignal);
    if (stage === pauseAt) await new Promise((resolve) => { resume = resolve; });
    if (stage === failAt) throw new Error(stage);
    // Intentionally resolve after cancellation to check stale completion handling.
    return result;
  };
  const context = {
    AbortController, isSaving: false, pendingAssetUploads: 0,
    projectSaveControllerRef: { current: null },
    getCurrentSetupSummary: () => ({ equipmentCount: 1, pendingCount: 3 }),
    OBSERVATION_SCOPE_TYPES: { SINGLE_EQUIPMENT: "SINGLE", MULTI_EQUIPMENT: "MULTI" },
    STEP_TRANSITION_ACTION_IDS: { CANCEL: "cancel", SAVE_AND_EXIT: "save" },
    editor: { observationWorkflow: { configured: true, scopeType: "SINGLE" }, projectName: "TR-L1",
      allMonitoringEquipment: [{}], layoutDocument: { name: "TR-L1" } },
    saveLayout: (layout) => {
      calls.push("local");
      if (failAt === "local") throw new Error("QuotaExceededError");
      savedLayout = layout;
      return layout;
    },
    setSaveStatus: () => {},
    setStepTransitionPrompt: (prompt) => calls.push(prompt ? "prompt" : "clearPrompt"),
    setIsSaving: () => {}, setHasUnsavedChanges: () => calls.push("clean"),
    navigateToAppRoute: (route) => calls.push(route), projectApiBase: "/api",
    readProjects: () => ({ activeId: "local-id", projects: [] }),
    uploadProjectAssets: (id, layout, signal) => remote("upload", signal, []),
    createBackendProject: (id, layout, signal) => remote("create", signal, { id: "server-id" }),
    linkProjectServerId: () => calls.push("link"),
    saveProjectConfiguration: (id, layout, signal) => remote("save", signal, { revision: 1 }),
    markProjectSavedRevision: () => calls.push("revision"),
    publishProjectConfiguration: (id, revision, signal) => remote("publish", signal),
    markProjectPublishedRevision: () => calls.push("published"), window: { localStorage: {} },
  };
  return { calls, context, save: callback("saveAndReturnToProjects", context),
    leave: callback("returnWithLocalSave", context),
    resume: () => resume(), layout: () => savedLayout };
}

for (const failAt of [undefined, "upload", "create", "save"]) {
  test(`unfinished setup saves a local draft and exits: ${failAt ?? "server success"}`, async () => {
    const h = harness({ failAt });
    await h.save();
    assert.equal(h.layout().projectStatus, "DRAFT");
    assert.equal(h.calls.includes("prompt"), false);
    assert.deepEqual(h.calls.slice(-3), ["clean", "clearPrompt", "/projects"]);
  });
}

test("local storage failure keeps the editor and does not offer an unsaved exit", async () => {
  const h = harness({ failAt: "local" });
  await h.save();
  h.leave();
  assert.deepEqual(h.calls, ["local", "prompt"]);
});

for (const pauseAt of ["upload", "create", "save", "publish"]) {
  test(`exit with local save immediately while ${pauseAt} is pending; ignore late completion`, async () => {
    const h = harness({ pauseAt });
    h.context.getCurrentSetupSummary = () => ({ equipmentCount: 0 });
    const pending = h.save("READY");
    while (!h.calls.includes(pauseAt)) await new Promise((resolve) => setImmediate(resolve));
    await h.save();
    assert.equal(h.calls.filter((call) => call === "local").length, 1, "Repeated clicks must not start another save");
    const signal = h.context.projectSaveControllerRef.current.signal;
    h.leave();
    assert.equal(signal.aborted, true);
    assert.equal(h.calls.at(-1), "/projects", "Navigation must not wait for the server");
    const callsAtExit = [...h.calls];
    h.resume();
    await pending;
    assert.deepEqual(h.calls, callsAtExit, "Late responses must not update metadata or navigate again");
  });
}
