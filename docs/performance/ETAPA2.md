# Etapa 2: historie, paměť a aktualizace UI

21. 10. 2026. Výchozí HTML `1473437` (v0.1.0), výsledné HTML v0.2.0.
Implementace: [14af6c8](https://github.com/Michaltymm/Meteo_webovky/commit/14af6c8084716811b9ff6514168a2107740974c7).
Srovnáváme tři změny: binární historické protějšky, nepřepisování nezměněných
textů a nový panel krajních měření. Nejde o audit skutečného telefonu ani SLA.

## Metodika a reprodukce

Chromium 154.0.8037.57, Chart.js 4.4.0, viewport 390 × 844, Europe/Prague,
headless Linux. Python Playwright je pouze volitelný vývojový nástroj;
produkce ani Node testy nemají novou závislost. Každá velikost má novou stránku,
pět synchronně měřených volání, medián bez odstranění prvního vzorku. Mezi
vzorky 350 ms pro doběhnutí animací. Samostatně CPU throttling ×4 při 100k.

```bash
git show 1473437:index.html > /tmp/meteo-before.html
curl --fail --location https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js --output /tmp/meteo-chart.js
python scripts/profile-history.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --output /tmp/before.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --output /tmp/after.json
python scripts/profile-history.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --cpu 4 --counts 100000 --output /tmp/before-cpu4.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --cpu 4 --counts 100000 --output /tmp/after-cpu4.json
python scripts/check-interval-browser.py --chartjs /tmp/meteo-chart.js --output /tmp/interval-browser.json
node --test tests/*.test.js
```

Spouštět postupně, bez souběžných benchmarků. V profilu je automatický startup
odstraněn, síť zablokována a data vznikají v paměti: pětiminutový interval,
T/RH/P/V, vložený extrém 85 °C. **Není měřena cena CSV parseru, raw CSV,
síť, celá RAM procesu, LCP, INP ani CLS.** Časy jsou synchronní úseky skutečných
funkcí s reálným DOM a Chart.js, ne dokončené vykreslení snímku na obrazovce.
CPU×4 je aproximace pomalejšího CPU, nikoli emulace všech vlastností mobilu.

Heap se měří přes CDP `JSHeapUsedSize` po vyžádaném GC: před daty, po vložení,
po pěti vzorcích a po 30 cyklech přehled/explorer. `Nodes` jsou CDP uzly,
`charts` počet živých `Chart.instances`. MutationObserver sleduje pouze
`childList` a `characterData`, nikoli atributy, layout či všechny zápisy do DOM.
30 cyklů neprokazuje stabilitu několikadenního provozu.

## Výsledky — ponechány i pomalejší scénáře

Milisekundy, medián pěti vzorků, CPU×1:

| Počet řádků | Historické protějšky před → po | Celá refreshUI před → po | Explorer T+RH vše před → po |
| ---: | ---: | ---: | ---: |
| 1 000 | 0,5 → 0,1 | 24,5 → 27,3 | 6,2 → 6,4 |
| 10 000 | 0,9 → 0,1 | 31,9 → 27,9 | 9,8 → 7,0 |
| 100 000 | 6,0 → 0,1 | 63,4 → 75,1 | 18,1 → 22,6 |
| 250 000 | 17,3 → 0,1 | 118,7 → 110,8 | 39,3 → 38,6 |

Surová data: [před](stage2/before-1473437.json), [po](stage2/after.json).
Výsledky „po“ obsahují všechny tři změny JS; následná úprava vnitřního paddingu
panelu byla ověřena integračně, nebyla důvodem opakovat celou časovou sérii.

CPU×4, 100k:

| Série | Historické protějšky před → po | refreshUI před → po | Explorer před → po |
| --- | ---: | ---: | ---: |
| První | 31,4 → 0,1 | 235,1 → 267,5 | 80,6 → 101,5 |
| Opakovaná postupně, bez jiného browser testu | 33,3 → 0,1 | 233,0 → 213,4 | 83,8 → 77,8 |

[První před](stage2/before-cpu4.json), [první po](stage2/after-cpu4.json),
[opakovaná před](stage2/repeat-before-cpu4.json),
[opakovaná po](stage2/repeat-after-cpu4.json).
Pomocný mezilehlý střídavý běh se překryl s browser smoke; kvůli tomuto známému
rušení není použit jako důkaz výkonu. Následné opakování proběhlo samostatně.
Smoke slouží jen jako funkční kontrola, jeho časování zde neporovnáváme.

**Doložený přínos je cílený:** čtyři O(n) skeny historie nahradilo několik
binárních hledání. Čas 0,1 ms leží blízko rozlišení měření, není univerzální
garance. Regrese navíc ověřuje méně než 100 čtení timestampu při 250k oproti
lineární referenci. Shodný text už nevytváří nové textové uzly. Při posledním
vzorku refreshUI jde o 46 → 0 sledovaných mutací, historie 1 → 0. Změněné hodnoty
se nadále zapisují. Nenulová cena čtení/porovnání textu zůstává.

**Plošné procento zrychlení celé stránky nelze doložit:** celá obnova i explorer
kolísají a některé výsledky jsou horší. Druhá série změnila směr rozdílu;
nepoužíváme pouze příznivý běh jako marketingový výsledek. Hlavní vlákno při
100k a CPU×4 stále blokuje přes 200 ms, což je důvod další práce.

## Paměť a životnost objektů

MiB JS heap po GC (nikoli celková RAM):

| Řádků | Po zahřátí před → po | Po dalších 30 cyklech před → po |
| ---: | ---: | ---: |
| 1 000 | 3,75 → 3,76 | 3,98 → 4,03 |
| 10 000 | 5,72 → 5,75 | 5,94 → 5,96 |
| 100 000 | 24,66 → 24,68 | 24,88 → 24,91 |
| 250 000 | 56,14 → 56,14 | 56,35 → 56,37 |

Paměť nebyla optimalizována; hlavní cena roste s počtem objektů/Date/textů.
Přibližně 0,2 MiB rozdíl po opakování sám neprokazuje leak ani jeho absenci.
Ve všech těchto scénářích zůstalo osm Chart instancí; kód je konstruuje na
startu a potom aktualizuje, nikoli ničí a vytváří při každé obnově. Přibývání
instancí zde nebylo pozorováno. Reálný provoz navíc drží `_lastFullCsv`, quick
CSV a přechodně odpověď/parser; tato čísla proto nejsou horní mez spotřeby.

## Síť, pomalý transport a kompatibilita

`check-interval-browser.py` spouští celý startup a používá skutečné tři
konfigurační soubory, řízený CSV transport se zpožděním 250 ms, fake UV a
zablokované MQTT CDN. Pro každou stanici ověřil quick400 → full1000 a dva
souběžné full požadavky sloučené do jednoho, včetně správného panelu po změně
stanice, slideru20/80, skrytí pro déšť/prázdné datum, darkblue/light a mobil390.
DST fixture má stejnou lokální hodinu se dvěma offsety a správné Δt=1 h.
[Výsledek](stage2/browser.json) rozlišuje fixture bytes od živého přenosu.
Pomalý přenos je konstantní latence, ne model packet loss nebo reálného 3G.

Read-only quick probe současných tří Sheets zdrojů:

| Stanice (index konfigurace) | HTTP | Délka těla | Doba jednoho požadavku |
| --- | ---: | ---: | ---: |
| 0 Praha baterie | 200 | 27 530 B | 1,23 s |
| 1 Praha okno | 200 | 34 624 B | 1,35 s |
| 2 Mšené lázně | 200 | 28 320 B | 0,69 s |

[Výsledek probe](stage2/live-probes.json). Použit stejný quick dotaz LIMIT400;
jde o jednotlivé souběžné požadavky Python klienta v tomto prostředí,
nikoli browser CORS test/propustnost/CDN cache benchmark. Těla nebyla ukládána
ani parserem validována. HTTP200 a text/csv potvrzují tehdejší přístupnost,
ne integritu historie, nasazení firmwaru nebo meteorologickou správnost.

Nové funkce neobsahují fetch. Nezměněné full CSV se stále přenáší celé,
pouze identický obsah přeskočí parser. `fetchAllOv` stahuje CSV ostatních
stanic a parser využije prvních šest logických řádků; limit přenosu zatím
není ověřený kontrakt. Tady může METEO-006 ušetřit podstatně více než úprava DOM.

## Úzká místa a navazující experimenty

- `refreshUI` opakovaně mapuje/skenuje plnou historii pro extrema a denní
  déšť, formátuje klíče dnů, filtruje dnešek. `buildAgg`/další panely mají
  vlastní průchody. **METEO-038:** společný souhrn dle revize dat + lokálního
  dne. Syntetické i skutečné CSV před/po; každý výsledek proti plnému výpočtu.
- Explorer počítá statistiky/redukci z celého výběru. Přesnost zachovat;
  uvažovat cache výsledků podle revize/rozsahu/metriky, nikoli statistiky
  z 800 vizuálních bodů. Při běžném posunu měřit i latenci celého snímku.
- **METEO-005:** pozadí a dlouhý provoz — Page Visibility + jediná obnova
  po návratu, následně několikahodinový soak s přepínáním stanic, heap
  snapshots/retained paths a počty aktivních requestů/timerů. Zatím nezměněno.
- **METEO-004:** do LRU cache nezahrnout bez limitu tři velké historie
  současně s CSV. Stanovit rozpočet počtu řádků/odhadnutých bytes a eviction,
  profilovat špičku parseru. 56 MiB pro jedinou syntetickou historii varuje
  před mechanickým ztrojením; není to přesný odhad RAM telefonu.
- **METEO-048/049:** čas/schema kontrakt před inkrementálním fetch nebo
  novými denními metrikami. Skutečnou historii anonymizovat a otestovat
  opravy starých řádků, smazání, pokrytí a DST, až potom worker METEO-008.

Žádné nové frameworky, workers, produkční závislosti, změny konfigurací
či main. Node suite 63/63, syntaxe inline JS a `git diff --check` prošly.
[Browser smoke](stage2/smoke.json) všech záložek/osmi metrik prošel bez pageErrors/přetečení.
Reálný broker, skutečný mobil, vícedenní soak a naměřené výkonnostní Web Vitals
zůstávají neověřené.
