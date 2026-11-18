import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const docs = path.join(root, 'docs');
const decoder = new TextDecoder('utf-8', { fatal: true });
const posix = value => value.replaceAll('\\', '/');
const extensions = new Set(['.md', '.html', '.sql', '.json']);
function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}
const files = listFiles(docs).filter(file => extensions.has(path.extname(file)));
const contents = new Map();
let localLinks = 0;
for (const file of files) {
  const bytes = fs.readFileSync(file);
  const relative = posix(path.relative(docs, file));
  const text = decoder.decode(bytes);
  const json = path.extname(file) === '.json';
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  assert.equal(bom, !json, `Unexpected UTF-8 BOM policy: ${relative}`);
  assert(!text.includes('\uFFFD'), `Replacement character: ${relative}`);
  assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text), `Unexpected control character: ${relative}`);
  assert(!text.includes('\r'), `Expected LF line endings: ${relative}`);
  assert(text.endsWith('\n'), `Missing final newline: ${relative}`);
  if (json) JSON.parse(text);
  contents.set(file, text);
}
function checkTarget(target, file) {
  const raw = target.replace(/^<|>$/g, '');
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw)) return;
  const pathname = raw.split(/[?#]/)[0];
  if (!pathname) return;
  const resolved = pathname.startsWith('/')
    ? path.resolve(root, `.${decodeURIComponent(pathname)}`)
    : path.resolve(path.dirname(file), decodeURIComponent(pathname));
  assert(fs.existsSync(resolved), `Broken local link in ${posix(path.relative(root, file))}: ${target}`);
  localLinks++;
}
for (const [file, text] of contents) {
  if (file.endsWith('.md')) {
    // Code examples can contain illustrative URLs that are not rendered links.
    const rendered = text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
    for (const match of rendered.matchAll(/!?\[[^\]\n]*\]\((<[^>\n]+>|[^\s)]+)(?:\s+"[^"\n]*")?\)/g)) checkTarget(match[1], file);
    for (const match of rendered.matchAll(/^\s*\[[^\]\n]+\]:\s*(<[^>\n]+>|[^\s]+)/gm)) checkTarget(match[1], file);
  } else if (file.endsWith('.html')) {
    for (const match of text.matchAll(/(?:href|src)=["']([^"']+)["']/g)) checkTarget(match[1], file);
  }
}
const readmePath = path.join(docs, 'README.md');
const readme = contents.get(readmePath);
assert(readme, 'Missing docs/README.md');
for (const file of files) {
  if (file === readmePath) continue;
  const relative = posix(path.relative(docs, file));
  assert(path.dirname(file) !== docs, `Unclassified document at docs root: ${relative}`);
  assert(readme.includes(`](${relative})`), `Document missing from README index: ${relative}`);
}
console.log(`PASS: ${files.length - 1} indexed documents; ${files.length} UTF-8 documents; ${localLinks} local file links. External URLs, anchors and database execution are not checked.`);
