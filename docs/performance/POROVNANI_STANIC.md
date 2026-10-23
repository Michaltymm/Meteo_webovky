# Dávkované porovnání stanic — v0.18.2

METEO-008, druhá část; výchozí `9fd455b` / v0.18.1. Hotová příprava společného
modelu zůstává zachovaná. Profiluje se nová hranice: příprava karty8 nad již
připraveným modelem a dvěma kompaktními historiemi ostatních stanic.

## Zjištění a zvolená změna

U250k řádků a posunu časů+5s zabral synchronní průchod149,5ms, z toho samotné
párování140,5ms (~94 %), výběr bodů2,8ms. Shodné časové značky mají rychlou
větev; při250k celý průchod53,7ms, párování44,5ms. CPU×4/100k posunuté značky
266,0ms. To odůvodňuje rozdělení přípravy; parser, síť ani worker se nepřidávají.

`analyticsMatchSteps` zachovává původní monotónní algoritmus i pořadí operací:
nejbližší dostupný čas do10min, při shodě dřívější, každý záznam nejvýše jednou,
bez interpolace a bez hledání globálního optima. Přidané kontrolní body po512
aktivních záznamech nemění součty/počty/průměry. `analyticsColumnPointSteps`
zachovává původní vizuální min/max výběr, jen umí přerušit průchod po1024
hodnotách. Synchronní API dokončí stejné generátory; druhý algoritmus nevzniká.

`analyticsComparisonSteps` nejprve vybere konečné teploty ze všech původních
řádků modelu, potom připraví řady a úplné párování. Statistika nepoužívá
redukované grafické body. Jedno dočasné pole odkazů na konečné teploty jako
u původního filter, nikoli kopie řádků či třetí cache historie.

UI používá dávky pro **Sheets a společný výřez**, pokud aktivní model nebo
časově vybraná část některé cizí historie má alespoň10k řádků. Malé/nezávislé
výřezy a MQTT/both zůstávají synchronní; rychlý stream nesmí neustále rušit
nedokončený výsledek. Všechny tři dodané konfigurace jsou nadále Sheets.

Jeden `comparisonJob` pro kartu8, společný `analyticsWorkSlice` s modelovou
úlohou: ~8ms/max64 kontrolních kroků, další dávka přes setTimeout(0). Kontrolní
bod, GC a plánování mohou rozpočet překročit. Není to záruka16ms snímku ani
paralelní výpočet. Porovnání má stav přípravy/aria-busy, staré plátno skryté
a PNG zakázané do překreslení; ostatní karty se neskrývají ani nepřepočítávají.

## Životní cyklus a správnost

- Úloha nese relaci stanice, identitu modelu/zdroje/délku, časové meze a
  snapshot dvou cache referencí, loading/error stavu. Vše ověřuje před dávkou
  a zveřejněním. Zveřejní se až celé porovnání a jeho podpis, nikdy část párů.
- Invalidace modelu, změna dat/období/stanice, odchod nebo skrytí stránky
  uzavřou generátor a zruší timer. Starý callback nemůže znovu vytvořit graf.
- Výměna/evikce cizí cache, změna jejího zdroje nebo loading/error evidence
  zneplatní starou práci. Viditelná karta připraví nový snapshot, žádný nový
  síťový požadavek kvůli přepočtu. Cache samotná se zachovává; rušení výpočtu
  nepřeruší její samostatné načítání.
- Neúspěšná obnova nadále ukáže původní cache s původním časem a vysvětlením.
  Selhání samotného výpočtu zobrazí obecnou chybu; bez textu výjimky a bez
  nekonečného opakování stejného snapshotu. Nová historie/obnova dovolí nový pokus.
- Hotový výsledek se memoizuje na jednom modelu. Cache reference jsou v relaci
  neměnné; případné budoucí úpravy typed arrays na místě musí výslovně invalidovat.
  Limit16MiB je rozpočet Map cache, nikoli veškeré RAM včetně transientních referencí.

## Měření před/po

`scripts/profile-analytics-comparison.py`, Chromium154.0.8037.57,390×844,
Europe/Prague. Stejný připravený model, dvě již načtené kompaktní historie,
1k/10k/100k/250k; duplicitní timestampy, null/nuly a85°C extrém. Dva scénáře:
shodné časy a+5s u obou cizích stanic. Posun ořízne nejnovější krajní řádek
mimo výřez, test proto nepředpokládá automaticky stejné velikosti obou zdrojů.

Jedno zahřátí,5vzorků/medián a GC před každým, před/po sekvenčně bez jiných
profilů/testů. Časované callbacky zahrnují přípravu porovnání a řízení úlohy;
hlavní model/CSV/síť/Chart/layout/paint jsou mimo. Žádné tvrzení o INP nebo
fyzickém telefonu. SHA-256 nad všemi datasety/popisky a **nezaokrouhlenými**
výsledky obou párování je přesně shodné před/po pro každý objem/scénář/CPU.
Ověřeny původní reference/pořadí, úplné počty a nejvýše600bodů na řadu.

| Řádků | Posun | Nejdelší blok před → po (ms) | Celé dokončení před → po (ms) | Součet bloků před → po (ms) |
| --- | --- | --- | --- | --- |
| 1 000 | 0s | 2,6 → 1,1 | 2,6 → 1,1 | 2,6 → 1,1 |
| 1 000 | 5s | 2,1 → 3,0 | 2,1 → 3,0 | 2,1 → 3,0 |
| 10 000 | 0s | 4,7 → 5,4 | 4,7 → 5,7 | 4,7 → 5,5 |
| 10 000 | 5s | 16,0 → 7,5 | 16,0 → 7,6 | 16,0 → 7,5 |
| 100 000 | 0s | 22,4 → 4,9 | 22,4 → 52,6 | 22,4 → 32,0 |
| 100 000 | 5s | 61,6 → 8,2 | 61,6 → 104,1 | 61,6 → 75,0 |
| 250 000 | 0s | 53,7 → 4,0 | 53,7 → 146,9 | 53,7 → 64,5 |
| 250 000 | 5s | 149,5 → 8,5 | 149,5 → 281,8 | 149,5 → 178,9 |

Menší blokování má cenu delšího dokončení:250k/+5s +132,3ms (~88 %), CPU
+29,4ms (~20 %). Nejde o zrychlení celé analýzy. Nejhorší nový blok ze všech
pěti250k/+5s vzorků9,6ms; u shodných časů5,2ms. Rozdíly malých vzorků i obou
směrů zahrnují JIT a variabilitu prostředí. Kontrolní body byly v průzkumném
běhu256, finálně512 kvůli zbytečnému počtu krátkých úloh; tabulka je finální profil.

CPU×4/100k: shodné časy blok102,7→12,9ms a celek102,7→214,7ms; posunuté
blok266,0→9,6ms a celek266,0→445,2ms. Nejhorší nový blok napříč oběma
scénáři14,1ms. Časový rozpočet je měkký, nikoli tvrdých8ms.

Heap poGC250k/+5s31 817 752→31 902 908B, shodné31 784 620→31 894 192B.
Není to peak/RSS/GPU ani důkaz nulového úniku. Dataset je jiný než profil
hlavního modelu, velikosti heapu mezi těmito dvěma dokumenty se nesrovnávají.
Vícedenní provoz, fyzické Safari/iOS a živé externí služby nebyly měřeny.

## Reprodukce a navazující práce

Ověření: **332/332 Node**,11nových regresí v
`tests/analytics-comparison-cooperative.test.js`: úplný výsledek/cache,
nezávislé/streaming/small větve, hustá cizí historie, rušení/pozdní callbacky,
reset A→B→A, výměna/evikce/změna zdroje cache, loading/error snapshot,
nedostupný časovač, selhání/obnova a PNG. Starší400náhodných historií proti
nezávislému párovacímu oraclu nadále prochází přes stejný algoritmus.

Rozšířený `scripts/check-analytics-cooperative-browser.py` prošel se skutečným
DOM/Chart.js/Paho se SRI a řízenými CSV/UV. Model100k a9grafů, všechny3původní
konfigurace s0/nullV, zoom/reset a PNG. Nově100k porovnání: busy jen karta8,
ostatní grafy/export dostupné, bez částečného výsledku/requestů navíc,
pozdní callback po výměně cache a odchodu se nepoužije, platný PNG po dokončení.
Čtyři rozložení320/1440px×2témata pro model i porovnání, žádný pageerror nebo
WebSocket. Původní info harness také prošel včetně1500ms hoveru, klávesnice
a dotyku. Není to ověření živých služeb/brokeru nebo fyzického Safari/iOS.

```bash
git show 9fd455b:index.html > /tmp/meteo-comparison-before.html
python scripts/profile-analytics-comparison.py --html /tmp/meteo-comparison-before.html --chartjs /tmp/chart.js --paho /tmp/paho.js --output /tmp/comparison-before.json
python scripts/profile-analytics-comparison.py --html index.html --chartjs /tmp/chart.js --paho /tmp/paho.js --output /tmp/comparison-after.json
```

CPU×4 doplní `--cpu 4 --counts 100000`. Surová data:
[před](comparison-before.json), [po](comparison-after.json),
[CPU×4 před](comparison-before-cpu4.json), [CPU×4 po](comparison-after-cpu4.json).

METEO-008 zůstává rozpracované. Následuje profil zbývajících synchronních
heatmapových buněk/vyhlazení/noční analýzy; velký CSV parser má samostatnou
cenu z předchozích měření. Worker/persistence, nezávislé výřezy a konzistentní
streaming snapshot vyžadují další etapu, nikoli snížení přesnosti výpočtů.
