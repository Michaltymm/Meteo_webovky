# Noční analýza a profil zbývající analytiky — v0.18.3

2026-10-24, třetí malá část METEO-008. Výchozí `0f2ad15` (HTML v0.18.2),
výsledek v commitu tohoto dokumentu. Dokončený model a porovnání se znovu
neimplementují. Profil nejprve porovnal heatmapu, volitelné vyhlazení a noční
analýzu; opravena pouze zbytečná práce poslední z nich.

## Metodika

`scripts/profile-analytics-details.py`, skutečný Chromium154.0.8037.57,
Chart.js/Paho se skutečnými SRI z lokálních souborů. Viewport390×844,
Europe/Prague, omezené animace. Připravený celý analytický model se neměří.
Jeden zahřívací běh, pak pět vzorků s GC před každým, tabulky jsou mediány ms.
Každá kombinace používá novou stránku, měření před/po i CPU×4 postupně,
bez souběžných testů nebo dalších profilů. Stejná data na obou revizích:

- `regular`: záznam po5min, poslední 24.10.2026 ve12:00 Europe/Prague.
  250k pokrývá přes dva roky; vybraná noc má asi144původních záznamů.
- `dense`: záznam po100ms, konec také ve12:00.250k je přibližně6,94h,
  takže zahrnuje pouze část nočního úseku před východem. Menší husté rozsahy
  v tomto scénáři nemají záznamy poslední dokončené noci.
- `night`: zátěžová varianta po100ms končící1s po skutečném východu Slunce
  24.10.2026. Téměř všechny záznamy patří noci. Není běžná četnost stanice.

Teplota/vlhkost obsahují nuly, null a extrém85°C; V je konečné sinusové,
aby šlo ověřit i číselný noční výsledek. Neplatné V/duplicity/mezery ověřují
zvlášť deterministické Node testy. Měří se synchronní volání:
studená heatmapa včetně buněk/DOM/canvas, teplá heatmapa s cache a redraw,
`analyticsMoving` a `analyticsNight`. Nejde o celý paint stránky, CSV, síť,
INP nebo fyzický telefon. CPU×4 je emulace zpomalení, nikoli měření iPhonu.

## Výchozí profil a výběr změny

| Řádků | Rozložení | Heat studená | Heat teplá | Vyhlazení | Noc |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 000 | regular | 1,2 | 0,2 | 0,4 | 0,2 |
| 10 000 | regular | 3,4 | 0,7 | 3,7 | 1,8 |
| 100 000 | regular | 3,9 | 0,7 | 16,0 | 14,9 |
| 250 000 | regular | 3,8 | 0,7 | 35,7 | 32,7 |
| 1 000 | dense | 0,9 | 0,2 | 0,4 | 0,3 |
| 10 000 | dense | 3,9 | 0,1 | 2,6 | 3,1 |
| 100 000 | dense | 20,0 | 0,2 | 14,4 | 24,9 |
| 250 000 | dense | 44,0 | 0,2 | 36,8 | 68,6 |

Heatmapa pravidelné historie už omezuje výběr na posledních14dní. Vyhlazení
je volitelné. Noční výpočet se provádí při první přípravě bateriové karty6
a původně procházel celou historii, ačkoli potřebuje jedinou dokončenou noc.
To odůvodňuje malou změnu před dalším dávkováním nebo přidáním workeru.

## Implementace a přesnost

Model už poskytuje vzestupně seřazené původní řádky s platnými Date, bez
vizuální redukce. Dvě binární meze vyberou první čas≥západ a první čas>východ;
vlastní průchod zůstává ve stejném pořadí se stejnými výpočty a validací.
Složitost O(log n+k), k je počet původních záznamů vybrané noci, prostor O(1).
Bez další cache, úlohy, požadavků, závislostí nebo změny konfigurací.

Obě hranice včetně všech duplicit jsou zahrnuté, nula V platí, neplatné V
uvnitř a mezery>3h nadále znemožní výsledek. Chybná V mimo noc neovlivňují
výsledek. Výběr dokončené noci, astronomie, lokální zóna, časování přes DST,
rozdíl mV a skutečné uplynulé hodiny se nemění. Pozorovaný úsek není příslib
pokrytí celé noci; napětí není proud, energie ani stav nabití.

SHA256 zahrnuje **celý přesný text nočního výsledku, všechny heatmapové buňky
a všechny výsledné body vyhlazení**; na všech12scénářích před/po se shoduje.
Kontroluje se také identita a pořadí všech původních řádků. SHA neporovnává
jen počet nebo zaokrouhlenou statistiku.

## Noční výpočet před/po

| Řádků | Rozložení | Před ms | Po ms |
| ---: | --- | ---: | ---: |
| 1 000 | regular | 0,2 | 0,1 |
| 10 000 | regular | 1,8 | 0,1 |
| 100 000 | regular | 14,9 | 0,2 |
| 250 000 | regular | 32,7 | 0,1 |
| 1 000 | dense | 0,3 | 0,1 |
| 10 000 | dense | 3,1 | 0,1 |
| 100 000 | dense | 24,9 | 0,1 |
| 250 000 | dense | 68,6 | 12,0 |
| 250 000 | night | 85,9 | 36,3 |
| 100 000, CPU×4 | regular | 63,6 | 0,8 |
| 100 000, CPU×4 | dense | 109,9 | 0,2 |
| 100 000, CPU×4 | night | 156,1 | 61,9 |

Hodnoty kolem0,1ms se blíží rozlišení časovače; nejsou záruka pro jiné stroje.
Hustá skutečná noc stále stojí O(k) a může blokovat hlavní vlákno. Ani36,3ms
nebo61,9ms neznamená splnění16ms rozpočtu. Dále zůstává cena přípravy modelu,
samotného Chart.js a dalších grafů. Jiné naměřené časy kolísají (například
vyhlazení250k regular35,7→55,6ms), jeho kód se neměnil a zrychlení se netvrdí.
Paměť ani dlouhodobé úniky tato etapa neměřila; O(1) označuje pomocný prostor
této funkce, nikoli celkovou RAM aplikace.

## Regrese a další checkpoint

`tests/analytics-night.test.js`:10testů s nezávislou původní lineární referencí,
100náhodných historií, inkluzivní hranice/duplicity, nuly/null/nonfinite,
mezery, chybějící poloha/astronomie, předvýchodový fallback, prázdná/částečná
noc, dense20k, neměnnost a skutečná astronomie přes oba přechody DST2026
v Europe/Prague, UTC a America/New_York. Proxy u250k pravidelné historie
potvrzuje méně než200přístupů, nanejvýš k+2ceil(log2 n)+1; bez křehkého
časového limitu v CI.

Při celé sadě se našla starší závislost `tests/data-status.test.js` na datu
stroje: čas testu byl23.10., ale kalendářní snapshot vznikal24.10. Selhání
potvrzeno i na původním HTML. Fixture nyní srovná `visibleDay` se svými
hodinami, obdobně jako existující background-refresh testy; produkční
obsluha viditelnosti se neměnila. Opravená fixture prošla i na původním HTML.

Celá sada342/342 Node. Rozšířený skutečný browser harness kontroluje také
přesný text a memo nočního výsledku v kartě6 bez dalšího requestu, vedle
existujících100k/9grafů/3konfigurací/zoom/reset/PNG a320/1440px v obou tématech.
Browser prošel bez pageerror a bez otevřených socketů; používá řízené CSV/UV,
nikoli živé služby.

**Další krok METEO-008:** navázat na tento profil volitelného vyhlazení,
zachovat pořadí přesných výpočtů a odstranit/rozdělit jeho plné dočasné pole
bodů před samplingem. Neopakovat hotový model/párování ani hledání nočního
intervalu. Hustou noční historii případně dávkovat až podle reálné potřeby;
heatmapu s velkým počtem záznamů, parser a streaming řešit samostatně.

## Surová data a reprodukce

- [Výchozí profil1k–250k](nocni-before.json), [po změně](nocni-after.json).
- [Hustá noc250k před](nocni-night-before.json), [po](nocni-night-after.json).
- [CPU×4/100k před](nocni-cpu4-before.json), [po](nocni-cpu4-after.json).

```bash
git show 0f2ad15:index.html > /tmp/meteo-night-before.html
python scripts/profile-analytics-details.py --html /tmp/meteo-night-before.html --chartjs /tmp/meteo-chart.js --paho /tmp/meteo-paho.js --output /tmp/night-before.json
python scripts/profile-analytics-details.py --html index.html --chartjs /tmp/meteo-chart.js --paho /tmp/meteo-paho.js --output /tmp/night-after.json
```

Pro hustou noc oba příkazy s `--counts 250000 --distributions night`.
Pro zpomalení oba s `--counts 100000 --distributions regular,dense,night --cpu 4`.
Knihovny jsou stejné lokální soubory pro obě revize; žádné živé služby.
