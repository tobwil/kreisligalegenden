# Sammelt für jeden Landesverband die höchste Kreisspielklasse (Herren, Saison 2026/27) von fussball.de:
# Gebiete (Kreise) -> Staffeln -> Tabelle (Vereinsname, Spiele, Punkte). Ergebnisse werden zwischengespeichert.
import json, subprocess, time, re, html, os, sys
TOP = {'32':'Kreisliga','31':'Kreisliga','66':'Kreisliga A','61':'Kreisoberliga','02':'1.Kreisliga (A)','03':'Kreisliga','34':'Kreisoberliga',
 '62':'Kreisoberliga','23':'Kreisliga A','22':'Kreisliga A','01':'Kreisliga','41':'Kreisliga A','43':'Kreisliga A / Kreisliga','63':'Kreisoberliga',
 '64':'Kreisoberliga','04':'Kreisliga','33':'1.Kreisliga (A)','42':'A-Klasse','65':'Kreisoberliga','21':'Kreisliga A','35':'Kreisliga A; Kreisliga'}
os.makedirs('cache', exist_ok=True)
def get(url, f):
    p = 'cache/' + f
    if os.path.exists(p) and os.path.getsize(p) > 500: return open(p, encoding='utf-8', errors='ignore').read()
    for i in range(3):
        subprocess.run(['curl', '-sL', '--max-time', '40', '-A', 'Mozilla/5.0 (kreisligalegenden hobby game)', url, '-o', p])
        time.sleep(0.5)
        if os.path.exists(p) and os.path.getsize(p) > 500: break
    return open(p, encoding='utf-8', errors='ignore').read() if os.path.exists(p) else ''
def table(s):
    out = []
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
        n = re.findall(r'<div class="club-name">\s*([^<]+?)\s*</div>', r)
        cells = [html.unescape(re.sub('<[^>]+>', '', c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
        cells = [c for c in cells if c]
        if n and cells and cells[0].endswith('.') and len(cells) >= 9:
            out.append({'n': html.unescape(n[0]).replace('​', ''), 'sp': cells[2], 'pkt': cells[-1]})
    return out
base = json.loads(get('https://www.fussball.de/wam_base.json', 'base.json'))
res = json.load(open('result.json')) if os.path.exists('result.json') else {}
for mk, mname in base['Mandanten'].items():
    m = mk[1:]
    if m == '89': continue
    d = json.loads(get(f'https://www.fussball.de/wam_kinds_{m}_2627_1.json', f'kinds_{m}.json'))
    h = [k[1:] for k, v in d['Mannschaftsart'].items() if v == 'Herren'][0]
    cls = [k[1:] for k, v in d['Spielklasse'][h].items() if v == TOP[m]][0]
    geb = d['Gebiet'][h].get(cls, {})
    V = res.setdefault(m, {'name': mname, 'klasse': TOP[m], 'kreise': {}})
    for gk, gname in geb.items():
        g = gk[1:]
        if g in V['kreise'] and V['kreise'][g].get('done'): continue
        c = json.loads(get(f'https://www.fussball.de/wam_competitions_{m}_2627_1_{h}_{cls}_{g}.json', f'comp_{m}_{g}.json') or '{}')
        comps = c.get(cls, {}).get(g, {})
        K = {'name': gname, 'ligen': []}
        for url, lname in comps.items():
            url = url[1:].replace('/spieltagsuebersicht/', '/spieltag/')
            sid = url.rstrip('/').split('/')[-1]
            page = get(url, f'st_{sid}.html')
            t = table(page)
            if not t:
                names = sorted(set(html.unescape(n).replace('​', '') for n in re.findall(r'<div class="club-name">\s*([^<]+?)\s*</div>', page)))
                t = [{'n': n, 'sp': '0', 'pkt': '0'} for n in names]
            K['ligen'].append({'name': lname, 'id': sid, 'teams': t})
        K['done'] = True
        V['kreise'][g] = K
        json.dump(res, open('result.json', 'w'), ensure_ascii=False)
        print(mname, '|', gname, '|', [(l['name'], len(l['teams'])) for l in K['ligen']], flush=True)
print('FERTIG', flush=True)
