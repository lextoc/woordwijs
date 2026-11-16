/**
 * Fail npm run data and npm run build when a denylisted word is in the
 * set, or when a starter id is missing from it. Also runnable on its own:
 *   node scripts/check-set.mjs
 *   node scripts/check-set.mjs --inject gedreig
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function assertSet(payload, denylist) {
  const words = payload.words ?? [];
  const banned = new Set(denylist.words ?? denylist);
  const present = words.filter((word) => banned.has(word.word)).map((word) => word.word);
  if (present.length) {
    throw new Error(`Denylist in de set: ${present.join(", ")}`);
  }
  const ids = new Set(words.map((word) => word.id));
  const missing = (payload.meta?.starterIds ?? []).filter((id) => !ids.has(id));
  if (missing.length) {
    throw new Error(`Starter ontbreekt: ${missing.join(", ")}`);
  }
  return { denylist: banned.size, starters: payload.meta?.starterIds?.length ?? 0 };
}

function runCli() {
  const wordsPath = path.join(root, "src", "data", "words.json");
  const denylistPath = path.join(root, "data", "denylist.json");
  const payload = JSON.parse(readFileSync(wordsPath, "utf8"));
  const denylist = JSON.parse(readFileSync(denylistPath, "utf8"));
  const injectAt = process.argv.indexOf("--inject");
  if (injectAt !== -1) {
    const word = process.argv[injectAt + 1];
    if (!word) throw new Error("Geef een woord na --inject");
    payload.words.push({ id: `${word}__noun`, word, pos: "noun", senses: ["test"] });
  }
  const result = assertSet(payload, denylist);
  process.stdout.write(
    `denylist ok (${result.denylist} woorden, geen ervan in de set)\nstarterIds ok (${result.starters})\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
