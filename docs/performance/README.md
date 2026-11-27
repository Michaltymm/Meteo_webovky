# Reprodukce měření výkonu

## Prohlížečová regrese analytiky (METEO-056)

Spusť z kořene projektu s Playwrightem, Chromium v `/usr/bin/chromium`
a lokálními kopiemi Chart.js a Paho ve verzích z `index.html`.

```sh
python scripts/check-analytics-browser.py --chartjs "$chartjs" --output /tmp/meteo-battery.json
python scripts/check-analytics-grid-browser.py --chartjs "$chartjs" --paho "$paho" --output /tmp/meteo-grid.json
```

Syntetická CSV a odpovědi služeb pokrývají všechny tři konfigurace. První
scénář ověřuje výpočty baterie a vlhkosti, zdrojové řádky a stránkování.
Druhý ověřuje devět karet, nápovědu myší, klávesnicí a dotykem, opakované
uvolnění grafů a práci s chybějícími daty. Výsledky a snímky se uloží vedle
zadaného výstupu. Pro měření latence a paměti slouží samostatné profily níže.

## Výkonnostní profily

[Dávky regrese napětí](DAVKY_REGRESE_NAPETI.md) měří zkrácení souvislé práce
u hustého třídenního okna při zachování predikce (METEO-008/046).

[Regrese napětí Průzkumníku](REGRESE_NAPETI_PRUZKUMNIKU.md) měří
zrychlené sestavení stejných řad a predikce na 1k–250k řádcích (METEO-008/046).

[Dávky při otevření rozsahu Průzkumníku](DAVKY_ROZSAHU_PRUZKUMNIKU.md)
měří odezvu při změně období a celé dokončení pro 1k–250k řádků (METEO-008).

[Dávky posuvníku Průzkumníku](DAVKY_POSUVNIKU_PRUZKUMNIKU.md) porovnávají
bloky hlavního vlákna a celé dokončení potvrzených výřezů (METEO-008).

[Výběr bodů a statistiky Průzkumníku](VYBER_A_STATISTIKY_PRUZKUMNIKU.md)
měří sdílený průchod při potvrzení výřezu s 1k–250k měřeními (METEO-008).

[Posuvník Průzkumníku](POSUVNIK_PRUZKUMNIKU.md) rozlišuje výběr vzorků,
souhrny a Chart.js při tažení výřezů s 1k–250k měřeními (METEO-008).

[Statistiky Průzkumníku](STATISTIKY_PRUZKUMNIKU.md) ověřují shodu souhrnů
a grafů a odstranění dočasných řad pro 1k–250k měření (METEO-008).

[Paměť uložených grafů](PAMET_GRAFU.md) měří METEO-007 po přechodu z hlavního
přehledu na Moderní přehled 2. Porovnává uvolněnou JS paměť a cenu nové
konstrukce se stávajícím rychlým návratem.

[Min/max vykreslení 24h](24H_MINMAX.md): METEO-033, nejvýše800 původních
vzorků, společné T/RH/Td extrémy, per-metric mezery a přesné plné statistiky.

[Skutečná časová osa 24h](CASOVA_OSA_24H.md): METEO-036, epochové souřadnice,
přesný původní čas a přerušení dlouhých mezer; porovnání režie proti category
grafu na1k–250k při zachování všech měření a úplných statistik.

[24h graf podle viditelnosti](LAZY_24H.md): další část METEO-008,
skutečný commit se skrytým/viditelným grafem, 1k–250k a CPU×4. Graf pod
obrazovkou neblokuje obnovu; jeho plné vykreslení se odkládá, nikoli ruší.

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

- [Dávkovaná příprava24h v0.20.1](KOOPERATIVNI_24H.md): přesná shoda bodů, délka dávek a celková režie.

- [Stabilní výběr24h v0.20.2](RAZENI_VYREZU_24H.md): odstranění opakovaného řazení Sheets výřezu, přesný oracle a profil celé obnovy.

- [Přesné agregace po dávkách v0.20.3](AGREGACE_PO_DAVKACH.md): soukromý snapshot před CSV commitem, atomická cache a časování.

- [Stabilní řazení CSV po dávkách v0.20.4](CSV_MERGE_PO_DAVKACH.md): ohraničené kroky, shodné řádky/reporty a režie.

- [Profil statistik a roční převody času v0.20.5](ROCNI_CASOVE_PREVODY.md): osm před/po scénářů, identické modely a další cíl overview.

- [Denní souhrny přehledu v0.20.6](PREHLED_DENNI_SOUHRNY.md): přesné průběžné výpočty, omezený rozsah a profily1k–250k.

- [DOM a formátování přehledu v0.20.7](PREHLED_RENDER.md): skutečný viditelný Chart, tabulka a opakované/změněné hodnoty.

- [Aktualizace grafu přehledu v0.20.8](PREHLED_GRAF_UPDATE.md) měří opakované zobrazení a změnu veličiny.

- [Hodinové statistiky v0.20.9](HODINOVE_SKUPINY.md) porovnávají běžná data a hustou historii s duplicitními i jedinečnými časy.

- [Stránkování denních souhrnů v0.21.0](PREHLED_STRANKOVANI.md) měří změnu veličiny u velkých historií a porovnává všechny stránky s původní tabulkou.

- [Stálé datové řady přehledu v0.21.1](PREHLED_DATOVE_RADY.md) měří aktualizaci grafu při změně veličiny a období.

- [Řazení dní v přehledu v0.21.2](PREHLED_RAZENI_DNU.md) odděluje řazení od výpočtu souhrnů a aktualizace grafu.

- [Porovnání profilů](POROVNANI_PROFILU.md) ověřuje shodu úplných dat, grafů a tabulek mezi dvěma měřeními.

- [Rychlý návrat na stanici v0.21.3](RYCHLY_NAVRAT_NA_STANICI.md) měří první zobrazení hodnot, síťové bajty a rozbor CSV.

- [Přenos horní lišty stanic v0.21.4](PRENOS_LISTY_STANIC.md) porovnává velikost CSV a shodu řádků na třech veřejných zdrojích.

- [Odložená konstrukce grafu 24 h v0.21.5](KONSTRUKCE_GRAFU_24H.md) odděluje práci při startu a při prvním zobrazení grafu.

- [Odložená konstrukce grafů srážek a napětí v0.21.6](KONSTRUKCE_SRAZKY_A_NAPETI.md) měří start a první otevření záložky zvlášť.

- [Výběr historie napětí v0.21.7](HISTORIE_NAPETI.md) měří omezení práce nad seřazenou historií a ověřuje regresi z úplných nedávných měření.

- [Odložená konstrukce měsíčního a ročního grafu v0.21.8](KONSTRUKCE_MESICNI_A_ROCNI.md) měří start a první vykreslení obou záložek.

- [Odložená konstrukce Průzkumníka v0.21.9](KONSTRUKCE_PRUZKUMNIKU.md) ověřuje start a první vykreslení čárového i sloupcového grafu.

- [Odložená konstrukce Porovnání dnů a Přehledu v0.21.10](KONSTRUKCE_POROVNANI_A_PREHLEDU.md) uzavírá odklad konstrukce základních grafů.

- [Denní srážky v Průzkumníku v0.21.11](DENNI_SRAZKY_PRUZKUMNIKU.md) měří zvlášť agregaci a první vykreslení.

- [Vykreslení srážkových sloupců v0.21.12](VYKRESLENI_SRAZKOVYCH_SLOUPCU.md) ověřuje přeskočení shodné obnovy a cenu oprav.

- [Překreslení zaměřovací čáry v0.21.13](ZAMEROVACI_CARA_GRAFU.md) měří sloupcový i čárový graf při pohybu ukazatele.

- [Neblokující načítání Chart.js v0.21.14](NEBLOKUJICI_CHART_JS.md) měří čas zobrazení měření při prodlevě CDN.

- [Načtení Paho při prvním připojení v0.21.15](NACTENI_PAHO_MQTT.md) měří start Sheets a ověřuje odložené MQTT.
