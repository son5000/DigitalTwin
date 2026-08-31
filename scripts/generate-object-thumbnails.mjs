import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as createViteServer } from "vite";

const projectRoot = process.cwd();
const outputDirectory = path.join(projectRoot, "public", "assets", "object-thumbnails");
await mkdir(outputDirectory, { recursive: true });

let complete;
const completion = new Promise((resolve) => { complete = resolve; });
const server = createHttpServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type,x-template-id");
  if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (request.url === "/thumbnail" && request.method === "POST") {
    const id = request.headers["x-template-id"];
    if (!/^[A-Z0-9_-]+$/i.test(id ?? "")) { response.writeHead(400).end("invalid template id"); return; }
    await writeFile(path.join(outputDirectory, `${id}.png`), Buffer.concat(chunks));
    response.writeHead(204).end();
    return;
  }
  if (request.url === "/complete" && request.method === "POST") {
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(204).end();
    complete(result);
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => server.listen(4179, "127.0.0.1", resolve));

const vite = await createViteServer({
  root: projectRoot,
  logLevel: "warn",
  server: { host: "127.0.0.1", port: 4178, strictPort: true },
});
await vite.listen();
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const { existsSync } = await import("node:fs");
const chrome = chromeCandidates.find(existsSync);
if (!chrome) throw new Error("Chrome 또는 Edge 실행 파일을 찾지 못했습니다.");
const browser = spawn(chrome, [
  "--headless=new",
  "--disable-gpu-sandbox",
  "--use-angle=swiftshader",
  "--enable-webgl",
  "--no-first-run",
  "--window-size=512,512",
  "http://127.0.0.1:4178/thumbnail-renderer.html?generate=all",
], { stdio: "ignore", windowsHide: true });

const timeout = setTimeout(() => complete({ timeout: true, failures: [] }), 10 * 60 * 1000);
const result = await completion;
clearTimeout(timeout);
browser.kill();
await vite.close();
await new Promise((resolve) => server.close(resolve));
if (result.timeout) throw new Error("썸네일 생성 시간이 초과되었습니다.");
if (result.failures?.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  await copyFile(path.join(outputDirectory, "MOTOR.png"), path.join(outputDirectory, "_fallback.png"));
  await writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify({
    version: 1,
    width: 512,
    height: 512,
    count: result.count,
    ids: result.ids,
  }, null, 2)}\n`);
  console.log(`Generated ${result.count} object thumbnails in ${outputDirectory}`);
}
