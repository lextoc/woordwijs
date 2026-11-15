/**
 * Build the committed Woordwijs starter set from the Kaikki.nlwiktionary extract.
 *
 * Downloads (cached under data/cache/, not committed):
 * - https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz
 * - https://raw.githubusercontent.com/bnpd/freqListsLemmatized/main/nl.txt
 *   (CC BY-SA 4.0 lemmatized frequency list; first token of each line is the lemma,
 *   lines are ordered by frequency of the most common form)
 *
 * Selection is deterministic:
 * 1. Keep Dutch lemmas (lang_code nl) with at least one gloss that is not a
 *    form-of or obsolete sense.
 * 2. Skip a fixed list of function words (articles, pronouns, conjunctions,
 *    prepositions and particles such as "niet" and "een"). Also skip a lemma
 *    when its only well-documented reading is closed-class.
 * 3. Keep one entry per lemma: among content readings within one gloss of the
 *    maximum, prefer noun, then verb, adjective, adverb, numeral, interjection.
 * 4. Walk the frequency list until 2 000 lemmas. Rank 1 is the most frequent.
 *    If that yields fewer than 1 000, fill by sense count, then word, then pos.
 *
 * Adaptations (also described on the Bronnen page):
 * - inflected form-of entries and closed-class lemmas are dropped
 * - at most 8 glosses; whitespace collapsed; a leading colon and [1]-indices removed
 * - the first example of 8–240 characters is kept
 * - article is derived from neuter / masculine / feminine tags
 *
 * The same inputs always produce the same JSON (no timestamps, stable key order).
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "data", "cache");
const extractPath = path.join(cacheDir, "nl-extract.jsonl.gz");
const frequencyPath = path.join(cacheDir, "nl-frequency.txt");
const outPath = path.join(root, "src", "data", "words.json");

const EXTRACT_URL = "https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz";
const FREQUENCY_URL = "https://raw.githubusercontent.com/bnpd/freqListsLemmatized/main/nl.txt";

const TARGET_PRIMARY = 2000;
const HARD_CAP = 2000;
const FUNCTION_LEMMAS = new Set(
  `de het een ik je jij u we wij ze zij hij hem haar hun mij me ons jullie jou
dat dit die deze wat wie waar hoe waarom wanneer welke welk er daar hier
en of maar want dus als dan omdat toen niet wel geen ook nog al toch zo nu
te om van in op met voor aan bij uit naar over door tot sinds tegen zonder
na tussen onder boven ja nee mijn jouw uw onze`.split(/\s+/).filter(Boolean),
);
const MIN_BEFORE_FALLBACK = 1000;
const MAX_SENSES = 8;
const CONTENT_POS = new Set(["noun", "verb", "adj", "adv", "num", "intj"]);
const CLOSED_POS = new Set(["article", "pron", "conj", "prep", "det", "particle", "contraction", "postp"]);
const POS_RANK = { noun: 0, verb: 1, adj: 2, adv: 3, num: 4, intj: 5 };
const WORD_RE = /^[\p{L}][\p{L}'’-]*$/u;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function download(url, dest) {
  mkdirSync(cacheDir, { recursive: true });
  process.stdout.write(`download ${url}\n`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download mislukt (${response.status}) voor ${url}`);
  }
  const file = createWriteStream(dest);
  const reader = response.body.getReader();
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (!file.write(value)) {
      await new Promise((resolve) => file.once("drain", resolve));
    }
  }
  await new Promise((resolve, reject) => {
    file.end(resolve);
    file.on("error", reject);
  });
  process.stdout.write(`saved ${dest} (${received} bytes)\n`);
}

async function ensureFile(url, dest, minBytes) {
  if (existsSync(dest) && statSync(dest).size >= minBytes) {
    process.stdout.write(`cache ${dest}\n`);
    return;
  }
  await download(url, dest);
}

function clean(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function cleanGloss(text) {
  return clean(clean(text).replace(/^:\s*/, "").replace(/\[\d+\]/g, ""));
}

function isInflectionGloss(text) {
  return /^(meervoud|verkleinwoord|verbogen vorm|verleden tijd|voltooid deelwoord|vergrotende trap|overtreffende trap|genitief|datief|accusatief|nominatief|partitief|vervoeging|verbuiging)\b/i.test(
    text,
  );
}

function articleFromTags(tags, pos) {
  if (pos !== "noun") return null;
  const set = new Set(tags || []);
  const neuter = set.has("neuter");
  const de = set.has("masculine") || set.has("feminine") || set.has("common-gender");
  if (neuter && de) return "de/het";
  if (neuter) return "het";
  if (de) return "de";
  return null;
}

function collectSenses(entry) {
  const senses = [];
  let example = null;
  for (const sense of entry.senses || []) {
    const tags = new Set(sense.tags || []);
    if (tags.has("form-of") || tags.has("obsolete")) continue;
    if (senses.length < MAX_SENSES) {
      for (const gloss of sense.glosses || []) {
        const text = cleanGloss(gloss);
        if (text.length < 2 || isInflectionGloss(text)) continue;
        if (!senses.includes(text)) senses.push(text);
        if (senses.length >= MAX_SENSES) break;
      }
    }
    if (!example) {
      for (const item of sense.examples || []) {
        const text = clean(item.text || "");
        if (text.length < 8 || text.length > 240) continue;
        if (text.toLocaleLowerCase("nl") === String(entry.word).toLocaleLowerCase("nl")) continue;
        example = text;
        break;
      }
    }
  }
  return { senses, example };
}

function posLabel(entry) {
  const title = clean(entry.pos_title || "");
  if (title) return title.toLocaleLowerCase("nl");
  const fallback = {
    noun: "zelfstandig naamwoord",
    verb: "werkwoord",
    adj: "bijvoeglijk naamwoord",
    adv: "bijwoord",
    num: "telwoord",
    intj: "tussenwerpsel",
  };
  return fallback[entry.pos] || "woord";
}

async function readFrequency(file) {
  const text = await readFile(file, "utf8");
  const lemmas = [];
  const seen = new Set();
  for (const line of text.split("\n")) {
    const first = line.trim().split(/\s+/)[0];
    if (!first || !WORD_RE.test(first) || first.length > 32) continue;
    const key = first.toLocaleLowerCase("nl");
    if (seen.has(key)) continue;
    seen.add(key);
    lemmas.push(key);
  }
  return lemmas;
}

async function indexExtract(file) {
  const index = new Map();
  let lines = 0;
  let dutch = 0;
  let kept = 0;
  const gunzip = createGunzip();
  const input = createReadStream(file).pipe(gunzip);
  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    lines += 1;
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.lang_code !== "nl") continue;
    dutch += 1;
    if (!CONTENT_POS.has(entry.pos) && !CLOSED_POS.has(entry.pos)) continue;
    const word = clean(entry.word || "");
    if (!WORD_RE.test(word) || word.length < 2 || word.length > 32) continue;
    const entryTags = new Set(entry.tags || []);
    if (entryTags.has("form-of")) continue;
    const { senses, example } = collectSenses(entry);
    if (senses.length === 0) continue;
    const key = word.toLocaleLowerCase("nl");
    let byPos = index.get(key);
    if (!byPos) {
      byPos = new Map();
      index.set(key, byPos);
    }
    const item = {
      word,
      pos: entry.pos,
      posLabel: posLabel(entry),
      article: articleFromTags(entry.tags, entry.pos),
      senses,
      example,
    };
    const existing = byPos.get(entry.pos);
    if (!existing) {
      byPos.set(entry.pos, item);
      kept += 1;
    } else {
      for (const sense of senses) {
        if (existing.senses.length >= MAX_SENSES) break;
        if (!existing.senses.includes(sense)) existing.senses.push(sense);
      }
      if (!existing.example && example) existing.example = example;
      if (!existing.article && item.article) existing.article = item.article;
    }
  }
  return { index, lines, dutch, kept };
}

function containsHeadword(example, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, "iu");
  return pattern.test(example);
}

function pickStarter(words) {
  const quotas = { noun: 4, verb: 3, adj: 3 };
  const starter = [];
  const take = (predicate) => {
    for (const word of words) {
      if (starter.length === 10) return;
      if (!predicate(word)) continue;
      if (!quotas[word.pos]) continue;
      if (starter.includes(word.id)) continue;
      starter.push(word.id);
      quotas[word.pos] -= 1;
    }
  };
  const awkward = /genitief|partitief|geslachtsgemeenschap/i;
  const base = (word) =>
    word.example &&
    word.example.length <= 130 &&
    word.word.length >= 4 &&
    word.word !== "seks" &&
    word.senses[0] &&
    word.senses[0].length >= 12 &&
    !awkward.test(word.senses[0]) &&
    (word.pos === "noun" || word.pos === "verb" || word.pos === "adj") &&
    containsHeadword(word.example, word.word);
  take((word) => base(word) && word.rank >= 400 && word.rank <= 1400);
  take((word) => base(word) && word.rank >= 200);
  take((word) => base(word));
  take(
    (word) =>
      word.example &&
      (word.pos === "noun" || word.pos === "verb" || word.pos === "adj") &&
      word.rank >= 200,
  );
  return starter;
}

function toRecord(entry, rank) {
  return {
    id: `${entry.word}__${entry.pos}`,
    word: entry.word,
    pos: entry.pos,
    posLabel: entry.posLabel,
    article: entry.article,
    senses: entry.senses,
    example: entry.example,
    rank,
  };
}

const extractBytes = async () => readFile(extractPath);
const frequencyBytes = async () => readFile(frequencyPath);

await ensureFile(EXTRACT_URL, extractPath, 50_000_000);
await ensureFile(FREQUENCY_URL, frequencyPath, 10_000);

const [extractHash, frequencyHash, lemmas, indexed] = await Promise.all([
  extractBytes().then(sha256),
  frequencyBytes().then(sha256),
  readFrequency(frequencyPath),
  indexExtract(extractPath),
]);

const { index, lines, dutch, kept } = indexed;
const selected = [];
const used = new Set();

function pushEntry(entry) {
  const id = `${entry.word}__${entry.pos}`;
  if (used.has(id)) return false;
  used.add(id);
  selected.push(toRecord(entry, selected.length + 1));
  return true;
}

function byUsefulness(a, b) {
  return (
    b.senses.length - a.senses.length ||
    (POS_RANK[a.pos] ?? 9) - (POS_RANK[b.pos] ?? 9) ||
    a.pos.localeCompare(b.pos) ||
    a.word.localeCompare(b.word, "nl")
  );
}

let primaries = 0;
for (const lemma of lemmas) {
  if (primaries >= TARGET_PRIMARY || selected.length >= HARD_CAP) break;
  if (FUNCTION_LEMMAS.has(lemma)) continue;
  const byPos = index.get(lemma);
  if (!byPos) continue;
  const content = [...byPos.values()].filter((entry) => CONTENT_POS.has(entry.pos));
  const closed = [...byPos.values()].filter((entry) => CLOSED_POS.has(entry.pos));
  if (content.length === 0) continue;
  const maxSenses = Math.max(...content.map((entry) => entry.senses.length));
  const close = content.filter((entry) => entry.senses.length >= maxSenses - 1);
  close.sort(
    (a, b) =>
      (POS_RANK[a.pos] ?? 9) - (POS_RANK[b.pos] ?? 9) ||
      b.senses.length - a.senses.length ||
      a.word.localeCompare(b.word, "nl"),
  );
  const primary = close[0];
  const closedSenses = closed.reduce((max, entry) => Math.max(max, entry.senses.length), 0);
  if (primary.senses.length === 1 && closedSenses >= primary.senses.length) continue;
  if (!pushEntry(primary)) continue;
  primaries += 1;
}

let fallback = 0;
if (selected.length < MIN_BEFORE_FALLBACK) {
  const rest = [];
  for (const byPos of index.values()) {
    for (const entry of byPos.values()) {
      const id = `${entry.word}__${entry.pos}`;
      if (used.has(id) || !CONTENT_POS.has(entry.pos)) continue;
      rest.push(entry);
    }
  }
  rest.sort(
    (a, b) =>
      b.senses.length - a.senses.length ||
      a.word.localeCompare(b.word, "nl") ||
      a.pos.localeCompare(b.pos),
  );
  for (const entry of rest) {
    if (selected.length >= HARD_CAP) break;
    pushEntry(entry);
    fallback += 1;
  }
}

if (selected.length < MIN_BEFORE_FALLBACK) {
  throw new Error(`Te weinig woorden geselecteerd: ${selected.length}`);
}

const starterIds = pickStarter(selected);
if (starterIds.length !== 10) {
  throw new Error(`Starterset heeft ${starterIds.length} woorden, verwacht 10`);
}

const withExample = selected.filter((word) => word.example).length;
const withArticle = selected.filter((word) => word.article).length;
const nouns = selected.filter((word) => word.pos === "noun").length;
const posCounts = {};
for (const word of selected) posCounts[word.pos] = (posCounts[word.pos] || 0) + 1;

const meta = {
  name: "Woordwijs starterset",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.nl",
  attribution:
    "Woorden, betekenissen en voorbeelden zijn bewerkt overgenomen uit WikiWoordenboek (het Nederlandstalige Wiktionary) via het nlwiktionary-extract van Kaikki.org, gemaakt met Wiktextract. De frequentievolgorde komt uit de lemmatized frequency lists (CC BY-SA 4.0).",
  sources: [
    {
      name: "WikiWoordenboek",
      url: "https://nl.wiktionary.org/",
    },
    {
      name: "Kaikki.org nlwiktionary-extract",
      url: EXTRACT_URL,
      sha256: extractHash,
      note: "Extract van de nlwiktionary-dump van 2026-10-01, zoals gepubliceerd op kaikki.org.",
    },
    {
      name: "Wiktextract",
      url: "https://github.com/tatuylonen/wiktextract",
    },
    {
      name: "Lemmatized frequency lists, nl.txt",
      url: FREQUENCY_URL,
      sha256: frequencyHash,
      license: "CC BY-SA 4.0",
    },
  ],
  fields: ["id", "word", "pos", "posLabel", "article", "senses", "example", "rank"],
  selection:
    "Nederlandse lemma's zonder vormvarianten. Lidwoorden, voornaamwoorden, voegwoorden, voorzetsels en een vaste lijst functiewoorden (zoals niet, een, in) zijn overgeslagen. Per lemma blijft één woordsoort: van de lezingen die hoogstens één betekenis achterlopen op de drukste lezing, in de volgorde zelfstandig naamwoord, werkwoord, bijvoeglijk naamwoord, bijwoord, telwoord, tussenwerpsel. Volgorde is de frequentielijst, tot 2000 lemma's. Rank 1 is het meest frequente item.",
  adaptations: [
    "Vormvarianten (form-of), verouderde betekenissen en gesloten woordklassen zijn weggelaten.",
    "Per item hoogstens acht betekenissen. Witruimte is genormaliseerd, een leidende dubbele punt en [n]-indices zijn verwijderd. De tekst is verder niet herschreven.",
    "De eerste voorbeeldzin van 8 tot 240 tekens is bewaard. Langere zinnen zijn overgeslagen.",
    "Het lidwoord is afgeleid uit de labels neuter, masculine en feminine: alleen onzijdig wordt het, mannelijk en/of vrouwelijk wordt de, allebei wordt de/het.",
  ],
  counts: {
    extractLines: lines,
    dutchEntries: dutch,
    indexedLemmas: kept,
    frequencyLemmas: lemmas.length,
    entries: selected.length,
    withExample,
    withArticle,
    nouns,
    fallbackEntries: fallback,
    byPos: posCounts,
  },
  starterIds,
  wordOfTheDay:
    "Het woord van de dag is een deterministische keuze uit het minst frequente deel van deze set (rank strikt boven 60% van de lengte), via FNV-1a van de lokale datum YYYY-MM-DD.",
};

const payload = { meta, words: selected };
const json = `${JSON.stringify(payload, null, 2)}\n`;
mkdirSync(path.dirname(outPath), { recursive: true });
await writeFile(outPath, json);

process.stdout.write(
  [
    `entries ${selected.length}`,
    `withExample ${withExample}`,
    `withArticle ${withArticle}`,
    `nouns ${nouns}`,
    `fallback ${fallback}`,
    `starter ${starterIds.join(", ")}`,
    `extract ${extractHash}`,
    `frequency ${frequencyHash}`,
    `out ${outPath}`,
    "",
  ].join("\n"),
);
