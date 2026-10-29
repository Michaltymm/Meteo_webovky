# 24hodinový graf podle viditelnosti — v0.18.12

2026-10-28, navázání METEO-008 přímo na uložený checkpoint po mobilní etapě.
Baseline476267b (HTMLv0.18.11). Hotové parserové, výběrové a mobilní etapy se
nepředělávaly. Celé METEO-008 zůstává Rozpracováno.

## Změna

Jediný IntersectionObserver sleduje stávající canvas24h, bez kopie zdrojových
dat nebo dalšího datového systému. Původní dirty stav tabu zůstane nastavený,
pokud je canvas pod/nad obrazovkou, mimo šířku viewportu, v jiném tabu/stránce,
odpojený nebo je dokument skrytý. Při vstupu observer ověří aktuální geometrii,
aktivní stránku/tab a data; nezachytává minulou stanici nebo rozsah do closure.
Sestaví původní graf z právě aktuálního store a teprve po úspěchu zruší dirty.
Více neviditelných obnov se tak sloučí do jediného pozdějšího vykreslení.

Invalidace dat/stanice zastaví původní animaci a skryje starý canvas, ale
zachová jeho plochu. Starý graf se neukáže při přechodu na novou stanici.
Při návratu ze skryté stránky se čekající viditelný graf obnoví existujícím
visibility handlerem i bez nového IO eventu. Původní návrat hlavní/moderní
stránky a přepínání dolních tabů využívá stejný refreshTab. Opožděné ruční
resize a změna motion preference graf mimo obrazovku nepřepočítávají.

Bez IntersectionObserver, při selhání konstruktoru nebo observe platí původní
synchronní cesta na viditelné stránce. Nejde o odstraňování/rekonstrukci Chart
instance: původních8instancí zůstává. Žádný nový request, polling/timer,
závislost nebo cache. Přímé buildCharts('now') je stále synchronní API pro
explicitní vykreslení, používané také nezávislými regresními kontrolami.

Nemění se výběr24h, všechny body T/RH/rosného bodu, nulové/chybějící hodnoty,
pořadí duplicit, jednotky, zóna, statistiky, historie ani konfigurace3stanic.
Výsledky jsou stále z úplných validních měření, ne z grafu. Mobilní vzhled
v0.18.11 zůstává zachován. UI timing už nezahrnuje pozdější odložený graf;
nepřepisuje se po scrollu zpětně jako údaj o poslední CSV obnově.

## Měření

Rozšířený scripts/benchmark-refresh-browser.py, Chromium154,390×844,
Europe/Prague, reduced-motion. Skutečné CSV/fetch/parser/commit a DOM/Chart.js,
řízený transport, původní konfigurace Praha-baterie PCB. Automatický startup
potlačen stejně u obou HTML; nový observer se inicializuje explicitně, graf se
před vzorkem nastaví do požadované polohy a jeho skutečná geometrie se ověří.
Kalendářní Date je pevné2026-10-28poledne, performance.now/fronty nativní.
Jedno zahřátí+pět vzorků, reset/400řádkový seed,350ms na resize a GC před
vzorkem. Pravidelné300s/husté1s odběry1k–250k. Časy generované přesUTC do
Europe/Prague, zachovaný původní význam CSV. Profily sekvenčně bez testů.

UI je synchronní commit/invalidace/report/refreshUI v původní timing hranici,
nikoli paint, dojití všech browser tasků nebo INP. Skrytý graf do tohoto
času nově nepatří. Sloupec celé obnovy končí přijetím CSV; **nezahrnuje
pozdější první návštěvu grafu**. Chart.js kreslení při scrollu nezmizelo.
Po dokončení časovaných vzorků se graf zvlášť explicitně sestaví a ověří
SHA-256 celých řádků, přesných statistik/reportu/DOM a kompletních grafových
dat. Jen checkedAt normalizován. Jednorázový verificationDrawMs není medián
uživatelského odscrollování, ale měření této samostatné kontrolní práce.

Mediány ms; před → po:

| Poloha | Řádků | Odběr | UI commit | Chart.update v commitu | Přijetí CSV celkem |
| --- | ---: | --- | ---: | ---: | ---: |
| Mimo obrazovku | 1 000 | 300s | 8,7 → 4,0 | 1 → 0 | 36,0 → 28,8 |
| Mimo obrazovku | 10 000 | 300s | 11,5 → 4,8 | 1 → 0 | 103,7 → 75,9 |
| Mimo obrazovku | 100 000 | 300s | 18,2 → 13,0 | 1 → 0 | 740,9 → 669,9 |
| Mimo obrazovku | 250 000 | 300s | 24,4 → 25,5 | 1 → 0 | 1752,0 → 1649,9 |
| Mimo obrazovku | 1 000 | 1s | 12,0 → 3,2 | 1 → 0 | 34,7 → 25,3 |
| Mimo obrazovku | 10 000 | 1s | 45,5 → 5,7 | 1 → 0 | 110,9 → 67,4 |
| Mimo obrazovku | 100 000 | 1s | 265,9 → 13,7 | 1 → 0 | 914,1 → 677,1 |
| Mimo obrazovku | 250 000 | 1s | 245,7 → 21,6 | 1 → 0 | 1927,2 → 1649,3 |
| Viditelný | 100 000 | 300s | 18,7 → 21,2 | 1 → 1 | 702,2 → 758,1 |
| Viditelný | 100 000 | 1s | 274,4 → 267,1 | 1 → 1 | 964,4 → 952,9 |
| Mimo · CPU×4 | 100 000 | 1s | 978,8 → 44,1 | 1 → 0 | 3344,6 → 2265,8 |

Všech13trojic SHA-256 je přesně shodných. Offscreen má0aktualizací grafu
ve všech pěti vzorcích každého scénáře, viditelná větev dál1aktualizaci.
Instance8→8, jeden fetch na měřený plný load beze změny. Nejsou přidány
časovače nebo průchody historií kvůli samotné detekci viditelnosti.

U hustých250k se UI zkrátilo245,7→21,6ms, CPU×4/hustých100k978,8→44,1ms.
Není obecné zrychlení každé cesty: pravidelných250k mimo obrazovku UI
24,4→25,5ms a viditelných100k pravidelných18,7→21,2ms. Agregace, layout,
GC a variabilita prostředí zůstávají. Viditelný hustý100k graf stále
potřeboval267,1ms UI. Jediný následný kontrolní draw250k hustého grafu
trval231ms, na CPU×4/100k903,9ms. Je to přesun práce na okamžik potřeby,
nikoli vyřešená plynulost samotného kreslení nebo záruka16ms.

Surové profily: [mimo před](lazy-24h-offscreen-before.json),
[mimo po](lazy-24h-offscreen-after.json), [viditelný před](lazy-24h-visible-before.json),
[viditelný po](lazy-24h-visible-after.json), [CPU×4 před](lazy-24h-cpu4-before.json),
[CPU×4 po](lazy-24h-cpu4-after.json).

## Regrese a omezení

400/400 Node,8nových v tests/current-chart-visibility.test.js: slučování100
obnov bez nových observerů/requestů/timerů, aktuální geometrie/tab/stránka,
změna stanice/pozdní callback/prázdná data, resume bez IO eventu, oba hlavní
pohledy, chybějící/selhaný IO a observe, motion/resize a chyba/obnova kreslení.
Dosavadní range/časové/přesnostní testy zůstaly stejné.

Nový scripts/check-current-chart-visibility-browser.py používá skutečný IO,
Chart.js/Paho odpovídající SRI a původní3konfigurace s řízenými12k exporty.
Dvě offscreen obnovy bez buildu, aktuální statistiky a jeden build po scrollu,
přesná shoda všech tří řad a popisků s původním algoritmem, V/0/null,
navigace přes analytiku/moderní stránku, syntetický visibilitychange a
fallback bez IO prošly.320/767/1440px a obě témata bez přetečení, žádný
pageerror/WebSocket. Původní CSV cooperative a data-status harness prošly;
CSV test před čtením grafových řad nyní přisune canvas a počká na dirty=false.

Nejsou změřeny Web Vitals/INP, peak/RSS nebo dlouhodobý provoz. Existující
Chart instance a její poslední vizuální pole zůstávají v paměti; není tvrzena
úspora RAM. Chart.js může na vlastní resize událost reagovat nezávisle na
aplikačním refreshi; nejde o úplné uspání všech interních canvas callbacků.
Řízené transporty a syntetické skrytí nejsou živé služby, broker nebo fyzický
Safari/iPhone. Nový prohlížečový test potvrdil skutečný scroll/IO; pouze změna
viditelnosti dokumentu se simuluje.

## Reprodukce a další checkpoint

Použít původní SRI knihovny. Pro každé HTML spustit sekvenčně:

```sh
git show 476267b:index.html > /tmp/lazy-before.html
python3 scripts/benchmark-refresh-browser.py --html /tmp/lazy-before.html --chartjs /path/chart.js --paho /path/paho.js --view offscreen --output /tmp/lazy-before.json
python3 scripts/benchmark-refresh-browser.py --chartjs /path/chart.js --paho /path/paho.js --view offscreen --output /tmp/lazy-after.json
```

Viditelný pár: --view visible --counts 100000.
CPU pár: --view offscreen --counts 100000 --fixtures dense --cpu 4. Porovnat celé sha256 dle rows+fixture.

Dále METEO-036: časově správná lineární osa24h grafu a detail původního času,
ne nová timezone interpretace. Pak lze bezpečně navázat omezeným vykreslením
min/max T/RH/rosného bodu podle METEO-033. Samotné kreslení hustých dat dál
blokuje hlavní vlákno; parser/viditelnost ani hotový výběr znovu neanalyzovat.
METEO-008 Rozpracováno, obecná cache004, cizí parsery a streaming snapshot dále.


Checkpoint036 pro24h dokončen ve v0.18.13: [skutečná časová osa](CASOVA_OSA_24H.md).
Líné vykreslení z této etapy zůstává; dále033 omezené min/max vykreslení
hustého24h grafu, bez redukce podkladů statistik.
