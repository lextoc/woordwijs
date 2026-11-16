"""Read-only dictionary API. No accounts, outbound requests or progress storage."""
import json, os, sqlite3, threading, unicodedata, time
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs
from pathlib import Path

DATABASE = Path(os.environ.get('WOORDWIJS_DB', '/var/lib/woordwijs/dictionary.sqlite'))
SLOTS = threading.BoundedSemaphore(8)

def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD',text.casefold()) if unicodedata.category(c) != 'Mn').strip()

def connect():
    db = sqlite3.connect(DATABASE.as_uri()+'?mode=ro',uri=True,timeout=5)
    db.execute('PRAGMA cache_size=-4096');db.execute('PRAGMA query_only=ON')
    deadline=time.monotonic()+10
    db.set_progress_handler(lambda: int(time.monotonic()>deadline),10000)
    return db

def stats(db): return json.loads(db.execute("SELECT value FROM metadata WHERE key='stats'").fetchone()[0])

class Handler(BaseHTTPRequestHandler):
    server_version = 'Woordwijs'
    def log_message(self,*args): pass
    def send_json(self,status,data):
        body=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
    def do_GET(self): self.handle_api(False)
    def do_POST(self): self.handle_api(True)
    def handle_api(self,post):
        if not SLOTS.acquire(blocking=False): self.send_json(503,{'error':'Het woordenboek is even druk. Probeer opnieuw.'});return
        try:
            self.connection.settimeout(15)
            with closing(connect()) as db:
                parsed=urlsplit(self.path);params=parse_qs(parsed.query)
                if parsed.path == '/api/health' and not post:
                    self.send_json(200,{'ready':True,'entries':stats(db)['entries']});return
                if parsed.path == '/api/stats' and not post:
                    self.send_json(200,stats(db));return
                if parsed.path == '/api/words/by-id' and post:
                    length=int(self.headers.get('Content-Length','0'))
                    if not 0 < length <= 65536: self.send_json(413,{'error':'Te veel woorden in één verzoek.'});return
                    payload=json.loads(self.rfile.read(length))
                    if not isinstance(payload,dict): raise ValueError('Invalid body')
                    ids=payload.get('ids')
                    if not isinstance(ids,list) or len(ids)>100 or any(not isinstance(i,str) or len(i)>200 for i in ids):
                        self.send_json(400,{'error':'Ongeldige woordenlijst.'});return
                    ids=list(dict.fromkeys(ids))
                    rows=db.execute('SELECT data FROM words WHERE id IN ('+','.join('?' for _ in ids)+')',ids).fetchall() if ids else []
                    words=[json.loads(row[0]) for row in rows];found={w['id'] for w in words}
                    self.send_json(200,{'words':words,'missing':[i for i in ids if i not in found]});return
                if parsed.path != '/api/words' or post: self.send_json(404,{'error':'Niet gevonden.'});return
                query=fold(params.get('q',[''])[0])
                if len(query)>80: self.send_json(400,{'error':'Zoek met maximaal 80 tekens.'});return
                offset=max(0,min(1000000,int(params.get('offset',['0'])[0])))
                limit=max(1,min(20,int(params.get('limit',['20'])[0])))
                recommended=params.get('scope',['recommended'])[0] != 'all' and not query
                catalog=stats(db)
                if not query:
                    where='WHERE recommended=1' if recommended else ''
                    total=catalog['recommended'] if recommended else catalog['entries']
                    order='rank,id' if recommended else 'normalized,id'
                    rows=db.execute(f'SELECT data FROM words {where} ORDER BY {order} LIMIT ? OFFSET ?',(limit,offset)).fetchall()
                else:
                    # B-tree for exact/prefix hits; FTS5 trigrams for longer infix searches.
                    if len(query)<3:
                        where='normalized>=? AND normalized<?';values=[query,query+'\U0010ffff']
                        source='words'
                    else:
                        match='"'+query.replace('"','""')+'"'
                        where='word_search MATCH ? AND instr(words.normalized,?)>0';values=[match,query]
                        source='word_search JOIN words ON words.rowid=word_search.rowid'
                    total=db.execute(f'SELECT COUNT(*) FROM {source} WHERE {where}',values).fetchone()[0]
                    order='CASE WHEN words.normalized=? THEN 0 WHEN substr(words.normalized,1,length(?))=? THEN 1 ELSE 2 END,words.normalized,words.id'
                    rows=db.execute(f'SELECT words.data FROM {source} WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?',values+[query,query,query,limit,offset]).fetchall()
                self.send_json(200,{'words':[json.loads(r[0]) for r in rows],'total':total,'offset':offset,'limit':limit,
                                   'dictionaryTotal':catalog['entries'],'recommendedTotal':catalog['recommended'],
                                   'hasMore':offset+len(rows)<total})
        except (ValueError,TypeError,json.JSONDecodeError): self.send_json(400,{'error':'Ongeldig verzoek.'})
        except (BrokenPipeError,ConnectionResetError,TimeoutError): pass
        except sqlite3.Error:
            self.send_json(503,{'error':'Het woordenboek is tijdelijk niet beschikbaar.'})
        finally: SLOTS.release()

if __name__=='__main__':
    ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('PORT','8098'))),Handler).serve_forever()
