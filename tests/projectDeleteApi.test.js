import test from "node:test";
import assert from "node:assert/strict";
import { deleteProjectConfiguration } from "../src/features/portal/projects/projectDeleteApi.js";

test("delete sends the encoded server ID and accepts confirmed 204 or JSON success", async () => {
  const controller = new AbortController();
  for (const response of [null, { projectId: "server/id", deleted: true }]) {
    const result = await deleteProjectConfiguration("server/id", controller.signal, async (path, options) => {
      assert.equal(path, "/projects/server%2Fid");
      assert.deepEqual(options, { method: "DELETE", signal: controller.signal });
      return response;
    });
    assert.deepEqual(result, { projectId: "server/id", deleted: true });
  }
});

test("delete does not mistake failures, wrong IDs or unconfirmed responses for success", async () => {
  for (const response of [{ projectId: "other", deleted: true }, { projectId: "server", deleted: false }, {}]) {
    await assert.rejects(deleteProjectConfiguration("server", undefined, async () => response), /삭제 결과/);
  }
  for (const status of [403, 404, 409, 500]) {
    const error = Object.assign(new Error("rejected"), { status });
    await assert.rejects(deleteProjectConfiguration("server", undefined, async () => { throw error; }), (cause) => cause === error);
  }
  let called = false;
  const request = async () => { called = true; };
  await assert.rejects(deleteProjectConfiguration("", undefined, request));
  await assert.rejects(deleteProjectConfiguration("server", AbortSignal.abort(), request), { name: "AbortError" });
  assert.equal(called, false);
});
