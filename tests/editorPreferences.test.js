import test from "node:test";
import assert from "node:assert/strict";

import { normalizeEditorPreferences } from "../src/features/digitalTwin/editor/store/useEditorPreferences.js";

test("그림자 환경설정은 기본 켜짐이며 명시적인 boolean만 복원한다", () => {
  assert.deepEqual(normalizeEditorPreferences(null), { shadowEnabled: true });
  assert.deepEqual(normalizeEditorPreferences({ shadowEnabled: false }), { shadowEnabled: false });
  assert.deepEqual(normalizeEditorPreferences({ shadowEnabled: "false" }), { shadowEnabled: true });
});
