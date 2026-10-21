# Projektová paměť a audit

## QUICK CONTEXT
- Aktualizováno 2026-10-21; práce výhradně na `codex-dev`, výchozí revize této etapy `bf31182`; původní audit `fbb9659`. Ověřuj proti kódu.
- Verze webu: 0.3.1 v hlavičce `#appVersion`; stručná historie vydání v `RELEASE_NOTES.md`, pravidla v AGENTS.md.
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
- Testy: `node --test tests/*.test.js` (119/119 prošlo); server má factory `createServer(rootDir)`.
- AUD-002/004/009 DONE: generační kontext, rušení síťových operací, await parseru, jeden spravovaný MQTT klient.
- AUD-003/005/006/007/008/011/012 DONE: bezpečný HTML výstup, grafy bez napětí, CSV/datum, roky, obnova i prázdné stavy.
- AUD-013/FUT-004 DONE: plné statistiky, min/max redukce, cache rozsahu, aktivní grafy a bezpečné agregace; 250k test.
- Centrální plán: `docs/NAPADY_A_ROADMAP.md` (75 METEO ID); AUD-010/METEO-005 DONE, METEO-038 sdílení hodin/denních/měsíčních/ročních souhrnů a podklady hotové; dostupnost čeká na měřicí plán senzoru. Dále METEO-019/020/031 a kontrakt času stanice METEO-048.
- Roční srážkové popisky v0.3.1 opravené: denní maximum čítače, přírůstek jednoho záznamu a legacy rozdíl rain do24h. Čísla zachována, nejde o ověřené úhrny; reset/interval/schema stále METEO-017/049.
- Historický benchmark etapy 1 Chromium 1k/10k/100k: při 100k přehled 148,6 → 53,8 ms, explorer 43,2 → 14,8 ms; viz docs/performance.
- Živé quick CSV všech tří zdrojů nyní HTTP200 (21. 10.); pouze dostupnost/bytes/doba, bez validace obsahu. Skutečné schema, firmware, MQTT ani dlouhá historie neověřeny.
- Nevkládat přístupové údaje do JSON, auditu ani logů. Veřejné Sheet ID není autentizační token.
- Zachovat líné vykreslování a oddělené konfigurace stanic; nezačínat rozsáhlým rozdělením monolitu.
- Kontext celého systému: `ANALYZA_CELEHO_WORKSPACE.md` na GitHubu, revize `29ecf56`; souvislosti a mapování nálezů viz B.1.
- Na `Raw_Data` nepřecházet pouhou změnou názvu listu: liší se timestampy a význam J/R. Firmware a živé nasazení zde nejsou ověřeny.
- DEPLOY-001 DONE: v0.3.1 nasazeno úspěšným [run39606840157](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39606840157), commit f807173, build16s/deploy9s, celkem33s. Main stále 2405c5d; přímé HTTP/vizuální ověření živých Pages zde není dostupné.

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
| `setup.txt`, `README.md` | Starší postup pro Windows Live Server; README odkazuje na audit, roadmapu a provoz |
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
| AUD-010 / P2 / DONE (v0.2.1) | Původní UTC klíče přesouvaly místní půlnoční měření do sousedního dne. Nový regresní test na 3e236bc vrátil null místo 10; další vynechal konec dne. | localDateKey + kalendářní posuny + meze další půlnoci; porovnání, vstupy, dnešní statistiky a datum UV cache sjednoceny v dosavadní zóně prohlížeče. 80 testů, pět zón a skutečné datumové vstupy 23/25h. Explicitní zóna stanice/CSV offset a UV hourly kontrakt zůstávají METEO-048; viz docs/CAS_A_KALENDAR.md. |
| AUD-011 / P2 / DONE | Volba Vše (0) původně spadla do výchozího limitu 500. | Rozlišena platná nula a neplatný/negativní limit; test s 501 řádky ověřuje Vše i limity. Stránkování velkých historií zůstává návrh, nikoli nezbytná součást této opravy. |
| AUD-012 / P2 / DONE | Staré panely při přepnutí již řešil předchozí balík; zbýval prázdný rozsah ve stejné stanici. | `_drawExplorerPts([])` vyčistí labely/datasety/statistiky a ukáže prázdný stav. Ověřeno jednotkově i skutečným prázdným datem v browseru. |
| AUD-013 / P0 dle nového zadání / DONE | Browser reprodukoval ztrátu extrému i počet pouze 800 místo 100k ve statistikách. | METEO-033: min/max redukce až při kreslení, statistiky/regrese z úplných dat, slider řeže plné řádky. 54 Node testů a Chromium/Chart.js ověření; původní chyba reprodukována také regresním testem. |

## D. IMPROVEMENT IDEAS

| ID / priorita | Návrh, přínos | Náročnost / soubory |
| --- | --- | --- |
| IMP-001 / P1 | Automatické deterministické testy pro server a datový lifecycle, poté CI; odhalí regrese AUD-001–005 bez závislosti na síti. | Střední; `tests/`, později `.github/workflows/` a testovatelná rozhraní JS |
| IMP-002 / P2 | Cache po stanici a identitě zdroje s TTL a omezením velikosti; méně stahování při návratu na stanici. Až po AUD-002/004. | Střední; `index.html`: store/fetch/switch |
| IMP-003 / P0–P1 / ČÁSTEČNĚ | METEO-001/002/033 hotové: viditelné grafy, cache rozsahu a min/max. Sdílené denní/hodinové agregace zbývají METEO-038. | Střední; výsledky viz docs/performance, hlavní data zůstávají plná |
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
| FUT-003 / ČÁSTEČNĚ | METEO-056: reprodukovatelné browser měření se syntetickými 1k/10k/100k a mobile viewportem hotové. Reálná CSV/síť, RAM a Web Vitals zbývají; data v docs/performance. |
| FUT-004 / ověřená chyba / DONE | RangeError reprodukován v původním refreshUI při 250k syntetických záznamech. METEO-039 používá iterativní numericSummary pro neomezená pole; test 250k i plné statistiky prošly. Jediný zbývající spread je pevná 24h UV předpověď. |
| FUT-005 / hypotéza / TODO | Quick dotaz ORDER BY A/B nemusí chronologicky řadit textová česká data; ověřit skutečné typy sloupců v Google Sheets. |
| FUT-006 / budoucí nápad / TODO | Export filtrovaných dat, indikace výpadků a stáří senzoru; zobrazovat neúplnost historie i ve statistikách. |
| FUT-007 / hypotéza / TODO | Ověřit denní/kumulativní sémantiku `rain` a `rainInc` pro každou stanici před změnou srážkových výpočtů. Současný max/den předpokládá denní reset. |
| FUT-008 / návrh podložený širším auditem W04 / TODO | Před přechodem na `Raw_Data` zavést explicitní adaptér `legacy` / `raw_v2` a testovací exporty ze skutečného schématu; zachovat poznámky, timestamp, jednotky a kvalitu. Cílově verzovaný kontrakt se `station_id`, `measurement_id` a UTC časem. Vazby viz B.1; migrace nyní není schválenou ani provedenou změnou. |
| FUT-009 / konkrétní zbývající problém / TODO | Spravovaný MQTT lifecycle je hotový (AUD-009); zbývá omezit počet zpráv, určit deduplikaci a sémantiku Sheets/MQTT overlay a doplnit backoff (Opus W08/W10). Neobnovovat vyřešený nález o neodpojování klienta. |
| FUT-010 / ověřený návrh / TODO | Optimalizovat pravidelný plný CSV přenos až po ověření typů/pořadí/hlaviček nebo zavedení spolehlivé revize dat. Aktuální raw export cache ušetří parse/render, nikoli přenos, a drží jednu kopii CSV v paměti aktivní relace. Nepoužívat statické hlavičky ani pouze počet/poslední řádek jako důkaz shody celé historie. |

## F. PRIORITIZED ROADMAP

Aktuální rozvojové priority jsou v [centrální roadmapě](docs/NAPADY_A_ROADMAP.md). Následující tabulka zachovává historii stabilizační etapy; P0 výkon nyní doložen benchmarkem (METEO-001/002/033/039 hotové, METEO-004/005 další):

| Pořadí / priorita | ID / stav | Proč teď / závislost |
| --- | --- | --- |
| 1 / P1 | AUD-001 DONE | Uzavřeno a regresně ověřeno; před změnou reprodukované zpřístupnění souborů, bez přepisu UI. |
| 2 / P1 | AUD-002 DONE | Izolace relací včetně A → B → A, importu a změny zdroje ověřena. |
| 3 / P1 | AUD-003 DONE | Bezpečné vykreslování a přísná validace ověřeny i v browseru. |
| 4 / P1 | AUD-005 DONE | Grafy i navazující agregace fungují bez napětí, bez vymyšlené predikce. |
| 5 / P1 | AUD-004 DONE | Úspěch potvrzen až po parseru; úklid po selhání a timeout doplněny. |
| 6 / P1 | AUD-009 DONE | Jeden spravovaný klient a rušitelný reconnect, testováno mockem. Další MQTT práce FUT-009. |
| 7 / P2 | AUD-006 DONE | CSV/datum fixture testy i víceřádkové poznámky v browseru prošly. |
| 8 / P2 | AUD-007/010 DONE | Roky i denní klíče sjednocené v zóně prohlížeče; vlastní zóna stanice a UTC kontrakt zdroje dále METEO-048. |
| 9 / P2 | AUD-008 DONE | Spolehlivé porovnání celého exportu; přenosovou optimalizaci vést samostatně jako FUT-010. |
| 10 / P2 | AUD-012 + AUD-011 DONE | Prázdné stavy a Vše opraveny; přístupnost/cache zůstávají samostatné návrhy. |

IMP-001 je průběžná podmínka každé opravy; testy serveru, sestavení a načítání stanic jsou hotové a běží v Pages CI; další domény testovat při jejich změnách. AUD-010/013 a METEO-005 jsou hotové. METEO-038 má společné hlavní souhrny, denní/měsíční T/RH a hodinové T/RH/P s podklady; pokračovat sdílením ročních statistik a vymezením pozorovaného času oproti dostupnosti dle plánu. Časový kontrakt zdroje/stanice dále METEO-048, METEO-004 cache stanic vyžaduje paměťový limit. P3: FUT-001, IMP-008 až po stabilizaci dat. Žádné návrhy nebyly označeny REJECTED; dokončení musí mít důkaz v H.

## G. RISKS AND DEPENDENCIES

- CORS proxy vidí URL veřejných tabulek a vracená data; nikdy jimi neposílat privátní klíče. Přímé načtení Sheets preferovat.
- CDN výpadek Chart.js zastaví inicializaci před startAll; MQTT klient může být nedostupný i když Sheets fungují.
- Líné renderování respektuje aktivní tab (METEO-001). Instance Chart.js stále vznikají všechny při startu; lazy konstrukce je samostatné METEO-007. Zachovat dirty tracking.
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
- Historický stav 20. 10. — DEPLOY-001 / IN PROGRESS pro automatické aktualizace vývoje (vyřešeno úspěšným během 21. 10., viz etapa 2): uživatel musí v Settings → Environments → github-pages povolit codex-dev vedle main (ostatní ochrany zachovat) a v uvedeném běhu zvolit Re-run all jobs. Neobcházet ochranu deployem z jiné větve. Dřívější uživatelské potvrzení se týká dostupnosti stránek; nové nasazení zatím potvrzené není. Postup přidán do docs/PAGES.md.
- Vývoj a push na codex-dev; do main slučovat až po schválení uživatelem. Před prací fetch a zachovat změny Opusu/uživatele; f2706b5 byl načten fast-forward. Další priority: AUD-010, AUD-013, výkon velkých historií (IMP-003).

- Další balík 2026-10-20: AUD-003/005/006/007/008/011/012 DONE. 44/44 Node testů, inline syntax check a diff check prošly; dřívější RangeError reprodukován před opravou stejným testem. Browser ověřil všechny záložky nad 61 řádky bez napětí, odmítnutí neplatného data, neproveditelné HTML v notes/historii, přesný obsah víceřádkové poznámky s uvozovkami, Vše, změnu starého řádku při neměnných hlavičkách, nezměněný export, chybu/retry a prázdný explorer včetně mobilu. Použit reálný Chart.js a fixture Sheets/UV; reálná síť/broker neověřeny.
- CSV parser vrací již dekódované buňky; neodstraňovat z poznámek uvozovky/apostrofy přes stripQ. Overview používá omezení na 6 **logických** záznamů; nesplitovat text na fyzické řádky. Čas parseru nově zachovává sekundy. Neplatný kalendář musí vracet null a neměnit yearState.
- `_lastFullCsv` aktualizovat jen po úspěšném zparsování celé odpovědi; při resetu relace zahodit, nepersistovat do localStorage. Vyšší přenos je vědomá cena odstranění falešného beze změn; optimalizace pouze FUT-010 s ověřeným protokolem. Raw_Data adaptér se tím neimplementoval.

- Následný okrajový případ: overview nyní přeskočí neplatný kalendářní řádek a hledá další validní měření v prvních šesti logických záznamech, případně zkusí fallback. Samostatný regresní test nejprve selhal (overview zůstalo prázdné), po opravě prošel; celkem 44/44 testů. Balík kvality odeslán v `3244df3`; jeho GitHub run [39477407012](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39477407012) měl úspěšný build a Pages artefakt, ale deploy znovu odmítlo pravidlo github-pages pro codex-dev. Živá verze oprav tím není potvrzená.

### Etapa výkonu a roadmapy (20. 10. 2026)

- Nové uživatelské zadání chce etapový rozvoj, P0 výkon, pak baterii/porovnání/metriky. `docs/NAPADY_A_ROADMAP.md` je centrální živý backlog (59 unikátních ID, 13 kategorií, zdroje/závislosti, návrh analytiky a přijímací kritéria). README/AGENTS na něj odkazují; starší audity zachovány.
- METEO-001/002/003/033/039 DONE: 1 místo 6 chart update na přehledu, binární výběr rozsahu + cache jednoho pole referencí, quick CSV shoda šetří parse/render, min/max výběr nejvýše 800 pozorovaných bodů, plné statistiky/slider/regrese a iterativní min/max bez argument limitu. Range cache neukládá všechny stanice, nepersistuje a nešetří síť; je třeba ji invalidovat při každé mutaci dat. Volat `invalidateDerivedData` po CSV/MQTT/resetu.
- `voltageSeries` má volitelný třetí argument pro úplná data regrese; vizuální body nesmí měnit výsledek výpočtu. Prognóza stále jednoduchá extrapolace; ne SOC ani AI. Cache quick i full CSV se ruší po MQTT overlay, aby totožný export neponechal nekonzistentní smíšený store.
- 54/54 Node testů prošlo (10 nových performance); nové testy na `c0bfddf` selhaly pro 800 místo 100k a RangeError při 250k. Finální skutečné Chromium 154 / Chart.js 4.4.0: 1k/10k/100k, všechny záložky a 8 metrik exploreru, mobil390 bez pageErrors/přetečení. Směrování sítě je fixture; živé služby tím neověřeny.
- Benchmark medián 5 běhů při100k: refreshUI 148,6→53,8 ms (6→1 chart update), explorer 43,2→14,8 ms, slider 18,2→10,8 ms. Originální data se nemění, extrém85°C z fixture zůstává. Údaje/omezení/metodika a surové JSON v docs/performance; skript scripts/benchmark-browser.py. RAM/LCP/INP/CLS/skutečná síť neměřeny; neuvádět zlepšení těchto metrik jako fakt.
- Další práce: METEO-004/005 (omezená cache mezi stanicemi a neaktivní karta); AUD-010/METEO-048 (jednotný čas) před novou analytikou. Raw_Data, srážkové jednotky/reset a procentuální dostupnost potřebují skutečný kontrakt. Nic z návrhů firmware/HW neprezentovat jako dostupné měření.
- Publikováno v commitu `0c80c9d770cb85818c050fedd45a7448b8bb8546` na codex-dev; SHA ověřeno přes `git ls-remote`, main stále `2405c5d`. [Actions run #8](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39482044092): build 14 s vytvořil artefakt, deploy 2 s odmítnut: `Branch "codex-dev" is not allowed to deploy to github-pages due to environment protection rules.` Povolení codex-dev v nastavení prostředí a opakování workflow zůstává nutné. Zrychlení je měřeno lokálně, nikoli na nově nasazeném webu.

### Verze a přehled změn (20. 10. 2026)

- METEO-060 DONE: první evidovaná verze 0.1.0 je přímo v HTML pod názvem Meteostanice. Viditelná bez dat i bez dalšího fetch; odkaz vede do sdílených RELEASE_NOTES.md na codex-dev, přímo na kotvu v010. Soubor obsahuje pouze čísla verzí a stručné změny; první záznam shrnuje existující stabilizaci/výkon a novou indikaci verze, nepřiřazuje zpětně neexistující vydání.
- Další změna webu zvýší X.Y.Z a přidá záznam nahoru; zachovat historii a aktualizovat kotvu odkazu. Dokumentační změny ani merge stejného HTML do main samy číslo nemění. Verze označuje skutečně načtený soubor; není to potvrzení deploymentu. main bude mít štítek až po schváleném merge.
- 54/54 stávajících testů a diff check prošly. Chromium ověřilo viditelnost/klikatelnost a nulové přetečení při 320/390/1280 px, cestě root i /dev/ a tématech darkblue/light; žádné pageErrors. Release notes jsou na GitHubu, Pages allowlist se nemění.

### Etapa 2: nové podněty, měření a v0.2.0 (21. 10. 2026)

- Roadmapa rozšířena o 15 samostatných METEO-061–075 (celkem 75). Původní ID/stavy/historie zachovány, baterie/lagy/události/mobil/export rozpracovány pod existujícími ID. `Navrhy_Vylepseni.md` je historická reference, v této etapě neměněn. Každý nový návrh obsahuje vstupy/proveditelnost, techniku, náklady, prioritu, omezení, závislosti a test; měření/výpočet/odhad jsou rozlišeny.
- Právě tři změny aplikace: METEO-061 porovnání krajních originálních měření exploreru; METEO-002 binární historické protějšky místo čtyř skenů + žádný shodný innerHTML; METEO-001 zápis textů společného přehledu jen při změně. Žádné nové fetch/deps, konfigurace a main beze změn. Verze 0.2.0 + release notes.
- `nearestHistoryRow` předpokládá sestupné řazení; ostrá tolerance <30 min, při stejné vzdálenosti novější čas a při duplicitě první řádek. Porovnáno s původní lineární referencí. `renderedHistoryMarkup` uchovává pouze malý string, nikoli historii; korekce hodnot se projeví.
- `intervalComparison` bere vzestupné **úplné** řádky výběru před samplingem, ne chart points. Null na kraji nenahradí vnitřním vzorkem; RH Δ v procentních bodech, žádná rychlost, srážkový úhrn/SOC. Dva časy/offsety, Δt a varování o mezerách; v současné zóně prohlížeče. Nejde o opravu AUD-010. Invalidace/změna stanice skryje panel, metriky rain/rainInc/dew nejsou podporované.
- Ověření: 63/63 Node testů (9 nových), nové DOM regrese selhaly na baseline 1473437. Reálný Chromium/Chart.js: všechny záložky/metriky, startup tří konfigurací s fixture CSV +250 ms, souběžné full load → jeden request, slider20/80, prázdná data, témata/mobil390, DST fold +02/+01 správně 1h. Syntax/diff check prošly. Skripty `profile-history.py` a `check-interval-browser.py` jsou volitelné dev nástroje, CI stále Node.
- Výkon: [docs/performance/ETAPA2.md](docs/performance/ETAPA2.md), kompletní raw před/po. 1k/10k/100k/250k, CPU×4, JS heap po GC a 30 cyklů, osm Chart instancí. Historické protějšky při250k 17,3→0,1 ms; stejné refresh texty 46→0 childList/characterData mutací. Celkový refresh kolísá, v první100k sérii i zpomalil; neuvádět plošné procento zrychlení. Při250k ~56 MiB JS heap, raw CSV a procesní RAM zde nezměřeny. Žádný důkaz několikadenní stability nebo fyzického mobilu.
- Zbylá úzká místa: O(n) statistiky/dešťové agregace v refreshUI, více samostatných agregací, plné CSV přenosy včetně overview, polling na pozadí. Nejbližší etapa AUD-010/METEO-048 + METEO-038; cache stanic004 až s limitem paměti. Vyžádat kontrakt času/srážek, umístění a specifikace senzorů před pokročilou interpretací.
- Aktualizace nasazení: veřejné Actions HTML potvrzuje [39483058506](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39483058506), commit1473437, **Success**, 49s, jeden artefakt. Dřívější chyby environment policy jsou historické, nepovažovat je znovu za aktivní blocker. Přímé Pages HTTP v prostředí není povoleno; workflow úspěch není vizuální kontrola live webu.

- Kód v0.2.0 uložen v [14af6c8](https://github.com/Michaltymm/Meteo_webovky/commit/14af6c8084716811b9ff6514168a2107740974c7); úspěch nasazení ověřovat samostatně podle nového Actions běhu, ne podle čísla verze.

- Publikace této etapy: aplikační commit `14af6c8` a analytická dokumentace `c5fe1bf50c196eb4b62bd88a7cb5e72c8cc3b0fb` odeslány na codex-dev; vzdálené SHA ověřeno. [Actions #10](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39589555415) pro c5fe1bf skončilo **Success**, 27s, build8s/deploy9s, jeden Pages artefakt. Workflow sestavilo stávající main + vývoj v0.2.0. Větev main zůstala `2405c5d7326909a24c41e7066bfdc4a9d1622208`. To potvrzuje deployment workflow; načtení živé stránky a skutečné widgety zde nebyly přímo vizuálně ověřeny. Následná aktualizace této paměti mění pouze dokumentaci a nový deployment nevyžaduje. Anotace Node20 action runtime/ubuntu-latest jsou varování, ne neúspěch běhu; modernizaci workflow řešit samostatně v METEO-055.

### Etapa 3: kalendářní dny a DST, v0.2.1 (21. 10. 2026)

- AUD-010 DONE, METEO-048 rozpracované. [Časový model a testy](docs/CAS_A_KALENDAR.md) popisují přesnou hranici změny. Legacy CSV se nadále parsuje v zóně prohlížeče, nic se nepřevádí podle domnělé zóny stanice. Uživatel v jiné zóně a nerozlišená podzimní CSV hodina potřebují následný datový kontrakt.
- `localDateKey` pro denní YYYY-MM-DD, `localCalendarDay` pro rychlé volby, `localDayBounds` pro inkluzivní rozsah do příští půlnoci minus1ms. Nepřidávat 86400s k počátku kalendářního dne; pevné 24h/7d intervaly v exploreru zůstávají klouzavé doby. Porovnání používá lokální den i hodinu, opakovanou hodinu průměruje ve stejné hodinové skupině a UI uvádí zónu.
- Dnešní karty/denní panel vylučují sousední dny; při chybějícím dnešku či veličině se starý text vyčistí na „–“, nula zůstává platná. UV cache používá lokální datum, hodinový polling/počet zdrojových requestů se nemění. UV timezone=auto vs browser hodinový index a DST pole 23/25 zůstávají nevyřešené v METEO-048; tato oprava samotná nezaručuje správnost UV v jiné zóně.
- `tests/calendar-days.test.js`: 17 nových testů v oddělených TZ procesech; celkem 80/80. Na původním 3e236bc stejné dvě regrese selhaly (půlnoc null místo10, konec dne2 místo3 řádků). Prague/NY 23/25h, UTC, UTC+14, São Paulo posun o půlnoci, přelom roku/leap day, neplatné/obrácené datum, chybějící data a UV datum cache.
- Browser skript rozšířen o --at (pevný Date), kontrolu init vstupů/kalendářních voleb a skutečné filtry 23/25h; fixture čas počítá přes UTC, aby nevytvářel neexistující jarní hodinu. Dva běhy se třemi konfiguracemi, reálný Chart.js, mobil390, zpožděné CSV/UV fixture. Výsledky docs/testing/calendar-*.json. Skutečné externí služby/firmware tím ověřeny nejsou; výkon není předmětem této opravy.
- Další implementační krok METEO-038: revizní cache souhrnů s invalidací po CSV/MQTT/resetu i změně dne, srovnání proti plným statistikám a měření před/po. METEO-005 pozastavení pollingu na pozadí poté; bez bezlimitní cache tří velkých historií. Main/konfigurace/workflow/archiv se v této etapě nemění.

- Publikace v0.2.1: [076bc08](https://github.com/Michaltymm/Meteo_webovky/commit/076bc0865a34961ebef4cd14e98062976c3ef956) odeslán na codex-dev, vzdálené SHA ověřeno. [Actions #11](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39593972552) **Success**, 44s, build12s/deploy24s, jeden artefakt. Workflow deployment potvrzen, živá data/browser Pages přímo neověřeny; lokální browser používá řízený transport. Main stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Následující commit aktualizuje pouze dokumentaci a nový deploy nevyžaduje.

### Etapa 4: sdílené souhrny a pozadí, v0.2.2 (21. 10. 2026)

- METEO-005 DONE, METEO-038 rozpracované. `dataAggregates` je jediný snapshot aktuálního zdroje: globální teplotní extrémy s řádky, denní maximum rain, denní/měsíční součty a validní počty T/RH a dnešní T/RH/P/rain/poslední V. Bez kopií raw historie a bez cache tří stanic. Sdílejí refreshUI/buildDailyGrid/buildAgg/srážkový graf. Pořadí součtů i řazení zachovány; žádná statistika z min/max vizuální redukce. Hodinové agregace/procentuální pokrytí a roční statistiky mají další etapu, neoznačovat celý METEO-038 DONE.
- Cache se ruší v invalidateDerivedData po CSV/MQTT/resetu. Ověření source/length + místního dne a jeho mezí zajišťuje také výměnu pole/půlnoc; in-place změny stále vyžadují explicitní invalidaci. Při neplatných číslech se počítají jen konečné hodnoty, nulové hodnoty se neztrácejí. Chybějící globální extrémy v UI se vyčistí. U sousedních měření stejného dne/měsíce se znovu netvoří textový klíč a nehledá skupina v Map.
- PeriodicRefresh kontroluje document.hidden, generaci relace a poslední pokus dle intervalu. Konfiguraci nesmí předběhnout pollingContext=null. Návrat obnoví jen zastaralé Sheets/UV/overview, také přepočítá UI po změně dne. UV/overview nově sdílí pending Promise, Sheets již sdílení měly. Pokus nikdy neznamená úspěšnou synchronizaci; nové UV chyby nemají retry na každý visibility event. Staré timery zrušené relace zůstávají neplatné. MQTT se při skrytí/návratu neodpojuje ani nereconnectuje; zprávy a již běžící síť se neruší. Ruční refresh/start zůstávají explicitní akce, intervaly ve skrytí neprovádějí periodické dotazy.
- 96/96 Node testů (7 souhrny, 9 pozadí nových); nezávislá reference plných dat, 250k bez dalšího čtení řádků pro další konzumenty, in-place oprava/delete/CSV/MQTT/reset, půlnoc, null/nula, reentrance, pending full, staré timery, ruční refresh, both/MQTT-only bez dalšího klienta. Sdílený VM helper nově zachytává intervaly a visibility listener; původní in-place test doplnil již povinné invalidateDerivedData.
- Výkon a surová data: [ETAPA4](docs/performance/ETAPA4.md). Při 250k refresh po invalidaci89,4→46,3ms, opakovaný79,1→23,1ms, denní karty33,0→0,2ms, denní graf35,4→3,3ms, měsíční27,2→2,4ms. Při 1k malé kolísání i zpomalení, neuvádět univerzální procento. CPU×4/100k cold213,3→136,4ms. JS heap250k56,36→56,48MiB; osm Chart instancí. Není to celá RAM, Web Vitals ani fyzický telefon.
- Browser skutečný Chart/DOM/timery: skryto10min/24h →0 periodických HTTP; návrat10min→3 požadavky (aktivní Sheets + dvě ostatní), další den→4 s UV. Rychlé přepínání nic nepřidalo, oprava starého extrému85→99 zachovala1000originálů, půlnoc vyčistila dnešek. Viditelnost je řízený document.hidden + event, nejde o nativní uspávání OS. Další browser běh ověřil všechny tři konfigurace, 23/25h, mobil390 a všechny taby/metriky. Živý broker/služby/několikadenní soak neověřeny.
- Navrhy_Vylepseni.md zůstává historický audit; aktualizovaná pouze úvodní evidence W06/W14 a odkaz na současné výsledky. Backlog jedině docs/NAPADY_A_ROADMAP.md. Konfigurace, workflow, archiv a main neměněny.

- Publikace v0.2.2: [83da84c](https://github.com/Michaltymm/Meteo_webovky/commit/83da84ca3eb2a335407c4a9c3b9c011af76e9b83) odeslán na codex-dev, SHA ověřeno. [Actions #12](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39598503481) **Success**, 33s, build 12s/deploy 12s, jeden artefakt. Main zůstává `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Workflow deployment potvrzen, přímé živé widgety Pages neověřeny. Následující aktualizace paměti je pouze dokumentace a nový deployment nevyžaduje.

### Etapa 5: hodinové souhrny a podklady, v0.3.0 (21. 10. 2026)

- METEO-038 pokračuje, žádné nové ID. `dataAggregates` přidává indexy start/end každého dne, `hourlyDay` projde jen jeho originální řádky. Nejvýše osm dnů v LRU mapě aktuálního snapshotu; ne všechny hodiny celé historie. Invalidace CSV/MQTT/reset/oprava/půlnoc zahodí i hodiny a vyčistí cmpDataQuality.
- Vzestupné timestampy s původním pořadím uvnitř duplicit zachovávají součty původního stable sortu. Průměry nad plnými konečnými T/RH/P, nula platná, null/nekonečno nezastupovat nulou. Žádné automatické odstranění duplicit. Dataset má sampleCounts/uniqueCounts pro tooltip, porovnání již používá spanGaps=false (dílčí METEO-036). Stejná původní hodina s dvěma offsety stále jeden průměr, ale dvě pozorované hodinové skupiny.
- Rozbalovací „Podklady hodinových průměrů“: záznamy vs různé interpretované časy, číselné hodnoty metriky, skupiny místní hodiny+offsetu s daty / existující skupiny dne, délka dne, span časů a nejdelší rozdíl sousedních různých časů. Jmenovatel na minutové mřížce, testované současné 23/25h a půlhodinové DST. Nejde o procento dostupnosti, souvislé pozorování ani automaticky výpadek. Legacy CSV bez offsetu nerozliší dvojí podzimní timestamp; METEO-048 zůstává otevřené. Panel rozlišuje částečnou/celou dostupnou načtenou historii a používá textContent.
- 110/110 Node testů, 14 nových. Reference původního algoritmu, floating-point pořadí duplicit, 0/null/nonfinite, sparse endpoints, empty day, LRU, warm čtení bez scan250k, historická oprava/reset, tooltip/partial, Prague/NY/UTC+14/Lord Howe včetně 24,5/23,5h a dvou podzimních offsetů. Původní spojení chybějící hodiny reprodukováno na c37227f (null + spanGaps=true), nyní null + false.
- Chromium/Chart.js s řízenými CSV/UV: všechny tři konfigurace, hodinový průměr a n, details/tooltip, dva tématy a mobil390; 2/25 a 2/23 hodinových skupin, skutečný rozdíl1h, prázdná jarní hodina, žádné pageErrors/overflow. Screenshot vizuálně zkontrolován. Smoke všech tabů/metrik a pozadí prošly; živé služby/firmware/broker tím ověřeny nejsou.
- [Výkon a surová data ETAPA5](docs/performance/ETAPA5.md): 250k cold compare35,3→28,4ms, opakované32,7→5,1ms; CPU×4/100k cold98,0→53,5ms a warm91,3→21,8ms. Malé1k první porovnání7,3→9,2ms kvůli novým podkladům; neuvádět univerzální zrychlení. Heap250k56,31→56,53MiB a osm Chart instancí i po30cyklech. LRU limit není omezení počtu uživatelem vybraných grafových řad; JIT/CSV/síť/Web Vitals/multiday nejsou měřené.
- METEO-038 zůstává rozpracované kvůli ročním konzumentům a vymezení pozorovaného času/dostupnosti podle ověřeného měřicího plánu. HTTP CFG.interval není měřicí interval senzoru. Poté bateriový modul METEO-019/020/031 bez SOC/energie jen z V; explicitní zóna/UV v METEO-048 samostatně. Konfigurace, workflow, archiv a main neměněny.

- Publikace v0.3.0: [07e63b1](https://github.com/Michaltymm/Meteo_webovky/commit/07e63b1f1808d9dfe97529e6e6f8139f64d6a494) odeslán na codex-dev, vzdálené SHA ověřeno. [Actions #13](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39602279948) **Success**, 30s, build 12s/deploy 10s, jeden Pages artefakt. Main stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Úspěšný deployment workflow není přímá kontrola živých widgetů; lokální browser měl řízené CSV/UV. Následující commit mění pouze dokumentaci.

### Etapa 6: sdílené roční statistiky, v0.3.1 (21. 10. 2026)

- METEO-038: `dataAggregates.years` obsahuje indexové meze v sestupných originálech. Lazy `annualStats(year,snapshot)` cachuje jen skutečně vyžádané roky aktuálního datasetu; měsíční průměry sdílejí původní součty/počty. Roční součty v původním pořadí, rekordové shody vybírají nejnovější řádek a stejné měsíční hodnoty kalendářní pořadí. Žádná statistika z redukovaných grafů. Dočasné odkazy rain pro stable sort se neuchovávají, pouze výsledky; nejde o cache historie dalších stanic.
- Invalidace přes původní CSV/MQTT/reset/opravy/datum. Opakovaný render nepřepisuje možnosti filtru; zaniklý rok i prázdná historie přejdou na dostupnou volbu. Nonfinite hodnoty se do ročních výsledků nezapočítají, nula zůstává validní.
- METEO-017/049: potvrzené nepřesné popisky „Max srážky/h“ a „Max za24h“ opraveny při zachování čísel. První je maximum rainInc jednoho záznamu, druhý legacy rozdíl čítače mezi začátkem a koncem okna do 24h v jednom roce. Neřeší reset a není prokázaným úhrnem. Maximum denních rain není roční součet. Skutečné úhrny/intenzity nadále vyžadují ověřený význam rain/rainInc, jednotky, reset a interval měření; CFG.interval je HTTP polling.
- 119/119 Node testů, devět nových: nezávislá reference ročních hodnot a osmi žebříčků přes několik let, floating-point pořadí, rekordové shody/0/null/nonfinite, lazy výběr roku, 250k bez opakovaného čtení, CSV/MQTT/reset/oprava/delete, filtr/empty, duplicitní rain/reset a lokální hranice roku Prague/Los Angeles. Syntax inline JS/Python, evidence JSON/verze a diff kontrola prošly.
- Skutečný browser DOM/Chart.js, tři původní konfigurace a řízené CSV/UV: 1000 řádků/tři roky, všechny tabulky a čísla shodné s bf31182 i po opravě starého záznamu. Přepínání roku bez requestů, filtr/empty/removed year, tooltip, dvě témata a 390/1280px bez přetečení/page errors. Mobilní screenshot prohlédnut. Živé služby, firmware, broker a dlouhý provoz tím ověřeny nejsou.
- [ETAPA6 — metodika a surové JSON](docs/performance/ETAPA6.md): 1k/10k/100k/250k, sekvenční běhy; při 250k roční po invalidaci 177,2→98,9ms a opakované 160,7→1,2ms. CPU×4/100k 384,9→204,3ms a 368,6→3,7ms. Cold refresh250k 54,1→54,2ms (bez zrychlení), heap po GC 56,88→56,83MiB (malý rozdíl), DOM 3307→3307 a Chart 8→8 po 30 cyklech. Měří synchronní volání a DOM, ne pozdější paint, celou RAM, Web Vitals, síť/parser nebo fyzický mobil. První výpočet stále může blokovat hlavní vlákno.
- METEO-038 má dokončené sdílení hodin/denních/měsíčních/ročních výsledků a rozlišení pozorovaných časů/počtů. Celé ID zůstává rozpracované: dostupnost potřebuje ověřený plán senzoru. Následuje METEO-019/020/031 teplota×napětí s kvalitou párování; před fyzikální interpretací ověřit umístění čidla, bez SOC/kapacity/energie jen z V. Zóna/UV METEO-048 a omezená cache004 samostatně. Konfigurace, workflow, archiv a main nezměněny; Navrhy_Vylepseni pouze aktuální úvodní evidence.

- Publikace v0.3.1: [f807173](https://github.com/Michaltymm/Meteo_webovky/commit/f807173f77a033a4648ab4af1667798649941d10) odeslán na codex-dev, vzdálené SHA ověřeno. [Actions #14](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39606840157) **Success**, build 16s/deploy 9s, celkem 33s, jeden Pages artefakt. Main stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`. To potvrzuje deployment workflow; přímé widgety živých Pages zde nejsou ověřeny. Následující commit mění pouze dokumentaci.

## INSTRUCTIONS FOR FUTURE AI AGENTS

1. Nejprve přečti QUICK CONTEXT; potom jen sekce relevantní k zadání.
2. Audit není vždy aktuální: ověř důležité skutečnosti ve zdrojovém kódu a zkontroluj související ID/rizika.
3. Po změně aktualizuj dotčené záznamy a ověřené příkazy; DONE až po skutečném ověření, s jeho výsledkem.
4. Nové problémy/nápady přidej se stabilním ID; nevytvářej duplicity ani zbytečný backlog.
5. Nedělej celý audit znovu, pokud to úkol nevyžaduje. Zachovej důležitá rozhodnutí a oprav rozpor dokumentace/kódu.
6. Použij existující izolovaný checkout; bez výslovné žádosti nevytvářej Git worktree. Zachovej cizí změny.
7. Odděluj fakta, hypotézy a návrhy i prošlé, selhané a neprovedené testy. Chybu sítě nevydávej za chybu aplikace.
