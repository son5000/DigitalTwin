import test from "node:test";
import assert from "node:assert/strict";
import { canUseDeveloperViewer, isDeveloperViewer, signInDemoAccount } from "../src/features/portal/portalSession.js";

function createStorage() {
  const entries = new Map();
  return { entries, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test("production dev login enables the list and developer URL after session restoration without storing password", () => {
  const storage = createStorage();
  const options = { development: false, storage };
  assert.equal(canUseDeveloperViewer(options), false);
  assert.equal(isDeveloperViewer("?project=demo&developer=1", options), false);
  assert.equal(signInDemoAccount("dev", "123", storage), true);
  const restored = createStorage();
  for (const [key, value] of storage.entries) restored.setItem(key, value);
  assert.equal(canUseDeveloperViewer({ development: false, storage: restored }), true);
  assert.equal(isDeveloperViewer("?project=demo&developer=1", options), true);
  assert.equal(isDeveloperViewer("?project=demo", options), false);
  assert.deepEqual(JSON.parse([...storage.entries.values()][0]), { version: 1, username: "dev" });
});

test("incorrect accounts or passwords cannot enable production developer tools", () => {
  for (const [username, password] of [["dev", "wrong"], ["other", "123"], ["", ""]]) {
    const storage = createStorage();
    assert.equal(signInDemoAccount(username, password, storage), false);
    assert.equal(canUseDeveloperViewer({ development: false, storage }), false);
    assert.equal(storage.entries.size, 0);
  }
});

test("invalid or unavailable storage fails closed while local development access is preserved", () => {
  for (const raw of ["invalid", "null", '{"version":2,"username":"dev"}', '{"version":1,"username":"other"}']) {
    assert.equal(canUseDeveloperViewer({ development: false, storage: { getItem: () => raw } }), false);
  }
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(canUseDeveloperViewer({ development: false, storage: denied }), false);
  assert.throws(() => signInDemoAccount("dev", "123", denied), /denied/);
  assert.equal(isDeveloperViewer("?developer=1", { development: true, storage: denied }), true);
});
