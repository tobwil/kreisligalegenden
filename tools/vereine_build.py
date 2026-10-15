# Baut src/d_vereine.js aus dem Ergebnis von vereine_crawl.py (result.json):
# Landesverband -> Kreis -> Liga (höchste Kreisspielklasse, Herren, Saison 2026/27) -> Vereine mit Punkten pro Spiel.
# Aufruf: python3 tools/vereine_build.py /pfad/zu/result.json
import json, os, re, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'result.json'
res = json.load(open(src))
ORDER = ['31', '35', '32', '33', '42', '41', '43', '34', '65', '63', '64', '61', '66', '62', '01', '02', '03', '04', '21', '22', '23']
def clean_team(n):
    n = n.replace('​', '').strip()
    n = re.sub(r'\s*\(?\bn\.\s?a\.\)?', '', n)
    n = re.sub(r'\s+zg\.?$', '', n)
    n = re.sub(r'\s+e\.\s?V\.?(\s+von\s+\d+)?', '', n)
    n = re.sub(r'\s+e\.\s?V\.?$', '', n)
    m = re.match(r'^\(SG\s*(\d*)\)\s*(.*)$', n)
    suffix = ''
    if m:
        if m.group(1) and m.group(1) != '1': suffix = ' ' + 'I' * int(m.group(1)) if int(m.group(1)) <= 3 else ' ' + m.group(1)
        parts = [re.sub(r'\s+(1|I)$', '', p.strip()) for p in m.group(2).split('/')]
        parts = [re.sub(r'\s+(2|II)$', '', p) for p in parts]
        n = 'SG ' + '/'.join(parts) if not m.group(2).startswith('SG') else '/'.join(parts)
    # Hamburg: 1.Hr. / 2.Hr.
    hm = re.search(r'\s+(\d)\.\s?Hr\.?$', n)
    if hm: n = n[:hm.start()]; k = int(hm.group(1)); suffix = '' if k == 1 else ' ' + 'I' * k if k <= 3 else ' ' + str(k)
    n = re.sub(r'\s+(1|I|1\.)$', '', n)
    m2 = re.search(r'\s+([2-6])\.?$', n)
    if m2: n = n[:m2.start()] + ' ' + ['II', 'III', 'IV', 'V', 'VI'][int(m2.group(1)) - 2]
    n = re.sub(r'\s{2,}', ' ', n).strip() + suffix
    return n
def clean_league(n):
    n = re.sub(r'^\d{3}\s+', '', n); n = re.sub(r'^Herren\s+', '', n); n = re.sub(r'\s*(Herren\s*)?20\d\d/20\d\d', '', n)
    n = n.replace('bfv-', '').strip(' -,')
    return n or 'Kreisliga'
def clean_kreis(n):
    return re.sub(r'^(Kreis|Kreisebene)\s+', '', n).strip()
out, nteams, nlig = [], 0, 0
for m in ORDER:
    V = res.get(m)
    if not V: continue
    kreise = []
    for g, K in sorted(V['kreise'].items(), key=lambda kv: clean_kreis(kv[1]['name'])):
        ligen, seen = [], set()
        for L in K['ligen']:
            if re.search(r'Winterrunde|Herbstrunde|Rückrunde|Meisterrunde|Abstiegsrunde', L['name']) and len(K['ligen']) > 1 and any(not re.search(r'runde', x['name']) for x in K['ligen']): continue
            teams = []
            for t in L['teams']:
                n = clean_team(t['n'])
                if n in seen or not n: continue
                seen.add(n)
                try: sp, pk = int(t['sp']), int(t['pkt'])
                except: sp, pk = 0, 0
                ppg = round(pk / sp * 10) if sp >= 3 else -1
                teams.append(f"{n}:{ppg if ppg >= 0 else ''}")
            if len(teams) >= 6:
                ligen.append([clean_league(L['name']), '|'.join(teams)]); nteams += len(teams); nlig += 1
        if ligen: kreise.append([clean_kreis(K['name']), ligen])
    out.append([m, V['name'], V['klasse'], kreise])
js = ('// Alle Vereine der höchsten Kreisspielklasse (Herren) in Deutschland, Saison 2026/27, Stand Herbst 2026.\n'
      '// Erzeugt mit tools/vereine_crawl.py und tools/vereine_build.py aus den öffentlichen Tabellen auf fussball.de.\n'
      '// Je Verein: Name und Punkte pro Spiel × 10 (leer = noch zu wenige Spiele). Spieler, Werte und Trikots im Spiel sind erfunden.\n'
      'const VDB = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'd_vereine.js'), 'w').write(js)
print('Verbände', len(out), 'Kreise', sum(len(v[3]) for v in out), 'Ligen', nlig, 'Vereine', nteams, 'Bytes', len(js.encode()))
