# Etapa 11 — podklady hodinových průměrů, v0.8.0

21.–22. 10. 2026, výchozí `26af1c1` / v0.7.0. Navazující část METEO-063:
původní měření hodinových průměrů v Porovnání dnů. Hotové METEO-077
a dosavadní výsledky analytiky se znovu neimplementují ani neauditují.

## Funkce a správnost

Kliknutí na konkrétní bod grafu otevře správný den, místní hodinu a veličinu.
Stejný výběr je dostupný klávesnicí v nativním rozbalovacím panelu. Teplota,
vlhkost i tlak mají nezávislou validitu; tabulka obsahuje také vynechané řádky,
nuly a duplicity. Chybějící hodina nemá vymyšlené měření ani průměr. Součet,
počet a podíl pocházejí z úplné původní agregace, nikoli z viditelné stránky.
Panel uvádí i zaokrouhlený bod grafu, vzorec, verzi, časovou zónu a vysvětlení,
že průměr není vážen dobou mezi vzorky. Hodnoty tabulky se nezaokrouhlují.

`hourlyDay` si během dosavadního průchodu uloží pro každou hodinu pouze
souvislé rozsahy zdrojových indexů. Nemění pořadí sčítání: časy vzestupně,
shodné časy v původním pořadí, zaokrouhlení průměru stále na jedno místo.
Rozsahy zahrnují i nečíselné hodnoty. Je jich více, pokud stejnou místní
hodinu přeruší jiná hodina při posunu času; žádný předpoklad UTC intervalu
o délce 60 minut. Ověřeny Praha, půlhodinový Lord Howe i dvouhodinový Troll.

Výpis stránkuje po 50 řádcích v sestupném pořadí historie. Nad připravenou
hodinovou cache čte pouze stránku; práce O(s+p), s je počet souvislých úseků
hodiny, p≤50. Nevzniká kopie historie, dne ani seznam indexů všech měření.
Zavřený výpis nepřidává čtení původních řádků při opakovaném porovnání.
LRU zůstává osm dnů; otevřený výpis může držet jeden malý souhrn i po jeho
vytěsnění, pouze do zavření či invalidace stejného snapshotu.

Při CSV/MQTT, změně stanice, opravených/smazaných datech či výběru porovnání
se staré řádky odstraní a reference uvolní. Před stránkováním se kontroluje
snapshot, identita/délka zdroje, stanice, místní den, výběr dnů i veličiny.
In-place změny dat nadále vyžadují `invalidateDerivedData`. Pořadové číslo
platí jen pro aktuální historii; není trvalé backendové ID. Časy mají
dosavadní sekundovou přesnost zobrazení a UTC offset (interní milisekundy
zůstávají ve zdroji). Explicitní zóna stanice a revize zdroje jsou další úkoly.

## Cílené měření

Skutečný Chromium 154.0.8037.57, Chart.js 4.4.0, 390×844, Europe/Prague,
CPU×1. Stejný profil `--comparison` před a po: 1k a 250k syntetických řádků
po pěti minutách, pět vzorků/medián bez vyřazení prvního. Běhy sekvenční,
bez souběžných browserů/testů. První porovnání zahrnuje invalidaci a nový
sdílený souhrn, opakované cache. Měřen synchronní JS/DOM/Chart update,
nikoli paint, skutečné CSV, síť nebo Web Vitals.

| Řádků historie | První porovnání před → po (ms) | Opakované před → po (ms) | Otevření podkladů (ms) | Další stránka (ms) |
| ---: | ---: | ---: | ---: | ---: |
| 1 000 | 7,5 → 6,8 | 4,0 → 4,9 | 1,1 | 0,6 |
| 250 000 | 23,3 → 25,0 | 4,7 → 5,3 | 1,4 | 0,6 |

[Před](stage11/before-26af1c1.json), [po](stage11/after.json).
Nová funkce má malou režii; nejde o tvrzení zrychlení původního grafu.
Rozdíly jednotlivých lokálních vzorků nejsou SLA pro fyzický mobil.

Doplňkové `--hour-records` běží až po základních měřeních a 30 cyklech.
Používá zvláštní hustou historii s 10ms rozestupy v jediné hodině, aby i 1k
scénář měl více stránek a 250k ověřil velkou hodinu. Nemění tím základní
profil. Obě details jsou otevřená, viditelnost tabulky ověřená; native toggle
proběhne před časováním. V DOM je 50 řádků, otevření má 10 změn uzlů/textu,
další stránka 2. MutationObserver nesleduje atributy. Nejde o čas prvního
kliknutí až do vykreslení. Proxy regresní test navíc potvrzuje přesně 50
čtení na další stránku a méně než 100 při otevření nad hotovou cache.

Zahřátý základní 250k profil: heap 59 301 372 → 59 330 404 B, DOM 2196 → 2461
uzlů; po 30 cyklech 2462 uzlů, stále osm grafů. Přibylo statické ovládání
a možnosti výběru, ne DOM za každý záznam. HTML bez komprese +11 755 B.

V doplňkovém 250k scénáři po otevření 28 694 272 B / 2908 uzlů, po zavření
28 694 516 B / 2908 uzlů, po 20 otevřeních/stránkách/zavřeních
28 704 292 B / 2908 uzlů, stále osm grafů. Odlišný heap proti základnímu
profilu vyplývá z jednodušší samostatné fixture; není paměťovou optimalizací.
Tělo tabulky je po zavření prázdné a stav null; CDP počty neklesly okamžitě.
Nelze tvrdit okamžité uvolnění veškeré nativní paměti nebo vícedenní stabilitu.

## Browser

[Ověřený výsledek](stage11/browser.json): tři původní konfigurace, řízené
CSV/UV a skutečný Chart.js. Tři veličiny s nezávislým součtem/počtem/průměrem,
chybějící senzory, nuly a duplicity. Vybraná hodina má480původních záznamů,
v DOM50. Otevření Enterem i kliknutím na skutečný bod, stránky, prázdná
hodina/den, volby a skutečná oprava CSV s invalidací. Žádné další HTTP nebo
grafy, žádný page error. Obě témata320/390px bez celostránkového přetečení,
horizontální region posouvatelný klávesnicí. Screenshot prohlédnut.

První kontrola testu zachytila nestabilní rozměr ihned po resize viewportu;
harness nyní čeká150ms na stávající Chart.js ResizeObserver. Produkt se
kvůli tomu neměnil. Měření výkonu proběhlo před browser integrací.

## Regrese a reprodukce

**180/180 Node testů**, z toho 15 nových v `tests/hourly-records.test.js`:
originální hodnoty/nezávislá validita/nuly/duplicity, plné i krajní stránky,
prázdné hodiny, nezměněné úplné součty, 250k omezená čtení, LRU, invalidace
CSV/MQTT/stanice/opravy/výběru, XSS, přechod bodu grafu na podklady a tři
zóny se změnami času. Původní testy výpočtů zachovávají shodu s plným
stabilním řazením; testy nezavádějí křehké limity milisekund.

```bash
git show 26af1c1:index.html > /tmp/meteo-stage11/before.html
python scripts/profile-history.py --html /tmp/meteo-stage11/before.html --chartjs /tmp/meteo-pages-validation/chart.js --comparison --counts 1000,250000 --output /tmp/meteo-stage11/before.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-pages-validation/chart.js --comparison --hour-records --counts 1000,250000 --output /tmp/meteo-stage11/after.json
node --test tests/*.test.js
python scripts/check-hourly-records-browser.py --chartjs /tmp/meteo-pages-validation/chart.js --output /tmp/meteo-stage11/browser.json
```

Playwright/Chromium jsou volitelné vývojářské nástroje. Nová produkční
závislost, síťový požadavek, Chart instance ani změna konfigurace nepřibyla.
Živý broker, služby, firmware, fyzický mobil a přímé widgety Pages tímto
nejsou ověřeny; nasazení se dokládá samostatně v roadmapě a auditu.

Po původním úspěšném běhu180/180 (21.10.) selhal22.10. CI build #19 ve fázi
testů. Místní179/180 odhalilo chybu inicializace testovacího času v
background-refresh a reprodukovalo ji i s původním HTML26af1c1. Fixture nyní
synchronizuje počáteční den po instalaci mockDate; žádný zásah do webu ani
důvod opakovat browser/časování. Výsledek následného běhu je v roadmapě.
