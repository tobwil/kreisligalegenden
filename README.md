# Kreisliga-Legenden

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-3ddc84?style=for-the-badge&labelColor=07060b)](LICENSE)

**Fußball im Retro-Pixel-Look: 11 gegen 11 auf Rasen, Kunstrasen und Hartplatz, mit allen rund 4.900 Vereinen der Kreisligen Deutschlands – aus 238 Kreisen und allen 21 Landesverbänden. Wer Kreismeister wird, spielt in den Playoffs gegen Kreismeister aus ganz Deutschland um die Goldene Eckfahne.** Ein komplettes Browserspiel in einer einzigen HTML-Datei, aus der Familie von [Hallen-Legenden](https://github.com/tobwil/hallenlegenden) und [Korb-Legenden](https://github.com/tobwil/korblegenden).

**[Screenshots](#screenshots) · [Deutsch](#deutsch) · [English](#english)**

## Screenshots

Echte Aufnahmen aus dem Browserspiel. Für die volle Ansicht auf ein Bild klicken.

| Spielgeschehen · Gameplay | Titelbildschirm · Title screen |
|:---:|:---:|
| [![Staffelstein gegen Krecktal auf Rasen, Radar oben rechts, Banden lokaler Betriebe](docs/screenshots/gameplay.jpg)](docs/screenshots/gameplay.jpg) | [![Titelbildschirm Kreisliga-Legenden mit Demo-Spiel im Hintergrund](docs/screenshots/title-screen.jpg)](docs/screenshots/title-screen.jpg) |
| **Hartplatz bei Regen · Cinder pitch in the rain** | **Ecke · Corner kick** |
| [![Spiel auf dem Hartplatz mit Pfützen und Regen](docs/screenshots/hartplatz-regen.jpg)](docs/screenshots/hartplatz-regen.jpg) | [![Ecke auf Kunstrasen mit Jugendfeld-Linien, Strafraum voll besetzt](docs/screenshots/ecke.jpg)](docs/screenshots/ecke.jpg) |
| **Aufstellungen unter Flutlicht · Line-ups** | **Kreisblatt · Newspaper** |
| [![Intro mit beiden Aufstellungen, Formation und Sportplatz](docs/screenshots/intro.jpg)](docs/screenshots/intro.jpg) | [![Saison mit Kreisblatt: Schlagzeile, Ticker, nächstes Spiel, Tabelle, Torjäger](docs/screenshots/kreisblatt.jpg)](docs/screenshots/kreisblatt.jpg) |
| **Tabelle Kreisliga 1 · League table** | **Playoffs der Kreismeister · Playoff bracket** |
| [![Tabelle der Kreisliga 1 Coburg](docs/screenshots/tabelle.jpg)](docs/screenshots/tabelle.jpg) | [![Turnierbaum der Playoffs um die Goldene Eckfahne](docs/screenshots/playoffs.jpg)](docs/screenshots/playoffs.jpg) |
| **Kader · Squad** | **Handy quer · Phone landscape** |
| [![Kader mit Stärke, Potenzial, Fitness, Form und Noten](docs/screenshots/kader.jpg)](docs/screenshots/kader.jpg) | [![Spiel auf dem Handy mit Stick und Knöpfen](docs/screenshots/mobile.jpg)](docs/screenshots/mobile.jpg) |

---

<a id="deutsch"></a>

## Deutsch

Spielen: `game/index.html` im Browser öffnen (am besten mit dem Ordner `fonts/` daneben). Läuft am Desktop mit Tastatur oder Gamepad und auf dem Handy mit Touch-Steuerung (quer). Kostenlos, ohne Werbung, ohne Anmeldung. Die Startseite `index.html` erzählt die Geschichte als Pixel-Film beim Scrollen (`assets/story.js`), dazu Impressum und Datenschutz.

> Die Ligen tragen die echten Vereinsnamen der **höchsten Kreisspielklasse (Herren) aller Kreise in Deutschland, Saison 2026/27, Stand Herbst 2026** – je nach Landesverband heißt sie Kreisliga, Kreisliga A, Kreisoberliga oder A-Klasse. Quelle sind die öffentlichen Tabellen auf fussball.de (siehe `tools/`). Spieler, Spielstärken, Trikotfarben, Sportplätze und Werbebanden sind frei erfunden; die Kreisligen 1 und 2 im Kreis Coburg/Kronach/Lichtenfels sind von Hand gestaltet. Kein offizielles Produkt des DFB, der Landesverbände oder der Vereine. Ein Verein möchte nicht dabei sein? Bitte ein Issue öffnen oder über das Impressum melden.

### Was drin ist

#### Spiel
- **11 gegen 11** auf einem 100 × 64 m großen Platz mit TV-Kamera, die mitschwenkt und sich neigt, dazu ein Radar
- **Aktionen:** Pass mit Vorschau (blaues Dreieck über dem Empfänger), Steilpass in den Lauf, Flanke vom Flügel, hoher Ball, Schuss mit Aufladen (flach, hoch, drüber) und Zielen in die Ecke, Direktabnahme, Volley und Kopfball, Haken
- **Abwehr:** Tackling (von hinten gibt es Fouls), Grätsche (Ball zuerst treffen!), Spielerwechsel (automatisch oder per Taste), Druck mit einem zweiten Mann
- **Regeln:** Abseits (abschaltbar), Einwurf, Ecke, Abstoß, Freistoß mit Mauer, Elfmeter (der Torwart rät die Ecke), Gelb, Gelb-Rot und Rot (Notbremse), Nachspielzeit, Verlängerung und Elfmeterschießen in K.-o.-Spielen
- **Torwart-KI** mit Paraden, Glanzparaden um den Pfosten und über die Latte, Rauslaufen, Flanken abfangen, Abwurf und Abschlag
- **Taktik & Wechsel** (Q): fünf Formationen (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2), Ausrichtung defensiv/normal/offensiv, fünf Auswechslungen, Kondition
- **Präsentation:** Pixel-Sportplatz mit Sportheim, Tribüne, Flutlicht, Bratwurststand mit Rauch, Burg auf dem Hügel, Zuschauer mit Bierbecher und Hund am Geländer, Banden lokaler Betriebe, Trainerbänke, Schiedsrichter und Linienrichter mit Fahne, Torjubel, Wiederholung, Eisspray
- **Platzarten:** Rasen mit Mähstreifen und abgespielten Stellen, Kunstrasen mit Jugendfeld-Linien, Hartplatz (Asche) mit Pfützen und Staub; das Endspiel unter Flutlicht
- **Ton** komplett synthetisiert: Schuss, Pfiff, Pfosten, Netz, Zuschauer, Autohupe vom Parkplatz, Blaskapellen-Chiptune

#### Saison
- **Jeder Kreisliga-Verein Deutschlands** wählbar: Deutschlandkarte → Landesverband → Kreis → Verein, oder einfach per Suche (keine endlosen Listen)
- Die Kreisligen des eigenen Kreises laufen parallel (bis zu drei Staffeln), Hinrunde oder Hin- und Rückrunde
- **Kreispokal** mit allen Vereinen dieser Staffeln: K.-o.-Runden zwischen den Spieltagen, Freilose, Elfmeterschießen, Finale auf neutralem Platz
- **Playoffs um die deutsche Kreisliga-Meisterschaft:** die Meister des eigenen Kreises und Kreismeister aus ganz Deutschland (möglichst jeder aus einem anderen Landesverband), Achtelfinale bis Endspiel, Turnierbaum
- **Kreisblatt** (Zeitung) mit Schlagzeile, Ergebnis-Ticker, nächstem Gegner, Tabelle, Torjägerliste und Meldungen
- **Kader** mit 18 Spielern (Werte, Alter, Potenzial, Form, Fitness, Verletzungen, Sperren), Spielerkarten mit Spitznamen und Beruf, Noten wie im Kicker (1 bis 6)
- **Aufstellung** (Formation, Startelf, Elfmeterschütze), Training mit Schwerpunkt, Vereinskasse (Eintritt, Bratwurst, Sponsoren, Prämien), Wechselbörse mit Handgeld
- **Mehrere Saisons:** Spieler entwickeln sich, Ältere hängen die Schuhe an den Nagel, Junge kommen aus der A-Jugend
- Jedes Spiel **selbst spielen, zuschauen oder simulieren**

### Steuerung

Belegung wie bei EA FC am PC (klassisch), Spielgefühl zwischen EA FC und International Superstar Soccer: schnelle Pässe, der angespielte Mitspieler läuft dem Ball entgegen und nimmt ihn sicher an.

| Taste | Angriff | Abwehr |
|---|---|---|
| Pfeile | laufen | laufen |
| S | Pass (Richtung = Empfänger) | Spieler wechseln |
| W | Steilpass | Druck (zweiter Mann presst) |
| A | Flanke / hoher Ball | Grätsche |
| D / Leertaste | Schuss (halten = fester, Pfeil hoch/runter = Ecke) | Tackling |
| Q | Haken | Spieler wechseln |
| Shift / E | Sprint | Sprint |
| T | Taktik & Wechsel | |
| Esc / P | Pause | |

Gamepad wie EA FC: Stick laufen · A Pass/Wechsel · B Schuss/Tackling · X Flanke/Grätsche · Y Steilpass/Druck · LB Haken · RT Sprint · Select Taktik · Start Pause.
Touch: Stick links (weit ziehen = Sprint) · PASS (lang drücken = Steilpass) · SCHUSS halten · HOCH = Flanke. Abwehr: WECHSEL, TACKLING, GRÄTSCHE. Mitspieler antippen = Pass zu ihm.

### Entwicklung

Der Quelltext liegt in `src/` (Module `p01_core.js` bis `p16_picker.js`, Gerüst und Styles in `head.html`, Vereinsdaten in `d_vereine.js`, Karte in `d_karte.js`). Die Vereinsdaten erzeugen `tools/vereine_crawl.py` (öffentliche Tabellen auf fussball.de) und `tools/vereine_build.py`, die Karte `tools/karte_raster.py` (Natural Earth, gemeinfrei). `sh src/build.sh` baut daraus `game/index.html`, das mit committet wird.

Tests (Playwright mit Chromium): `cd tests && npm install && npm test`. Sie spielen ganze Spiele Bild für Bild durch, prüfen Regeln, Standards, Elfmeterschießen, die Vereinsdaten und die Kartenauswahl, zwei komplette Saisons mit Kreispokal und Playoffs, das Training, Menüs mit Pfeiltasten und die Touch-Steuerung. Die GitHub Action prüft außerdem, dass `game/index.html` zu `src/` passt.

Lizenz: [PolyForm Noncommercial 1.0.0](LICENSE) · Schriften: Press Start 2P und VT323 (SIL Open Font License).

---

<a id="english"></a>

## English

**Retro pixel football (soccer): 11 vs 11 on grass, artificial turf and cinder pitches, featuring all ~4,900 real clubs of Germany's district leagues ("Kreisliga") from 238 districts and all 21 regional FAs. Pick your club on a map of Germany, win your league and the district cup, then take on district champions from all over the country in a knockout playoff for the Golden Corner Flag.** A complete browser game in a single HTML file, from the family of Hallen-Legenden (handball) and Korb-Legenden (basketball).

Club names are the real names of the 2026/27 top district league clubs (source: public tables on fussball.de); all players, ratings, kits, pitches and ads are fictional. Not an official product of the DFB, the regional FAs or the clubs. A club wants to be removed? Please open an issue.

Play: open `game/index.html`. Keyboard like EA FC on PC (arrows to run, S pass, W through ball, A cross/lob, D or Space shoot, Q feint, Shift/E sprint; defending: S switch, D tackle, A slide tackle, W pressure), gamepad (FC layout) or touch. Season mode with a newspaper, squad, lineup, training, transfers and multiple seasons. Source in `src/`, build with `sh src/build.sh`, tests with `cd tests && npm install && npm test`.
