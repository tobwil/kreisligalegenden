# Rastert die Bundesländer (Natural Earth admin-1, gemeinfrei, de.geojson) in ein Pixelgitter je Fußball-Landesverband.
# Aufruf: python3 tools/karte_raster.py /pfad/zu/de.geojson  -> schreibt src/d_karte.js
import json, math, os, sys
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'de.geojson'))
LON0, LON1, LAT0, LAT1 = 5.8, 15.1, 47.2, 55.1
COS = math.cos(math.radians(51.2))
GW = 100
GH = round(GW * (LAT1 - LAT0) / ((LON1 - LON0) * COS))
# Verbände: Kürzel (fussball.de-Mandant) je Bundesland, Sonderregeln für NRW, BW, RLP
ST = {'Sachsen':'63','Bayern':'31','Saarland':'43','Schleswig-Holstein':'04','Niedersachsen':'01','Brandenburg':'61','Mecklenburg-Vorpommern':'62',
      'Bremen':'02','Hamburg':'03','Hessen':'34','Thüringen':'65','Sachsen-Anhalt':'64','Berlin':'66'}
def verband(state, lon, lat):
    if state in ST: return ST[state]
    if state == 'Nordrhein-Westfalen':
        if lat < 51.05 and lon < 7.75: return '23'          # Mittelrhein
        if lat >= 51.05 and lon < 7.18: return '22'         # Niederrhein
        return '21'                                          # Westfalen
    if state == 'Baden-Württemberg':
        if lat < 48.65 and lon < 8.8 or lat < 47.85 and lon < 9.6: return '33'   # Südbaden
        if lat >= 48.65 and (lon < 8.85 or lat > 49.3): return '32'              # Baden
        return '35'                                                               # Württemberg
    if state == 'Rheinland-Pfalz':
        if (lon > 7.75 and lat < 50.05) or lat < 49.62: return '42'   # Südwest
        return '41'                                                    # Rheinland
    return None
def inside(pt, ring):
    x, y = pt; c = False
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
polys = []
for f in d['features']:
    g = f['geometry']; name = f['properties']['name']
    ps = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for p in ps:
        xs = [q[0] for q in p[0]]; ys = [q[1] for q in p[0]]
        polys.append((name, p, min(xs), max(xs), min(ys), max(ys)))
codes = {}
grid = []
for r in range(GH):
    lat = LAT1 - (r + 0.5) * (LAT1 - LAT0) / GH; row = ''
    for c in range(GW):
        lon = LON0 + (c + 0.5) * (LON1 - LON0) / GW; ch = '.'
        for name, p, x0, x1, y0, y1 in polys:
            if x0 <= lon <= x1 and y0 <= lat <= y1 and inside((lon, lat), p[0]) and not any(inside((lon, lat), h) for h in p[1:]):
                v = verband(name, lon, lat); ch = chr(65 + sorted(set(['63','31','43','04','01','61','62','02','03','34','65','64','66','23','22','21','33','32','35','42','41'])).index(v)); break
        row += ch
    grid.append(row)
order = sorted(set(['63','31','43','04','01','61','62','02','03','34','65','64','66','23','22','21','33','32','35','42','41']))
# Lauflängen je Zeile
rle = []
for row in grid:
    out, i = '', 0
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]: j += 1
        out += row[i] + (str(j - i) if j - i > 1 else ''); i = j
    rle.append(out)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'd_karte.js')
open(out, 'w').write('// Deutschlandkarte als Pixelgitter: je Feld ein Buchstabe = Landesverband (Reihenfolge order), Punkt = Ausland/Meer. Lauflängen je Zeile.\n'
  '// Erzeugt mit tools/karte_raster.py aus Natural-Earth-Daten (gemeinfrei).\n'
  'const KARTE = ' + json.dumps({'w': GW, 'h': GH, 'order': order, 'rows': rle}, separators=(',', ':')) + ';\n')
print(GW, GH, sum(len(r) for r in rle))
for row in grid[::2]: print(row[::1])
