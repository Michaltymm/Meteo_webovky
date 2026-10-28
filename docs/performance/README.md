# Reprodukce měření výkonu

[Skutečná obnova přehledu a výběr 24h grafu](OBNOVA_PREHLEDU.md): další část
METEO-008, původní CSV fetch/parser/commit, skutečné DOM/agregace/Chart.js,
1k–250k pravidelných/hustých řádků a CPU×4. Stejná všechna data, statistiky
i celý graf; levnější příprava není příslib obecně rychlejší obnovy.

[Číselné porovnávání CSV časů](CSV_RAZENI.md): další část METEO-008,
stejný nativní stabilní sort bez implicitních Date převodů;1k–250k,
neuspořádané100k/250k a přesná shoda všech dat/reportů. Celková obnova
není obecně rychlejší a sort zůstává souvislý.

[Dávkovaná validace CSV řádků](CSV_VALIDACE.md): další část METEO-008,
filtrace/převod po dávkách, přesná data/reporty1k–250k a neuspořádané100k.
Nativní sort měřen zvlášť, zůstává souvislý; celkové zrychlení se netvrdí.

[Dávkované čtení CSV polí](CSV_LEXER.md): první část velkého aktivního Sheets
parseru v METEO-008, lexikální dávky a přesná shoda1k–250k. Validace/řazení
zůstávají souvislé; celé načítání zatím není plynulé ani obecně rychlejší.

[Denní výběr heatmapových buněk](HEATMAPA.md): další část METEO-008,
samostatná agregace a celé cold/warm volání1k–250k, CPU×4; přesná shoda
všech T/RH buněk, zachované místní dny a DST. Hustá data zůstávají synchronní.

[Jednoprůchodové vyhlazení](VYHLAZENI.md): další část METEO-008, přesně stejné
průměry i vybrané body bez plného dočasného pole;1k–250k, CPU×4 a samostatný
vzorkovaný odhad alokací. Výpočet všech původních průměrů nadále O(n).

[Noční analýza a profil zbývajících grafů](NOCNI_ANALYZA.md): třetí část
METEO-008, výběr jediné noci binárními mezemi; přesná shoda1k–250k iCPU×4,
včetně husté noční historie, která nadále vyžaduje průchod všemi jejími body.

[Dávkované porovnání stanic](POROVNANI_STANIC.md): další část METEO-008;
shodné/posunuté časy,1k–250k,CPU×4, cena párování a přesná shoda výsledků.
Čeká jen karta porovnání, menší bloky mohou prodloužit celkové dokončení.

[Dávkovaná příprava analytického modelu](ANALYTICKY_MODEL.md): první část
METEO-008; blokování a celé dokončení před/po na1k–250k, CPU×4 a přesná shoda
souhrnů i vizuálních bodů. Menší blokování může prodloužit celkové čekání.

[MQTT diagnostika](MQTT_DIAGNOSTIKA.md): skutečný handler před/po s historií
1k–250k, přijaté/odmítnuté dávky a zachování původních řádků; žádný živý broker.

[Režie časování obnovy](CASOVANI_OBNOVY.md): celý načítací pipeline ve VM
před/po na 1k–250k, zachování hodnot a cena omezeného snapshotu; skutečný browser
ověřuje zvlášť hranice fází a ovládání.

[Čítače validace CSV](VALIDACE_CSV.md): cena aktivní diagnostiky parseru před/po
na 1k–250k záznamech, zachování hodnot a velikost omezeného reportu.

[Stav a stáří dat](STAV_DAT.md): skutečný DOM/Chart.js před/po na 1k–250k
měření; cena minutové aktualizace a opakovaného refresh, beze změny řádků/grafů.

[Volba karet moderního přehledu](MODERNI_KARTY.md): režie synchronizace před/po na1k–250k měření; samostatně ověřen nulový přírůstek fetch/grafů.

[Bezpečnostní limity parseru](SECURITY.md): kontrola před/po na1k–250křádcích a přesné hranice odmítnutí vstupů.

[Etapa 13 — Analytické grafy](ETAPA13.md) měří nový přehled devíti karet,
zachování hlavního dashboardu a paměť při 1k/10k/100k/250k, včetně CPU×4.

[Etapa 12 — podklady teplotních extrémů](ETAPA12.md) měří cenu doplněných
čítačů a O(1) zobrazení původního maxima/minima i při250k shodách.

[Etapa 11 — podklady hodinových průměrů](ETAPA11.md) ověřuje přímý výpis
původních měření, cenu porovnání před/po a stránkování husté 250k hodiny.

[Etapa 10 — původní T/V záznamy](ETAPA10.md) dokládá líný výpis po50řádcích,
čtení jen mezí/stránky, cenu otevření a životní cyklus při zavírání.

[Etapa 9 — denní citlivost T/V](ETAPA9.md) měří cenu nového výpočtu,
cache a stav DOM/heap/grafů při1k/10k/100k/250k původních párů.

[Etapa 8 — rozklad změny RH](ETAPA8.md) ověřuje navazující endpointový výpočet,
dvě čtení i při250k a cílené srovnání průzkumníku/slideru před a po změně.

[Etapa 7 — analytika T/V, AH/VPD a omezení pohybu](ETAPA7.md) odděluje
měření běžných pohledů před/po od provozní ceny nového analytického modulu.

[Etapa 6 — sdílené roční statistiky](ETAPA6.md) měří první i opakovaný roční
pohled, shodu všech tabulek s původní verzí a vysvětluje meze srážkových čítačů.

[Etapa 5 — hodinové agregace a podklady](ETAPA5.md) přidává porovnání dnů,
LRU osmi dnů a počty/rozložení záznamů; měření první i opakované návštěvy.

[Etapa 4 — sdílené souhrny a obnova na pozadí](ETAPA4.md) navazuje na v0.2.1:
profil s invalidovanou i opakovaně použitou cache, mobilní viewport, CPU×4,
heap a kontrola periodických požadavků při změně viditelnosti.

Novější [etapa 2 — historie, paměť a DOM](ETAPA2.md) obsahuje 1k/10k/100k/250k,
CPU×4, surové JSON, 30 cyklů a integrační ověření tří stanic. Níže zůstává
původní metodika a historie etapy 1.

Etapa 1, 20. 10. 2026. Výchozí revize `c0bfddf`, výsledná implementace uvedena
v commitu obsahujícím tento dokument. Surová měření:

- [before-c0bfddf.json](before-c0bfddf.json)
- [after.json](after.json)

Metodika a výsledná tabulka jsou v [roadmapě](../NAPADY_A_ROADMAP.md#etapa-1--ověřené-výsledky).
Test používá skutečný DOM a Chart.js 4.4.0. Data generuje pouze uvnitř testovací
stránky, startovní síťové operace potlačí, všechna externí spojení zablokuje.
Zdroj Chart.js je dodán lokálně; produkční build jej tímto nepřebírá.

Požadavky na ruční benchmark: Python s Playwright, Chromium na `/usr/bin/chromium`.
Nejsou to produkční závislosti a nejsou nutné pro Node testy.

```bash
git show c0bfddf:index.html > /tmp/meteo-before.html
curl --fail --location https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js --output /tmp/meteo-chart.js
python scripts/benchmark-browser.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --output /tmp/meteo-before.json
python scripts/benchmark-browser.py --html index.html --chartjs /tmp/meteo-chart.js --output /tmp/meteo-after.json
node --test tests/*.test.js
```

Každý objem 1k/10k/100k používá novou stránku. Pět opakování, bez vyřazování
prvního běhu; souhrn uvádí medián. Každý čas zahrnuje synchronní volání,
např. `refreshUI`, `buildExplorer`, `expSliderUpdate`, včetně skutečného
Chart.js update. Po měření je 350ms odstup kvůli původní animaci.

`current.updates` počítá Chart.js aktualizace během `refreshUI`, nikoli všechny
pozdější resize callbacky. `explorer.stats` zachycuje skutečný text statistik,
`explorer.points` počet kategorií grafu. Zvlášť se kontroluje mobilní šířka
390 px. Výsledný běh má navíc smoke průchod všech záložek a osmi veličin
průzkumníku; původní uložený běh tuto dodatečnou kontrolu ještě neobsahuje.
Ta probíhá po časovaných vzorcích a nemění jejich metodiku.

Stroj není fyzický telefon. Jde o lokální headless Chromium bez CPU throttlingu;
výsledky nejsou SLA pro konkrétní zařízení. Změna cache uchovává jeden výběr
referencí na měření; RAM nebyla změřena. Rychlost sítě, LCP, INP, CLS a životní
cyklus skutečných Google Sheets/MQTT služeb vyžadují samostatné měření.

Výkonnostní testy Node mají funkční assertions (extrémy, celé statistiky,
hranice rozsahu, invalidace, cache, 250k bez RangeError), nikoli křehké časové
limity na sdíleném CI stroji.
