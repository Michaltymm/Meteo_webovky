# Skutečná časová osa 24h — v0.18.13

2026-10-29, METEO-036, navázání na checkpoint v0.18.12 /7e5e12d.
Jde o dokončenou dílčí etapu hlavního a moderního přehledu. Celé036 zůstává
Rozpracováno kvůli ostatním starším category grafům. METEO-008 a další24h
min/max vykreslení zůstávají samostatné; parser/výběr/IO se nepředělávaly.

## Chování a původ hodnot

Stávající Chart.js a jediná instance24h nyní dostávají původní vzestupné
`{x: epochMs, y: hodnota}`. Lineární osa má fyzické rozestupy podle času,
ne podle pořadí záznamu. Bez adaptéru dat nebo nové závislosti. Vlastní osa,
interaction/tooltip a plugin nemění společná nastavení ostatních grafů.
`parsing:false`, `normalized:false` dovolují původní duplicitní timestampy.
T/RH/Td jsou zarovnané po stejných řádcích; nuly zůstávají nuly, neplatné
senzory null. Td se počítá existujícím dewPoint(T,RH), nikoli z redukované řady.

Výběr se neměnil: inkluzivních24uplynulých hodin vůči prvnímu záznamu;
Sheets dvě binární meze a kopie pouze výřezu; MQTT/both původní plný predikát
kvůli možnému posunu hodin/budoucím CSV. Stabilní sort zachová pořadí shod.
Všechny původní vybrané body zůstávají; žádný sampling, interpolované měření,
nová deduplikace nebo změna zdroje. Plné statistiky stále z úplného store.

Čára je přímá mezi vzorky (bez spline překmitů) a nepřemosťuje null. Při
časovém odstupu **>3h** se do všech tří vizuálních řad vloží jasně označený
`{x: předchozíEpoch+1, y:null, gap:true}`. Není to měření, nemá hodnotu ani
tooltip a nevstupuje do zdrojových řádků/agregací/počtů. Shodná pevná hranice
jako v analytice je pravidlo kreslení, **není detekcí výpadku** nebo doloženou
frekvencí stanice. Přesně3h se nepřerušují. Vysvětlení využívá existující
informační panel pod ikonou, běžný přehled nezaplňuje textem.

Osamocené platné body mezi mezerami doplňuje dvoupixelový marker ve své
barvě. Plugin čte hotové segmenty Chart.js, neprochází znovu zdrojová měření;
respektuje legendu a ořezání. Nezavádí scriptable styl pro každý vzorek.
Jediný/shodný čas má rozsah ±60s a standardní viditelné body; prázdný graf
zahodí předchozí ruční meze. Líné kreslení, dirty/stanice/resume/fallback
z v0.18.12 zůstává. Žádný nový fetch, timer, cache nebo Chart instance.

Tooltip vybírá společný původní index na oseX, ukáže datum/sekundy/UTC posun
existujícím intervalTimestamp a nezaokrouhlenou číselnou hodnotu daného bodu.
**Význam legacy CSV zůstává v zóně prohlížeče.** Lokální řetězec bez zóny
neumožní obnovit chybějící UTC offset během opakované hodiny. Test dvou různých
epoch při DST používá explicitně známé Date; nedokládá takové rozlišení ze
samotného ambiguózního CSV. Konfigurace zóny stanice je dále METEO-048.
Duplicitní epochy mohou vizuálně ležet na sobě; zůstávají však v původním pořadí.

## Ověření

407/407 Node, sedm nových regresí v
[tests/current-chart-time.test.js](../../tests/current-chart-time.test.js):
samostatná lineární osa/options, původní epochové páry, null/NaN/Infinity/0,
striktní>3h a oddělení rendereru od měření, prázdný/jediný/shodný čas,
přesný tooltip/UTC offsety při opakované hodině a marker jen skutečně
osamocených viditelných bodů. Původní range/visibility testy se přizpůsobily
pouze datovému formátu; full-scan oracle,100náhodných historií, frozen vstup,
250kProxy, plné statistiky mimo okno, DST3zón, MQTT posun hodin a IO guardy
zůstaly a prošly.

Rozšířený skutečný Chromium154/Chart.js/IO browser:
[scripts/check-current-chart-visibility-browser.py](../../scripts/check-current-chart-visibility-browser.py).
Tři původní konfigurace,400/12k exporty a úplný původní oracle T/RH/Td,
coalescing dvou skrytých commitů, změna stanice/stránky/resume/fallback;
320/767/1440px/obě témata bez přetečení. Navíc skutečné pixelové poměry
1min:1h=1:60, segmenty přes null a>3h přerušeny, pixel osamoceného vzorku má
přesnou barvu, hover i tap ukazují původní čas, kliknutá legenda přetrvá přes
hlavní/moderní přehled, informační panel, prázdný/jediný čas a explicitní DST.
Bez pageerror/socketu. Původní cooperative CSV browser se3konfiguracemi/12k
unordered exporty prošel také; změnil se pouze oracle na epochové body.

## Měření režie

Stejný skutečný CSV/fetch/parser/commit/DOM/Chart harness jako předchozí etapa,
[scripts/benchmark-refresh-browser.py](../../scripts/benchmark-refresh-browser.py),
390×844, Europe/Prague, reduced-motion, řízené CSV/původní Praha-baterie PCB.
Startup potlačen stejně, observer inicializován, před vzorkem400seed/reset,
skutečné přisunutí grafu a kontrola geometrie,350ms pro resize, GC.
Jedno zahřátí+pět měřených vzorků, všechny profily sekvenčně bez souběžných
testů/profilů. Kalendářní Date pevné2026-10-28poledne, nativní performance.now
+fronty; pravidelných300s/hustých1s1k–250k, navíc CPU×4/hustých100k.
Tato oprava nemění volbu animací uživatele; měří se shodný reduced-motion.

Jde o kombinovanou změnu osy/datového formátu, vynechání interního parseru,
přímých segmentů místo spline a markeru. Měření neizoluje příspěvek každé části.
UI je původní synchronní commit, ne paint/INP nebo první scroll. Skrytá větev
se neměnila; ověřena browserem, samostatný nový výkonový profil nepotřebovala.

Mediány ms, před → po. Graf je při commitu viditelný:

| CPU / odběr | Řádků historie | UI commit | Chart.update | Přijetí CSV celkem |
| --- | ---: | ---: | ---: | ---: |
| 1× / 300 s | 1 000 | 9,3 → 8,3 | 5,6 → 5,0 | 31,3 → 31,1 |
| 1× / 300 s | 10 000 | 10,2 → 8,9 | 5,1 → 3,6 | 75,8 → 70,0 |
| 1× / 300 s | 100 000 | 20,3 → 21,5 | 5,7 → 4,8 | 728,6 → 778,1 |
| 1× / 300 s | 250 000 | 27,2 → 26,5 | 5,9 → 5,0 | 1693,2 → 1812,1 |
| 1× / 1 s | 1 000 | 12,4 → 10,2 | 8,5 → 6,2 | 34,4 → 35,0 |
| 1× / 1 s | 10 000 | 34,5 → 29,8 | 26,4 → 20,8 | 104,3 → 111,9 |
| 1× / 1 s | 100 000 | 258,3 → 98,0 | 217,9 → 46,8 | 912,5 → 810,8 |
| 1× / 1 s | 250 000 | 259,4 → 112,2 | 210,7 → 45,5 | 1960,4 → 1843,3 |
| 4× / 1 s | 100 000 | 936,7 → 378,7 | 805,1 → 201,2 | 3422,4 → 2757,5 |

V pravidelné historii jde v 24h okně o 289 řádků, v hustých 100k/250k o
86 401 řádků (inkluzivní kraj). Statistiky vždy zahrnují celou historii.
Husté 100k: UI 258,3 → 98,0 ms, CPU×4 936,7 → 378,7 ms. Zhoršení se
nezamlčují: pravidelné 100k UI 20,3 → 21,5 ms a celý load 728,6 → 778,1 ms,
pravidelné 250k load 1693,2 → 1812,1 ms.

Samotné kreslení hustých řad zůstává drahé. Nejde o záruku16ms nebo celkově
rychlejšího načítání v každém scénáři. Neprováděl se profil peak/RSS/heap ani
fyzického mobilu, a netvrdí se úspora RAM. Nový renderer drží3pole objektů,
Chart.js může podle počtu mezer držet další segmenty; starý měl vlastní
parsované body. Před/po níže měří čas, ne porovnání těchto alokací.

Po časovaných vzorcích samostatný úplný oracle ověří řádky, přesné agregace,
validační report (jen checkedAt=0), uvedenou podmnožinu DOM z harnessu a všechny
původní trojice epoch/T/RH/Td včetně null a duplicit. Devět trojic SHA-256
rows/stats/measurements se musí přesně shodovat. Starý category formát dostane
epochy z nezávislého původního full-scanu; nový je bere přímo z bodů a zahodí
pouze označené vizuální gap. Oba se navíc porovnají proti původnímu store.
Celý hash `chart` se záměrně liší: dokumentovaná změna formátu/os/mezer,
ne změna naměřených hodnot. Counts/statistiky nejsou z visualizačních dat.
V každém vzorku zůstává jedna Chart.update, osm instancí a jeden full fetch.

Surové výsledky: [před](time-axis-24h-before.json), [po](time-axis-24h-after.json),
[CPU×4 před](time-axis-24h-cpu4-before.json), [CPU×4 po](time-axis-24h-cpu4-after.json).
Přesný baselineHTML: `git show 7e5e12d:index.html > /tmp/meteo-axis-before.html`.

```sh
python scripts/benchmark-refresh-browser.py --html /tmp/meteo-axis-before.html \
  --chartjs /cesta/chart.js --paho /cesta/paho.js --view visible \
  --counts 1000,10000,100000,250000 --fixtures regular,dense --output /tmp/before.json
python scripts/benchmark-refresh-browser.py --html index.html \
  --chartjs /cesta/chart.js --paho /cesta/paho.js --view visible \
  --counts 1000,10000,100000,250000 --fixtures regular,dense --output /tmp/after.json
# CPU profil: stejné dva běhy, --counts 100000 --fixtures dense --cpu 4.
```

Použít místní kopie přesně těch CDN souborů, jejichž SRI je v HTML. Živé služby,
MQTT broker, fyzický Safari/iOS a živý Pages host nejsou ověřeny. Pages doména
není v síťovém allowlistu prostředí. Nasazení se dokládá zvlášť Actions.

## Další checkpoint

METEO-033 rozšířit na24h: bounded min/max vizualizace všech T/RH/Td s jejich
extrémy, původními časy, null/mezerami a tooltipy. Statistiky dál ze všech
původních validních řádků. Průzkumník pod033 zůstává hotový; tohle je další
renderer, ne nové ID. Neopakovat hotovou036/24h, parser, výběr a IO.
Ostatní category grafy036, explicitní zóna048, streaming snapshot a004 cache
stanic zůstávají samostatné budoucí etapy.
