# Projektová paměť a audit

## QUICK CONTEXT
- Aktualizováno 2026-10-20; práce na `codex-dev` po synchronizaci `f2706b5`; výchozí audit `fbb9659`. Ověřuj proti kódu.
- Statický český dashboard tří meteostanic; aktivní aplikace je kořenový `index.html`.
- HTML obsahuje CSS, konfiguraci, CSV parser, výpočty i všechny grafy; žádný framework/build/npm manifest.
- Node.js `server.js` pouze poskytuje soubory; data nestahuje ani neukládá.
- Start: z kořene repozitáře `node server.js` (port 8080); ověřeno Node 24.19.0.
- `config_praha_baterie.json`, `config_praha_okno.json`, `config_stanice3.json` odpovídají indexům 0–2.
- Google Sheets → CSV → `parseAndStore` → sestupně řazené `store.rows` → `refreshUI` → aktivní záložka.
- Chart.js 4.4.0 z jsDelivr; Paho MQTT 1.1.0 z cdnjs; UV z Open-Meteo.
- Nastavení přes `preferences`: hlavní web zachovává klíče `meteoStations`, `meteoActiveIdx`, `meteoTheme`; `/dev/` přidává prefix `meteoDev:`.
- Quick load načítá 400 řádků; `ensureFullData` spouští historii na vyžádání.
- `Git/MQTT_webovky/index.html` je odlišná starší stránka; její účel jako archivu není potvrzen.
- `Navrhy_Vylepseni.md` je audit Opusu s aktuální tabulkou realizace; pozor na odlišná Wxx ID workspace auditu (B.2).
- AUD-001 DONE: server omezuje veřejné cesty i reálné cíle symlinků; 6 regresních testů prošlo.
- Testy: `node --test tests/*.test.js` (44/44 prošlo); server má factory `createServer(rootDir)`.
- AUD-002/004/009 DONE: generační kontext, rušení síťových operací, await parseru, jeden spravovaný MQTT klient.
- AUD-003/005/006/007/008/011/012 DONE: bezpečný HTML výstup, grafy bez napětí, CSV/datum, roky, obnova i prázdné stavy.
- Další priority: AUD-010 (lokální dny/UTC), AUD-013 (statistiky před downsamplingem), výkon dlouhé historie.
- Živá data nebyla ověřena: onboarding proxy vracela CONNECT 403; neplést s chybou aplikace.
- Nevkládat přístupové údaje do JSON, auditu ani logů. Veřejné Sheet ID není autentizační token.
- Zachovat líné vykreslování a oddělené konfigurace stanic; nezačínat rozsáhlým rozdělením monolitu.
- Kontext celého systému: `ANALYZA_CELEHO_WORKSPACE.md` na GitHubu, revize `29ecf56`; souvislosti a mapování nálezů viz B.1.
- Na `Raw_Data` nepřecházet pouhou změnou názvu listu: liší se timestampy a význam J/R. Firmware a živé nasazení zde nejsou ověřeny.
- Main + `/dev/` dříve potvrzeny uživatelem; nový push codex-dev zablokovala environment policy github-pages. Nutno povolit codex-dev a zopakovat deploy; viz H/docs/PAGES.md.

## A. PROJECT CONTEXT

Projekt zobrazuje aktuální počasí, historii, statistiky srážek a napětí, porovnání dní, poznámky a odhady slunce/Měsíce/UV. Uživatelská konfigurace je lokální v prohlížeči; server nemá databázi, API pro zápis ani skutečnou autentizaci.

| Cesta | Úloha |
| --- | --- |
| `index.html` | Produkční vstup; veškeré styly, UI a aplikační JavaScript |
| `server.js` | Statický HTTP server s portem 8080; kořen `__dirname`, export `createServer(rootDir)` pro testy |
| `tests/server.test.js` | Šest skupin HTTP regresí bez externí sítě/závislostí; dočasné fixture a náhodný port |
| `tests/station-loading.test.js` | 14 deterministických testů životního cyklu načítání |
| `tests/data-quality.test.js`, `tests/helpers/app.js` | 20 testů kvality, rendererů, grafů, CSV/datumů a obnovy; společná VM spouští skutečný inline JS s řízeným DOM/Chart/transportem |
| `AGENTS.md`, `PROJECT_AUDIT.md` | Pravidla práce a projektová paměť s ověřenými nálezy |
| `.github/workflows/pages.yml`, `scripts/build-pages.js`, `tests/pages.test.js`, `docs/PAGES.md` | Publikování `main` a `codex-dev` jako jednoho Pages artefaktu, allowlist veřejných souborů, testy a aktivační postup |
| `config_praha_baterie.json`, `config_praha_okno.json`, `config_stanice3.json` | Automaticky načítané konfigurace tří stanic |
| `config.json` | Starší konfigurace jedné stanice, současný automatický start ji nečte |
| `Git/MQTT_webovky/index.html` | Druhá odlišná implementace (3219 řádků oproti 4878); kořenová stránka na ni neodkazuje |
| `setup.txt`, `README.md` | Postup pro Windows Live Server; README obsahuje pouze název |
| `remote_parse.txt` | UTF-16 úryvek staršího parseru; není načítán aplikací |
| `Navrhy_Vylepseni.md` | Audit Opusu z f2706b5 a tabulka aktuálního stavu implementace; Wxx číslování odlišné od workspace auditu |

Závislosti v prohlížeči: Chart.js a Paho přes pevné CDN URL, Google Sheets CSV, Open-Meteo a dva záložní CORS proxy (`corsproxy.io`, `api.allorigins.win`). MQTT je volitelný; dodané konfigurace mají prázdný host a zdroj `sheets`. Není potřeba instalovat balíčky ani sestavovat aplikaci. V repozitáři nebyly před auditem testy ani CI.

Ověřený postup: `node server.js`; HTTP požadavky na `/` a čtyři JSON soubory vracejí obsah projektu, neexistující cesta 404. Ověřeno i spuštění absolutní cestou z `/tmp` (neservíruje pracovní adresář). `node --test tests/*.test.js`: 44/44 prošlo (6 server, 4 Pages, 14 načítání, 20 kvalita dat); žádné přeskočené testy. `node --check server.js` a `git diff --check` prošly. Browser smoke s reálným Chart.js: titul, všechny záložky a změna stanice bez page errors; externí data a volitelný MQTT CDN byly v tomto testu záměrně blokovány, aby test izoloval změnu serveru. Chromium používá důvěryhodné CA prostředí v dočasné NSS databázi, nikoli vypnuté TLS ověřování. Živá data/UV ani skutečné MQTT připojení tím nejsou ověřeny.

## B. ARCHITECTURE MAP

Všechny následující funkce jsou v `index.html` (hledat názvy, čísla řádků se mění):

1. `STATION_DEFAULTS`, načtení localStorage a migrace → `stations`, `activeIdx`, `CFG`.
2. `switchStation` → `cancelStationWork`/`resetStationStore` → `loadStationConfig` → `tryLoadConfigJson` → `_applyCfgObject` → `startAll`.
3. `startAll` spouští Sheets interval, případně MQTT a UV; `fetchAllOv` samostatně aktualizuje přehled ostatních stanic.
4. `fetchSheets` sdílí rozpracovanou operaci v relaci, full požadavek případně počká na quick. `loadSheets` volí quick/full/incremental a přímé/proxy URL; awaituje `parseAndStore`, který uvolní UI přes 10ms timer a znovu ověří relaci.
5. `splitCSV`, `stripQ`, `pf`, `parseCSDateTime` převádějí hodnoty na záznamy `{date,time,ts,temp,pressure,hum,rainInc,rain,tank,voltage,note}`.
6. `store.rows` má nejnovější záznam na indexu 0; `refreshUI` aktualizuje společné karty a `ovStores[activeIdx]`.
7. `markAllTabsDirty` / `refreshTab` omezují render na aktivní záložku. `ensureFullData` řídí jednorázové načtení historie a čekající callbacky.
8. `buildCharts`, `buildAgg`, `buildExplorer`, `_drawExplorerPts`, `buildCompare`, `buildTempOverview`, `buildYearlyStats`, `buildNotesTable` vytvářejí jednotlivé pohledy.
9. `fetchUVData` → sdílený `uvStore` → `updateSunBar` a canvas; astronomické výpočty jsou lokální odhady.

Rizikové vazby: změna stanice musí zneplatnit všechna stará asynchronní dokončení; parser/řazení ovlivňuje grafy i přehled; změna CSV sloupců zasáhne hlavní i overview parser; barvy grafů jsou pevné a ne všechny sledují CSS téma.

Kontrakt relace: `stationContext()` zachytí index, kopii CFG a signál konkrétního AbortControlleru. `isCurrentStation` ověřuje identitu signálu i index, tedy i A → B → A. `stationText` kombinuje zrušení a timeout (quick 8s, check 5s, overview 10s, jinak 30s). `cancelStationWork` ruší síť, aktivní intervaly a MQTT; staré dokončení nesmí měnit data, příznaky, stav ani spouštět fallback/reconnect. `resetStationStore` zahodí historii/callbacky a skryje staré panely do přijetí nových dat; nezmění nastavení jiných stanic.

### B.1 Souvislosti s auditem celého systému

Prostudovaný zdroj: [ANALYZA_CELEHO_WORKSPACE.md, revize 29ecf56](https://github.com/Michaltymm/Meteo_webovky/blob/29ecf56edaac99560ab48d47e12bec439154393f/ANALYZA_CELEHO_WORKSPACE.md), audit z 20. 10. 2026. Tato revize na GitHubu oproti výchozímu `fbb9659` přidává pouze dokument. Načteno přes Git fetch/show bez merge pracovních souborů. Následující informace o ESP/Apps Script jsou převzaté závěry tohoto dokumentu, nikoli nové ověření jejich zdrojů nebo živého provozu v tomto checkoutu.

- Celý tok: ESP32/BME280/Hall/ADC → NVS fronta → HTTPS GET → Apps Script → `Prijem_dat` (dokumentovaně také `Hlavni_datovna`) → veřejné CSV → tento web. Nový příjem do `Raw_Data` a souhrnů je alternativní větev, její skutečné nasazení není doložené.
- Sjednocený firmware posílá aktivně 9 středníkem oddělených položek; historický formát má 8, rozšířených 16 je připraveno. Nové `Raw_Data` má 18 sloupců. Tři webové profily nelze automaticky mapovat na čtyři firmware profily podle pořadí.
- Kontrakt sloupce J: hlavní web očekává poznámku, starý příjem rezervuje solár, nové `Raw_Data` má rosný bod a poznámku až v R. Nový MASTER navíc může exportovat B jako celé datum a čas. Budoucí migrace vyžaduje adaptéry schémat a fixture testy, nikoli jen změnu `sheetName`.
- Starý příjem vkládá data na řádek 3 po dvou hlavičkách; nová větev používá append-only pořadí. U AUD-008 proto nestačí opravit druhý otazník: rozsah `1:2` může sledovat hlavičky a nejnovější řádek závisí na schématu.
- MQTT publisher nebyl v auditovaných ESP sketchích doložen. Webový MQTT režim není důkazem existujícího přenosu z těchto stanic.
- Širší audit hlásí riziko ztráty pulzů před potvrzeným NVS zápisem (F01), falešně věrohodné náhrady při chybě BME (F03), neověřované TLS (S01), chybnou deduplikaci MASTER (G01), chybějící souběhové zámky/obnovu agregací (G02/G03) a špatné zpracování nul a datumových klíčů (G04). Webová oprava sama integritu celého řetězce nezajistí.
- Před změnami příjmu nebo migrací určit skutečné nasazení: stanice → firmware/build → hardware → endpoint → tabulka/schéma → webový profil (D01). Zachovat stack ESP32 + Sheets + statický web; nejprve spolehlivost dat, následně výkon a nové funkce.

Mapování existujících nálezů (nevytvářet duplicitní TODO): W01 = AUD-002; W02 = AUD-008; W03 = AUD-004; W05 = AUD-010; W06 se překrývá s AUD-006; W07 = AUD-009; W08 se překrývá s IMP-002/003/007. S02 zahrnuje AUD-001, ale je širší (také veřejný adresář a síťové vystavení); lokální oprava AUD-001 neznamená dokončení všech doporučení S02 ani její publikování na GitHub.

### B.2 Aktualizovaný audit Opusu

`Navrhy_Vylepseni.md` byl uživatelem aktualizován v `f2706b5`; nyní obsahuje podrobný audit místo původního seznamu návrhů. Jeho W01 = AUD-002, W02 = AUD-008, W03/W09 = AUD-004, W05/W12 = AUD-006, W06 = AUD-010 a část W08 = AUD-009. **Číslování Wxx se liší od celkového workspace auditu v B.1**; při citaci vždy uvést zdrojový dokument. Stav implementace se udržuje i v úvodní tabulce nového `Navrhy_Vylepseni.md`.

## C. CONFIRMED ISSUES

Priority: P0 = bezprostředně kritické; P1 = bezpečnost/funkční spolehlivost; P2 = správnost okrajových případů/údržba; P3 = volitelné. Žádný doložený P0; skutečné veřejné nasazení serveru není potvrzeno.

| ID / priorita / stav | Místo a důkaz | Dopad a doporučení |
| --- | --- | --- |
| AUD-001 / P1 / DONE | Původní `server.js`: `path.join(process.cwd(), req.url…)` bez omezení cest. Raw HTTP `GET /../<dočasný-sentinel>` vrátil 200 a obsah neškodného souboru mimo checkout; `/.git/HEAD` také 200. Po opravě raw/encoded traversal a metadata vrací 403, neplatné URL 400. | Opraveno v `server.js`: dekódovat a ověřit segmenty, `realpath` + kontrola relativní cesty včetně skrytých cílů symlinků, pouze běžné soubory, kořen u skriptu místo cwd. `tests/server.test.js`: 6/6 prošlo; HTTP smoke na skutečném projektu zachoval všechny konfigurace a index. |
| AUD-002 / P1 / DONE | Před opravou opožděný konfig A přepsal B. Nový regresní test reprodukoval `sheet-0` místo `sheet-1` na původním zdroji. | Opraveno generační identitou + AbortControllerem pro konfig, CSV, odložený parser, UV a overview; také import FileReader a změna zdroje na stejném indexu. Staré fallbacky a callbacky se ignorují. Ověřeno Node testy i browserem s odloženou konfigurací. |
| AUD-003 / P1 / DONE | Původně se raw date/time vkládaly do innerHTML a parser přijímal HTML suffix. | `escapeHTML` chrání datum, čas i poznámku (také staré/cachované řádky); aktuální parser suffix odmítá. Browser s vloženým img/svg ověřil nulový počet takových DOM uzlů a nespustil handler; literal HTML entity zůstávají textem. |
| AUD-004 / P1 / DONE | Původní fullLoaded/OK/callbacky předbíhaly odložený parser; full fetch neměl timeout. | Parser nyní vrací Promise + boolean, volající awaituje commit validních řádků a platnost relace; poté nastaví fullLoaded a spustí aktuální callbacky. Neplatná CSV/HTML nepotvrdí úspěch; při selhání se uvolní pending i callbacky, full request má 30s timeout. Ruční refresh už nenastavuje fullLoaded před stažením. Testováno úspěšné pořadí i chyby všech fallbacků. CSV/datum parser doplněn v AUD-006; adaptér Raw_Data zůstává FUT-008. |
| AUD-005 / P1 / DONE | Původní Array(-1) při chybějícím napětí reprodukován novým regresním testem nad předchozím HTML. | Sdílená `voltageSeries` pro hlavní graf i explorer: filtr konečných hodnot, platná 0, prázdné řady bez pádu, predikce až pro dvě různá nedávná časová měření. Testy null/0/1/více/duplicitní/staré vzorky a reálný Chart.js bez napěťového senzoru prošly. |
| AUD-006 / P2 / DONE | Původní CSV ztrácelo dvojité uvozovky/víceřádkové buňky, datum/čas se normalizovaly místo chyby. | `parseCSV` rozumí BOM/CRLF/uvozovkám/prázdným buňkám/víceřádkovým poznámkám; malformed quoting odmítá. `parseCSDateTime` ověřuje celý formát, kalendář a hodiny/minuty/sekundy; aktualizuje yearState jen pro platné datum. `pf` vrací null pro nekonečno; `dewPoint` ošetřuje neplatnou vlhkost/NaN. Rok bez roku zůstává odhad dle stávajícího sestupného kontraktu, ne nová jistota. |
| AUD-007 / P2 / DONE | Původně se stejný den/měsíc různých let zprůměroval do jedné položky. | `buildAgg` používá denní klíč `fmtDateShort` včetně roku. Test rozlišuje 20.10.2025/2026 a zachovává průměr platné nuly i chybějící vlhkosti. |
| AUD-008 / P2 / DONE | Původní preflight skládal dvojitý otazník a mohl porovnávat hlavičky; otisk měnil před úspěchem. | Nespolehlivý preflight odstraněn. Celý úspěšně zparsovaný CSV export se uloží jako `store._lastFullCsv`; identická odpověď ušetří parse/render. Změny starších řádků/poznámek i při stejných hlavičkách a posledním timestampu se projeví. Po chybě otisk zůstává původní; ruční refresh parsuje znovu. Cena: plný přenos při periodické obnově; optimalizace až podle ověřeného datového kontraktu/revize, viz FUT-010. |
| AUD-009 / P1 / DONE | Původní lokální klienti/reconnecty zůstávali aktivní po změně stanice. | `mqttClient` a `mqttReconnectTimer` mají jednoho vlastníka; `stopMQTT` je zruší. Callbacky ověřují relaci i identitu klienta, pozdní onSuccess se odpojí bez subscribe, staré zprávy/chyby/retry se ignorují. Ověřeno fake klientem v regresních testech, nikoli reálným brokerem. Limit historie/backoff zůstávají FUT-009. |
| AUD-010 / P2 / TODO | `buildCompare` seskupuje dny přes UTC `toISOString().slice(0,10)`, hodiny přes lokální `getHours`. Pro Prague 00:30 je UTC předchozí den. | Půlnoční měření v nesprávném dni; stejné UTC datum používají date inputy/UV cache. Definovat časovou zónu a konzistentní denní klíče, testovat DST. |
| AUD-011 / P2 / DONE | Volba Vše (0) původně spadla do výchozího limitu 500. | Rozlišena platná nula a neplatný/negativní limit; test s 501 řádky ověřuje Vše i limity. Stránkování velkých historií zůstává návrh, nikoli nezbytná součást této opravy. |
| AUD-012 / P2 / DONE | Staré panely při přepnutí již řešil předchozí balík; zbýval prázdný rozsah ve stejné stanici. | `_drawExplorerPts([])` vyčistí labely/datasety/statistiky a ukáže prázdný stav. Ověřeno jednotkově i skutečným prázdným datem v browseru. |
| AUD-013 / P2 / TODO | `buildExplorer` redukuje body na nejvýše 800 před voláním `_drawExplorerPts` → `buildExpStats`. Ověřeno datovým tokem, ne benchmarkem. | Min/max/průměr se počítají jen z vybraných bodů; krátký extrém může zmizet. Statistiky počítat z plného filtrovaného rozsahu, downsampling použít jen pro vykreslení. |

## D. IMPROVEMENT IDEAS

| ID / priorita | Návrh, přínos | Náročnost / soubory |
| --- | --- | --- |
| IMP-001 / P1 | Automatické deterministické testy pro server a datový lifecycle, poté CI; odhalí regrese AUD-001–005 bez závislosti na síti. | Střední; `tests/`, později `.github/workflows/` a testovatelná rozhraní JS |
| IMP-002 / P2 | Cache po stanici a identitě zdroje s TTL a omezením velikosti; méně stahování při návratu na stanici. Až po AUD-002/004. | Střední; `index.html`: store/fetch/switch |
| IMP-003 / P2 | Agregace do Map v jednom průchodu, nevykreslovat skryté grafy; zachovat extrema při downsamplingu. | Střední; buildCharts/buildAgg/buildExplorer/buildYearlyStats |
| IMP-004 / P2 | Schema konfigurace: rozsahy lat/lon/port/interval/source a přesně tři stanice; bezpečný wrapper localStorage. | Střední; init, _applyCfgObject, applyConfig. Např. pole >3 v storage přistoupí k neexistujícím STATION_DEFAULTS[i]. |
| IMP-005 / P2 | Jasně označit lokální heslo nastavení jako UX zámek; bezpečnost vyžaduje serverovou autentizaci pouze pokud bude potřeba chráněný zápis. | Nízká pro dokumentaci; toggleFullCfg/_pwConfirm. Hash na klientu nechrání veřejné konfigurace. |
| IMP-006 / P2 | Lepší UI stavy, a11y záložek/dialogů (klávesnice/ARIA/focus), touch plochy, mobilní orientace a světlé grafy. | Střední; HTML/CSS a inicializace Chart.js; měřit v prohlížeči |
| IMP-007 / P2 | Důvěryhodnost externích knihoven a dat: ověřené SRI + crossorigin nebo lokální verzované soubory; dokumentovat únik URL/tabulek přes veřejné proxy. | Střední; `<head>`, fetchSheets/fetchOvStation. Nezaměňovat CSP za validaci vstupů. |
| IMP-008 / P3 | Postupné vyčlenění čistých parserů/agregací, pak data/UI modulů. Začít testovatelnými hranicemi místo hromadného přepisu HTML. | Vysoká; `index.html`, nové JS moduly; ověřit statický hosting a file: režim |

Oprava historických předpokladů z `Navrhy_Vylepseni.md` (soubor zatím ponechán): poslední stanice už se ukládá (`meteoActiveIdx`); light/dark témata a překryv dní už existují (`setTheme`, `buildCompare`); explorer už redukuje na nejvýše 800 bodů. Cache, PWA a modularizace jsou stále návrhy. Orientační mobilní chyby ze starého dokumentu nebyly nezávisle reprodukovány.

## E. FUTURE IDEAS / BACKLOG

| ID / typ / stav | Nápad nebo otázka |
| --- | --- |
| FUT-001 / budoucí nápad / TODO | PWA/offline shell a poslední známá data, se zřetelným časem/stářím. Vyžaduje cache verze a bezpečnou aktualizaci service workeru. |
| FUT-002 / hypotéza / TODO | Ověřit účel `Git/MQTT_webovky/index.html`, `config.json`, `remote_parse.txt`; teprve poté navrhnout archivaci. Bez souhlasu nemazat. |
| FUT-003 / ověřený návrh / TODO | Zjednodušit měření výkonu pomocí reálných CSV fixture (400/20k/100k řádků) a mobilního profilu; neoptimalizovat podle počtu řádků HTML. |
| FUT-004 / hypotéza / TODO | `Math.max(...array)` na velkých historiích může překročit limit argumentů; změřit mez a použít reduce, pokud se potvrdí pro reálná data. |
| FUT-005 / hypotéza / TODO | Quick dotaz ORDER BY A/B nemusí chronologicky řadit textová česká data; ověřit skutečné typy sloupců v Google Sheets. |
| FUT-006 / budoucí nápad / TODO | Export filtrovaných dat, indikace výpadků a stáří senzoru; zobrazovat neúplnost historie i ve statistikách. |
| FUT-007 / hypotéza / TODO | Ověřit denní/kumulativní sémantiku `rain` a `rainInc` pro každou stanici před změnou srážkových výpočtů. Současný max/den předpokládá denní reset. |
| FUT-008 / návrh podložený širším auditem W04 / TODO | Před přechodem na `Raw_Data` zavést explicitní adaptér `legacy` / `raw_v2` a testovací exporty ze skutečného schématu; zachovat poznámky, timestamp, jednotky a kvalitu. Cílově verzovaný kontrakt se `station_id`, `measurement_id` a UTC časem. Vazby viz B.1; migrace nyní není schválenou ani provedenou změnou. |
| FUT-009 / konkrétní zbývající problém / TODO | Spravovaný MQTT lifecycle je hotový (AUD-009); zbývá omezit počet zpráv, určit deduplikaci a sémantiku Sheets/MQTT overlay a doplnit backoff (Opus W08/W10). Neobnovovat vyřešený nález o neodpojování klienta. |
| FUT-010 / ověřený návrh / TODO | Optimalizovat pravidelný plný CSV přenos až po ověření typů/pořadí/hlaviček nebo zavedení spolehlivé revize dat. Aktuální raw export cache ušetří parse/render, nikoli přenos, a drží jednu kopii CSV v paměti aktivní relace. Nepoužívat statické hlavičky ani pouze počet/poslední řádek jako důkaz shody celé historie. |

## F. PRIORITIZED ROADMAP

TOP 10 v doporučeném pořadí (P0 nyní bez potvrzených položek):

| Pořadí / priorita | ID / stav | Proč teď / závislost |
| --- | --- | --- |
| 1 / P1 | AUD-001 DONE | Uzavřeno a regresně ověřeno; před změnou reprodukované zpřístupnění souborů, bez přepisu UI. |
| 2 / P1 | AUD-002 DONE | Izolace relací včetně A → B → A, importu a změny zdroje ověřena. |
| 3 / P1 | AUD-003 DONE | Bezpečné vykreslování a přísná validace ověřeny i v browseru. |
| 4 / P1 | AUD-005 DONE | Grafy i navazující agregace fungují bez napětí, bez vymyšlené predikce. |
| 5 / P1 | AUD-004 DONE | Úspěch potvrzen až po parseru; úklid po selhání a timeout doplněny. |
| 6 / P1 | AUD-009 DONE | Jeden spravovaný klient a rušitelný reconnect, testováno mockem. Další MQTT práce FUT-009. |
| 7 / P2 | AUD-006 DONE | CSV/datum fixture testy i víceřádkové poznámky v browseru prošly. |
| 8 / P2 | AUD-007 DONE; AUD-010 TODO | Roky oddělené; zbývá sjednotit lokální dny/UTC a otestovat půlnoc/DST. |
| 9 / P2 | AUD-008 DONE | Spolehlivé porovnání celého exportu; přenosovou optimalizaci vést samostatně jako FUT-010. |
| 10 / P2 | AUD-012 + AUD-011 DONE | Prázdné stavy a Vše opraveny; přístupnost/cache zůstávají samostatné návrhy. |

IMP-001 je průběžná podmínka každé opravy; testy serveru, sestavení a načítání stanic jsou hotové a běží v Pages CI; další domény testovat při jejich změnách. Po datových opravách pokračovat AUD-013 a cache dle měření. P3: FUT-001, IMP-008 až po stabilizaci dat. Žádné návrhy nebyly označeny REJECTED; dokončení musí mít důkaz v H.

## G. RISKS AND DEPENDENCIES

- CORS proxy vidí URL veřejných tabulek a vracená data; nikdy jimi neposílat privátní klíče. Přímé načtení Sheets preferovat.
- CDN výpadek Chart.js zastaví inicializaci před startAll; MQTT klient může být nedostupný i když Sheets fungují.
- Líné renderování je záměr; `buildCharts` ale stále aktualizuje několik skrytých grafů najednou. Zachovat dirty tracking, měřit změny.
- Změny časových klíčů musí sjednotit parser, overview, compare, date inputy, UV cache a kalendářní agregace.
- Historie bez roku a předpokládané sestupné řazení jsou skrytý datový kontrakt; změna GViz dotazu může ovlivnit odvozování let.
- Formulář/JSON se ukládá pouze do prohlížeče a po startu může být přepsán dodaným JSON; hash hesla není serverová ochrana.
- Vývojový server není plnohodnotný produkční hosting. Ani omezení cest nezavádí autentizaci či ochranu před škodlivým lokálním procesem měnícím soubory/symlinky během požadavku.
- Bez živých dat nelze potvrdit reálné Sheets schéma, aktualizační intervaly, broker ani reálný objem historie. Lokální reprodukce závad jsou na síti nezávislé.

## H. AI DEVELOPMENT MEMORY

- Aktivní zdroj je kořenový `index.html`; neduplikovat opravy automaticky do `Git/MQTT_webovky/`.
- `store.rows[0]` je nejnovější záznam. Grafy řadí vlastní kopii vzestupně; chybějící senzor je `null`, ne 0.
- Veškerý text z CSV/konfigurace je nedůvěryhodný včetně data/času; preferovat textContent. Denní klíče musí mít rok a jasnou zónu.
- Životní cyklus stanice patří `stationSession`: nestačí porovnat index (A → B → A). Po await i před odloženým zápisem musí platit `isCurrentStation`; kopie CFG drží původní parametry žádosti.
- `fetchSheets` sdílí aktivní operaci; full čeká na quick a teprve pak případně stahuje historii. Úspěch, příznaky a callbacky nastávají po parsování, ne po přijetí HTTP. Po chybě se pending/callbacky uvolní.
- `startAll` ruší předchozí relaci; `resetStationStore` navíc zahazuje data a skryje staré panely. Automatický config je vázaný na původní kontext, import souboru též. Nemíchat reset každého periodického fetch s resetem stanice.
- MQTT má právě jednoho klienta a reconnect timer. Kontrolovat relaci **i** identitu klienta; pozdní onSuccess se musí odpojit. Reálný broker zatím nebyl testován; backoff/limit historie jsou FUT-009.
- 2026-10-20: AUD-001 opraveno v `fa72a4f` včetně AGENTS/auditu/HTTP testů. Zachován port/MIME/CORS, import neotevře port, root je __dirname. Nevracet na string-prefix nebo cwd, ověřovat reálné cíle symlinků. Před tím tento kód a paměť zůstávaly pouze lokální.
- 2026-10-20: AUD-002/004/009 dokončeny. Regresní test konfigu na starém HTML selhal skutečnou záměnou sheet-0/sheet-1; po opravě prošlo všech 24 testů. Browser s reálným Chart.js a mock Sheets/UV ověřil startup, odložený A config, B/C měření, skrytí starých panelů, full historii, ruční refresh a mobilní viewport bez page errors. Síťové služby/broker tím ověřeny nejsou. Workflow prošlo actionlint a spouští všechny testy.
- Zdrojové audity: workspace `ANALYZA_CELEHO_WORKSPACE.md` v `29ecf56` (B.1) a novější Opus `Navrhy_Vylepseni.md` v `f2706b5` (B.2). Firmware/Apps Script jsou zde převzatý kontext; skutečné nasazení a schéma je nutné ověřit před migracemi.
- VIS-001 DONE: test fialového pozadí `c197717` odeslán na `codex/test-background-color`, následně převzat do codex-dev; hlavní web ponechává původní barvu do schváleného merge.
- DEPLOY-001 DONE dle potvrzení uživatele „už to funguje“. Publikační commit `a024441`, merge PR #2 do main `2405c5d`; vývojová větev codex-dev. Workflow sestavuje obě verze současně z allowlistu pěti veřejných souborů, preview má banner a prefix nastavení meteoDev:. Stejný origin není bezpečnostní izolace.
- Git fetch/push funguje; čtení/správa Pages a PR/Actions přes API i HTTP na veřejné weby byly v tomto prostředí blokovány 403. Z toho nelze dovozovat chybu nasazení. Při změně dostupnosti ověřit nově, nepožadovat token jen kvůli CLI.
- Aktualizace dostupnosti: veřejné HTML github.com/actions lze číst přes curl bez API; seznam běhů a anotace dostupné bez přihlášení, podrobné logy vyžadují přihlášení. Pro ověření CI použít tento podporovaný read-only přístup, nikoli extrahování přihlašovacích údajů.
- Publikované opravy: `fa72a4f` (server/paměť) a `f43d599` (izolace/parser/MQTT/testy) odeslány na codex-dev, vzdálené SHA ověřeny; main zůstává `2405c5d`. Run [39467402153](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39467402153) vytvořil Pages artefakt a build prošel; **deploy selhal** za 2 s s hláškou `Branch "codex-dev" is not allowed to deploy to github-pages due to environment protection rules`. AUD-002/004/009 jsou ověřené opravy kódu, nikoli důkaz jejich nasazení.
- DEPLOY-001 / IN PROGRESS pro automatické aktualizace vývoje: uživatel musí v Settings → Environments → github-pages povolit codex-dev vedle main (ostatní ochrany zachovat) a v uvedeném běhu zvolit Re-run all jobs. Neobcházet ochranu deployem z jiné větve. Dřívější uživatelské potvrzení se týká dostupnosti stránek; nové nasazení zatím potvrzené není. Postup přidán do docs/PAGES.md.
- Vývoj a push na codex-dev; do main slučovat až po schválení uživatelem. Před prací fetch a zachovat změny Opusu/uživatele; f2706b5 byl načten fast-forward. Další priority: AUD-010, AUD-013, výkon velkých historií (IMP-003).

- Další balík 2026-10-20: AUD-003/005/006/007/008/011/012 DONE. 44/44 Node testů, inline syntax check a diff check prošly; dřívější RangeError reprodukován před opravou stejným testem. Browser ověřil všechny záložky nad 61 řádky bez napětí, odmítnutí neplatného data, neproveditelné HTML v notes/historii, přesný obsah víceřádkové poznámky s uvozovkami, Vše, změnu starého řádku při neměnných hlavičkách, nezměněný export, chybu/retry a prázdný explorer včetně mobilu. Použit reálný Chart.js a fixture Sheets/UV; reálná síť/broker neověřeny.
- CSV parser vrací již dekódované buňky; neodstraňovat z poznámek uvozovky/apostrofy přes stripQ. Overview používá omezení na 6 **logických** záznamů; nesplitovat text na fyzické řádky. Čas parseru nově zachovává sekundy. Neplatný kalendář musí vracet null a neměnit yearState.
- `_lastFullCsv` aktualizovat jen po úspěšném zparsování celé odpovědi; při resetu relace zahodit, nepersistovat do localStorage. Vyšší přenos je vědomá cena odstranění falešného beze změn; optimalizace pouze FUT-010 s ověřeným protokolem. Raw_Data adaptér se tím neimplementoval.

- Následný okrajový případ: overview nyní přeskočí neplatný kalendářní řádek a hledá další validní měření v prvních šesti logických záznamech, případně zkusí fallback. Samostatný regresní test nejprve selhal (overview zůstalo prázdné), po opravě prošel; celkem 44/44 testů. Balík kvality odeslán v `3244df3`; jeho GitHub run [39477407012](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39477407012) měl úspěšný build a Pages artefakt, ale deploy znovu odmítlo pravidlo github-pages pro codex-dev. Živá verze oprav tím není potvrzená.

## INSTRUCTIONS FOR FUTURE AI AGENTS

1. Nejprve přečti QUICK CONTEXT; potom jen sekce relevantní k zadání.
2. Audit není vždy aktuální: ověř důležité skutečnosti ve zdrojovém kódu a zkontroluj související ID/rizika.
3. Po změně aktualizuj dotčené záznamy a ověřené příkazy; DONE až po skutečném ověření, s jeho výsledkem.
4. Nové problémy/nápady přidej se stabilním ID; nevytvářej duplicity ani zbytečný backlog.
5. Nedělej celý audit znovu, pokud to úkol nevyžaduje. Zachovej důležitá rozhodnutí a oprav rozpor dokumentace/kódu.
6. Použij existující izolovaný checkout; bez výslovné žádosti nevytvářej Git worktree. Zachovej cizí změny.
7. Odděluj fakta, hypotézy a návrhy i prošlé, selhané a neprovedené testy. Chybu sítě nevydávej za chybu aplikace.
