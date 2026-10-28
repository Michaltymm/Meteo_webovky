# Mobilní horní blok — v0.18.11

Úprava METEO-010/011 podle mobilního zadání, 2026-10-28. Rozsah: společná
hlavička, hlavní navigace, doplňkové lišty a akce dat. Senzorové karty,
výpočty, grafy, parser a konfigurace nejsou přepracované.

- Do767px má hlavička mřížku s pružným názvem stanice a44px ovladači.
  Navigace má tři stejné sloupce a čitelné zalamování.
- Obnovit, celá historie a nastavení tvoří stejně vysokou řadu bez
  změny pořadí DOM. Skryté tlačítko historie nezanechává prázdný sloupec.
- Slunce/Měsíc/ostatní stanice jsou v nativním details, na mobilu při
  načtení zavřeném. Desktop zůstává otevřený se skrytým summary. Jediný
  matchMedia listener při překročení breakpointu obnoví odpovídající stav
  a zavře staré astronomické popups; nejsou další fetch/timery ani kopie dat.
- Rozbalené astronomické údaje mají mřížku a detaily jako spodní panel
  omezený výškou viewportu. Stanice jsou posuvné karty s viditelným začátkem
  další karty, snap proximity, bez animace nebo horizontálního přetečení stránky.
- Doplňkové lišty nejsou na mobilu připnuté. Na šířku při výšce do500px
  odroluje také hlavička/navigace. Na767px a méně se skládá modern-intro,
  čímž je opravené dřívější přetečení moderního pohledu mezi651–767px.
- Všechny původní texty, akce, tři stanice a palety jsou zachované.
  Desktopová CSS pravidla zůstávají; nová pravidla platí do767px.

## Ověření

`node --test tests/*.test.js`:392/392. Nový
`scripts/check-mobile-layout-browser.py`:66 kombinací tří pohledů, dvou
barevných témat a11rozměrů:320×740,375×812,390×844,430×932,540×900,
650×900,767×900,667×375,767×430,1024×900 a1440×900. Skutečný Chromium154,
původní konfigurace, lokální knihovny se SRI, řízené CSV/UV. Ověřeny44px
hlavní cíle, shodné zarovnání akcí, menu ve viewportu, rozbalování bez
requestu, všechny tři stanice, načtení historie/obnova a čtyři spodní panely.
Bez přetečení a pageerror. Je povolen posun pouze uvnitř seznamu stanic.

Stejný scénář proti původnímu HTML z0c48c7b potvrdil přesnou shodu geometrie
hlavičky/navigace/akcí/stavu dat ve12desktopových snímcích(1024/1440px).
Nejde o pixelovou shodu včetně nového čísla verze. Hlavní pohled390px:
lišta akcí96→68,5px, začátek stavu dat349,8→294,9px. Na320px se stav
posunul381,6→294,9px. Na767px nejsou všechny bloky nižší: větší dotykové
cíle mají přednost před úsporou několika pixelů.

Rozšířená původní kontrola `check-data-status-browser.py` prošla třemi
stanicemi,24rozloženími a12MQTTrozloženími, včetně varování, diagnostiky a
zachování dat. Před otevřením dismiss-on-scroll nápovědy test nechá doběhnout
svůj automatický scroll; produkční logika nápovědy se neměnila.
Evidence a screenshoty: /workspace/validation/meteo-mobile-layout/.
Živé služby, broker a fyzický Safari/iPhone nejsou tímto offline testem ověřeny.

## Pokračování

Tato mobilní etapa je hotová. Obecné METEO-010 zůstává Rozpracováno
(ostatní klávesnice/fokus); již hotové METEO-011 se znovu neotevírá.
Při pokračování výkonnostní roadmapy navázat na uložený checkpoint
METEO-008: líné kreslení24h karty podle viditelnosti. Tuto UX etapu ani
hotový parser/výběr neopakovat.
