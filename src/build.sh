#!/bin/sh
# Baut das Spiel aus den Quelldateien (Reihenfolge ist wichtig, alle Module teilen sich einen Script-Block).
# Ergebnis: game/index.html. Die Startseite index.html im Hauptordner wird hier nicht erzeugt.
cd "$(dirname "$0")"
JS="d_karte.js d_vereine.js p01_core.js p02_audio.js p03_sprites.js p04_pitch.js p05_match.js p06_actions.js p07_ai.js p08_rules.js p09_fx.js p10_render.js p11_menus.js p13_career.js p14_career_ui.js p15_training.js p16_picker.js p17_aimview.js p18_flair.js p19_derby.js p20_eigen.js p21_save.js p22_chronik.js p23_multi.js p24_flitzer.js p12_main.js"
TITLE='Kreisliga-Legenden spielen – Fußball 11 gegen 11 im Retro-Pixel-Look'
DESC='Fußball im Browser: Kreisliga im Retro-Pixel-Look mit allen Kreisliga-Vereinen Deutschlands, Saison mit Kreispokal, Meisterschaft und Playoffs um die deutsche Kreisliga-Krone. Kostenlos, am Computer und am Handy.'
# Nutzungsstatistik (Umami Cloud, ohne Cookies): Website-ID eintragen, dann zählt sie nur auf kreisliga-legenden.de und nicht bei „Do Not Track“
UMAMI_ID='f4b1de32-7b96-43cb-9ff1-987bbe214049'
mkdir -p ../game
# Kennung dieses Stands (aus den Quellen, ändert sich mit jeder Änderung): ein offener alter Tab merkt so, dass es eine neue Version gibt
BUILD=$(cat $JS head.html | cksum | cut -d' ' -f1)
{
  echo '<!doctype html>'
  echo '<html lang="de"><head><meta charset="utf-8"><meta name="viewport" id="vp" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
  echo "<meta name=\"description\" content=\"$DESC\"><meta name=\"theme-color\" content=\"#07060b\">"
  echo "<link rel=\"icon\" href=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚽</text></svg>\">"
  sed -n '1,/^<\/style>/p' head.html | sed -e "s#^<title>.*#<title>$TITLE</title>#" -e 's#href="fonts/fonts.css"#href="../fonts/fonts.css"#'
  [ -n "$UMAMI_ID" ] && echo "<script defer src=\"https://cloud.umami.is/script.js\" data-website-id=\"$UMAMI_ID\" data-domains=\"kreisliga-legenden.de,www.kreisliga-legenden.de\" data-do-not-track=\"true\"></script>"
  echo '</head><body>'
  sed '1,/^<\/style>/d' head.html
  echo '<script>'; echo "'use strict';"; echo "const BUILD = '$BUILD';"; cat $JS; echo '</script>'
  echo '</body></html>'
} > ../game/index.html
cp d_karte.js ../assets/karte.js   # Deutschlandkarte auch für die Story der Startseite
echo "fertig: game/index.html"
