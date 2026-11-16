"""Stream Dutch WikiWoordenboek entries into an atomically published SQLite index."""
import argparse, collections, datetime, gzip, hashlib, json, os, re, sqlite3, unicodedata
from pathlib import Path
from urllib.request import urlopen

SOURCE = 'https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz'
FREQUENCY = 'https://raw.githubusercontent.com/bnpd/freqListsLemmatized/main/nl.txt'
ROOT = Path(__file__).resolve().parents[1]

def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.casefold()) if unicodedata.category(c) != 'Mn').strip()

def clean(text):
    return re.sub(r'\s+', ' ', re.sub(r'^\s*:\s*|\[\d+\]', '', text)).strip()

def merge_data(old, new):
    a, b = json.loads(old), json.loads(new)
    a['senses'] = list(dict.fromkeys(a['senses'] + b['senses']))[:20]
    a['example'] = a['example'] or b['example']
    a['article'] = a['article'] or b['article']
    a['labels'] = list(dict.fromkeys(a.get('labels', []) + b.get('labels', [])))
    return json.dumps(a, ensure_ascii=False, separators=(',', ':'))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--frequency')
    args = parser.parse_args()
    target = Path(args.output)
    staging = target.with_name(target.name + '.building')
    if staging.exists(): staging.unlink()
    target.parent.mkdir(parents=True, exist_ok=True)
    frequency_path = Path(args.frequency or Path(args.source).with_name('frequency.txt'))
    if not frequency_path.exists():
        with urlopen(FREQUENCY, timeout=60) as response: frequency_path.write_bytes(response.read())
    frequency = {}
    for line in frequency_path.read_text().splitlines():
        fields = line.split()
        if fields and not line.startswith('#'): frequency.setdefault(fold(fields[0]), len(frequency) + 1)
    core = json.loads((ROOT / 'src/data/words.json').read_text())['words']
    db = sqlite3.connect(staging)
    db.create_function('merge_data', 2, merge_data)
    db.executescript('''PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=FILE; PRAGMA cache_size=-16384;
        CREATE TABLE words(id TEXT PRIMARY KEY, word TEXT NOT NULL, normalized TEXT NOT NULL, pos TEXT NOT NULL,
        data TEXT NOT NULL, recommended INTEGER NOT NULL DEFAULT 0, rank INTEGER NOT NULL DEFAULT 1000000);
        CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);''')
    insert = '''INSERT INTO words VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        data=merge_data(words.data,excluded.data), recommended=MAX(words.recommended,excluded.recommended), rank=MIN(words.rank,excluded.rank)'''
    labels = {'formal':'formeel','literary':'literair','poetic':'poëtisch','rare':'zeldzaam','archaic':'archaïsch',
              'obsolete':'verouderd','dated':'verouderd','dialectal':'regionaal','dialect':'regionaal',
              'colloquial':'informeel','slang':'straattaal','vulgar':'grof','abbreviation':'afkorting'}
    excluded = {'form-of','plural','infinitive','participle'}
    avoid_recommend = {'archaic','obsolete','dated','dialect','dialectal','vulgar','slang','abbreviation','proper-noun'}
    elevated = {'formal','literary','poetic','rare','uncommon'}
    counts = collections.Counter()
    batch = []
    with gzip.open(args.source, 'rt', encoding='utf-8') as stream:
        for line in stream:
            counts['sourceLines'] += 1
            entry = json.loads(line)
            if entry.get('lang_code') != 'nl': continue
            counts['dutchRecords'] += 1
            word, pos = entry.get('word', '').strip(), entry.get('pos', '')
            if not word or len(word) > 120 or not pos: continue
            senses, example, selected_tags = [], None, set(entry.get('tags') or [])
            usable = [sense for sense in entry.get('senses', []) if not sense.get('form_of') and not (set(sense.get('tags') or []) & excluded)]
            # Prefer current meanings, retaining labelled historical/technical meanings below.
            usable.sort(key=lambda sense: bool(set(sense.get('tags') or []) & avoid_recommend))
            for sense in usable:
                glosses = [clean(g) for g in sense.get('glosses', []) if isinstance(g, str)]
                glosses = [g for g in glosses if len(g) >= 3 and len(g) <= 4000]
                if glosses and not senses: selected_tags.update(sense.get('tags') or [])
                senses.extend(g for g in glosses if g not in senses)
                if not example:
                    for item in sense.get('examples', []):
                        text = item.get('text')
                        if isinstance(text, str) and 3 <= len(text) <= 2000:
                            example = clean(text); break
            if not senses:
                counts['withoutDefinitionOrInflection'] += 1; continue
            tags = set(entry.get('tags') or [])
            de = bool(tags & {'masculine','feminine','common-gender'})
            het = 'neuter' in tags
            article = ('de/het' if de and het else 'het' if het else 'de' if de else None) if pos == 'noun' else None
            normalized = fold(word)
            frequency_rank = frequency.get(normalized)
            recommend = bool(pos in {'noun','verb','adj','adv'} and re.fullmatch(r'[a-zà-ÿ]{5,28}', word) and
                len(senses[0]) >= 12 and not selected_tags & avoid_recommend and
                (selected_tags & elevated or frequency_rank and frequency_rank > 6000))
            data = {'id':f'{word}__{pos}', 'word':word, 'pos':pos, 'posLabel':entry.get('pos_title',pos).lower(),
                    'article':article,'senses':senses[:20],'example':example,'rank':frequency_rank or 1000000,
                    'labels':list(dict.fromkeys(labels[t] for t in sorted(selected_tags) if t in labels))}
            batch.append((data['id'],word,normalized,pos,json.dumps(data,ensure_ascii=False,separators=(',',':')),int(recommend),1000+(frequency_rank or 1000000)))
            if len(batch) >= 1000:
                db.executemany(insert,batch);db.commit();batch.clear()
            if counts['dutchRecords'] % 100000 == 0: print('Dutch records processed:',counts['dutchRecords'],flush=True)
    if batch: db.executemany(insert,batch)
    # Keep stable IDs, approved meanings and examples for every existing personal deck.
    for rank, word in enumerate(core):
        data = {**word, 'labels':[]}
        db.execute('INSERT INTO words VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,recommended=1,rank=excluded.rank',
                   (word['id'],word['word'],fold(word['word']),word['pos'],json.dumps(data,ensure_ascii=False,separators=(',',':')),1,rank))
    db.commit()
    print('Building prefix and substring indexes…',flush=True)
    db.executescript('''CREATE INDEX words_prefix ON words(normalized,id);
        CREATE INDEX words_recommended ON words(recommended,rank,id);
        CREATE VIRTUAL TABLE word_search USING fts5(normalized, content='words', content_rowid='rowid', tokenize='trigram');
        INSERT INTO word_search(word_search) VALUES('rebuild'); ANALYZE;''')
    with open(args.source,'rb') as source: sha = hashlib.file_digest(source,'sha256').hexdigest()
    stats = dict(counts)
    stats.update(entries=db.execute('SELECT COUNT(*) FROM words').fetchone()[0],
                 recommended=db.execute('SELECT COUNT(*) FROM words WHERE recommended=1').fetchone()[0],
                 withExample=db.execute("SELECT COUNT(*) FROM words WHERE json_extract(data,'$.example') IS NOT NULL").fetchone()[0],
                 importedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), source=SOURCE, sourceSha256=sha,
                 license='CC BY-SA 4.0', inflections='Entries consisting only of inflections are omitted; parts of speech remain separate.')
    db.execute('INSERT INTO metadata VALUES(?,?)',('stats',json.dumps(stats)))
    db.commit()
    if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok': raise RuntimeError('Database integrity check failed')
    db.close();os.chmod(staging,0o644);os.replace(staging,target)
    print(json.dumps(stats,ensure_ascii=False),flush=True)
    print('Published',target,'bytes',target.stat().st_size,flush=True)

if __name__ == '__main__': main()
