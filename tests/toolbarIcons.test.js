import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const readSource = (path) => readFile(new URL(path, ROOT), "utf8");

test("toolbar image registry keeps light and dark assets separate from legacy SVG icons", async () => {
  const [registry, actions] = await Promise.all([
    readSource("src/features/digitalTwin/editor/components/toolbarIconRegistry.js"),
    readSource("src/features/digitalTwin/editor/components/toolbarActionDefinitions.jsx"),
  ]);

  const requiredKeys = [
    "select", "move", "rotate", "transparency", "isolate", "hide-surroundings",
    "shadow", "high-detail", "floor-spacing", "path-edit", "play", "pause", "stop",
  ];
  requiredKeys.forEach((iconKey) => assert.match(registry, new RegExp(`"${iconKey}"`)));
  assert.match(registry, /\/assets\/toolbar-icons/);
  assert.match(registry, /light:/);
  assert.match(registry, /dark:/);
  assert.match(registry, /preloadToolbarIcons\(\);/);
  assert.doesNotMatch(`${registry}\n${actions}`, /data:image|procedural:/i);
  assert.doesNotMatch(actions, /@\/components\/icons|Icon\b/);
});

test("toolbar and timeline use the shared md icon size without text playback icons", async () => {
  const [toolbar, primitives, timeline, css] = await Promise.all([
    readSource("src/features/digitalTwin/editor/components/EditorToolbar.jsx"),
    readSource("src/features/digitalTwin/editor/components/ToolbarPrimitives.jsx"),
    readSource("src/features/digitalTwin/editor/components/MovementTimeline.jsx"),
    readSource("src/features/digitalTwin/editor/components/EditorToolbar.module.css"),
  ]);

  assert.match(toolbar, /TOOLBAR_ACTION_IDS\.MOVEMENT_PATH/);
  assert.match(timeline, /TOOLBAR_ACTION_IDS\.PLAY/);
  assert.match(timeline, /TOOLBAR_ACTION_IDS\.PAUSE/);
  assert.match(timeline, /TOOLBAR_ACTION_IDS\.STOP/);
  assert.doesNotMatch(`${toolbar}\n${timeline}`, /[▶Ⅱ■]/);
  assert.match(primitives, /sm:\s*20/);
  assert.match(primitives, /md:\s*24/);
  assert.match(primitives, /lg:\s*28/);
  assert.match(primitives, /size = "md"/);
  assert.match(primitives, /<img/);
  assert.match(primitives, /loading="eager"/);
  assert.match(primitives, /decoding="sync"/);
  assert.doesNotMatch(`${toolbar}\n${timeline}`, /@\/components\/icons|\bicon=\{/);
  assert.match(css, /width:\s*40px;[\s\S]*height:\s*40px;/);
  assert.match(css, /\.iconMD,[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;[\s\S]*flex:\s*0 0 24px;/);
  assert.match(css, /\.icon img[\s\S]*filter:\s*none;[\s\S]*opacity:\s*1;[\s\S]*transform:\s*none;/);
  assert.match(css, /\.button:disabled[\s\S]*opacity:\s*1;/);
  assert.doesNotMatch(css, /backdrop-filter/);
});
