/**
 * Build the committed Woordwijs starter set from the Kaikki nlwiktionary extract.
 *
 * Downloads (cached under data/cache/, not committed):
 * - https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz
 * - https://raw.githubusercontent.com/bnpd/freqListsLemmatized/main/nl.txt
 *   (CC BY-SA 4.0 lemmatized frequency list; first token of each line is the lemma)
 *
 * Selection is deterministic. The frequency list is a filter, not a ranking:
 * the top 6 000 lemmas are everyday Dutch and are left out. The tail of that
 * list is still full of ordinary words, names and loans, so a lemma is kept
 * only when it also looks formal, literary or uncommon:
 * - a Dutch gloss of at least a short definition, and an example that still
 *   contains the lemma (or a short inflection) after clipping to 240 characters
 * - no proper noun, abbreviation, multiword entry, inflection, dialect,
 *   archaic-only sense, or specialist topic
 * - no transparent compound or productive derivation of a frequent word
 * - a formal/poetic tag, a literary shape (desalniettemin, kwistig,
 *   onverkwikkelijk), an adverb of at least 8 letters, or a rare noun
 *   or verb with a real definition (tabbaard, vermeien, verguizen, kuieren)
 * - no gloss that repeats the lemma, and no see-through -ig compound
 * - a plain noun only when it has a native Dutch ending; a plain verb only
 *   when it is not a separable compound or a loan spelling
 * One part of speech per lemma. At most 1 200 entries.
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
const recognitionPath = path.join(cacheDir, "nl-recognition.json");
const outPath = path.join(root, "src", "data", "words.json");

const EXTRACT_URL = "https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz";
const FREQUENCY_URL = "https://raw.githubusercontent.com/bnpd/freqListsLemmatized/main/nl.txt";
const RECOGNITION_API = "https://nl.wiktionary.org/w/api.php";
const RECOGNITION_RAW = "https://nl.wiktionary.org/w/index.php";
const SURVEY_MAX = 90;

const HARD_CAP = 1200;
const MAX_SENSES = 6;
const CONTENT_POS = new Set(["noun", "verb", "adj", "adv"]);
const POS_RANK = { adv: 0, adj: 1, noun: 2, verb: 3 };
const WORD_RE = /^[\p{L}][\p{L}'’-]*$/u;
const LEMMA_RE = /^[a-zà-ÿ]{7,20}$/;
const SKIP_ENTRY = new Set(["form-of", "abbreviation", "acronym", "proper-noun", "name", "surname", "toponymic", "person", "plural", "participle"]);
const SKIP_SENSE = new Set(["form-of", "obsolete", "archaic", "dated", "dialect", "dialectal", "historical", "abbreviation", "acronym", "name", "surname", "proper-noun"]);
const SPECIALIST = new Set([
  "medicine", "botany", "physics", "chemistry", "biology", "anatomy", "mathematics", "zoology", "geology",
  "electrical-engineering", "pharmacology", "zootomy", "mechanical-engineering", "biochemistry", "optics",
  "astronomy", "mining", "numismatics", "electronics", "computer sciences", "Internet", "telecommunications",
  "grammar", "linguistics", "units-of-measure", "shipping", "military", "railways", "textiles", "fishing",
  "agriculture", "demonym", "accounting", "pathology", "genetics", "dentistry", "veterinary", "surgery",
  "heraldry", "mycology", "entomology", "ornithology", "paleontology", "mineralogy", "taxonomy", "immunology",
  "virology", "cardiology", "neurology", "psychiatry", "engineering", "programming", "software", "aviation",
  "meteorology", "sports", "football", "cycling", "hunting", "nautical", "comics", "mythology",
  "economics", "financial", "legal", "architecture", "music",
]);
const TAILS = new Set(["waar", "niet", "min", "dan", "wel", "toch", "nog", "mee", "uit", "aan", "bij", "dank", "ondanks"]);
const FUNCTION_PARTS = new Set([
  "niet", "waar", "wel", "dank", "maar", "toch", "want", "deze", "daar", "hier", "voor", "naar", "over",
  "onder", "boven", "door", "tegen", "zonder", "tussen", "sinds", "omdat", "hoewel", "terwijl", "ondanks",
  "alleen", "altijd", "nooit", "misschien", "gewoon", "eigen", "andere", "ander", "alles", "iets", "niets",
  "zelf", "heel", "zeer", "veel", "meer", "minder", "weer", "eens", "zoals", "tijdens", "binnen", "buiten",
  "rondom", "vanuit", "vanaf",
]);
const LITERARY_SUFFIXES = ["elijkheid", "temin", "erwijs", "gewijs", "lings", "waarts", "halve", "wege", "elijk", "lijk", "zaam", "aard", "nis", "dom", "dank", "ig"];
const BAD_ENDINGS = ["loos", "eloos", "achtig", "vormig", "atie", "iteit", "isme", "isch", "sel"];
const NUMBER_PREFIXES = ["twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf", "twaalf", "dertien", "veertien", "vijftien", "twintig", "dertig", "veertig", "vijftig", "zestig", "zeventig", "tachtig", "negentig", "honderd", "duizend", "miljoen"];
const ENGLISHY = /(body|guard|stage|ticket|showbiz|manager|computer|internet|online|feedback|baby|fuck|shit)/;
const LATIN = /(itis|osis|ium|hypo|hyper|neuro|cardio|encefal|pathie)/;
const COMPASS = /(oost|west|noord|zuid)/;
const NUMBER_WORD = /^(een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf|dertien|veertien|vijftien|twin|der|veer|vijf|zes|zeven|tach|negen).+tig$/;
// Everyday lemmas this subtitle list ranks too low or misses entirely.
const EVERYDAY = new Set(`aanlokkelijk aanmerkelijk aanhankelijk aanstekelijk aantoonbaar aanvankelijk adequaat afwezig
anderzijds authentiek begerig behendig bezittelijk beweeglijk bovenmatig buitensporig deugdelijk derhalve doelmatig
driftig dunnetjes duurzaam eenstemmig eentonig enerzijds fleurig geleidelijk gemoedelijk giechelig glibberig
grieperig grimmig hinderlijk hobbelig hoogstens huilerig ijverig inhoudelijk kleverig klunzig klungelig
knorrig kortstondig kriebelig krullig lacherig middelmatig meertalig miezerig minnetjes naburig objectief ogenschijnlijk onverschillig overvloedig
optimaal overmatig pertinent piekerig plakkerig pluizig poezelig prijzig prikkelig puberaal radicaal rimpelig stoornis
rumoerig schemerig schriftelijk slijmig snoezig stekelig stijfjes stilletjes stuntelig toegeeflijk dromerig weetgierig botmatig eenzijdig
hindernis ergernis aanstoot fundament interieur logistiek onbehagen rijtuig boomgaard heidezee vistuig lievelings editoriaal puzzelen brouwen bungelen graaien grinniken dobbelen dreunen hinkelen hippelen buffelen waggelen wiegelen dweilen sproeien multitasken spammen wrappen
bruschetta bungeejump deepfake fastfood freefight goodwill moussaka soulmate strooistep danseuse banlieue raspoetin tibetaan jamboree roulette nouvelle islamofoob pentagoon aggregaat
alstublief treuzelen wiebelen ratelen gorgelen jengelen gniffelen sponsoren kladden spatelen sluizen
barrevoets barvoets blootsvoets blootvoets collectief plusminus normalerwijze gemakshalve buitenmate
desondanks niettemin weliswaar nochtans onderwijl middelerwijl daarmede hiermede waarmede afgrijselijk heelhuids andermaal nauwgezet bevlogen billijk binnensmonds luidkeels meermalen onbeschrijfelijk ruimschoots ternauwernood voetstoots hutjemutje aanschouwelijk vanwaaruit zoetjesaan koeltjes wijselijk ziekelijk alleszins
pastorij bezondigen huldigen ijveren kenschetsen verkondigen verkroppen verveelvoudigen beteren ontfermen krieken bejubelen
behaaglijk baldadig erbarmelijk hachelijk wispelturig weelderig zedelijk vernuftig schimmig onderhavig minnelijk erkentelijk behoeftig afzijdig aanhangig heilzaam triomfantelijk
penseel terpentijn uitgeverij visserij wasserij vakmanschap babbelarij dagdromerij dromerij aannemerij smokkelarij vreterij opschepperij blufferij beeltenis tafereel
aanhalig aannemelijk afzonderlijk ambachtelijk ambtelijk armzalig bebaard bedachtzaam bedillerig behoedzaam bemoeizuchtig bespottelijk betweterig bezitterig bibberig bijgelovig bijterig bouwvallig broeierig brokkelig brommerig bronstig buigzaam buitenkerkelijk clichématig dikwandig dommelig doornig draderig drassig dreinerig dwangmatig eeneiig eenkennig erfelijk gaperig geboortig geeuwerig gemakzuchtig geniepig glanzig gluiperig grijzig grofkorrelig grofmazig hakkelig halfzijdig halsstarrig hatelijk hebberig hijgerig hikkerig huiverig inpandig inschikkelijk interkerkelijk jankerig jeukerig jichtig klefferig kleffig kleumerig klierig krakkemikkig kroezelig kroezig kruimig lamlendig leuterig lijfelijk luidruchtig lummelig mallotig meerdelig meerduidig meerledig moedwillig onaannemelijk onbedachtzaam onbenullig onbuigzaam ondeugdelijk onmetelijk onomstotelijk onpasselijk onstuimig ontoegankelijk onverbeterlijk onvergeeflijk onwennig oubollig ouwelijk overdadig overgankelijk pafferig papperig patserig pesterig petieterig pietluttig plagerig pluizerig potsierlijk praatlustig prekerig priegelig profijtelijk protserig prullerig prullig rafelig reflexmatig rellerig rijkelijk rillerig roestig saamhorig salonfähig satijnig schetsmatig schichtig schijterig schraperig sjokkerig slaperig sletterig slibberig slijmerig slobberig slonzig snauwerig sopperig statelijk streberig stuiterig tintelig tobberig toepasselijk toeschietelijk treiterig trillerig vakmatig veeltalig verachtelijk verlokkelijk vleierig volmondig voltallig voorradig waaghalzerig wederkerig wetmatig wijdmazig wijsneuzig wormstekig zanderig zelfredzaam zelfzuchtig zintuiglijk zoenerig zoeterig zorglijk zuurbestendig zwemmerig zweterig zweverig
adbusten bakkeleien bedampen bedijken beduimelen begapen bekalken beknabbelen beknibbelen besnuffelen besproeien bespuwen bestrooien bezuren bloezen bruisen daveren djoinen dretsen drillen frituren glooien grauwen haperen herijken joderen klieren klitten knauwen knipogen krammen kreuken krikken krullen kwalmen lameren lanterfanten loodsen luieren muilkorven ontkrullen ontkurken ontvinken ontwurmen plaveien priemen pruilen puberen rausjen ravotten roetsjen sleuren sleuven slijzen slinken sloeren slurpen smakken smotsen smurfen snakken snauwen snierken snorken snuiven sperren speuren sprengen spruiten stippen stuiken tjompen toespitsen verachtvoudigen verdampen verengen verhakkelen verhippen verkegelen verkruimelen verloden vernikkelen verslanken verslijpen versloffen versmoren verstuiken verstuwen vertienvoudigen vertrappelen verwerven verzuimen verzadigen wipwappen zuchten zwammen zwetsen
tussenin uitbundig uitermate uitvoerig uitwendig veelzijdig veranderlijk verdacht vergeefs vermakelijk vlijtig
volgzaam volstrekt wekelijks wenselijk winderig zorgzaam zuinigjes zwierig allerminst breeduit
vanbinnen vanbuiten schaakmat fiftyfifty crescendo spiccato staccato sforzando contrecoeur`.split(/\s+/));
const INFLECTION_GLOSS = /^(meervoud|verkleinwoord|verbogen vorm|verleden tijd|voltooid deelwoord|vergrotende trap|overtreffende trap|genitief|datief|accusatief|nominatief|partitief|vervoeging|verbuiging|afkorting|synoniem van|zie |voornaam|achternaam|plaatsnaam)\b/i;

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

function parseRecognitionPage(wikitext, region, into) {
  const pattern = /\|([^\n|={}]+)=(\d+)/g;
  let match = pattern.exec(wikitext);
  while (match) {
    const word = match[1].trim().toLocaleLowerCase("nl");
    if (word.length >= 2 && /^[\p{L}'’]+$/u.test(word) && !into[word]) {
      into[word] = {};
    }
    if (into[word] && into[word][region] == null) into[word][region] = Number(match[2]);
    match = pattern.exec(wikitext);
  }
}

async function ensureRecognition() {
  if (existsSync(recognitionPath) && statSync(recognitionPath).size > 1000) {
    process.stdout.write(`cache ${recognitionPath}\n`);
    return JSON.parse(await readFile(recognitionPath, "utf8"));
  }
  const listUrl = `${RECOGNITION_API}?action=query&list=allpages&apnamespace=10&apprefix=Leesonderzoek_2013/&aplimit=500&format=json`;
  process.stdout.write(`download ${listUrl}\n`);
  const listResponse = await fetch(listUrl);
  if (!listResponse.ok) throw new Error(`Download mislukt (${listResponse.status}) voor ${listUrl}`);
  const listed = await listResponse.json();
  const titles = (listed.query?.allpages || []).map((page) => page.title).sort((a, b) => a.localeCompare(b, "nl"));
  if (titles.length < 40) throw new Error(`Te weinig Leesonderzoek-pagina's: ${titles.length}`);
  const rows = {};
  for (const title of titles) {
    const region = title.includes("/nl-") ? "nl" : "vl";
    const url = `${RECOGNITION_RAW}?action=raw&title=${encodeURIComponent(title)}`;
    process.stdout.write(`download ${url}\n`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download mislukt (${response.status}) voor ${url}`);
    parseRecognitionPage(await response.text(), region, rows);
  }
  const ordered = {};
  for (const word of Object.keys(rows).sort((a, b) => a.localeCompare(b, "nl"))) ordered[word] = rows[word];
  mkdirSync(cacheDir, { recursive: true });
  await writeFile(recognitionPath, JSON.stringify(ordered));
  process.stdout.write(`saved ${recognitionPath} (${Object.keys(ordered).length} woorden)\n`);
  return ordered;
}

function clean(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function cleanGloss(text) {
  return clean(clean(text).replace(/^:\s*/, "").replace(/\[\d+\]/g, ""));
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

function posLabel(entry) {
  const title = clean(entry.pos_title || "");
  if (title) return title.toLocaleLowerCase("nl");
  const fallback = {
    noun: "zelfstandig naamwoord",
    verb: "werkwoord",
    adj: "bijvoeglijk naamwoord",
    adv: "bijwoord",
  };
  return fallback[entry.pos] || "woord";
}

const NOT_INFINITIVE = new Set(
  "mensen dingen kinderen handen voeten ogen oren jaren namen woorden zaken delen soorten vormen tijden plaatsen landen dieren planten stenen boeken kanten grenzen tussen binnen buiten tegen boven onder zonder".split(" "),
);
const SHORT_VERB = new Set(["zijn", "gaan", "staan", "slaan", "zien", "doen", "worden", "hebben", "kunnen", "laten"]);

function hasInfinitive(gloss) {
  const tokens = gloss.toLocaleLowerCase("nl").split(/[^\p{L}]+/u).filter(Boolean);
  return tokens.some((token) => SHORT_VERB.has(token) || (token.length >= 4 && token.endsWith("en") && !NOT_INFINITIVE.has(token)));
}

function prepareGloss(raw, pos) {
  let gloss = acceptableGloss(raw);
  if (!gloss) return null;
  if (/^is\s+(het|de|een)\b/i.test(gloss)) gloss = gloss.replace(/^is\s+/i, "");
  if (/^te wijten aan\b/i.test(gloss)) return null;
  if (/^geheel\s+(onder|boven|binnen|buiten|in|op)\b/i.test(gloss)) return null;
  if (pos === "verb" && !hasInfinitive(gloss)) return null;
  if (pos === "verb" && /^het\s+\p{L}+en\s+van\b/iu.test(gloss)) return null;
  if (pos === "noun" && /^zich\b/i.test(gloss)) return null;
  if (gloss.length < 8) return null;
  return gloss;
}

function acceptableGloss(raw) {
  const gloss = cleanGloss(raw);
  if (gloss.length < 8 || INFLECTION_GLOSS.test(gloss)) return null;
  if (/strijkinstrument|strijkstok|\bstoornis\b/i.test(gloss)) return null;
  if (/^(niet |zonder |het tegengestelde|afkorting|lijkend )/i.test(gloss)) return null;
  if (/^(zeer |heel |erg |zelden |vrijwel )/i.test(gloss)) return null;
  if (/verouderd|archaïsch|zie\s*:|\+|aanspreektitel|uitroep bij|spelfout|schrijfwijze|alternatieve spelling|verkeerde spelling|spelling van/i.test(gloss)) return null;
  if (/\b(the|and|with|from|which|voornaam|achternaam|hormoon|scheikundig|informatica|plantkundig|geslacht|de vorm van|hebbend|opwekkend)\b/i.test(gloss)) return null;
  const tokens = gloss.split(/[\s,;:/]+/).filter(Boolean);
  if (tokens.length < 2) return null;
  if (tokens.length < 3 && gloss.length < 16) return null;
  const letters = gloss.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters) {
    const capitals = [...letters].filter((char) => char.toLocaleUpperCase("nl") === char && char.toLocaleLowerCase("nl") !== char).length;
    if (capitals / letters.length > 0.25) return null;
  }
  return gloss;
}

function related(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?:e|en|er|ere|ste|s)?(?![\\p{L}\\p{M}])`, "iu").test(text);
}

function exampleMentions(text, word) {
  if (related(text, word)) return true;
  if (!word.endsWith("en") || word.length < 7) return false;
  const stem = word.slice(0, -2);
  if (stem.length < 4) return false;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{M}])(?:ge)?${escaped}(?:t|d|de|den|end)?(?![\\p{L}\\p{M}])`, "iu").test(text);
}

function seeThroughIg(word, common) {
  if (!word.endsWith("ig") || word.endsWith("lijk") || word.length < 7) return false;
  let stem = word.slice(0, -2);
  const consonants = "bcdfghjklmnpqrstvwxz";
  if (stem.length >= 2 && stem.at(-1) === stem.at(-2) && consonants.includes(stem.at(-1))) stem = stem.slice(0, -1);
  if (stem.length < 4) return false;
  if (common.has(stem)) return true;
  for (let index = 3; index <= stem.length - 3; index += 1) {
    if (common.has(stem.slice(0, index)) && common.has(stem.slice(index))) return true;
  }
  return false;
}

const VERB_PREFIXES = ["tegen", "onder", "over", "voor", "weer", "door", "heen", "ver", "be", "ont", "her", "aan", "af", "uit", "mee", "bij", "om", "op", "in", "mis"];

function undouble(stem) {
  const consonants = "bcdfghjklmnpqrstvwxz";
  if (stem.length >= 2 && stem.at(-1) === stem.at(-2) && consonants.includes(stem.at(-1))) return stem.slice(0, -1);
  return stem;
}

const BASIC_ACTION = /\b(lopen|wandelen|bewegen|zitten|staan|slaan|breken|eten|drinken|vallen|gooien|trekken|duwen|knoeien|vlekken|zeuren|zaniken|jammeren|huilen|lachen|slapen|springen|klimmen|rennen|hinken)\b/i;
const ONOMATOPOEIA = /\b(geluid|geluiden|klank|klinkt|klinken|knars\w*|piep\w*|ratel\w*|suiz\w*|zoem\w*|knetter\w*|rinkel\w*|rammel\w*|roffel\w*)\b/i;
const LOAN_VERB = /^(sponsor|perform|sprint|trim|tase|snooze|sniff|slam|spoil|plog|blur|disabel|grill|chant|fase|kader|fritur|schmink|jodel|press|spar|wrap|disable|djoin|rausj|jode|adbust)/;
const LITERARY_VERB = new Set(["wrochten", "verschalken", "verbeuzelen", "vermeien", "verguizen", "kuieren"]);

function ordinaryVerb(word, gloss, listed) {
  if (LITERARY_VERB.has(word)) return false;
  if (ONOMATOPOEIA.test(gloss)) return true;
  if (/elen$/.test(word) && !/^(ver|be|ont|her|over)/.test(word)) return true;
  const literaryWalk = gloss.length >= 55 && /zonder|gemak|\bdoel\b/.test(gloss);
  if (!literaryWalk && !/^(ver|be|ont|her)/.test(word) && BASIC_ACTION.test(gloss)) return true;
  if (!word.endsWith("en")) return false;
  const stem = undouble(word.slice(0, -2));
  if (stem.length >= 4 && listed.has(stem) && gloss.toLocaleLowerCase("nl").includes(stem)) return true;
  if (word.endsWith("eren")) {
    const base = word.slice(0, -4);
    if (base.length >= 3 && listed.has(base) && !/(aa|ee|oo|uu|eu|oe|ui|ei|ij|ou|au)/.test(base)) return true;
  }
  if (LOAN_VERB.test(word)) return true;
  return false;
}

function recognitionPercent(recognition, word) {
  const row = recognition.get(word);
  if (!row) return null;
  const values = [row.nl, row.vl].filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.max(...values);
}

function baseWidelyKnown(word, recognition, top) {
  if (!word || word.length < 3) return false;
  const percent = recognitionPercent(recognition, word);
  if (percent != null) return percent > SURVEY_MAX;
  return top.has(word);
}

const DERIVATION_SUFFIXES = [
  "erwijze", "gewijze", "elijkheid", "elijks", "shalve", "erij", "arij", "gewijs", "wijze",
  "schap", "heid", "elijk", "lijks", "lijk", "zaam", "baar", "loos", "lings", "daags", "waarts",
  "dom", "ing", "nij",
];

function stemCandidates(stem) {
  const candidates = new Set();
  const add = (value) => {
    if (value && value.length >= 3) candidates.add(value);
  };
  add(stem);
  add(undouble(stem));
  if (stem.endsWith("s") && stem.length > 4) add(undouble(stem.slice(0, -1)));
  if (stem.endsWith("en") && stem.length > 5) add(undouble(stem.slice(0, -2)));
  if (stem.endsWith("e") && stem.length > 4) add(stem.slice(0, -1));
  add(`${undouble(stem)}en`);
  return candidates;
}

function knownStem(stem, recognition, top) {
  for (const candidate of stemCandidates(stem)) {
    if (baseWidelyKnown(candidate, recognition, top)) return true;
  }
  return false;
}

function transparentDerivation(word, recognition, top) {
  for (const suffix of DERIVATION_SUFFIXES) {
    if (!word.endsWith(suffix) || word.length <= suffix.length + 2) continue;
    if (knownStem(word.slice(0, -suffix.length), recognition, top)) return true;
  }
  if (word.endsWith("erij") || word.endsWith("arij")) {
    const cores = [word.slice(0, -2), word.slice(0, -4)];
    for (const core of cores) {
      for (let index = 3; index <= core.length - 4; index += 1) {
        const left = core.slice(0, index);
        const right = core.slice(index);
        if (!baseWidelyKnown(left, recognition, top)) continue;
        if (knownStem(right, recognition, top) || baseWidelyKnown(right, recognition, top)) return true;
      }
    }
  }
  if (word.startsWith("ge") && word.length >= 6) {
    const rest = word.slice(2);
    if (baseWidelyKnown(`${rest}en`, recognition, top) || baseWidelyKnown(`${undouble(rest)}en`, recognition, top)) return true;
  }
  return false;
}

function glossFitsNominalization(gloss) {
  if (/^(?:een |de |het )?(?:persoon|man|vrouw|iemand|vertegenwoordiger|functionaris|beambte|dienaar|officier|bewoner)\b/iu.test(gloss)) return false;
  if (/\b(?:ambt|ambts\p{L}*|functie|waardigheid|betrekking|positie|hoedanigheid|eigenschap|kwaliteit|handeling|daad|relatie|verhouding|toestand|stemming|gevoel|neiging|gedrag|gewoonte|verschijnsel|vermogen)\b/iu.test(gloss)) return true;
  if (/\bde mate waarin\b/iu.test(gloss)) return true;
  if (/\bniet te \p{L}{3,}(?:en|n)\b/iu.test(gloss)) return true;
  if (/^het\s+niet\b/iu.test(gloss)) return true;
  if (/^het\s+\p{L}{4,}en\b/iu.test(gloss)) return true;
  if (/\bhet\s+\p{L}{3,}\s+zijn\b/iu.test(gloss)) return true;
  return false;
}

function spellingVariant(word, ordinaryForms, listed) {
  const prepositions = ["onder", "boven", "binnen", "buiten", "achter", "naast", "tegen", "zonder"];
  for (const preposition of prepositions) {
    if (!word.startsWith(preposition)) continue;
    const rest = word.slice(preposition.length);
    if (rest.length >= 3 && ordinaryForms.has(rest) && !listed.has(rest)) return true;
  }
  return false;
}

function transparentVerb(word, common, depth = 0) {
  if (!word.endsWith("en") || depth > 2) return depth === 0;
  for (const prefix of VERB_PREFIXES) {
    if (!word.startsWith(prefix) || word.length < prefix.length + 5) continue;
    const rest = word.slice(prefix.length);
    if (common.has(rest)) return true;
    if (rest.endsWith("en") && rest.length >= 6) {
      const bare = undouble(rest.slice(0, -2));
      if (bare.length >= 4 && common.has(bare)) return true;
      if (transparentVerb(rest, common, depth + 1)) return true;
    }
  }
  return false;
}

function loanSpelling(word) {
  if (/iëren$/u.test(word)) return true;
  if (/ck|ph|th|sh|tz|wh|gh|eau|ouil|oise|aise/u.test(word)) return true;
  if (/oa|ea|ay|ey|oy|ow/u.test(word)) return true;
  if (/[öüéèêáàâô]/u.test(word)) return true;
  if (/(assess|batik|bookmark|bonjour|diesel|dozer|entertain|finetun|forward|fluff|jobhop|karaoke|review|settel|zigzag|röntgen|fröbel|frobel|bookmark|scroll|tweet|spoof|scout|freelanc|download|upload|phub|urbex|botox|cocoon|payroll|influenc|skydiv|breakdanc|backpack|crowdsourc|doomscroll|hoelahoep)/u.test(word)) return true;
  const stripped = word.replace(/sch/gu, "").replace(/ch/gu, "");
  return /[cqxy]/u.test(stripped);
}

function namedGloss(gloss) {
  return /\p{Lu}[\p{L}'’]{2,}/u.test(gloss.slice(1));
}

function obviousLeft(word, common) {
  if (word.length < 8) return false;
  for (let index = 4; index <= word.length - 3; index += 1) {
    if (common.has(word.slice(0, index))) return true;
  }
  return false;
}

function seeThroughAard(word, common) {
  if (!word.endsWith("aard") || word.endsWith("gaard") || word.length < 8) return false;
  const raw = word.slice(0, -4);
  const stem = raw.replace(/(en|e|s)$/u, "");
  return (stem.length >= 3 && common.has(stem)) || (raw.length >= 3 && common.has(raw));
}

function clipExample(text, word) {
  const cleaned = clean(text);
  if (!exampleMentions(cleaned, word) || cleaned.length < 12) return null;
  if (cleaned.length <= 240) return cleaned;
  const chunk = cleaned.slice(0, 240);
  const cut = Math.max(chunk.lastIndexOf(". "), chunk.lastIndexOf("! "), chunk.lastIndexOf("? "));
  let clipped = chunk;
  if (cut >= 40) clipped = chunk.slice(0, cut + 1).trim();
  else {
    const space = chunk.lastIndexOf(" ");
    if (space > 40) clipped = chunk.slice(0, space).replace(/[ ,;]+$/u, "");
  }
  if (clipped.length >= 12 && exampleMentions(clipped, word)) return clipped;
  return null;
}

function literaryShape(word) {
  if (BAD_ENDINGS.some((suffix) => word.endsWith(suffix))) return false;
  if (word.endsWith("gaard")) return false;
  return LITERARY_SUFFIXES.some((suffix) => word.endsWith(suffix) && word.length > suffix.length + 2);
}

function embedsCommon(word, top400, top3000) {
  for (let start = 0; start < word.length - 3; start += 1) {
    const max = Math.min(word.length, start + 16);
    for (let end = start + 4; end <= max; end += 1) {
      const part = word.slice(start, end);
      if (FUNCTION_PARTS.has(part) || TAILS.has(part)) continue;
      if (part.length >= 4 && top400.has(part)) return true;
      if (part.length >= 5 && top3000.has(part)) return true;
    }
  }
  return false;
}

function isCompound(word, top400, top3000, top6000, top8000) {
  if (embedsCommon(word, top400, top3000)) return true;
  for (let index = 4; index < word.length - 2; index += 1) {
    const right = word.slice(index);
    if (right.length >= 3 && right.length <= 12 && top8000.has(right) && !TAILS.has(right)) return true;
  }
  for (let index = 4; index < word.length - 2; index += 1) {
    const left = word.slice(0, index);
    const rest = word.slice(index);
    if (!top6000.has(left)) continue;
    for (const linker of ["", "s", "e", "en", "er", "n"]) {
      if (!rest.startsWith(linker)) continue;
      const right = rest.slice(linker.length);
      if (right.length >= 3 && top8000.has(right) && !TAILS.has(right)) return true;
    }
  }
  return false;
}

function listedOk(word, pos, frequencyRank, formal) {
  if (frequencyRank == null) return true;
  if (frequencyRank <= 6000) return false;
  if (formal) return true;
  if (frequencyRank < 8500) return false;
  if (literaryShape(word)) return true;
  if (pos === "adv" && word.length >= 8) return true;
  if ((pos === "noun" || pos === "verb") && word.length >= 7) return frequencyRank >= 11000;
  return false;
}

function nounOfCommonParts(word, listed) {
  if (word.length < 8) return false;
  for (let index = 4; index <= word.length - 4; index += 1) {
    const left = word.slice(0, index);
    const rest = word.slice(index);
    for (const linker of ["", "s", "e", "en", "er"]) {
      if (!rest.startsWith(linker)) continue;
      const right = rest.slice(linker.length);
      if (right.length >= 4 && listed.has(left) && listed.has(right)) return true;
    }
  }
  return false;
}

function containsHeadword(example, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, "iu").test(example);
}

async function readFrequency(file) {
  const text = await readFile(file, "utf8");
  const lemmas = [];
  const forms = [];
  const seen = new Set();
  for (const line of text.split("\n")) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    const first = tokens[0];
    if (!first || !WORD_RE.test(first) || first.length > 32) continue;
    const key = first.toLocaleLowerCase("nl");
    if (seen.has(key)) continue;
    seen.add(key);
    lemmas.push(key);
    forms.push(tokens.slice(1).map((token) => token.toLocaleLowerCase("nl")));
  }
  return { lemmas, forms };
}

function categoryText(entry) {
  return (entry.categories || [])
    .map((item) => (typeof item === "string" ? item : item?.name || ""))
    .join("\n");
}

function foldAccents(word) {
  return word.normalize("NFD").replace(/\p{M}/gu, "");
}

async function indexExtract(file, bands) {
  const { rankOf, listed, top400, top2500, top3000, top6000, top8000, ordinaryForms, verbCommon, recognition } = bands;
  const byPos = new Map();
  let lines = 0;
  let dutch = 0;
  let surveyRemoved = 0;
  let derivationRemoved = 0;
  let glossRemoved = 0;
  const derivationDropped = [];
  const glossDropped = [];
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
    if (!CONTENT_POS.has(entry.pos)) continue;
    const word = clean(entry.word || "");
    if ([...word].some((char) => char !== char.toLocaleLowerCase("nl"))) continue;
    const key = word.toLocaleLowerCase("nl");
    if (!LEMMA_RE.test(key) || key.includes("-") || key.includes(" ")) continue;
    const entryTags = new Set(entry.tags || []);
    if ([...entryTags].some((tag) => SKIP_ENTRY.has(tag) || tag === "misspelling" || tag === "alt-of" || tag === "alternative-form" || tag === "alternative-spelling")) continue;
    if (NUMBER_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    if (COMPASS.test(key) || ENGLISHY.test(key) || LATIN.test(key) || NUMBER_WORD.test(key)) continue;
    if (EVERYDAY.has(key) || key.endsWith("kundig") || key.endsWith("toonaard")) continue;
    if (BAD_ENDINGS.some((suffix) => key.endsWith(suffix))) continue;

    let formal = false;
    let elevated = false;
    const senses = [];
    let example = null;
    for (const sense of entry.senses || []) {
      const tags = new Set(sense.tags || []);
      if ([...tags].some((tag) => SKIP_SENSE.has(tag))) continue;
      if (sense.form_of?.length || sense.alt_of?.length) continue;
      if (tags.has("misspelling") || tags.has("alt-of") || tags.has("alternative-form") || tags.has("alternative-spelling")) continue;
      if (tags.has("informal") || tags.has("slang") || tags.has("vulgar")) continue;
      const topics = new Set(sense.topics || []);
      if ([...topics].some((topic) => SPECIALIST.has(topic))) continue;
      if (tags.has("formal") || tags.has("literary")) {
        formal = true;
        elevated = true;
      } else if (tags.has("poetic")) elevated = true;
      for (const gloss of sense.glosses || []) {
        const text = prepareGloss(gloss, entry.pos);
        if (!text || senses.includes(text) || related(text, word)) continue;
        if (key.endsWith("ig") && !key.endsWith("lijk") && /^(met |in het bezit van|voorzien van |bestaande uit )/i.test(text)) continue;
        if (senses.length < MAX_SENSES) senses.push(text);
      }
      if (senses.length && !example) {
        for (const item of sense.examples || []) {
          const clipped = clipExample(item.text || "", word);
          if (clipped) {
            example = clipped;
            break;
          }
        }
      }
    }
    if (!senses.length || !example) continue;
    const translations = (entry.translations || []).length;
    if (!elevated && translations > 14) continue;
    const frequencyRank = rankOf.get(key) ?? null;
    if (!listedOk(key, entry.pos, frequencyRank, elevated)) continue;
    const folded = foldAccents(key);
    if (folded !== key && (top8000.has(folded) || EVERYDAY.has(folded) || ordinaryForms.has(folded))) continue;
    if (ordinaryForms.has(key)) continue;
    const categories = categoryText(entry);
    const separable = /(?<!on)scheidbaar werkwoord/i.test(categories);
    const compoundNoun = /samenstelling in het nederlands/i.test(categories);
    if (entry.pos === "verb" && (separable || compoundNoun)) continue;
    if (entry.pos === "noun" && compoundNoun && !formal && !literaryShape(key)) continue;
    if (seeThroughAard(key, top6000)) continue;
    if ((entry.pos === "noun" || entry.pos === "verb") && !formal && loanSpelling(key)) continue;
    if (
      entry.pos === "noun" &&
      !elevated &&
      !literaryShape(key) &&
      (/^ge/.test(key) || /(er|ster|aar|ist|eur|iek|age|tie|our|um|us|app|bag|dump|izer|liner|stift|foon|food|fight|fake|jump|mate|step)$/u.test(key))
    ) {
      continue;
    }
    const plainContent = (entry.pos === "noun" || entry.pos === "verb") && !elevated && !literaryShape(key);
    if (plainContent && translations > 3) continue;
    if (plainContent && (namedGloss(senses[0]) || /\b(drank|gerecht|soort|aandoening|belasting|software|computer|smartphone|internet|hiphop|seksue|verkleinwoord|schriftgeleerde)/i.test(senses[0]) || /benaming voor/i.test(senses[0]))) continue;
    if (plainContent && entry.pos === "noun" && obviousLeft(key, top2500)) continue;
    if (plainContent && entry.pos === "noun" && !/(aa|ee|oo|uu|eu|oe|ui|ei|ij|ou|au|sch)/u.test(key)) continue;
    if (plainContent && entry.pos === "noun" && !/(ij|erij|arij|schap|dom|eel|aal|ouw|aai|ijn|erd|ede|oor|ein|ens|ui)$/u.test(key)) continue;
    if (plainContent && entry.pos === "noun" && /(tje|pje|kje|vernis)$/u.test(key)) continue;
    if (isCompound(key, top400, top3000, top6000, top8000) || seeThroughIg(key, listed)) continue;
    if (entry.pos === "verb" && transparentVerb(key, verbCommon)) continue;
    if (entry.pos === "verb" && !elevated && ordinaryVerb(key, senses[0], listed)) continue;
    if (entry.pos === "noun" && !formal && key.endsWith("ing")) continue;
    if (entry.pos === "noun" && key.endsWith("en") && top6000.has(key.slice(0, -2))) continue;
    if (entry.pos === "noun" && key.endsWith("e") && top6000.has(key.slice(0, -1))) continue;
    if (entry.pos === "noun" && (key.endsWith("stoornis") || key.endsWith("vernis"))) continue;
    if (entry.pos === "noun" && !formal && !literaryShape(key) && nounOfCommonParts(key, listed)) continue;
    if (
      entry.pos === "noun" &&
      !elevated &&
      !literaryShape(key) &&
      senses[0].split(/[\s,;:/]+/).filter(Boolean).length < 6
    ) {
      continue;
    }
    if (key.length >= 8 && /ge[a-zà-ÿ]{3,}(?:en|[dt])$/.test(key)) continue;
    if (key.length >= 8 && /^(ver|be|ont|her)[a-zà-ÿ]+[dt]$/.test(key)) continue;
    if (key.length >= 8 && /ende$/.test(key)) continue;
    if (key.startsWith("on") && key.length > 5 && top8000.has(key.slice(2))) continue;
    const shaped =
      elevated ||
      literaryShape(key) ||
      (entry.pos === "adv" && key.length >= 8) ||
      entry.pos === "noun" ||
      (entry.pos === "verb" && key.endsWith("en"));
    if (!shaped) continue;
    if (entry.pos === "adv" && spellingVariant(key, ordinaryForms, listed)) continue;
    const percent = recognitionPercent(recognition, key);
    if (percent != null && percent > SURVEY_MAX) {
      surveyRemoved += 1;
      continue;
    }
    if (percent == null && transparentDerivation(key, recognition, top6000)) {
      derivationRemoved += 1;
      derivationDropped.push(key);
      continue;
    }
    if (entry.pos === "noun" && /(schap|heid|ing)$/.test(key)) {
      const fitting = senses.filter((sense) => glossFitsNominalization(sense));
      if (!fitting.length) {
        glossRemoved += 1;
        glossDropped.push(key);
        continue;
      }
      if (fitting.length !== senses.length) senses.splice(0, senses.length, ...fitting);
    }

    const id = `${key}__${entry.pos}`;
    const item = {
      id,
      word,
      pos: entry.pos,
      posLabel: posLabel(entry),
      article: articleFromTags(entry.tags, entry.pos),
      senses,
      example,
      formal,
      frequencyRank,
      translations,
    };
    const existing = byPos.get(id);
    if (!existing) {
      byPos.set(id, item);
    } else {
      existing.formal = existing.formal || formal;
      if (!existing.article && item.article) existing.article = item.article;
      if (!existing.example && example) existing.example = example;
      else if (example && containsHeadword(example, word) && !containsHeadword(existing.example, word)) existing.example = example;
      for (const sense of senses) {
        if (existing.senses.length >= MAX_SENSES) break;
        if (!existing.senses.includes(sense)) existing.senses.push(sense);
      }
    }
  }
  return { byPos, lines, dutch, surveyRemoved, derivationRemoved, glossRemoved, derivationDropped, glossDropped };
}

function pickLemma(byPos) {
  const byLemma = new Map();
  for (const item of byPos.values()) {
    const key = item.word.toLocaleLowerCase("nl");
    const current = byLemma.get(key);
    if (!current) {
      byLemma.set(key, item);
      continue;
    }
    const better =
      Number(item.formal) - Number(current.formal) ||
      (POS_RANK[current.pos] ?? 9) - (POS_RANK[item.pos] ?? 9);
    if (better > 0) byLemma.set(key, item);
  }
  return [...byLemma.values()];
}

function pickStarter(words) {
  const quotas = { adv: 3, adj: 3, noun: 2, verb: 2 };
  const starter = [];
  const awkward = /genitief|partitief|geslachtsgemeenschap|titel|uitroep|benaming|kruispunt|vliegtuig|verouderd/i;
  const ordered = [...words].sort(
    (a, b) =>
      Number(b.formal) - Number(a.formal) ||
      Number(a.word.endsWith("iter")) - Number(b.word.endsWith("iter")) ||
      b.word.length - a.word.length ||
      (a.example?.length ?? 999) - (b.example?.length ?? 999) ||
      a.word.localeCompare(b.word, "nl"),
  );
  const usable = (word) =>
    word.example &&
    word.example.length <= 150 &&
    word.word.length <= 18 &&
    containsHeadword(word.example, word.word) &&
    word.senses[0] &&
    word.senses[0].length >= 12 &&
    !awkward.test(word.senses[0]);
  for (const word of ordered) {
    if (starter.length === 10) break;
    if (!usable(word) || !quotas[word.pos] || starter.includes(word.id)) continue;
    starter.push(word.id);
    quotas[word.pos] -= 1;
  }
  for (const word of ordered) {
    if (starter.length === 10) break;
    if (!usable(word) || starter.includes(word.id)) continue;
    if (!["adv", "adj", "noun", "verb"].includes(word.pos)) continue;
    starter.push(word.id);
  }
  return starter;
}

function toRecord(entry, rank) {
  return {
    id: entry.id,
    word: entry.word,
    pos: entry.pos,
    posLabel: entry.posLabel,
    article: entry.article,
    senses: entry.senses,
    example: entry.example,
    rank,
  };
}

await ensureFile(EXTRACT_URL, extractPath, 50_000_000);
await ensureFile(FREQUENCY_URL, frequencyPath, 10_000);
const recognitionTable = await ensureRecognition();
if (recognitionTable.onverkwikkelijk?.nl !== 78) {
  throw new Error("Het herkenningsbestand hoort onverkwikkelijk op 78 procent voor Nederland te zetten");
}

const [extractHash, frequencyHash, recognitionHash, frequency] = await Promise.all([
  readFile(extractPath).then(sha256),
  readFile(frequencyPath).then(sha256),
  readFile(recognitionPath).then(sha256),
  readFrequency(frequencyPath),
]);
const { lemmas } = frequency;

const rankOf = new Map(lemmas.map((lemma, index) => [lemma, index + 1]));
const ordinaryForms = new Set();
for (let index = 0; index < Math.min(lemmas.length, 8000); index += 1) {
  for (const form of frequency.forms[index] || []) {
    if (form.length >= 3 && WORD_RE.test(form)) ordinaryForms.add(form);
  }
}
const bands = {
  rankOf,
  listed: new Set(lemmas),
  top400: new Set(lemmas.slice(0, 400)),
  top2500: new Set(lemmas.slice(0, 2500)),
  top3000: new Set(lemmas.slice(0, 3000)),
  top6000: new Set(lemmas.slice(0, 6000)),
  top8000: new Set(lemmas.slice(0, 8000)),
  ordinaryForms,
  verbCommon: new Set([...lemmas.slice(0, 6000), ...ordinaryForms]),
  recognition: new Map(Object.entries(recognitionTable)),
};
const indexed = await indexExtract(extractPath, bands);
const pool = pickLemma(indexed.byPos);
const buckets = { adv: [], adj: [], noun: [], verb: [] };
for (const item of pool) buckets[item.pos]?.push(item);
const byRare = (a, b) =>
  a.translations - b.translations ||
  Math.abs(a.word.length - 9) - Math.abs(b.word.length - 9) ||
  a.word.localeCompare(b.word, "nl");
const shapedNouns = buckets.noun.filter((item) => item.formal || literaryShape(item.word));
const plainNouns = buckets.noun.filter((item) => !item.formal && !literaryShape(item.word)).sort(byRare);
buckets.verb.sort(byRare);
const chosen = [
  ...buckets.adv,
  ...buckets.adj,
  ...shapedNouns,
  ...plainNouns.slice(0, 200),
  ...buckets.verb,
];
process.stdout.write(
  `pool adv ${buckets.adv.length} adj ${buckets.adj.length} noun ${buckets.noun.length} (shaped ${shapedNouns.length} plain ${plainNouns.length}) verb ${buckets.verb.length}\n`,
);
chosen.sort(
  (a, b) =>
    Number(b.formal) - Number(a.formal) ||
    (POS_RANK[a.pos] ?? 9) - (POS_RANK[b.pos] ?? 9) ||
    a.word.localeCompare(b.word, "nl") ||
    a.pos.localeCompare(b.pos),
);
const capped = chosen.slice(0, HARD_CAP);
if (capped.length < 200) {
  throw new Error(`Te weinig woorden geselecteerd: ${capped.length}`);
}
const selected = capped.map((entry, index) => toRecord(entry, index + 1));
const starterIds = pickStarter(capped);
if (starterIds.length !== 10) {
  throw new Error(`Starterset heeft ${starterIds.length} woorden, verwacht 10`);
}

const withExample = selected.filter((word) => word.example).length;
const withArticle = selected.filter((word) => word.article).length;
const nouns = selected.filter((word) => word.pos === "noun").length;
const formalCount = capped.filter((word) => word.formal).length;
const posCounts = {};
for (const word of selected) posCounts[word.pos] = (posCounts[word.pos] || 0) + 1;

const meta = {
  name: "Woordwijs starterset",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.nl",
  attribution:
    "Woorden, betekenissen en voorbeelden zijn bewerkt overgenomen uit WikiWoordenboek (het Nederlandstalige Wiktionary) via het nlwiktionary-extract van Kaikki.org, gemaakt met Wiktextract. Alledaagse lemma's zijn weggefilterd met de lemmatized frequency lists (CC BY-SA 4.0).",
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
    {
      name: "WikiWoordenboek, Leesonderzoek 2013",
      url: "https://nl.wiktionary.org/wiki/Sjabloon:Leesonderzoek_2013",
      sha256: recognitionHash,
      note: "Herkenningspercentages uit het onderzoek van het Centrum voor Leesonderzoek (2013), zoals nl.wiktionary ze per lemma toont. Een lemma met deze cijfers blijft alleen als hoogstens 90 procent van de Nederlanders en van de Vlamingen het herkent.",
    },
  ],
  fields: ["id", "word", "pos", "posLabel", "article", "senses", "example", "rank"],
  selection:
    "Nederlandse lemma's van 7 tot 20 letters met een duidelijke Nederlandse betekenis en een voorbeeldzin. Een betekenis die het lemma herhaalt, valt weg. De eerste 6000 lemma's van de frequentielijst vallen weg (alledaags). Eigennamen, afkortingen, woordgroepen, buigingsvormen, dialect, alleen verouderde betekenissen, informeel taalgebruik en vaktaal vallen weg. Doorzichtige samenstellingen, scheidbare werkwoorden, -ig-afleidingen van gewone delen en productieve afleidingen van een frequent woord vallen weg. Een lemma blijft als het formeel of poëtisch gelabeld is, een literaire vorm heeft, of een bijwoord van minstens 8 letters is. Een zelfstandig naamwoord of werkwoord zonder die vorm blijft alleen als het geen samenstelling of leenwoordspelling is, een Nederlandse uitgang heeft wanneer het een zelfstandig naamwoord is, en het extract het naar hoogstens drie andere talen vertaalt. Gewone werkwoorden, klanknabootsingen en leenwerkwoorden vallen weg. Spelfouten en alternatieve spellingen vallen weg. Heeft een lemma cijfers uit het Leesonderzoek 2013, dan blijft het alleen als hoogstens 90 procent het herkent. Een afleiding op ge-, -erij, -arij, -nij, -schap, -heid, -ing, -shalve, -wijze, -lijk of een vergelijkbare productieve uitgang valt weg als het grondwoord algemeen bekend is: volgens het Leesonderzoek als dat cijfers heeft (meer dan 90 procent), anders volgens de frequentielijst. Heeft de afleiding zelf een onderzoekcijfer van 90 procent of minder, dan blijft ze. Een -schap, -heid of -ing waarvan de betekenis niet een toestand, ambt, handeling of eigenschap beschrijft, valt weg. Een betekenis die niet bij de woordsoort past, of die met 'is het' begint, wordt verbeterd of weggelaten. Per lemma één woordsoort: formeel eerst, dan bijwoord, bijvoeglijk naamwoord, zelfstandig naamwoord, werkwoord. Hoogstens 1200. Rank is de plaats in die volgorde, niet de frequentie.",
  adaptations: [
    "Alledaagse lemma's (de eerste 6000 van de frequentielijst), eigennamen, afkortingen, woordgroepen, buigingsvormen, dialect, verouderde betekenissen en vaktaal zijn weggelaten.",
    "Betekenissen die het lemma herhalen, doorzichtige samenstellingen en productieve afleidingen van een frequent woord zijn weggelaten.",
    "Per item hoogstens zes betekenissen. Witruimte is genormaliseerd, een leidende dubbele punt en [n]-indices zijn verwijderd. De tekst is verder niet herschreven.",
    "Een voorbeeldzin die langer is dan 240 tekens is ingekort op een zinseinde, zolang het woord er nog in staat.",
    "Het lidwoord is afgeleid uit de labels neuter, masculine en feminine: alleen onzijdig wordt het, mannelijk en/of vrouwelijk wordt de, allebei wordt de/het.",
  ],
  counts: {
    extractLines: indexed.lines,
    dutchEntries: indexed.dutch,
    indexedLemmas: indexed.byPos.size,
    frequencyLemmas: lemmas.length,
    entries: selected.length,
    withExample,
    withArticle,
    nouns,
    formal: formalCount,
    byPos: posCounts,
    surveyRemoved: indexed.surveyRemoved,
    derivationRemoved: indexed.derivationRemoved,
    glossRemoved: indexed.glossRemoved,
  },
  starterIds,
  wordOfTheDay:
    "Het woord van de dag komt uit de hele set. De index is FNV-1a van de lokale datum YYYY-MM-DD, modulo het aantal lemma's, na sortering op id.",
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
    `formal ${formalCount}`,
    `byPos ${JSON.stringify(posCounts)}`,
    `surveyRemoved ${indexed.surveyRemoved}`,
    `derivationRemoved ${indexed.derivationRemoved}`,
    `glossRemoved ${indexed.glossRemoved}`,
    `derivationDropped ${indexed.derivationDropped.join(", ")}`,
    `glossDropped ${indexed.glossDropped.join(", ")}`,
    `starter ${starterIds.join(", ")}`,
    `extract ${extractHash}`,
    `frequency ${frequencyHash}`,
    `lines ${indexed.lines}`,
    `dutch ${indexed.dutch}`,
    `frequencyLemmas ${lemmas.length}`,
    `out ${outPath}`,
    "",
  ].join("\n"),
);
