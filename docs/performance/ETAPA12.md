# Etapa 12 — původní měření teplotních extrémů, v0.9.0

22. 10. 2026, výchozí `08e531a` / v0.8.0. Další dílčí etapa METEO-063:
nejvyšší a nejnižší teplota ve společné kartě Statistika. Hotové podklady
T/V dnů077 a hodinových průměrů se znovu neimplementují. Celé063 dál
rozpracované: roční/denní extrémy a další odvozené výsledky mají vlastní rozsah.

## Rozsah a výběr

Dvě nativní tlačítka a rozbalovací panel ukazují původní vybraný záznam,
teplotu bez tabulkového zaokrouhlení, doprovodné RH/P/V, datum/čas s UTC
offsetem, pořadí v načtené historii, verzi a pravidlo výběru. Počet shod
odpovídá přesné číselné rovnosti před zaokrouhlením, nikoli shodnému textu
v kartě. Nuly a duplicitní časy zůstávají samostatné záznamy. Při shodě
stále vítězí první v sestupném zdroji; při stejném čase původní pořadí.

Rozsah je **všechna právě načtená data**; částečná quick historie400 je
výslovně označena. Počet platných T, vynechaných hodnot, přesných shod
a časový rozsah všech načtených záznamů vysvětlují podklady. Není to filtr
roku, dne ani ověřený klimatický rekord; metadata umístění/kalibrace071
a časový kontrakt048 dál chybějí. Pořadí není trvalé backendové ID.
Časy mají dosavadní sekundovou přesnost zobrazení, interní ms se nemění.
Chybějící RH/P/V výběr teploty neovlivňují; jejich buňky zůstávají „–“.

`dataAggregates` přidává v původním jediném průchodu jen čítač platných T,
číselné indexy min/max a dva čítače shod. Původní minRow/maxRow i hodnoty
se vybírají stejnými přísnými porovnáními. Žádný seznam shod nebo kopie
historie. Nad hotovým souhrnem otevření O(1): nejvýše tři čtení řádků
(vybraný, první a poslední), i když má všech250k záznamů tutéž teplotu.
Zavřený výpis nepřidává čtení historie při opakovaném refreshi.

Stav drží pouze snapshot, druh extrému, index, stanici a příznak plné
historie. CSV/MQTT, oprava/delece, stanice/reset nebo změna platného
snapshotu panel vyčistí a zavře. Před čtením kontrola identity/délky zdroje,
místního dne, stanice, volby a fullLoaded; i přechod na full se stejnými
řádky zneplatní starý rozsah. In-place mutace nadále musí invalidovat.
Buňky escapované, kontext přes textContent. Bez dalšího fetch/grafu/závislosti.

## Měření

Skutečný Chromium154.0.8037.57 / Chart.js4.4.0,390×844,Europe/Prague,CPU×1.
Pět vzorků, medián bez vyřazování prvního;1k a250k syntetických5min řádků
s extrémem85°C. Stejný `--aggregates` scénář před/po, sekvenčně bez
souběžných testů/browserů. Měřen synchronní JS+DOM+Chart update, nikoli
paint, CSV parser, síť nebo Web Vitals. Stará čtyřvelikostní měření zůstávají
historickým důkazem; nyní cíleně jen malý a velký rozsah.

| Řádků | Cold refresh před → po (ms) | Opakovaný refresh před → po (ms) | Podklady maxima (ms) | Podklady minima (ms) |
| ---: | ---: | ---: | ---: | ---: |
| 1 000 | 20,9 → 22,0 | 16,6 → 18,1 | 0,6 | 0,3 |
| 250 000 | 48,4 → 45,7 | 21,0 → 21,2 | 0,5 | 0,3 |

[Před](stage12/before-08e531a.json), [po](stage12/after.json).
Rozdíly na sdíleném stroji nejsou tvrzením zrychlení: přidána funkce
a několik čítačů, původní algoritmy/statistiky zachovány.

Volitelné `--temperature-record` běží až po hlavních měřeních a30cyklech,
nad stejným zdrojem. Viditelnost tabulky ověřena, native toggle proběhne
před časováním. Měří znovusestavení podkladů, nikoli kliknutí až do paintu.
V DOM jediný řádek;8změn uzlů/textu na otevření, atributy pozorovatel neměří.
Proxy unit test s250k shodami ověřuje max3čtení; není časovým limitem CI.

Základní250k warm heap59 271 396→59 320 204B, uzly2328→2414,
po30cyklech stále2414uzlů/8grafů. HTML+7414B bez komprese.
Doplňkový výpis po otevření60 302 072B/2429uzlů/8grafů,
po zavření60 302 104B/2429uzlů, po20cyklech60 302 160B/2413uzlů/8grafů.
Tělo tabulky prázdné, stav null. CDP paměť neklesá okamžitě při zavření;
nejde o důkaz okamžitého uvolnění nativní paměti ani vícedenní soak.

## Regrese

**193/193 Node testů**,13nových v `tests/temperature-record.test.js`:
přesné výhry/shody/indexy, stejně zaokrouhlené různé teploty, min=max0,
nečíselné/chybějící senzory, částečný/full rozsah,250k omezená čtení bez
kopií, source/CSV/MQTT/in-place/stanice/reset/den/fullLoaded/volba/close,
XSS, nezávislost ročních a porovnávacích filtrů a opakovaná DST02:30.
Původní testy souhrnů nadále potvrzují úplné výpočty a původní identity.

[Browser](stage12/browser.json) spouští originální start/parser a tři původní
konfigurace s řízeným CSV/UV. Ověřeny quick400→full1000 a zavření starého
panelu, nativní Enter/volba min/max, úplné nezávislé počty/shody/původní
řádek, stanice s0T i bezT, oprava starého CSV, žádný extra HTTP/Chart/pageerror.
Obě témata320/390px bez celostránkového overflow; horizontální posun tabulky
klávesnicí. Screenshot prohlédnut. Pevná globální hlavička na elementovém
screenshotu překrývá horní část kvůli posunutí stránky při snímání.

```bash
git show 08e531a:index.html > /tmp/meteo-stage12/before.html
python scripts/profile-history.py --html /tmp/meteo-stage12/before.html --chartjs /tmp/meteo-pages-validation/chart.js --aggregates --counts 1000,250000 --output /tmp/meteo-stage12/before.json
node --test tests/*.test.js
python scripts/check-temperature-record-browser.py --chartjs /tmp/meteo-pages-validation/chart.js --output /tmp/meteo-stage12/browser.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-pages-validation/chart.js --aggregates --temperature-record --counts 1000,250000 --output /tmp/meteo-stage12/after.json
```

Playwright/Chromium jsou pouze volitelné vývojářské nástroje. Firmware,
HW/broker, živé služby, fyzický telefon ani přímé widgety Pages tímto
neověřeny; nasazení dokládat samostatně. Server/konfigurace/workflow/archiv
ani main tato etapa nemění.
