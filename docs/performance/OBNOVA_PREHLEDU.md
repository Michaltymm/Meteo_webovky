# Obnova přehledu a výběr posledních 24 hodin — v0.18.10

2026-10-28, další malá etapa METEO-008. Výchozí `7bcd82d` (HTML v0.18.9).
Navazuje na uložený checkpoint skutečného prohlížeče; předchozí parserové
ani analytické etapy se nepředělávaly. Celé METEO-008 zůstává Rozpracováno.

## Zjištění a změna

Profil oddělil studené úplné agregace, DOM mutace a vykreslování Chart.js při
skutečném přijetí velkého CSV. U pravidelné historie zůstává v24h grafu289bodů,
u husté až86401. V hustém250k scénáři před úpravou UI286,3ms, samotný
Chart.update216,1ms; většina času patří kreslení. Měnit znovu parser nebo
přesouvat jeho výpočty do workeru by tento náklad neodstranilo.

Jako malá kompatibilní část byla odstraněna zbytečná kopie celé historie
a její plná filtrace v `buildCharts('now')`. Sheets data jsou seřazená
sestupně: původní `historyRangeBounds` inkluzivně vybere posledních24uplynulých
hodin vzhledem k nejnovějšímu záznamu. Kopíruje se pouze vybraný rozsah,
nikoli všech n řádků. Nativní stabilní sort používá číselné getTime, takže
nedělá opakované implicitní převody Date na číslo. Výběr stojí O(log n+k), následné
řazení původním nativním algoritmem a příprava tří řad závisejí na k.

Vykresluje se **každý původní bod**, žádný downsampling, interpolace, cache
nebo změna schématu. Zachovaná je krajní milisekunda, pořadí duplicit,
null/nuly, původní rosný bod, časová zóna i kategorie původní osy. Statistické
agregace dál čtou úplná validní data a nespoléhají na graf. Vzhled a ovládání
se nemění, nepřidává se request, timer, závislost nebo grafická instance.

Pro `mqtt`/`both` se používá původní plný predikát; není bezpečné předpokládat
řazení při změně hodin nebo přijetí zprávy před budoucím CSV časem. I zde
odpadá zbytečná úvodní spread kopie a comparator je číselný, ale výběr dál
O(n). Celý problém konzistentního streaming snapshotu se touto etapou neřeší.

## Metodika

`scripts/benchmark-refresh-browser.py`, Chromium154.0.8037.57, Europe/Prague,
1280×1000, reduced-motion. Skutečný HTML/DOM a obě knihovny odpovídající SRI.
Automatický start/polling potlačen; původní konfigurace Praha-baterie PCB,
řízená CSV odpověď. Skutečné fetchSheets, stream reader, lexer/validace,
commit, invalidateDerivedData, refreshUI, agregace a Chart.update.
Nejde o VM náhradu UI z předchozích parserových profilů.

Čtyři objemy1k/10k/100k/250k, pravidelný odběr po300s a hustý po1s. T/RH
obsahují nuly/null, srážkový čítač a poznámka jsou deterministické. Časy se
generují jako UTC okamžiky převedené do Europe/Prague: žádné vymyšlené
neexistující jarní02:xx. Legacy CSV zůstává bez offsetu, podzimní dvojí hodina
má stávající parserový význam; časový kontrakt METEO-048 se nemění.

Před každým během reset stanice a původní400řádkový quick snapshot,350ms na
responzivní canvas a GC. Jeden zahřívací +pět měřených plných fetchů.
`forceFullLoad=true` zaručuje skutečný parse/commit stejného exportu.
Kalendářní Date je pevné2026-10-28poledne; performance.now, fronty i další
časovače zůstávají nativní. CPU×4 emuluje pomalejší výpočet, není telefon.
Před/po profily běžely sekvenčně bez souběžných testů/profilů. Finální
profily po doplnění MQTT guardu nahradily průzkumnou variantu bez guardu.

`ui.ms` je stávající synchronní hranice commit/invalidace/report/refreshUI;
neobsahuje následné pomocné stavové aktualizace, resize, paint nebo dojití
všech browser tasků. Wrappery uvnitř oddělují dataAggregates, buildCharts,
Chart.update a další spotřebitele. Časy funkcí jsou **vnořené**, nesčítat
např. buildCharts s Chart.update. „Příprava grafu“ je v každém vzorku rozdíl
buildCharts−Chart.update: zahrnuje výběr, sort, popisky a tři původní řady.
MutationObserver počítá synchronní mutace DOM pouze uvnitř UI hranice;
Chart kreslí do canvasu, jeho práce není DOM mutace. Instrumentace a provoz
prostředí vnášejí režii/variabilitu. Není změřeno INP, Web Vitals, peak/RSS,
fyzický Safari/iOS, živá síť nebo dlouhodobá stabilita.

## Naměřené výsledky

Mediány pěti vzorků, ms; šipka značí před → po. V každém řádku se shodují
všechny tři SHA-256 podpisy (úplné řádky, přesné statistiky/report/DOM, celý graf).

| Řádků | Odběr | Příprava grafu | Chart.update | UI commit/přehled | Celá řízená obnova |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 000 | 300s | 0,4 → 0,3 | 6,2 → 7,5 | 8,6 → 9,9 | 31,1 → 33,6 |
| 10 000 | 300s | 0,6 → 0,3 | 5,9 → 5,8 | 10,7 → 9,9 | 89,8 → 87,1 |
| 100 000 | 300s | 3,3 → 0,3 | 8,2 → 7,1 | 26,3 → 20,8 | 751,6 → 708,5 |
| 250 000 | 300s | 4,6 → 0,3 | 6,0 → 6,7 | 29,4 → 28,8 | 1737,8 → 1878,0 |
| 1 000 | 1s | 0,7 → 0,8 | 10,0 → 13,0 | 14,0 → 16,6 | 36,6 → 45,0 |
| 10 000 | 1s | 3,9 → 3,8 | 32,3 → 51,8 | 41,8 → 61,2 | 113,6 → 140,3 |
| 100 000 | 1s | 37,6 → 25,3 | 224,5 → 232,9 | 283,4 → 274,5 | 1017,9 → 952,7 |
| 250 000 | 1s | 45,7 → 22,5 | 216,1 → 202,9 | 286,3 → 250,5 | 2075,3 → 2088,7 |
| CPU×4 · 100 000 | 300s | 10,9 → 0,5 | 27,7 → 29,6 | 87,0 → 69,1 | 2609,1 → 2684,6 |
| CPU×4 · 100 000 | 1s | 169,1 → 118,1 | 890,6 → 787,1 | 1101,8 → 963,1 | 3607,0 → 3319,4 |

Změřený přínos je v přípravě: u250k pravidelných4,6→0,3ms, u250k hustých
45,7→22,5ms. U běžné historie binární výběr čte méně než400položek místo
250k a kopíruje pouze289bodů; počet skutečně vykreslených bodů se nemění.
Celé UI je dál O(n) kvůli přesným agregacím, žádná obecná sublineární obnova.

Agregace byly měřeny samostatně: pravidelných250k16,5→18,6ms, hustých250k
25,7→21,4ms, CPU×4/hustých100k39,5→35,7ms. Jejich algoritmus se neměnil,
rozdíly nelze přisuzovat optimalizaci. DOM se nezmenšoval: ve250k pravidelném
scénáři v každém vzorku4childList/0characterData/25attribute mutací před i po,
u hustého6/0/25; není prokázána úspora DOM operací. Počet Chart instancí8→8,
jeden update24h grafu při commitu, žádný nový graf nebo request.

Celková obnova není obecně rychlejší: pravidelných250k1737,8→1878,0ms,
hustých10k113,6→140,3ms. I malé UI může kolísat/pomalejší (1k8,6→9,9ms,
hustých10k41,8→61,2ms); většina ceny této malé historie patří nezměněnému
Chart.update, nikoli binárnímu výběru. Tvrdit lze odstranění O(n) výběru
u Sheets a levnější velkou přípravu, ne univerzální zrychlení webu nebo sítě.
Hustých100k na CPU×4 má stále963,1ms UI; graf není v16ms rozpočtu.

Surové profily: [před](obnova-prehledu-before.json), [po](obnova-prehledu-after.json),
[CPU×4 před](obnova-prehledu-cpu4-before.json), [CPU×4 po](obnova-prehledu-cpu4-after.json).
Všechny10scénáře mají přesně shodné kompletní podpisy, ne jen minima/maxima.

## Přesnost a regrese

SHA-256 celých původních řádků (včetně časů/poznámek), všech nezaokrouhlených
denních/měsíčních/ročních rozsahů, dnešních součtů/extrémů/reportu a skutečného
obsahu24h grafu se porovnává po časované práci. Jen checkedAt je normalizován.
Žádné statistiky nejsou vypočítány ze zmenšeného nebo jiného datasetu.

**392/392 Node**,7nových v `tests/current-chart-range.test.js`: původní
full-scan oracle, inkluzivní kraj, starý nejnovější čas, duplicitní pořadí,
null/nuly a frozen vstup,100náhodných nepravidelných historií, prázdno/jeden/
4000shodných časů,250kProxy s<400čteními místo plného průchodu, úplné
statistiky mimo24h, DST3zón a skutečný MQTT handler po budoucím CSV i posunu
hodin zpět. Poslední případ odmítl průzkumnou nechráněnou binární variantu;
finální fallback oběma živým zdrojům zachovává původní výsledek.

Rozšířený `scripts/check-csv-cooperative-browser.py` prošel12k neuspořádanými
řádky v párech shodných časů u všech3původních konfigurací. Ověřuje přesně
všechny popisky a T/RH/rosnýbod vůči starému full-scan algoritmu, V/0/null,
atomický report/commit, callback jednou, coalescing, navigaci a rušení v obou
parserových fázích. Šířky320/1440px bez přetečení, bez pageerror/WebSocketů.
Živé služby ani broker se nekontaktují.

## Další checkpoint

Hustý graf má stále až86401bodů a jeho Chart.update zůstává synchronní.
Žádná záruka16ms nebo obecně rychlejší celé obnovy. Příští malá etapa má
řešit **líné překreslení24h karty podle viditelnosti**, při zachování dirty
stavu a aktuální stanice/dat při návratu. Využít zkušenost současné analytiky,
nevytvářet další datový systém. Samotné omezení počtu bodů musí navázat na
METEO-033/036 (extrémy/gapy a časově správná osa); nynější category osu
nepovažovat za vyřešenou. Parser/comparator této etapy ani dřívější grafové
modely se znovu neanalyzují. METEO-004 cache stanic zůstává samostatné.


## Reprodukce

```sh
git show 7bcd82d:index.html > /tmp/meteo-refresh-before.html
python3 scripts/benchmark-refresh-browser.py --html /tmp/meteo-refresh-before.html --chartjs /path/to/chart.js --paho /path/to/paho.js --output /tmp/refresh-before.json
python3 scripts/benchmark-refresh-browser.py --chartjs /path/to/chart.js --paho /path/to/paho.js --output /tmp/refresh-after.json
```

CPU×4 se spouští pro obě HTML přidáním `--cpu 4 --counts 100000` a samostatnými
výstupními JSON. Nepouštět profily současně ani současně s browser/testy.
Pro porovnání podpisů párovat rows+fixture a porovnat celé objekty sha256.
Knihovny musí odpovídat původnímu SRI; nehledá se za ně jiná verze.
