# Etapa 6 — sdílené roční statistiky, v0.3.1

21. 10. 2026, výchozí revize `bf31182`. Pokračování METEO-038 a oprava
významu srážkových popisků v rámci METEO-017/049; žádná nová ID.

Roční pohled původně při každém otevření seskupoval celou historii do polí
roků, filtroval T/RH/rain/rainInc, znovu počítal měsíce a řadil srážky.
Nyní sdílený snapshot eviduje indexové meze roku a `annualStats` vypočítá
jen požadovaný rok, jednou pro danou revizi dat. Měsíční průměry přebírají
existující součty/počty, roční součet zachovává původní pořadí originálů
(součet zaokrouhlených nebo přeskupených měsíčních průměrů by nebyl shodný).

Cache uchovává malé výsledky pro skutečně načtené a navštívené roky aktuální
stanice. Neobsahuje kopie historie; dočasné pole odkazů rain pro stabilní
sort po výpočtu zaniká. Invalidace používá existující CSV/MQTT/reset/datum
mechanismus. Filtr roku se nepřestavuje při nezměněných možnostech a po
odstranění roku/stanice přejde na „Všechny roky“, prázdná historie ho vyčistí.

## Správnost srážkových výsledků

Číselné výsledky původního algoritmu se nemění. Opravené popisky a tooltipy:

- Maximum denního čítače není roční součet.
- Maximum `rainInc` patří jednomu záznamu, bez doloženého intervalu není
  hodinovým úhrnem. Předchozí komentář o „přibližně hodinových“ záznamech
  neměl podklad v konfiguraci; `CFG.interval` je interval HTTP pollingu.
- Původní sliding okno porovnává hodnotu `rain` nejstaršího dostupného
  záznamu a každého koncového záznamu v okně do 24h, uvnitř jednoho roku.
  Nemá opravu resetů čítače, není integrálem srážek a nepřechází hranici roku.
  Označuje se „Max. rozdíl čítače (≤24h)“, nikoli skutečný 24h úhrn.

Skutečné úhrny zůstávají METEO-017/049 s požadavkem na ověřené jednotky,
reset, význam rain/rainInc a interval/čas měření. Zachování staré aritmetiky
není důkazem fyzikální správnosti původní interpretace.

## Metodika a výsledky

Chromium 154.0.8037.57, skutečný Chart.js 4.4.0 a DOM, viewport 390,
Europe/Prague, offline syntetická pětiminutová historie se zachovaným
extrémem 85. Každý objem nová stránka; pět vzorků, medián bez vyřazení prvního.
Časované běhy postupně bez souběžných testů či dalších prohlížečů.
`--annual --aggregates` přidává všechny roky do profilu souhrnů:

- `coldAnnual`: `invalidateDerivedData(); buildYearlyStats()`, tedy také
  společný snapshot v nové verzi; nejde o studený JIT nebo start browseru.
- `annual`: hned následující opakovaný pohled na stejnou historii, včetně
  sestavení HTML a synchronní výměny DOM. Pozdější layout/paint není časován.
- 30 dalších cyklů přehled/průzkumník/roční pohled, poté heap po GC a počty
  DOM/Chart objektů. Nejde o několikadenní soak ani celou RAM procesu.

| Záznamů | Roční po invalidaci před → po (ms) | Opakované roční před → po (ms) |
| ---: | ---: | ---: |
| 1 000 | 1,9 → 1,4 | 1,4 → 0,3 |
| 10 000 | 9,0 → 5,9 | 8,4 → 0,4 |
| 100 000 | 90,6 → 43,1 | 80,8 → 0,8 |
| 250 000 | 177,2 → 98,9 | 160,7 → 1,2 |

[Před](stage6/before-bf31182.json), [po](stage6/after.json).
CPU×4 při 100k: po invalidaci **384,9 → 204,3ms**, opakované **368,6 → 3,7ms**.
[Před CPU×4](stage6/before-cpu4.json), [po CPU×4](stage6/after-cpu4.json).
CPU throttling není měření fyzického telefonu.

Při250k společný cold refresh **54,1 → 54,2ms**; této části nepřipisovat
zrychlení. Heap po 30 cyklech **56,88 → 56,83MiB**, rozdíl je malý a není
důkazem poklesu celkové RAM. DOM 3307→3307, Chart 8→8. Opakované roční volání
má jednu MutationObserver událost místo dvou (nepřepisuje možnosti filtru).
Nejde o plošné procento zrychlení celého webu. První výpočet velké historie
stále může blokovat hlavní vlákno přibližně100ms, na CPU×4 déle; nyní pouze
po změně dat/invalidaci. Případné dělení práce má nejprve změřit také parser
a interval příjmu dat, ne automaticky přidat Worker nebo další závislost.

## Ověření

**119/119 Node testů**, devět nových v `tests/annual-statistics.test.js`:
nezávislé úplné výpočty všech osmi žebříčků a ročních statistik přes několik
let, přesné floating-point pořadí, rekordové shody, 0/null/nonfinite,
250k bez opakovaného čtení, lazy výběr roku, oprava/smazání staré historie,
CSV/MQTT/reset, prázdný filtr, duplicitní timestampy a reset rain, místní
hranice roku Prague/Los Angeles. Statistiky nejsou z vizuálně redukovaných dat.

[Browser](stage6/browser.json) načetl skutečné tři konfigurace a řízené
CSV/UV. Původní i nová implementace vytvořily stejné T/RH souhrny, všech
osm tabulek i všechny číselné srážkové výsledky pro 1000 záznamů / 3 roky u každé
stanice a po opravě starého měření. Přepínání roku nepřidalo požadavky.
Filtr/empty/removed year prošly, dvě témata a390/1280px bez přetečení či
page errors, vysvětlující tooltip viditelný. Mobilní screenshot zkontrolovaný.
Syntax inlineJS a `git diff --check` prošly.

Reprodukce (Chart.js a dev nástroje podle [README](README.md)):

```bash
git show bf31182:index.html > /tmp/meteo-before.html
python scripts/profile-history.py --annual --aggregates --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --output /tmp/before.json
python scripts/profile-history.py --annual --aggregates --html index.html --chartjs /tmp/meteo-chart.js --output /tmp/after.json
python scripts/profile-history.py --annual --aggregates --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --counts 100000 --cpu 4 --output /tmp/before-cpu4.json
python scripts/profile-history.py --annual --aggregates --html index.html --chartjs /tmp/meteo-chart.js --counts 100000 --cpu 4 --output /tmp/after-cpu4.json
node --test tests/*.test.js
python scripts/check-annual-browser.py --chartjs /tmp/meteo-chart.js --baseline /tmp/meteo-before.html --output /tmp/annual-browser.json
```

Konfigurace, produkční závislosti, workflow a archiv se nemění. Reálný
broker, firmware, skutečná dlouhá CSV historie, síť a živé widgety Pages
nejsou tímto offline testem ověřeny. Publikaci evidovat samostatně.
METEO-038 má hotové sdílení hodin/denních/měsíčních/ročních výsledků;
dostupnost podle měřicího plánu čeká na ověřený kontrakt senzoru. Následuje
METEO-019/020/031 pro vztah teploty a napětí s kvalitou párování, bez SOC či
energie vypočtené pouze z napětí.
