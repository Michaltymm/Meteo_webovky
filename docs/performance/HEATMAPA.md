# Výběr heatmapových buněk po dnech — v0.18.5

2026-10-25, další malá část METEO-008. Výchozí `8e23702` (HTML v0.18.4),
výsledná implementace v commitu tohoto dokumentu. Navazuje na již uložený
profil [heatmapy/vyhlazení/noci](NOCNI_ANALYZA.md). Dokončený model, párování,
noční výběr a vyhlazení se znovu neanalyzují ani nemění.

## Nález a změna

První heatmapa hustých250k dat měla42,7ms synchronního volání, z toho42,1ms
agregace; zbytek DOM/layout/canvas kolem0,6ms. Původní průchod pro každý
záznam formátoval místní datum, hledal jeho index v mapě a dvakrát zjišťoval
hodinu, zvlášť pro T a RH. Není důvod přidávat jinou grafovou knihovnu.

`analyticsHeatCells(source,keys,from,to)` odděluje stejnou agregaci od UI.
Používá existující `localDayBounds` a `historyRangeBounds` pro každý z nejvýše
14zobrazených dnů, s průnikem přesného výřezu. Zdroj je původní sestupně
seřazená historie, klíče stránky nejnovější první. Dny i záznamy prochází
od nejstarších a hodinu čte jednou pro obě veličiny. Žádné formátování data
uvnitř řádkového průchodu. Čas O(d log n+k), d≤14, k počet původních záznamů
vybraných dnů. Paměť buněk zůstává O(24d), bez kopie vybraných řádků.

Pořadí součtů každé buňky je stejné, včetně duplicit a floating-point
zaokrouhlení. Nuly jsou platné, každý senzor má vlastní platnost/count/min/max.
Všechny platné původní hodnoty se započtou, vizuální redukce se nepoužívá.
Prázdné buňky zůstávají prázdné. Částečné dny mají inkluzivní konce, kalendářní
meze nejsou odvozené přičtením24h. Přeskočená hodina nemá vymyšlená data,
opakovaná místní hodina se stejně jako dříve slučuje. Časová zóna zůstává
zónou prohlížeče; tím není vyřešen samostatný kontrakt METEO-048.

Původní cache, její invalidace, stránkování, škála celého výřezu, výběr
metriky, detail, klávesnice a canvas zůstávají. Žádný další request, timer,
závislost nebo změna konfigurací stanic. Výpočet je stále synchronní;
hustá stránka může nadále blokovat hlavní vlákno nad16ms.

## Měření před/po

`scripts/profile-analytics-details.py --heat-only`, Chromium154.0.8037.57,
stejné skutečné lokální SRI knihovny,390×844, Europe/Prague, reduced motion.
Připravený plný model se neměří. Stejné scénáře jako dříve: konec24.10.2026
ve12:00, `regular` po5min, `dense` po100ms (250k≈6,94h), v T/RH null/nuly
a extrém85°C. Jedno zahřátí a pět vzorků s GC před každým, nová stránka na
scénář. Před/po, CPU×4 a testy sekvenčně, žádné překrývání profilů.

Profil přidává stejné dva časové odečty kolem existujícího cold-cache bloku
v obou revizích, bez nahrazení jeho algoritmu. Celé volání zahrnuje DOM,
layout a canvas; rozdíl proti agregaci je synchronní zbytek, nikoli skutečný
paint nebo izolovaný čas GPU. Teplé volání už buňky nepřipravuje. Tabulka
obsahuje mediány ms; mediány fází nemusí v součtu dát medián celku.

| Řádků | Rozložení | Agregace před → po | Celé volání před → po | Teplé před → po |
| ---: | --- | ---: | ---: | ---: |
| 1 000 | regular | 0,6 → 0,2 | 1,2 → 0,6 | 0,3 → 0,3 |
| 1 000 | dense | 0,8 → 0,2 | 1,0 → 0,5 | 0,1 → 0,1 |
| 10 000 | regular | 2,2 → 0,6 | 3,4 → 1,5 | 0,7 → 0,7 |
| 10 000 | dense | 3,3 → 1,5 | 3,7 → 1,7 | 0,2 → 0,1 |
| 100 000 | regular | 3,5 → 0,7 | 4,8 → 1,9 | 0,8 → 0,8 |
| 100 000 | dense | 19,5 → 13,3 | 20,1 → 13,9 | 0,3 → 0,2 |
| 250 000 | regular | 2,4 → 0,8 | 4,0 → 2,0 | 0,7 → 1,0 |
| 250 000 | dense | 42,1 → 23,6 | 42,7 → 24,3 | 0,2 → 0,3 |
| 100 000, CPU×4 | regular | 9,7 → 3,0 | 15,0 → 8,6 | 3,7 → 4,2 |
| 100 000, CPU×4 | dense | 79,1 → 38,2 | 81,8 → 43,3 | 1,0 → 0,9 |

SHA256 celých všech buněk (T/RH sum/count/min/max) a klíčů stránky je shodné
na všech10scénářích. Kontrola identity a pořadí všech zdrojových řádků je
mimo časování. Nejde jen o zaokrouhlené průměry nebo počet bodů.

Zrychlila cold-cache agregace, neprokazuje se zrychlení teplé heatmapy,
sítě, parseru nebo celé stránky/INP. CPU×4 je emulace, nikoli mobil.
Výsledek43,3ms stále není16ms rozpočet. Paměť, peak/RSS, alokace ani
vícedenní stabilita se v této etapě neměřily; nelze tvrdit úsporu celé RAM.

## Testy a checkpoint

`tests/analytics-heat-cells.test.js`:7nových testů, nezávislá původní inline
agregace jako reference, přesné součty/min/max/count včetně nonfinite/-0,
nuly/null, inkluzivní vlastní výřez/duplicity, řídké klíče stránky,
100náhodných vícedenních historií,250kProxy s omezeným počtem čtení a jedním
getHours na vybraný řádek, zmrazený zdroj/cache a bez requestů/timerů.
Skutečné kalendářní dny přes oba DST přechody2026 v Europe/Prague,
America/New_York a půlhodinové Australia/Lord_Howe, navíc UTC. Celá sada
357/357 Node.

Rozšířený skutečný browser harness ověřuje heatmapové buňky proti původním
měřením, výběr klávesnicí, přepnutí T/RH se stejnou cache, starší/novější
stránku a detail bez dalších požadavků. Současně původních100k/9grafů/
3konfigurace/zoom/PNG/320–1440px/obě témata. Výsledek a publikování viz audit.

Celé METEO-008 zůstává Rozpracováno. Další etapa: velký CSV parser podle
existujícího profilu [časování obnovy](CASOVANI_OBNOVY.md), který dokládá
řádově1,7s synchronní práce250k exportu. Rozdělit na menší ověřitelnou část
se zachováním limitů, všech řádků, validačních čítačů a generačních guardů.
Dokončenou heatmapovou optimalizaci neopakovat; případné dávkování husté
heatmapy, nočního výpočtu/vyhlazení, nezávislé výřezy a streaming dále.

## Reprodukce

- [Před1k–250k](heatmapa-before.json), [po](heatmapa-after.json).
- [CPU×4 před](heatmapa-cpu4-before.json), [po](heatmapa-cpu4-after.json).

```bash
git show 8e23702:index.html > /tmp/meteo-heat-before.html
python scripts/profile-analytics-details.py --html /tmp/meteo-heat-before.html --chartjs /tmp/meteo-chart.js --paho /tmp/meteo-paho.js --heat-only --output /tmp/heat-before.json
python scripts/profile-analytics-details.py --html index.html --chartjs /tmp/meteo-chart.js --paho /tmp/meteo-paho.js --heat-only --output /tmp/heat-after.json
```

Pro CPU×4 oba příkazy s `--counts 100000 --cpu 4`. Výchozí ostatní profily
skriptu zůstávají dostupné; tato etapa měří pouze heatmapu.
