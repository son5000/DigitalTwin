const COPY_SUFFIX = /(?:\s+(?:복사본|copy))+$/iu;
const TRAILING_NUMBER = /^(.*?)(?:\s+(\d+))$/u;

function cleanName(value) {
  return String(value ?? "").trim().replace(COPY_SUFFIX, "").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createSequentialCopyName(sourceName, siblings = []) {
  const source = cleanName(sourceName) || "오브젝트";
  const sourceMatch = source.match(TRAILING_NUMBER);
  const base = sourceMatch?.[1]?.trim() || source;
  const width = Math.max(2, sourceMatch?.[2]?.length ?? 0);
  const numberedName = new RegExp(`^${escapeRegExp(base)}\\s+(\\d+)$`, "u");
  let highest = sourceMatch ? Number(sourceMatch[2]) : 1;

  siblings.forEach((item) => {
    const name = cleanName(item?.name);
    if (name === base) highest = Math.max(highest, 1);
    const match = name.match(numberedName);
    if (match) highest = Math.max(highest, Number(match[1]));
  });

  return `${base} ${String(highest + 1).padStart(width, "0")}`;
}
