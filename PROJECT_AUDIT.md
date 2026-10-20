# Projektová paměť a audit

## QUICK CONTEXT
- Aktualizováno 2026-10-20; výchozí revize `fbb9659` (`main`). Audit ověřuj proti kódu.
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
- `Navrhy_Vylepseni.md` je historický seznam, některé nápady už existují (viz D).
- AUD-001 DONE: server omezuje veřejné cesty i reálné cíle symlinků; 6 regresních testů prošlo.
- Testy: `node --test tests/server.test.js`; server má testovatelnou factory `createServer(rootDir)`.
- Další priorita: AUD-002 (izolace asynchronních odpovědí stanic), AUD-003 (CSV → HTML/XSS).
- Živá data nebyla ověřena: onboarding proxy vracela CONNECT 403; neplést s chybou aplikace.
- Nevkládat přístupové údaje do JSON, auditu ani logů. Veřejné Sheet ID není autentizační token.
- Zachovat líné vykreslování a oddělené konfigurace stanic; nezačínat rozsáhlým rozdělením monolitu.
- Kontext celého systému: `ANALYZA_CELEHO_WORKSPACE.md` na GitHubu, revize `29ecf56`; souvislosti a mapování nálezů viz B.1.
- Na `Raw_Data` nepřecházet pouhou změnou názvu listu: liší se timestampy a význam J/R. Firmware a živé nasazení zde nejsou ověřeny.
- Publikování main + `/dev/` funguje dle potvrzení uživatele; workflow `.github/workflows/pages.yml`, postup `docs/PAGES.md`, DEPLOY-001 DONE v H.

## A. PROJECT CONTEXT

Projekt zobrazuje aktuální počasí, historii, statistiky srážek a napětí, porovnání dní, poznámky a odhady slunce/Měsíce/UV. Uživatelská konfigurace je lokální v prohlížeči; server nemá databázi, API pro zápis ani skutečnou autentizaci.

| Cesta | Úloha |
| --- | --- |
| `index.html` | Produkční vstup; veškeré styly, UI a aplikační JavaScript |
| `server.js` | Statický HTTP server s portem 8080; kořen `__dirname`, export `createServer(rootDir)` pro testy |
| `tests/server.test.js` | Šest skupin HTTP regresí bez externí sítě/závislostí; dočasné fixture a náhodný port |
| `AGENTS.md`, `PROJECT_AUDIT.md` | Pravidla práce a projektová paměť s ověřenými nálezy |
| `.github/workflows/pages.yml`, `scripts/build-pages.js`, `tests/pages.test.js`, `docs/PAGES.md` | Publikování `main` a `codex-dev` jako jednoho Pages artefaktu, allowlist veřejných souborů, testy a aktivační postup |
| `config_praha_baterie.json`, `config_praha_okno.json`, `config_stanice3.json` | Automaticky načítané konfigurace tří stanic |
| `config.json` | Starší konfigurace jedné stanice, současný automatický start ji nečte |
| `Git/MQTT_webovky/index.html` | Druhá odlišná implementace (3219 řádků oproti 4878); kořenová stránka na ni neodkazuje |
| `setup.txt`, `README.md` | Postup pro Windows Live Server; README obsahuje pouze název |
| `remote_parse.txt` | UTF-16 úryvek staršího parseru; není načítán aplikací |
| `Navrhy_Vylepseni.md` | Starší návrhy; nejsou autoritativním popisem aktuálního stavu |

Závislosti v prohlížeči: Chart.js a Paho přes pevné CDN URL, Google Sheets CSV, Open-Meteo a dva záložní CORS proxy (`corsproxy.io`, `api.allorigins.win`). MQTT je volitelný; dodané konfigurace mají prázdný host a zdroj `sheets`. Není potřeba instalovat balíčky ani sestavovat aplikaci. V repozitáři nebyly před auditem testy ani CI.

Ověřený postup: `node server.js`; HTTP požadavky na `/` a čtyři JSON soubory vracejí obsah projektu, neexistující cesta 404. Ověřeno i spuštění absolutní cestou z `/tmp` (neservíruje pracovní adresář). `node --test tests/server.test.js`: 6/6 prošlo, žádné přeskočené testy. `node --check server.js` a `git diff --check` prošly. Browser smoke s reálným Chart.js: titul, všechny záložky a změna stanice bez page errors; externí data a volitelný MQTT CDN byly v tomto testu záměrně blokovány, aby test izoloval změnu serveru. Chromium používá důvěryhodné CA prostředí v dočasné NSS databázi, nikoli vypnuté TLS ověřování. Živá data/UV ani skutečné MQTT připojení tím nejsou ověřeny.

## B. ARCHITECTURE MAP

Všechny následující funkce jsou v `index.html` (hledat názvy, čísla řádků se mění):

1. `STATION_DEFAULTS`, načtení localStorage a migrace → `stations`, `activeIdx`, `CFG`.
2. `switchStation` → vyprázdnění `store` → `tryLoadConfigJson` → `_applyCfgObject` → `startAll`.
3. `startAll` spouští Sheets interval, případně MQTT a UV; `fetchAllOv` samostatně aktualizuje přehled ostatních stanic.
4. `fetchSheets` volí quick/full/incremental a přímé/proxy URL; `parseAndStore` odloží parsování pomocí `setTimeout`.
5. `splitCSV`, `stripQ`, `pf`, `parseCSDateTime` převádějí hodnoty na záznamy `{date,time,ts,temp,pressure,hum,rainInc,rain,tank,voltage,note}`.
6. `store.rows` má nejnovější záznam na indexu 0; `refreshUI` aktualizuje společné karty a `ovStores[activeIdx]`.
7. `markAllTabsDirty` / `refreshTab` omezují render na aktivní záložku. `ensureFullData` řídí jednorázové načtení historie a čekající callbacky.
8. `buildCharts`, `buildAgg`, `buildExplorer`, `_drawExplorerPts`, `buildCompare`, `buildTempOverview`, `buildYearlyStats`, `buildNotesTable` vytvářejí jednotlivé pohledy.
9. `fetchUVData` → sdílený `uvStore` → `updateSunBar` a canvas; astronomické výpočty jsou lokální odhady.

Rizikové vazby: změna stanice musí zneplatnit všechna stará asynchronní dokončení; parser/řazení ovlivňuje grafy i přehled; změna CSV sloupců zasáhne hlavní i overview parser; barvy grafů jsou pevné a ne všechny sledují CSS téma.

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

## C. CONFIRMED ISSUES

Priority: P0 = bezprostředně kritické; P1 = bezpečnost/funkční spolehlivost; P2 = správnost okrajových případů/údržba; P3 = volitelné. Žádný doložený P0; skutečné veřejné nasazení serveru není potvrzeno.

| ID / priorita / stav | Místo a důkaz | Dopad a doporučení |
| --- | --- | --- |
| AUD-001 / P1 / DONE | Původní `server.js`: `path.join(process.cwd(), req.url…)` bez omezení cest. Raw HTTP `GET /../<dočasný-sentinel>` vrátil 200 a obsah neškodného souboru mimo checkout; `/.git/HEAD` také 200. Po opravě raw/encoded traversal a metadata vrací 403, neplatné URL 400. | Opraveno v `server.js`: dekódovat a ověřit segmenty, `realpath` + kontrola relativní cesty včetně skrytých cílů symlinků, pouze běžné soubory, kořen u skriptu místo cwd. `tests/server.test.js`: 6/6 prošlo; HTTP smoke na skutečném projektu zachoval všechny konfigurace a index. |
| AUD-002 / P1 / TODO | `tryLoadConfigJson(i)` po `await` volá `_applyCfgObject`, které zapisuje do **aktuálního** `activeIdx`. VM test opožděného konfigu A přepsal stanici B; `fetchSheets`, odložený parser a UV obdobně sdílejí stav bez identity požadavku. | Cizí konfigurace se uloží do localStorage, data/grafy mohou patřit jiné stanici. Zavést generační identitu konfigurace a AbortController; ověřovat platnost po každém await i před odloženým zápisem. Samotné abortování nestačí. |
| AUD-003 / P1 / TODO | `updateHistoryTable` vkládá `r.date/r.time` do `innerHTML`, `buildNotesTable` escapuje jen poznámku. VM ověřil, že `parseCSDateTime('20.10.2026<img src=x onerror=…>', '10:00')` projde díky `parseInt`. | HTML z CSV se může dostat do aktivního DOM (XSS). Používat textContent/bezpečné escapování všech řetězců; přísná validace parseru je další vrstva. Důkaz: přijetí payloadu a neescapovaný sink; spuštění skriptu v reálném prohlížeči nebylo testováno. |
| AUD-004 / P1 / TODO | `parseAndStore` vrací ihned a parsuje až za 10 ms; `fetchSheets` mezitím nastaví OK/fullLoaded a spustí callbacky. Kontrola odpovědi je jen délka >10; neplatná CSV/HTML nemusí zrušit úspěch. Full fetch nemá timeout. | Falešné OK, neúplná/stará historie, nesprávné callbacky nebo nekonečné čekání. Parser vracet/awaitovat, potvrdit alespoň jeden validní záznam, atomicky publikovat úspěch, doplnit timeout a cleanup. |
| AUD-005 / P1 / TODO | `buildCharts`: bez napětí `vr=[]`, ale `Array(vr.length - 1)` vyhodí RangeError. VM reprodukce s platným záznamem a `voltage:null`. | Chybějící volitelný senzor přeruší aktualizaci grafů a agregací. Prázdné datové řady a predikci řešit explicitně; testovat null/0/1/více hodnot. |
| AUD-006 / P2 / TODO | `parseCSDateTime` přijímá přetečení `31.02.2026`, `25:90` (VM: normalizace na březen místo chyby). `splitCSV` přepíná u každé uvozovky a ztrácí escapované `""`; rozdělení po řádcích nezvládne víceřádkové buňky. | Chybné timestampy/poznámky a možné chybné odvozování roku. Přísná kalendářní validace, explicitní kontrakt CSV a fixture testy; rok bez roku nelze vždy spolehlivě určit. |
| AUD-007 / P2 / TODO | `buildAgg(...,'day',...)` klíčuje jen `d.m.`. VM: 20.10.2025=0 °C + 20.10.2026=20 °C → jediný den s 10 °C. | Směšování ročních historií v denním grafu. Interně klíč YYYY-MM-DD, zobrazovaný popisek oddělit. |
| AUD-008 / P2 / TODO | `fetchSheets` incremental: `fullURL` už obsahuje `?`, připojuje další `?tqx…`; `sheet` tedy obsahuje přidaný text. `_lastRawLine` se mění před úspěšným plným fetch. | Neúčinná nebo falešná detekce změn. Použít URL/searchParams, platný rozsah/pořadí a validovat odpověď; otisk měnit až po potvrzených datech. |
| AUD-009 / P1 / TODO | `connectMQTT` vytvoří lokálního klienta; neukládá ho k odpojení. `startAll`/switch neničí staré spojení a reconnect setTimeout není rušitelný. Ověřeno čtením kódu, nikoli proti brokeru. | Duplicity a zprávy staré stanice do nového store. Spravovat životní cyklus klienta i reconnect, navázat ho na identitu stanice (AUD-002). |
| AUD-010 / P2 / TODO | `buildCompare` seskupuje dny přes UTC `toISOString().slice(0,10)`, hodiny přes lokální `getHours`. Pro Prague 00:30 je UTC předchozí den. | Půlnoční měření v nesprávném dni; stejné UTC datum používají date inputy/UV cache. Definovat časovou zónu a konzistentní denní klíče, testovat DST. |
| AUD-011 / P2 / TODO | `updateHistoryTable`: `parseInt(histLimit.value) || 500`; volba Vše má value=0. VM: 501 záznamů → 500 řádků. | Uživatel nedostane celou historii. Rozlišit 0 od neplatného vstupu; u dlouhých tabulek přidat stránkování. |
| AUD-012 / P2 / TODO | Po `switchStation` se maže store, ale ne stávající karty/grafy; `_drawExplorerPts([])` vrací před vyčištěním grafu. Ověřeno čtením kódu. | Staré hodnoty mohou zůstat pod novým názvem stanice nebo prázdným filtrem. Vyčistit/označit zastaralá data a mít explicitní loading/empty/error stav. |
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

## F. PRIORITIZED ROADMAP

TOP 10 v doporučeném pořadí (P0 nyní bez potvrzených položek):

| Pořadí / priorita | ID / stav | Proč teď / závislost |
| --- | --- | --- |
| 1 / P1 | AUD-001 DONE | Uzavřeno a regresně ověřeno; před změnou reprodukované zpřístupnění souborů, bez přepisu UI. |
| 2 / P1 | AUD-002 TODO | Chybná trvale uložená konfigurace a záměna dat podkopávají všechny pohledy; připraví lifecycle i pro MQTT/cache. |
| 3 / P1 | AUD-003 TODO | Uzavřít neescapované HTML vstupy před přidáváním dalších datových funkcí. Nezávisí na přestavbě parseru. |
| 4 / P1 | AUD-005 TODO | Malá reprodukovaná oprava pádu při chybějícím napětí; snadno ověřitelná bez sítě. |
| 5 / P1 | AUD-004 TODO | Spolehlivý commit dat a pravdivé stavy jsou nutné pro lazy historii i cache; navázat na AUD-002. |
| 6 / P1 | AUD-009 TODO | Ukončit staré MQTT klienty/reconnect; použít lifecycle z AUD-002, testovat mockem. |
| 7 / P2 | AUD-006 TODO | Přísný CSV/datum kontrakt zabrání tiché normalizaci a ztrátě poznámek; využít fixture testy. |
| 8 / P2 | AUD-007 + AUD-010 TODO | Správná víceroční a lokální denní agregace; otestovat hranice let a DST, závisí na timestamp kontraktu. |
| 9 / P2 | AUD-008 TODO | Zprovoznit úsporné ověřování změn až po správném fetch/parser lifecycle. |
| 10 / P2 | AUD-012 + AUD-011 TODO | Odstranit zavádějící stará/prázdná data a nefunkční Vše; pokračovat a11y a cache dle měření. |

IMP-001 je průběžná podmínka každé opravy; testy serveru jsou hotové, frontend/CI zůstávají TODO. Po datových opravách pokračovat AUD-013 a cache dle měření. P3: FUT-001, IMP-008 až po stabilizaci dat. Žádné návrhy nebyly označeny REJECTED; dokončení musí mít důkaz v H.

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
- Nezaměnit `stationIdx` s nynějším `activeIdx`; konfig i data musí být svázané s původním požadavkem.
- `store.rows[0]` je nejnovější záznam; grafy potřebují lokálně vzestupné pořadí. Nemutovat sdílené pole kvůli grafu.
- Chybějící senzor je `null`, nikoli 0. Predikce bez reálných dat nesmí vymýšlet nuly.
- Veškerý text z CSV/konfigurace je nedůvěryhodný, včetně datumu a času; pro DOM preferovat textContent.
- Pro denní klíč používat rok a jasně určenou zónu; popisek je jiná věc než interní identita.
- Audit vznikl z kontroly souborů a lokálních HTTP/VM reprodukcí; není důkazem funkčnosti živých dat.
- 2026-10-20: AUD-001 opraveno. Zachován port, veřejné soubory, MIME a CORS; import serveru už nesmí otevřít port. Výchozí root je adresář skriptu. Nevracet na prostý string-prefix check ani cwd; kontrolovat i reálné cíle symlinků. 6/6 HTTP regresí + startup z `/tmp` + browser smoke prošly. Důkazy před/po viz C/A.
- AGENTS.md ani předchozí audit ve výchozím checkoutu neexistovaly; vytvořeny při tomto úkolu. Další doporučená práce je AUD-002; nespojovat ji bez potřeby s rozsáhlým refaktoringem.
- 2026-10-20: prostudován také audit celého ESP/Apps Script/web workspace z GitHubu (`29ecf56`), souvislosti uloženy v B.1. Pro změny schématu a obnovy dat číst zejména jeho §6, W02/W04 a D01. Tvrzení o firmware a cloudovém příjmu zůstávají převzatá, dokud nebudou ověřeny jejich skutečné zdroje/nasazení.
- VIS-001 / DONE / 2026-10-20: uživatelem vyžádaný test zápisu na GitHub. V `index.html` změněno pouze výchozí `--bg` z `#1e2a38` na `#24213b`; Chromium ověřil výslednou barvu při 1280×800 i 390×844 (CSS test, JS vypnutý). Commit `c197717eedd5f1d23a62cac12d2c765364c43ce4` odeslán na `origin/codex/test-background-color`, shoda vzdáleného SHA potvrzena přes `git ls-remote`. Větev vychází z `29ecf56`; není sloučena do main. Předchozí oprava serveru, testy a tato projektová paměť zůstávají lokálně necommitované.
- DEPLOY-001 / DONE (zprovoznění potvrzeno uživatelem) / 2026-10-20: publikační změna `a024441` odeslána na `codex/pages-preview` (základ pro PR do main), vývojová větev `codex-dev` odeslána na `d3ef6a7` (obsahuje též fialové pozadí). Vzdálené SHA potvrzeny, main zůstává `29ecf56`. Workflow publikuje hlavní obsah do kořene a vývojový do `/dev/` vždy společně; do artefaktu smí jen pět veřejných souborů z každé větve. Vývoj má banner a vlastní preference přes prefix `meteoDev:`; oba weby stále sdílejí origin a případně datové služby.
- DEPLOY-001 ověření: 4/4 testy sestavení, `node --check`, `git diff --check`, actionlint 1.7.7 (oficiální release s ověřeným SHA-256), Chromium s reálným Chart.js nad oběma lokálními sestavenými adresami: banner/titul/barva, relativní JSON i zachování hlavních předvoleb při změně vývojových prošly. Externí data/MQTT v browser testu blokovány; skutečný běh GitHub Actions a živý `/dev/` zatím nejsou ověřeny.
- DEPLOY-001 zbývá: uživatel vytvoří/sloučí PR `codex/pages-preview` → `main`, v Pages nastaví Source GitHub Actions a spustí workflow z main. Pokud environment github-pages omezuje větve, povolit main i codex-dev. Dostupné API vrací 403 pro čtení Pages i vytvoření PR; Git fetch/push funguje. Název `codex` koliduje s existujícími `codex/*`, proto vývoj používá `codex-dev`. Další práce a aktivační kroky viz `docs/PAGES.md` na odeslaných větvích. Lokální oprava serveru a starší audit nejsou součástí těchto commitů.
- DEPLOY-001 aktualizace: následným Git fetch ověřeno sloučení PR #2 do main (`2405c5d`); workflow je již v main. Screenshot uživatele dokládá úspěšný PR build, ale deploy byl správně přeskočen pro událost pull_request. Pokus `gh workflow run pages.yml --ref main` po merge stále blokuje GitHub API 403. Přímou kontrolu obou veřejných webů blokuje egress proxy 403, což nedokazuje nedostupnost webu. Zbývá ověřit Source GitHub Actions a úspěšný push/manual deploy v uživatelském rozhraní; neopakovat merge již dokončeného PR.

## INSTRUCTIONS FOR FUTURE AI AGENTS

1. Nejprve přečti QUICK CONTEXT; potom jen sekce relevantní k zadání.
2. Audit není vždy aktuální: ověř důležité skutečnosti ve zdrojovém kódu a zkontroluj související ID/rizika.
3. Po změně aktualizuj dotčené záznamy a ověřené příkazy; DONE až po skutečném ověření, s jeho výsledkem.
4. Nové problémy/nápady přidej se stabilním ID; nevytvářej duplicity ani zbytečný backlog.
5. Nedělej celý audit znovu, pokud to úkol nevyžaduje. Zachovej důležitá rozhodnutí a oprav rozpor dokumentace/kódu.
6. Použij existující izolovaný checkout; bez výslovné žádosti nevytvářej Git worktree. Zachovej cizí změny.
7. Odděluj fakta, hypotézy a návrhy i prošlé, selhané a neprovedené testy. Chybu sítě nevydávej za chybu aplikace.

- DEPLOY-001 dokončení: uživatel následně potvrdil „už to funguje“. Nasazení hlavní/vývojové verze je tím potvrzené uživatelem; nezávislá HTTP kontrola z tohoto prostředí zůstává neprovedená kvůli dříve doloženému egress 403. Další změny webu připravovat v codex-dev, kontrolovat na /dev/ a do main slučovat po schválení uživatelem.
