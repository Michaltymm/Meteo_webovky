# Etapa 7 — nová analytika a její provozní cena, v0.4.0

21. 10. 2026. Výchozí HTML `fcb8ca4` / v0.3.1. Analýza nových návrhů je
výhradně v [centrální roadmapě](../NAPADY_A_ROADMAP.md#etapa-7--druhá-rozvojová-analýza-nad-75-návrhy-21-10-2026),
METEO-076–083. Zde pouze metodika, výsledky a hranice ověření.

## Tři realizované změny

1. **METEO-019/031:** explorativní T/V modul. Pár tvoří stejný původní řádek,
   bez interpolace a náhrad za null. Online Welford pro průměry, rozptyly a
   kovarianci; r a sklon ze všech párů, nikoliv z grafu. Méně než3páry nebo
   nulový rozptyl → nedostupné. Duplicity zůstávají započtené, ale rozlišují
   se počet řádků, různých časů a místních dnů. Žádná p-value ani tvrzení
   o kauzalitě/SOC/kapacitě/energii; teplota čidla nemusí být teplota článku.
2. **METEO-013/012:** absolutní vlhkost g/m³ a VPD vzduchu kPa. Aktuální
   karty i historie v existujícím průzkumníku, vzorce/obor/zdroj v native
   details. Magnus nad kapalnou vodou, včetně superchlazené pod 0 °C,
   −45≤T≤60°C a 0≤RH≤100 %. AH=216,7·e/(T+273,15), e v hPa; VPD=(es−e)/10.
   Výpočet není zaokrouhlen před statistikou. RH0 je platná pro AH/VPD,
   nikoli pro logaritmický rosný bod. Chybějící vstup/mimo obor → null.
3. **METEO-010:** počáteční i živé prefers-reduced-motion pro Chart.js,
   CSS a scroll. Při návratu do běžného režimu zůstávají explorer a nové
   velké analytické grafy bez animace. Zbytek ARIA/fokus/touch není dokončen.

Nový modul má cache jediného rozsahu ve stávajícím snapshotu; data/CSV/MQTT/
stanice/den používají původní invalidaci. Rozsahy7/30 × 24 h končí nejnovějším
měřením, nejde o7/30 kalendářních dnů. Časový graf maximálně800 původních
reprezentantů dvou veličin; XY maximálně24×24 buněk +6 extremálních/krajních
bodů =582. Každý reprezentant je skutečný pár s časem, žádný centroid.
Počet XY bodů nevyjadřuje hustotu měření. Časové body se nespojují čarou
přes nepozorované intervaly. Dočasné odkazy na úplné páry nejsou uchovány.

Oba grafy vznikají líně až při použití. Dokončený full-load callback nově
označí pohled jako dirty, vykreslí jen stále aktivní záložku a aktualizuje
partial/full metadata. Když uživatel během přenosu odejde jinam, grafy
analýzy se na pozadí nevytvářejí. Původní generační ochrana zůstává.

## Metodika

Stejný profiler jako etapa6, Chromium 154.0.8037.57, Chart.js 4.4.0, mobilní
viewport 390, Europe/Prague, syntetické 5minutové řádky, síť blokovaná.
Pět vzorků, mediány, první se nevyřazuje. Časované série běžely postupně
bez současných testů/prohlížečů. Jde o synchronní JS/DOM/Chart update,
nikoli pozdější paint, Web Vitals nebo celou RAM procesu.

**Před/po** používá totožné `--aggregates` scénáře se zavřenou novou
analytikou. `--analysis` je samostatná série s novou funkcí: její předchozí
protějšek neexistoval, proto jí nevyrábíme procento zrychlení. Cold battery
invaliduje i základní snapshot, warm ho hned následuje. VPD je průzkumník
nad úplnou historií, redukce až před vykreslením. Po30 cyklech heap po GC,
počet DOM uzlů a Chart instancí. Není to několikadenní soak.

## Běžné pohledy před/po

Milisekundy, mediány pěti vzorků:

| Řádků | Cold refresh před → po | Opakovaný refresh před → po | Explorer T/RH před → po |
| ---: | ---: | ---: | ---: |
| 1 000 | 23,2 → 27,3 | 20,2 → 17,4 | 5,8 → 5,8 |
| 10 000 | 23,6 → 25,5 | 17,6 → 19,0 | 7,5 → 10,4 |
| 100 000 | 37,7 → 39,0 | 21,1 → 20,4 | 21,7 → 22,5 |
| 250 000 | 61,5 → 54,2 | 25,6 → 23,8 | 40,4 → 43,5 |

[Před](stage7/before-fcb8ca4.json), [po](stage7/after.json).
CPU×4/100k cold **130,9 → 139,6 ms**, warm **88,1 → 85,5 ms**, explorer
**94,1 → 95,1 ms**: [před](stage7/before-cpu4.json), [po](stage7/after-cpu4.json).
Rozdíly jsou oběma směry; žádné plošné zrychlení ani výkonová SLA.
CPU throttling není skutečný slabší mobil a pět mediánových vzorků nedává
statistický důkaz příčiny každého malého rozdílu.

Při 250k po 30 cyklech zavřené analytiky heap **56,72 → 56,68 MiB** (šum, nelze
vyvozovat celkovou úsporu RAM), Chart stále8. DOM1969 → 2104 kvůli novým
kartám, vysvětlením a záložce. HTML210340 → 222854 bajtů bez komprese; nejde
o změřené wire bytes na Pages. Nové funkce mají explicitní cenu obsahu.

## Cena nového modulu

| Řádků | T/V po invalidaci (ms) | T/V opakovaně (ms) | VPD explorer (ms) |
| ---: | ---: | ---: | ---: |
| 1 000 | 8,1 | 5,1 | 5,3 |
| 10 000 | 10,0 | 5,3 | 7,8 |
| 100 000 | 26,3 | 6,6 | 18,8 |
| 250 000 | 55,7 | 6,1 | 29,2 |

[Surová série](stage7/analysis.json). [CPU×4/100k](stage7/analysis-cpu4.json):
T/V cold141,4 ms, warm28,8 ms, VPD66,4 ms. První výpočet zůstává možný dlouhý
blok hlavního vlákna. Před Workerem změřit skutečný parser a dobu interakce,
nejprve omezit rozsah, zachovat cache a nedělat analýzu při neaktivní záložce.
Nová závislost není odůvodněna jen číslem z lokálního fixture benchmarku.

Při 250k otevřené analytiky heap po GC 57,55 MiB, deset Chart instancí i po30
cyklech. Rozdíl proti zavřené analytice zahrnuje i jiné navštívené panely,
není to čisté měření velikosti cache; nezaměňovat s únikem/celou RAM.
Všech250k párů zůstává ve výpočtu, časový graf≤800, XY≤582. Node test
ověřuje cache bez dalších čtení zdrojových řádků, ne křehký časový limit CI.

## Ověření a dostupnost

**132/132 Node testů**, třináct nových v analytical-metrics.test.js:
nezávislé referenční es/AH/VPD, doména/0/null, karty a plné explorer hodnoty,
nezávislá dvouprůchodová kovariance/regrese, konstantní a malé vzorky,
duplicitní časy, velký offset,250k/původní extrémy, omezené grafy, cache,
rozsah podle posledního měření, CSV/MQTT/reset a živá změna preference.

[Browser](stage7/browser.json): skutečné tři konfigurace, řízené CSV/UV.
První stanice924 platných párů / 1000 a r≈1, druhá bez V → 0 párů/r nedostupné,
třetí 924 párů s 0 V → platné nuly a r nedostupné kvůli konstantě. Full request
jen jeden při explicitním otevření nad quick historií; přepínání rozsahu 0.
Přepnutí do jiné záložky během přenosu nevytvořilo skryté nové grafy,
partial/full se po dokončení opravilo. Skutečná CSV oprava starého V0 → 0,02
se přepočítala při zachování1000 originálů. AH/VPD historie, dvě témata,
390px bez přetečení/page errors, motion při startu i za běhu, spinner CSS.
Screenshot analytiky prohlédnut. [Smoke](stage7/smoke.json) prošel všechny
záložky včetně nové a deset explorer voleb; jeho časy nejsou srovnávány,
protože tento funkční běh probíhal souběžně s Node testy.

Žádné nové produkční závislosti, konfigurace nebo automatické dotazy při
startu/obnově. Jednorázový full při otevření modulu je stávající mechanismus
pro přesná historická data. Živé Sheets/UV, MQTT broker, firmware, délka
reálné historie, fyzický mobil a několikadenní provoz nebyly ověřeny.
Přímé živé Pages nejsou v síťové politice prostředí povolené; úspěch
publikačního workflow evidovat odděleně od lokálních fixture testů.

## Reprodukce

Volitelné Python/Playwright/Chromium a lokální Chart.js podle [README](README.md).
Benchmarky spouštět postupně, každý příkaz nechat doběhnout:

```bash
git show fcb8ca4:index.html > /tmp/meteo-before.html
python scripts/profile-history.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --aggregates --output /tmp/before.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --aggregates --output /tmp/after.json
python scripts/profile-history.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --aggregates --cpu 4 --counts 100000 --output /tmp/before-cpu4.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --aggregates --cpu 4 --counts 100000 --output /tmp/after-cpu4.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --aggregates --analysis --output /tmp/analysis.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --analysis --cpu 4 --counts 100000 --output /tmp/analysis-cpu4.json
node --test tests/*.test.js
python scripts/check-analytics-browser.py --chartjs /tmp/meteo-chart.js --output /tmp/analytics-browser.json
python scripts/benchmark-browser.py --html index.html --chartjs /tmp/meteo-chart.js --output /tmp/smoke.json
```
