# Min/max vykreslení 24hodinového grafu — v0.19.1

Dokončení checkpointu METEO-033/036 po v0.19.0 (baseline `4ebb3d4`).
Jde o hlavní a moderní přehled; oba používají stejný graf. Nastavení ESP
(METEO-084) nadále čeká na firmware a zápisové API.

## Implementace a správnost

Do 800 měření zůstává původní úplný renderer. Pro větší 24h výřez se používá
existující `sampleExtrema` se třemi veličinami: teplota, relativní vlhkost,
rosný bod vypočtený ze stejného původního řádku. Nový volitelný režim vrací
indexy; výchozí API i kooperativní generátor ostatních grafů zůstávají stejné.

88 souvislých košů vybírá první minimum, maximum a chybějící vzorek každé
veličiny; navíc oba krajní řádky. Sjednocení je nejvýše **794 původních řádků**
při rozpočtu 800. Zachovává globální i košové extrémy všech tří veličin,
nuly, pořadí shod a původní epochové souřadnice. Nepočítá nové průměry ani
interpolované hodnoty. Řady zůstávají zarovnané a tooltip patří jednomu
původnímu řádku. `sourceIndex` je jen pozice v aktuálním vzestupném 24h výřezu,
nikoli trvalé ID měření nebo index v sestupném store.

Druhý průchod zaznamená i chybějící hodnoty **vynechaných** řádků a původní
časové skoky >3h. U každé veličiny zvlášť označí `breakBefore`. Veřejné
Chart.js `segment.borderColor` skryje takové propojení; nepoužívá interní
`_segments`/`stop` ani falešné nenulové body. Osamocené vzorky mají marker,
legendou skrytá řada se nekreslí. V malém výřezu zůstávají původní null
oddělovače, které se nepočítají mezi měření. Jejich chování se neměnilo.

Při četných chybějících hodnotách může redukce ponechat více oddělených bodů
než souvislých čar. Z přerušení nelze odvozovat přesnou délku výpadku; žádná
čára však nepředstírá kontinuitu přes známý chybějící vzorek. Přesnější výřez
nabízí stávající Průzkumník. Počet zobrazených/původních měření a vysvětlení
jsou pod stávající ikonou podrobností, mimo běžný přehled.

`store.rows`, parser, výběr časového okna, stabilní sort, původní měření,
konfigurace tří stanic a veškeré statistiky zůstávají úplné. Sheets používá
původní binární výběr, MQTT/both původní plný predikát kvůli posunům hodin.
Zachované jsou dirty/IO/resume/fallback a stávající animace podle preference.
Žádný nový fetch, timer, Chart instance nebo závislost.

Pomocná data rendereru jsou omezena rozpočtem; výběr stále vyžaduje O(n)
práci. Generic sampler přečte každý řádek pro tři metriky, další průchod
sestaví body a mezery (Proxy test: přesně 4n přístupů). Nezavádí pole n
odvozených bodů ani prefixové pole, ale původní kopie/sort 24h výřezu zůstává.
Nejde o měření nebo důkaz celkové úspory RAM.

## Ověření

419/419 Node. Sedm nových testů v
[tests/current-chart-sampling.test.js](../../tests/current-chart-sampling.test.js):
nezávislý košový oracle, 100 nepravidelných historií, nuly/null/konstanty,
shodné časy i opakované objektové reference, skutečné mezery, první shody,
plné statistiky a Proxy250k. Původní range testy dál porovnávají **celý vstupní
výřez** s nezávislým full-scanem; kontrola grafu se záměrně mění na původní
podmnožinu. Nevyžadují shodu všech bodů, kterou tato etapa úmyslně nahrazuje.

Rozšířený
[scripts/check-current-chart-visibility-browser.py](../../scripts/check-current-chart-visibility-browser.py)
prošel se skutečným Chromium154/Chart.js/IO a třemi původními konfiguracemi:
12k exporty, 320/767/1440px, obě témata, přepínání stanic a stránek, resume,
fallback, původní tooltip a legendy, malé/velké/prázdné grafy a explicitní DST.
Navíc skutečná barva segmentu potvrzuje, že vynechaný null přeruší jen
postiženou veličinu; >3h skok zůstává přerušený a touch tooltip používá jeden
původní řádek. Zachovaný pixelový test osamoceného bodu a poměr času 1:60.
Původní cooperative CSV browser s třemi konfiguracemi/12k unordered exporty
také prošel. Žádný pageerror/socket. Měřicí transport je lokální a řízený;
živé ESP/API ani fyzický Safari/iOS nejsou ověřeny.

## Výkon před / po

Skutečný CSV fetch/parser/commit a DOM/Chart.js ve stávajícím
[scripts/benchmark-refresh-browser.py](../../scripts/benchmark-refresh-browser.py).
Chromium154, 390×844, Europe/Prague, reduced-motion, původní Praha-baterie PCB,
řízená pravidelná300s/hustá1s CSV, stejné 400řádkové seed/reset, GC a350ms
na responsive resize. Graf je před každým vzorkem skutečně viditelný.
Startup potlačen stejně u obou HTML, IO inicializován explicitně. Kalendářní
Date je pevné2026-10-28poledne; performance.now a fronty zůstávají nativní.
Jedno zahřátí + pět vzorků na scénář. Obě varianty se po přerušení změřily
znovu v tomto běhu, sekvenčně bez souběžných testů nebo jiných profilů.

Mediány ms, před → po. Příprava = buildCharts minus jeho Chart.update
v jednotlivých vzorcích; nejde o součet nezávislých časů.

| CPU / odběr | Řádků historie | UI commit | Příprava grafu | Chart.update | Celý load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1× / 300 s | 1 000 | 8,5 → 7,6 | 0,3 → 0,3 | 5,3 → 4,7 | 29,5 → 28,7 |
| 1× / 300 s | 10 000 | 10,0 → 10,9 | 0,3 → 0,3 | 4,1 → 4,6 | 70,5 → 75,1 |
| 1× / 300 s | 100 000 | 16,2 → 18,1 | 0,2 → 0,3 | 4,0 → 4,1 | 671,3 → 653,5 |
| 1× / 300 s | 250 000 | 24,9 → 23,9 | 0,3 → 0,2 | 3,7 → 4,8 | 1686,3 → 1708,6 |
| 1× / 1 s | 1 000 | 9,6 → 13,1 | 0,6 → 1,0 | 5,6 → 8,2 | 34,1 → 41,9 |
| 1× / 1 s | 10 000 | 34,9 → 20,5 | 5,4 → 4,8 | 21,5 → 9,5 | 111,7 → 88,6 |
| 1× / 1 s | 100 000 | 86,2 → 61,6 | 30,8 → 38,6 | 44,5 → 10,6 | 754,6 → 687,1 |
| 1× / 1 s | 250 000 | 98,5 → 67,9 | 25,3 → 37,6 | 52,7 → 9,7 | 1777,2 → 1729,3 |
| 4× / 1 s | 100 000 | 377,0 → 223,2 | 125,8 → 136,8 | 186,2 → 48,2 | 2710,5 → 2411,6 |

Hustých100k nyní předává Chart.js601 místo86 401 vzorků. Chart.update
44,5→10,6ms, UI86,2→61,6ms. CPU×4 má Chart186,2→48,2ms a UI377→223,2ms.
Příprava grafu ale v hustých100k vzrostla30,8→38,6ms: více průchodů zajišťuje
přesný výběr a mezery. Malé husté1k je pomalejší: UI9,6→13,1ms,
Chart5,6→8,2ms; pravidelných100k UI16,2→18,1ms. Není to univerzální zrychlení,
záruka16ms/INP ani vyřešení celého CSV pipeline. Další optimalizace má řešit
především synchronní přípravu, ne opakovat hotové omezení vykreslení.

V pravidelné historii je ve 24h okně 289 vzorků; v hustých100k/250k
86 401 vzorků před redukcí. Všechny statistiky dál zahrnují celou historii.
`UI` je původní synchronní commit, nikoli paint/INP nebo první návštěva grafu.
Celý load zahrnuje i CSV, parser a fronty; nelze jej zaměňovat s Chart.update.
Skrytá větev se neměnila a zůstává ověřena funkčním IO testem.

Po vzorcích se mimo časování ověřují SHA celých řádků, přesných agregací,
validačního reportu (jen checkedAt=0), vyjmenovaných DOM hodnot v harnessu
a **úplných původních měření ve výřezu**. Před/po mají tyto podpisy shodné.
Hash redukovaného grafu se záměrně liší. Každý vykreslený bod se navíc ověří
proti původnímu řádku a každá mezera proti plnému intervalu; všechny extrémy
T/RH/Td se musí shodovat. Statistiky se neověřují jen ze sampled dat.
Počet instancí osm, jeden full fetch a jedna Chart.update na měřený commit
zůstávají stejné. Nejde o Web Vitals nebo profil paměti/fyzického mobilu.

Surová data: [před](24h-minmax-before.json), [po](24h-minmax-after.json),
[CPU×4 před](24h-minmax-cpu4-before.json), [CPU×4 po](24h-minmax-cpu4-after.json).
Reprodukce: `git show 4ebb3d4:index.html > /tmp/meteo-before.html`, potom
stejný benchmark s `--html /tmp/meteo-before.html` a `--html index.html`;
`--view visible --counts 1000,10000,100000,250000 --fixtures regular,dense`.
CPU profil: `--counts 100000 --fixtures dense --cpu 4`. Oba běhy vyžadují
místní kopie původních Chart.js/Paho odpovídající SRI v HTML.

## Další krok

Neopakovat hotovou redukci, časovou osu, parser nebo IO. Navazující METEO-008
řeší zbylou synchronní přípravu velkého výřezu a úplné agregace podle
naměřeného dopadu; případné dávkování musí zachovat dirty stav a guard aktuální
stanice/dat. Změna na asynchronní cestu ani worker zde implementované nejsou.
METEO-084 zůstává nezávisle BLOCKED pro živé řízení ESP bez firmware/API.
