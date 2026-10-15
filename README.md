# Kreisliga-Legenden

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-3ddc84?style=for-the-badge&labelColor=07060b)](LICENSE)

**Fußball im Retro-Pixel-Look: 11 gegen 11 auf Rasen, Kunstrasen und Hartplatz, mit den Vereinen aus dem Kreis Coburg/Kronach/Lichtenfels. Wer Kreismeister wird, spielt in den Playoffs gegen die Kreismeister aus ganz Deutschland um die Goldene Eckfahne.** Ein komplettes Browserspiel in einer einzigen HTML-Datei, aus der Familie von [Hallen-Legenden](https://github.com/tobwil/hallenlegenden) und [Korb-Legenden](https://github.com/tobwil/korblegenden).

**[Deutsch](#deutsch) · [English](#english)**

---

<a id="deutsch"></a>

## Deutsch

Spielen: `game/index.html` im Browser öffnen (am besten mit dem Ordner `fonts/` daneben). Läuft am Desktop mit Tastatur oder Gamepad und auf dem Handy mit Touch-Steuerung (quer). Kostenlos, ohne Werbung, ohne Anmeldung. Die Startseite mit Story folgt.

> Die Ligen tragen die echten Vereinsnamen der **Kreisliga 1 und 2 im Kreis Coburg/Kronach/Lichtenfels (BFV), Saison 2026/27**. Spieler, Spielstärken, Trikotfarben, Werbebanden und die Gegner aus anderen Regionen sind frei erfunden. Kein offizielles Produkt des BFV oder der Vereine.

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
- **Kreisliga 1 Coburg** oder **Kreisliga 2 Coburg/Kronach/Lichtenfels** mit je 16 Vereinen, Hinrunde (15 Spieltage) oder Hin- und Rückrunde (30)
- **Playoffs um die deutsche Kreisliga-Meisterschaft:** die Meister beider Kreisligen und 14 Kreismeister aus anderen Regionen, Achtelfinale bis Endspiel im K.-o.-System, Turnierbaum
- **Kreisblatt** (Zeitung) mit Schlagzeile, Ergebnis-Ticker, nächstem Gegner, Tabelle, Torjägerliste und Meldungen
- **Kader** mit 18 Spielern (Werte, Alter, Potenzial, Form, Fitness, Verletzungen, Sperren), Spielerkarten mit Spitznamen und Beruf, Noten wie im Kicker (1 bis 6)
- **Aufstellung** (Formation, Startelf, Elfmeterschütze), Training mit Schwerpunkt, Vereinskasse (Eintritt, Bratwurst, Sponsoren, Prämien), Wechselbörse mit Handgeld
- **Mehrere Saisons:** Spieler entwickeln sich, Ältere hängen die Schuhe an den Nagel, Junge kommen aus der A-Jugend
- Jedes Spiel **selbst spielen, zuschauen oder simulieren**

### Steuerung

| Taste | Angriff | Abwehr |
|---|---|---|
| Pfeile | laufen | laufen |
| S | Pass | Spieler wechseln |
| A | Steilpass | Druck (zweiter Mann presst) |
| D | Flanke / hoher Ball | Tackling |
| Leertaste | Schuss (halten = fester, Pfeil hoch/runter = Ecke) | Grätsche |
| F | Haken | |
| Shift / W | Sprint | Sprint |
| Q | Taktik & Wechsel | |
| Esc / P | Pause | |

Gamepad: Stick laufen · A Pass/Wechsel · Y Steilpass · B Flanke/Tackling · X Schuss/Grätsche · LB Haken · RT Sprint · Select Taktik · Start Pause.
Touch: Stick links (weit ziehen = Sprint) · PASS (lang drücken = Steilpass) · SCHUSS halten · HOCH = Flanke. Mitspieler antippen = Pass zu ihm.

### Entwicklung

Der Quelltext liegt in `src/` (Module `p01_core.js` bis `p14_career_ui.js`, Gerüst und Styles in `head.html`). `sh src/build.sh` baut daraus `game/index.html`, das mit committet wird.

Tests (Playwright mit Chromium): `cd tests && npm install && npm test`. Sie spielen ganze Spiele Bild für Bild durch, prüfen Regeln, Standards, Elfmeterschießen, zwei komplette Saisons mit Playoffs, Menüs mit Pfeiltasten und die Touch-Steuerung. Die GitHub Action prüft außerdem, dass `game/index.html` zu `src/` passt.

Lizenz: [PolyForm Noncommercial 1.0.0](LICENSE) · Schriften: Press Start 2P und VT323 (SIL Open Font License).

---

<a id="english"></a>

## English

**Retro pixel football (soccer): 11 vs 11 on grass, artificial turf and cinder pitches, featuring the real amateur clubs of the Coburg/Kronach/Lichtenfels district in Bavaria. Win your district league ("Kreisliga") and fight the champions of 14 other regions in a knockout playoff for the Golden Corner Flag.** A complete browser game in a single HTML file, from the family of Hallen-Legenden (handball) and Korb-Legenden (basketball).

Club names are the real names of the 2026/27 district league clubs; all players, ratings, kits, ads and the opponents from other regions are fictional. Not an official product of the Bavarian FA or the clubs.

Play: open `game/index.html`. Keyboard (arrows to run, S pass, A through ball, D cross/lob, Space shoot/slide tackle, F feint, Shift sprint), gamepad or touch. Season mode with a newspaper, squad, lineup, training, transfers and multiple seasons. Source in `src/`, build with `sh src/build.sh`, tests with `cd tests && npm install && npm test`.
