import test from "node:test";
import assert from "node:assert/strict";
import { createProjectConfigurationPayload } from "../src/features/portal/projects/projectConfigurationApi.js";

test("backend draft save sends layout v18 and the current server revision", () => {
  const layout = {
    version: 18,
    hierarchy: { nodes: [{ id: "site", type: "SITE" }] },
    savedAt: "2026-11-16T00:00:00.000Z",
    name: "펌프 관측",
    projectStatus: "DRAFT",
    observationWorkflow: { scopeType: "SINGLE_EQUIPMENT" },
    siteEnvironment: { width: 10, depth: 10 },
  };
  const payload = createProjectConfigurationPayload(layout, 4);
  assert.equal(payload.baseRevision, 4);
  assert.deepEqual(payload.layout, layout);
  assert.deepEqual(payload.assetManifest, []);
  assert.equal(createProjectConfigurationPayload(layout).baseRevision, 0);
  assert.throws(() => createProjectConfigurationPayload(layout, -1));
  assert.throws(() => createProjectConfigurationPayload({ ...layout, version: 17 }));
});
