# Projektová paměť a audit

## QUICK CONTEXT
- v0.18.3 (2026-10-24): třetí malá část METEO-008 hotová, celé ID Rozpracováno. Profil heatmapy/vyhlazení/noci vybral zbytečný plný průchod noční analýzy. Vzestupný původní model, dvě binární inkluzivní meze, průchod jen západ–východ: O(log n+k), O(1) pomocně, bez cache/requestů/nového plánovače. Duplicity/nuly/null/mezery>3h/astronomie/DST/text/částečná noc zachované. Před/po250k regular32,7→0,1ms, dense68,6→12ms, celá hustá noc85,9→36,3ms; CPU×4/100k regular63,6→0,8ms, celá hustá noc156,1→61,9ms. Hustá noc zůstává synchronní O(k), žádná záruka16ms/INP. Všech12přesných SHA shodných.342/342Node,10nových testů/reference/100náhodných historií/DST3zón/Proxy250k<200čtení. Opravena jen testovací fixture visibleDay, selhání data-status potvrzeno i na původním HTML; produkční visibility beze změny. Viz docs/performance/NOCNI_ANALYZA.md. Baseline0f2ad15, pouze codex-dev. Dále navázat na již provedený profil volitelného vyhlazení a jeho plné dočasné pole; neopakovat model/porovnání/noční výběr. Rozšířený Chromium154/100k/9grafů/3konfigurace/zoom/PNG/320–1440px/obě témata prošel, včetně přesného nočního textu/memo bez requestů; žádný pageerror/socket. Publikování evidovat na konci etapy.
- v0.18.2: druhá část METEO-008 hotová, celé ID Rozpracováno. Velké porovnání pro Sheets/společný výřez má samostatný comparisonJob až nad hotovým modelem. Stejný workSlice~8ms/max64kroků; matcher kontrolní body512, filtr/sampling1024, synchronní API dokončí stejné generátory. Pravidla10min/nejbližší/dřívější/one-to-one/duplicit a plné statistiky zachované. Snapshot cache/source/model/context/domain/loading/errors, atomický commit; invalidace/odchod/skrytí ruší, změna cizí cache zneplatní/restartuje viditelnou kartu. Busy/PNG jen karta8, ostatní model/grafy/cizí fetch zůstávají.332/332Node včetně11nových, skutečný Chromium100k/9grafů/3konfigurace/zoom/PNG/320–1440px +info harness prošly, bez pageerror/socketů. Přesné podpisy datasetů i nezaokrouhlených match výsledků před/po shodné.250k/+5s blok149,5→8,5ms, celek149,5→281,8ms; CPU×4/100k blok266→9,6ms, celek266→445,2ms. Menší blokování, nikoli celkové zrychlení; viz docs/performance/POROVNANI_STANIC.md. Baseline9fd455b. Dále profil heatmapy/vyhlazení/noční analýzy; velký CSV parser a streaming/nezávislé rozsahy dále. Jen codex-dev.
- v0.18.1: první část METEO-008 hotová, celé ID Rozpracováno. Společný Sheets výřez od10k vybraných řádků připravuje jeden model v dávkách ~8ms/max64kroků; kontrolní body po1024položkách, stejné generátory pro synchronní API i UI. Kopie referencí/úplný souhrn/gapy/minmax/XY, přesné pořadí výpočtů zachováno. Rušení na každou invalidaci/odchod/skrytí, guard identity/context/source/length/domain; žádný částečný commit. Busy skrývá staré plátno, čistí staré heat detaily a vypíná PNG do překreslení. Malé/nezávislé a MQTT/both zůstávají synchronní kvůli riziku opakovaného rušení streamem.321/321Node (včetně13nových cílených), nový skutečný Chromium harness100k/9grafů/3stanice/PNG/zoom/320–1440px prošel. Před/po modelu250k: nejdelší blok389,6→10,7ms, celé dokončení389,6→685,6ms; CPU×4/100k834,4→20,1ms blok a834,4→925,2ms celek, přesně stejné podpisy celých souhrnů/bodů. Bez tvrzení rychlejšího celého webu/INP. Viz docs/performance/ANALYTICKY_MODEL.md. Baselinefcdcbba; dále podle profilu rozdělit první přípravu porovnání stanic. Velký CSV parser, night/smoothing/heatmapa, nezávislé výřezy a streaming snapshot dále.
- v0.18.0: METEO-050 DONE v rozsahu provozního panelu CSV/časování/MQTT. Živé zprávy mají lokální čítače obsloužených/uložených/odmítnutých a 8 pevných důvodů, chyby aplikace oddělené včetně selhání po uložení. Limity, číselná pravidla, duplicity i nulové/chybějící senzory zachovány. Reconnect drží čítače, reset/změna stanice čistí, staré callbacky ignorovány; metadata bez payloadu/topicu/hostu/chyb. MQTT ponechá otevřenou jen diagnostiku; původní podklady dál zavírá. 308/308 Node (12 nových), Chromium: 24 původních +12 MQTT layoutů, bez pageerror/socketů; původní tři konfigurace zůstávají Sheets. Před/po skutečného handleru 1k–250k: bez prokázaného zrychlení, metadata 310 B JSON, žádný scan historie. Viz docs/MQTT_DIAGNOSTIKA.md a docs/performance/MQTT_DIAGNOSTIKA.md. Baseline068db56, pouze codex-dev. Dále METEO-008 podle existujících měření; log/export METEO-064, fyzikální kvalita METEO-047 a živý broker dále neověřené.
- v0.17.0: další část METEO-050 hotová — stejné ⓘ nově ukazuje jediný snapshot poslední dokončené Sheets obnovy: celý čas, přenos včetně těla a retry, parser a synchronní commit/refreshUI/full-load callbacky. performance.now, žádné vymyšlené časy bez platného časovače. Nezměněný export má nové měření přenosu a 0 běhů parseru/UI („Neproběhlo“), starý parser report se nepřepisuje. Report se publikuje jen pro aktuální generaci, reset jej vyčistí; UV/overview/cizí historie/MQTT jej nemění. 296/296 Node včetně 12 nových deterministických regresí a rozšířený skutečný browser prošly. Viz docs/CASOVANI_OBNOVY.md a docs/performance/CASOVANI_OBNOVY.md. Baseline d1d42a4, pouze codex-dev. Dále METEO-050: počty/důvody MQTT odmítnutí; velký synchronní parser stále METEO-008.
- v0.16.1: první část METEO-050 hotová — ⓘ u načtené historie ukazuje čítače posledního CSV rozboru, odmítnutí s kódy DATE_MISSING/DATETIME_INVALID a nejvýše 8 logických pozic, dostupnost 7 veličin a čas/rozsah rozboru. Původní pravidla parseru, duplicity, null/nuly a statistiky zachovány. Report neobsahuje raw hodnoty/poznámky/URL; syntaxe/limit jsou obecné kódy bez neúplných součtů. Jen aktivní generační kontext, reset a nezměněný export zachovávají správnou evidenci. Čistý parseHistoryCSV cizích stanic report nevytváří. 284/284 Node, cílený browser a info harness prošly; viz docs/VALIDACE_CSV.md a docs/performance/VALIDACE_CSV.md. Baseline 33557f2, pouze codex-dev. METEO-050 zůstává rozpracované; dále časování transport/parser/render a MQTT čítače.
- v0.15.0: METEO-009 DONE — společný panel stáří záznamu, posledního úspěšného přenosu a načtené historie ve všech třech pohledech. Sheets úspěch znamená přijatý platný export (i nezměněný), MQTT čas znamená příjem platné zprávy, ne čas čidla. Chyba ponechá data/poslední úspěch; station generation guard a reset zabrání přenosu evidence mezi stanicemi. O(1) aktualizace přes stávající minutový timer/visibility, bez dalších fetch/grafů a bez změny statistik. 273/273 Node, cílený browser, moderní a info harness prošly. Viz docs/STAV_DAT.md a docs/performance/STAV_DAT.md. Baseline 5dca29d, pouze codex-dev. Další etapa METEO-050; explicitní zóna/známý měřicí plán zůstávají METEO-048/027/045.
- v0.14.0: METEO-011 DONE v rozsahu7volitelných senzorových karet. Moderní přehled má „Upravit karty“, uložený výběr po stanici (meteoModernCards, schema1, devprefix), bezpečné defaulty/validaci, session fallback a obnovení všech. Klasický přehled vždy7karet. syncModernCards se volá přes syncModernStation při vstupu/updateUI/refresh a používá podpis pro omezení DOM. Data a grafy beze změny; žádné fetch ani nové Chart. Skrývání zavře infoPopover a pendingInfoTrigger,1500ms nápověda zachována.263/263Node + moderní a info Chromium harnessy prošly. Viz docs/MODERNI_PREHLED.md a docs/performance/MODERNI_KARTY.md. Výchozí revize4a88d7e, pouzecodex-dev.
- v0.13.1: hover nápovědy má jednotný dwell 1500 ms. Odjetí, přechod na jinou ikonu, Escape, scroll, resize, skrytí stránky a invalidace ruší čekání. Kliknutí/dotyk/klávesnice jsou okamžité. 254/254 Node testů včetně 3 nových časovačových regresí a rozšířený Chromium harness prošly; rychlé přejetí a aktivní→čekající ikona ověřeny.
- v0.13.0: společná nápověda ⓘ nahrazuje tlačítka podkladů minima/maxima, 17 vysvětlujících sekcí a původní srážkové otazníky. Jediný panel v body, přesun původního DOM bez klonování; živé poznámky, tabulky i ovládání zachované. Hover/odjetí, dotyk, fokus/Enter/Tab/Escape; zavření při navigaci, scrollu mimo panel, resize a invalidaci dat. Ověřeno 251/251 Node testů + scripts/check-info-browser.cjs v Chromium 153 (řízené CSV/UV, skutečné Chart/Paho se SRI), 1440/390/320px, obě témata/přehledy/analytika, bez pageerror a bez dodatečného fetch/Chart při otevření nápovědy. METEO-010/011/012/030/063 dílčí UI; širší úkoly zůstávají otevřené. Fyzický Safari/iPhone neověřen.
- v0.12.0: třetí horní stránka Moderní přehled (`#moderni`) je alternativní design celého dashboardu. `currentPage=modern` používá původní page-main, společný DOM/store/grafy a všechny dolní záložky; žádné duplikované ID, druhé grafy, fetch/polling při přepnutí. CSS pouze body[data-view=modern], atribut přežije setTheme. syncModernStation bezpečně naplní výběr stanic při vstupu/updateUI/refresh. Původní #prehled a #analytika zachovány, Back/Forward/direct URL testované. Viz docs/MODERNI_PREHLED.md; METEO-011 částečně realizováno, personalizace karet dále.251/251Node testů a oba Chromium browser harnessy prošly.
- Bezpečnostní závěry: [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md), 5 potvrzených podmíněných nálezů opraveno; 246/246 Node testů a Chromium regrese prošly. Infrastruktura, striktní CSP, úplná modernizace archivu a fyzické Safari/iOS zůstávají mimo ověřený rozsah. Nasazení viz SECURITY_ROADMAP.
- Bezpečnostní série: [docs/SECURITY_ROADMAP.md](docs/SECURITY_ROADMAP.md); etapy 1–10 dokončeny v dostupném rozsahu, otevřená externí ověření uvedena zvlášť. SEC-001/002: konfigurace validovaná před resetem, jen podporovaná pole, odolné předvolby při blokaci/poškození. 7 nových + 34 souvisejících regresí prošlo. Soukromé nálezy mimo repozitář.
- Aktualizováno 2026-10-23; práce výhradně na `codex-dev`, výchozí revize této etapy `9fd455b`; původní audit `fbb9659`. Ověřuj proti kódu.
- Verze webu: 0.18.2 v hlavičce `#appVersion`; stručná historie vydání v `RELEASE_NOTES.md`, pravidla v AGENTS.md.
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
- Testy: `node --test tests/*.test.js` (332/332 prošlo po dávkování porovnání stanic); server má factory `createServer(rootDir)`.
- AUD-002/004/009 DONE: generační kontext, rušení síťových operací, await parseru, jeden spravovaný MQTT klient.
- AUD-003/005/006/007/008/011/012 DONE: bezpečný HTML výstup, grafy bez napětí, CSV/datum, roky, obnova i prázdné stavy.
- AUD-013/FUT-004 DONE: plné statistiky, min/max redukce, cache rozsahu, aktivní grafy a bezpečné agregace; 250k test.
- Centrální plán: `docs/NAPADY_A_ROADMAP.md` (83 METEO ID); etapa7 přidala8nových076–083 a12skupin doplnění starších návrhů. METEO-078 DONE v0.5.0; METEO-019/031 základní T/V, METEO-013 AH/VPD a METEO-010 motion hotové ve v0.4.0, další části těchto ID rozpracované. Plán dostupnosti a zóna stále027/038/048.
- METEO-077 DONE v plánovaném denním rozsahu v0.7.0. METEO-063 rozpracováno: T/V dny0.7.0, hodinové průměry T/RH/P0.8.0, globální teplotní extrémy0.9.0 hotové. Globální min/max mají původní řádek/index, přesné hodnoty a počet shod, úplné validní/vynechané počty, quick/full rozsah a UTC offsety. Shoda před zaokrouhlením, první záznam v sestupném zdroji, při shodném čase původní pořadí. Původní minRow/maxRow zachovány; v původním průchodu jen O(1) čítače/indexy, otevření O(1)/max3čtení i250k. Invalidace CSV/MQTT/reset/stanice/fullLoaded zavře a zahodí ref. Pořadí není trvalé ID;063 dále roční/denní extrémy a původ odvozených Td/AH/VPD, vstupy odvozených metrik zůstávají budoucím dílčím úkolem. Po nové analytické etapě má výkonovou návaznost008. Explicitní zóna048 a metadata071 dále.
- Historické popisky0.11.1 byly ve v0.13.0 nahrazeny ikonou ⓘ u názvu každého grafu. Původní .ana-description a dynamické #anaNote0–8 zůstávají živé v jediném panelu. Osy/legendy/anaEmpty/heatlegend/detail a Možnosti grafu jsou dál přímo u grafu.
- Navigace0.11.0: horní Hlavní přehled / Analytické grafy jsou dvě samostatná hlavní zobrazení. Analytika mimo stationData/dolní tabs, dashboard+sticky lišty skryté; URL #analytika/#prehled, browserBack/Forward, nativní odkazy. Sdílený store/caches/config, bez reloadu/refetch již načtené historie. currentPage určuje analyticsActive a refreshUI; refreshTab hlídá skrytou hlavní stránku. Při návratu se zachová aktivní dolní tab a obnoví dirty obsah. Po resetu stanice anaGrid skrytý, anaDataEmpty viditelný; bez dat buildAnalytics nevyžaduje full fetch před konfigurací.4nové VM regrese a aktualizovaný skutečný browser harness.
- Analytické grafy0.10.0: devět karet,3/2/1 responzivní sloupce, období24h/7/30/90/365/all/custom, lineární epochová osa, zoom/pan/sync/kurzor, rozšíření/Escape/PNG. Statistický model z úplných řádků, vizualizace≤600/XY≤580. Lazy jen dle viewportu, po odchodu destroy/osm původních grafů. Nová vlastní heatmapa14dnů×24hodin, T/RH plné průměry, touch/klávesnice. Cizí T historie: čistý sdílený parseHistoryCSV, actual cfg, žádný commit do store; sekvenčně/abort/cache Float64 po16B/8MiB stanice/16MiB celkem, ruční obnova a viditelná chyba. Párování do10min monotónní one-to-one, O(n log m)/rychlá exact větev, bez interpolace. Srážky jen diagnostika čítače017/049, mV/h není proud/SOC/energie. Viz docs/ANALYTICKE_GRAFY.md a ETAPA13; širší004/007/020/025/029/030/034/037 dál rozpracované.
- METEO-078: rozbalovací rozklad RH v průzkumníku (T/RH/dew/AH/VPD). Pouze původní krajní řádky aktuálního slideru, O(1), 2čtení i při250k; vodní Magnus jako013, faktory/logaritmická identita, žádná kauzální atribuce či vodní bilance. RH0/nuly T odlišit, nevybírat náhradní endpoint. Kalibrace/umístění mezi body neověřeny, vždy uvedeno; metadata epoch071 dále.
- Nová batteryAnalysis: pouze páry stejného řádku, plné Welford r/sklon a n/časy/dny. Cache jediného rozsahu7/30/all v dataAggregates, grafy lazy +2 (start stále8, po použití10). Max800 časových a582 skutečných XY reprezentantů, počet bodů není hustota. Žádné p-value/SOC/energie ani záměna T čidla za T baterie.
- AH/VPD mají vzorec/obor/jednotky v UI; Magnus nad kapalnou vodou i pod0°C, T−45..60°C, RH0..100%. RH0 je validní zde, nikoli pro Td. Originály ani stávající průměry se nemění.
- Roční srážkové popisky v0.3.1 opravené: denní maximum čítače, přírůstek jednoho záznamu a legacy rozdíl rain do24h. Čísla zachována, nejde o ověřené úhrny; reset/interval/schema stále METEO-017/049.
- Historický benchmark etapy 1 Chromium 1k/10k/100k: při 100k přehled 148,6 → 53,8 ms, explorer 43,2 → 14,8 ms; viz docs/performance.
- Živé quick CSV všech tří zdrojů nyní HTTP200 (21. 10.); pouze dostupnost/bytes/doba, bez validace obsahu. Skutečné schema, firmware, MQTT ani dlouhá historie neověřeny.
- Nevkládat přístupové údaje do JSON, auditu ani logů. Veřejné Sheet ID není autentizační token.
- Zachovat líné vykreslování a oddělené konfigurace stanic; nezačínat rozsáhlým rozdělením monolitu.
- Kontext celého systému: `ANALYZA_CELEHO_WORKSPACE.md` na GitHubu, revize `29ecf56`; souvislosti a mapování nálezů viz B.1.
- Na `Raw_Data` nepřecházet pouhou změnou názvu listu: liší se timestampy a význam J/R. Firmware a živé nasazení zde nejsou ověřeny.
- DEPLOY-001: v0.10.0 v[da16a8d](https://github.com/Michaltymm/Meteo_webovky/commit/da16a8d5381d4ef0712154dda0838af82cd24924), [Actions #22](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39742818313) **Success**, build22s/deploy20s/celkem50s/1artefakt. Main stále2405c5d. Předchozí publikace viz historie etap. Přímé widgety Pages nejsou z prostředí ověřeny (host není v síťové politice); workflow potvrzuje deployment.

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

### Etapa 7: analýza nad75 a první T/V + AH/VPD, v0.4.0 (21. 10. 2026)

- Analýza v centrální roadmapě:8 nových076–083, nikoliv umělé doplnění do15duplicit. Plán měření076, vliv vzorku/denní skupiny077, rozklad změny RH078, informativní mezery079, společná tlaková komponenta080, experiment před/po s kontrolou081, empirický sezónní kalendář082, podpis původu083. Každý má vstupy/proveditelnost/nové požadavky/řešení/výkon/prioritu/obtížnost/vazby/omezení/test; žádný nový návrh není vydáván za implementovaný. Dvanáct starších ID rozšířeno, historický audit zachován.
- Realizovány právě tři změny: METEO-019/031 základní explorativní analýza, METEO-013/012 AH/VPD, METEO-010 omezení pohybu. Welford z úplných původních T/V, cache jednoho rozsahu a XY biny24×24 se skutečnými reprezentanty+extrémy; timestamp tooltip, count/unique/days, obě grafické osy s jednotkami, žádná statistika z vizuální redukce. Nuly platné, žádné doplňování senzorů; r/sklon při n<3 či nulovém rozptylu nedostupné. Základní r není statistická průkaznost, nezaměnit za teplotní koeficient článku.
- Rozsahy7/30 × 24 h končí nejnovějším měřením, all je načtená historie. Full historie se načte jen při explicitním otevření standardním ensureFullData (jeden požadavek); přepnutí rozsahu nic nepřenáší. Callback po full označí pohled dirty a vykreslí ho jen když zůstal aktivní; řeší pravdivý partial/full text a nevytváří skryté grafy při odchodu jinam. Generační guardy původní.
- AH/VPD ze stejného T/RH, vodní reference/obor/vzorce v details, pouze konečné hodnoty v platném oboru; původní Td nezměněn. Aktuální dvě karty a dvě explorer volby, statistiky z plných hodnot, zaokrouhlení až při zobrazení. Výpočty nejsou teplota listu/povrchu ani doporučení zálivky.
- Motion preference čtená při konstrukci a za běhu, omezuje Chart/CSS/scroll. Při vypnutí omezení původní malé grafy obnoví300 ms, explorer a nové velké grafy zůstanou false. Ostatní ARIA/fokus/touch nadále METEO-010, nikoliv DONE.
- 132/132 Node testů,13 nových, skutečný inline kód v rozšířené VM (motion event). Reference fyzikálních veličin, stabilní dvouprůchodová Pearson/regrese, velký offset, null/0/duplicitní časy,250k plných párů/původní extrémy/omezené grafy, cache/rozsah, CSV/MQTT/reset, živá preference. Browser skutečné tři konfigurace+řízené CSV/UV:924 párů/r≈1, bez V0 párů, 0 V platné/konstantní r null; bez skrytých grafů při full, metadata plné historie, oprava starého CSV V0 → 0,02 při 1000 originálech. Dvě témata, 390px, motion/CSS/start/live, AH/VPD historie, žádný overflow/page error. Screenshot prohlédnut, smoke všech tabů/deseti explorer voleb prošel; jeho časy kvůli souběhu s Node nejsou srovnávány.
- [ETAPA7 a surové důkazy](docs/performance/ETAPA7.md): sekvenční 1k/10k/100k/250k před/po běžných pohledů; rozdíly oběma směry, ne plošné zrychlení. Při 250k cold refresh61,5 → 54,2 ms, explorer40,4 → 43,5 ms; CPU×4/100k cold130,9 → 139,6 ms. Nová analýza250k cold55,7 ms/warm6,1 ms, VPD29,2 ms; CPU×4/100k141,4/28,8/66,4 ms. Zavřený heap56,72 → 56,68 MiB a8 Chart; otevřená analýza57,55 MiB a10 Chart i po 30 cyklech. Nejde o celou RAM/OS mobil/paint/Web Vitals/síť/parser nebo vícedenní soak. HTML bez komprese+12514 bajtů.
- Další etapa: potvrdit metadata čidel/epoch a skutečný kontrakt času, potom METEO-019/020/031 podmíněná srovnání a077 vliv dnů, případně malý078 rozklad RH nad061. Planner076 až s ověřenou referenční četností, sezónní082 až s dostatečně dlouhou homogenní historií. Dostupnost027 a srážky017/049 stále mají datové blokery, SOC024 zůstává zamítnuté. Konfigurace, workflow, server, archiv a main nezměněny. Firmware, broker a živé služby zde neověřeny.

- Publikace v0.4.0: analýza [d6e343c](https://github.com/Michaltymm/Meteo_webovky/commit/d6e343c472f8cf291c2d191161b763cb1226a7df), implementace a důkazy [25b7048](https://github.com/Michaltymm/Meteo_webovky/commit/25b7048eba1b806b55b2b195cf70ec402dc69618), obojí na codex-dev se SHA ověřeným proti origin. [Actions #15](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39614305462) **Success**, build16s/deploy30s, celkem57s, jeden Pages artefakt. Main stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Ověřený workflow deployment není přímé načtení živých widgetů. Následující commit mění pouze dokumentaci, HTML stále v0.4.0.

### Etapa 8: METEO-078 rozklad RH v úseku, v0.5.0 (21. 10. 2026)

- Po kontrole čistého `7aa843e` a shody s origin zvolen navazující P1/nízká 078. Hotové souhrny, T/V, AH/VPD a motion neopakovány. METEO-078 nyní DONE: matematický rozklad dvou stavů nad013/061 bez potřebných nových FW/HW/dat. Žádné nové ID ani plošné dokončení dalších rozpracovaných funkcí. Údaj „12“ v předchozí etapě znamená12skupin rozpracování, ne12unikátních starších ID.
- `humidityChange(start,end)` sdílí saturationPressure (kapalná voda včetně pod 0 °C, −45..60°C a 0<RH≤100%). e=es·RH/100; RH2/RH1=(es1/es2)·(e2/e1), Δln(RH)=Δln(e)−Δln(es). Vše v plné přesnosti, formátování až v UI. Původní RH/T se nemění, rozdíly nejsou procentní body; neprokazuje zdroj/odtok vody ani příčinu. Při nulové RH, chybějícím/mimooborovém vstupu, shodném/neplatném čase a číselném podtečení vrací důvod nedostupnosti. Kontrolní RH při stejném e nad 100% se označí jako formální překročení nasycení, ne měření či možný setrvalý stav bez kondenzace.
- Native details v průzkumníku pro temp/hum/temp_hum/dew/absHum/vpd, reaguje na celé původní endpointy slideru. Vstupy i časy s UTC offsetem, faktory a zaokrouhlené logaritmické příspěvky. Platnost kalibrace/umístění mezi body vždy označena neověřená, epoch metadata071 nejsou odhadována. Průběh mezi body ani nepozorované mezery se nehodnotí. Nekompatibilní metrika, prázdný/jednobodový rozsah či invalidace vyčistí/skryje panel.
- 142/142 Node testů (10 nových): konstantní e/ohřev, izotermická změna páry,400 kombinací v oboru s nezávislým poměrem RH, identické stavy/RH100, nasycení,0/null/NaN/out-of-domain, podtečení/malé číslo, shodný/neplatný čas, DST fold,2 čtení250k, skutečné endpointy slideru/clear/reset. Zaokrouhlená nezávislá es reference vyžaduje 1e−9 toleranci RH, nikoli absolutní 1e−12; samotná algebraická identita testována 1e−12.
- Skutečný browser/Chart.js se třemi původními konfiguracemi a řízeným CSV/UV: správné faktory při stejném RH a různém T, UTC offsety, slider, žádné další požadavky;0/missing/nasycení, unrelated/empty clear, dvě témata a320/390 px bez trvalého přetečení/page errors. Screenshot prohlédnut. Po změně viewportu test čeká 100 ms na existující Chart ResizeObserver; okamžitý scrollWidth během resize není ustálený layout. Zachována i integrační kontrola T/V/motion a opravy starého CSV.
- [ETAPA8 — cílené měření a JSON](docs/performance/ETAPA8.md): před/po 1k a 250k,5 vzorků, sekvenčně bez souběžných testů. Slider1k5,4 → 5,7 ms,250k 23,5 → 20,3 ms; explorer 1k 6,0 → 6,9 ms,250k 47,7 → 39,5 ms. Nejde o tvrzení zrychlení grafů; nový výpočet O(1) nemění staré O(n) statistiky/sampling. Opakovaný široký audit ani čtyři velikosti/CPU×4 z etapy 7 neprováděny. Síť/parser/OS mobil/živé Pages tím neověřeny.
- Konfigurace, workflow, závislosti, server, archiv, původní měření i main nezměněny. Další vhodná etapa077 vliv jednotlivých dnů na T/V vztah;071 metadata a048 zóna dále, bez slibů o kapacitě baterie nebo srážkových úhrnech017/049.

- Uložení v0.5.0: [1003743](https://github.com/Michaltymm/Meteo_webovky/commit/100374322a4b675c74c904afe56831ca7a8ff724) odeslán do codex-dev, ověřeno přes ls-remote i veřejnou stránku commitu. Main stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Veřejné Actions i konkrétní pages.yml při závěrečné kontrole zobrazovaly jako nejnovější run #15 pro25b7048/v0.4.0, nový běh pro1003743 nebyl nalezen. To není potvrzení chyby CI ani důkaz deploymentu v0.5.0; důvod z read-only veřejných podkladů nezjištěn. Místní142testy a browser prošly, deployment zatím NEOVĚŘENÝ. Další dokumentační commit toto pouze zaznamenává, kód neopakovat ani netestovat znovu jen kvůli kontrole publikace.

### Etapa 9: METEO-077 denní citlivost T/V, v0.6.0 (21. 10. 2026)

- Po fetch ověřen čistý21e0f3f = origin/codex-dev; origin/main stále2405c5d. Zvolen navazující P1 úkol077, rozdělen na hotovou denní analytiku a budoucí přímé dohledání párů063. Žádné nové ID ani falešné globální DONE; předchozí078 zůstává DONE.
- `batteryAnalysis` zachovává původní plný Welford průchod a grafické reprezentanty; navíc po místních dnech vytváří centrované souhrny. `mergePairMoments` skládá dva souhrny bez odečítání velkých téměř stejných čtverců; `batteryDaySensitivity` prefix/suffix O(n+d), žádné d kopií/skenů historie. Do výsledku jediné battery cache pouze meze/počty amax3příklady dnů; dočasné souhrny se uvolní. Zůstávají null/0/duplicity i úplné páry ze stejného řádku.
- Panel potřebuje≥3 místní dny, po vynechání≥3páry a nenulový rozptyl T/V; neplatný číselný rozsah také nedostupný. Rozsah je jen přes dostupné výsledky, neplatné vynechání se nezamlčí. Vlivný den zvlášť absolutníΔr aΔsklonu, při přesné shodě novější den. Nejde o interval spolehlivosti nebo důkaz chyby čidla. Kalibrace/umístění neověřeny, dny mají nestejné N, časová závislost trvá; žádné SOC/kapacita/energie.
- Native details + tři tlačítka (r/sklon/nedostupný zbytek), přechod do existujícího průzkumníku celého místního dne, napětí s možností přepnout T. Žádný fetch nebo konstrukce grafu, nové datum dostane fokus. UI výslovně uvádí případné řádky mimo okraj analytického rozsahu. Nejde o přímý výpis všech T/V párů; ten zbývá s063 a platností reference po refreshi. Invalidace/reset vyčistí texty i akce.
- 153/153 Node testů,11 nových v battery-sensitivity: nezávislý dvouprůchodový přepočet každého vynechání, lineární±, jediná vlivná dvojice, posunutý celý den (nikoli ověřená epocha), konstantní zbytek/malé N, null/0/duplicity, velké offsety a numerický rozsah,250k s jediným čtením zdroje/cache,7d/reset, přesné shody, DST Europe/Prague. Browser tři původní konfigurace+řízené CSV/UV/Chart: všechny nové stavy, přechod dne bez requestů, původní AH/VPD/078/motion/oprava starého CSV zachovány,320/390px/obě témata, žádný page error; screenshot nové analýzy prohlédnut.
- [ETAPA9](docs/performance/ETAPA9.md): skutečný sekvenční profil před/po1k/10k/100k/250k,5vzorků/medián. První otevření250k57,2→71,1ms (nová práce navíc), opakované6,6→6,3ms. Stále10grafů po30cyklech; přibližně+56KiB heapu v teplém250k scénáři, nikoli měření celé RAM/vícedenního úniku. Pozorovatel opakovaného battery buildu0změn uzlů/textu (atributy nesleduje), přidány stálé prvky panelu. HTML+7392bajtů. Nové API/worker/knihovna se nepřidávají; reálný slabý mobil by bylo třeba změřit před dalším offloadem.
- Změněny jen index, test077, browser dev script, release notes, roadmapa/audit a výkonové důkazy. Konfigurace, server, workflow, archiv, původní data a main nezměněny. Neověřeny živé služby/broker/HW/firmware/OS mobil ani widgety Pages. Deployment dokládat samostatně.

- Uložení a publikace etapy9: [8457fde](https://github.com/Michaltymm/Meteo_webovky/commit/8457fdeb6ca8e6ecfdad22f4ae823c9f43361f9d) odeslán do codex-dev, vzdálené SHA ověřeno. [Actions #17](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39638764748) pro tento commit **Success**, build14s/deploy10s/celkem34s, jeden Pages artefakt. Main stále2405c5d. Nově viditelný i předchozí [#16](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39627880077) pro1003743/v0.5.0, Success44s — nejistota etapy8 o deploymentu je tím uzavřena, tehdejší popis kontroly zachován jako historie. Následující commit pouze ukládá tuto paměť, kód/testy neopakuje a verzi nezvyšuje. Přímé živé widgety neověřeny.

### Etapa 10: METEO-063/077 původní záznamy dne, v0.7.0 (21. 10. 2026)

- Čistý9c017bb ověřen fetch/ls-remote; main stále2405c5d. Navázáno na hotovou denní analytiku, bez nového auditu/backlogu. METEO-077 DONE pro plánované vynechávání dnů + dohledání podkladů; METEO-063 má hotové T/V dny, širší maxima/hodinové/odvozené vstupy zůstávají rozpracované. Žádné nové ID.
- Native details v citlivosti T/V. Volba byR/bySlope/undefinedDay jen podle dostupných výsledků; nejvýše50původních záznamů na stránku. Průnik dne a přesného původního7/30/all rozsahu včetně hraničních/missing řádků, ne jen párové nebo grafické reprezentace. UTC offset rozlišuje opakované místní časy; plné String(number) hodnoty, pořadí v této historii, důvod vynechání chybějící/nečíselné T/V, plný/zbylý počet/r/sklon, vzorce a verze. Pořadí není backendové ID; zdrojový CSV text se neuchovává. Celý den dále původními tlačítky exploreru.
- `historyRangeBounds` vytažena z původní binární funkce exploreru; vrací jen indexové meze bez řezání/skenu historie. Explorer používá stále svou původní jedinou cache. `batteryRecordView` drží snapshot/analysis identity, stanici, rozsah, druh výsledku, meze a stránku; žádné pole řádků. Otevření O(log n+p), stránkování O(p), p≤50; zavřený výpis nenačítá zdroj. Původní plný Welford/sensitivity/sampling ani statistiky se nemění.
- `invalidateDerivedData` výpis smaže/zavře/skryje a uvolní referenci. Stejně změna analytického rozsahu a zavření details; před stránkováním kontrola identity zdroje i jeho délky, snapshotu/analýzy, stanice, rozsahu, dne cache a volby. Mutace pole in-place nadále MUSÍ invalidovat jako dříve. HTML buňky escapované, info přes textContent, žádné vložení poznámek do markup. Přístupná nativní tabulka/hlavičky/region posunu, klávesnice a stav stránky; mobil bez celostránkového přetečení.
- 165/165 Node testů,12nových v battery-records.test.js; originální páry/missing/0/duplicitní časy/plné číselné hodnoty, kompletní stránkování a stejné statistiky, hraniční7d,250k (<100čtení otevření, přesně50další), snapshot/rozsah/delece/station/CSV/MQTT/reset/close, nedostupný zbytek, missing/constant V, escapování a25h den se dvěma02:30/UTCoffsety. Browser skutečné tři konfigurace+řízené CSV/UV/Chart: Enter/stránky/výběr/rozsah a reset, původní AH/VPD/078/motion i oprava starého CSV zachovány;0V platný i ve výpisu. Obě témata320/390px, žádné page errors/extra fetch/Chart; screenshot prohlédnut.
- [ETAPA10](docs/performance/ETAPA10.md): cílené sekvenční před/po1k/250k, ne opakování celého dřívějšího auditu. Nový výpis1,5ms, stránka0,6ms v obou velikostech, DOM50řádků. Rozdíly původních grafů nejsou tvrzením zrychlení. Konfigurace/server/workflow/archiv/původní měření/main nezměněny; žádná závislost, síťový požadavek nebo nový graf. Živé služby/broker/HW/firmware/OS mobil/Pages widgety neověřeny.
- Další vhodná etapa063: podklady hodinového průměru v Porovnání dnů s počty, originály a důvody vyloučení; opět líně/po stránkách/pro aktuální snapshot, bez opakování hotové077 analýzy. Metadata071 a explicitní časový kontrakt048 zůstávají vlastními úkoly.

- Uložení/publikace etapy10: [d1e42e3](https://github.com/Michaltymm/Meteo_webovky/commit/d1e42e3f9edb47cf39375b7a893c93a003498509) odeslán na codex-dev a SHA ověřeno proti origin. [Actions #18](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39677857017) **Success**, build17s/deploy10s/celkem36s, jeden Pages artefakt. Main stále2405c5d. Následující commit pouze zaznamenává ověřené nasazení, nemění HTML ani verzi0.7.0; hotové testy/analýzu neopakovat. Přímá kontrola živých widgetů tím není provedena.

### Etapa 11: METEO-063 podklady hodinových průměrů, v0.8.0 (21.–22. 10. 2026)

- Navázáno na čistý `26af1c1` = origin/codex-dev, main stále `2405c5d`. Hotové077 a předchozí analýzy zachovány. Dílčí063 pro hodinové průměry DONE; celé063 dál rozpracováno pro maxima a další odvozené hodnoty. Žádné nové ID.
- Porovnání dnů: kliknutí na bod grafu nese původní den/veličinu/hodinu; stejné volby dostupné klávesnicí v nativním details. T/RH/P používají nezávislou validitu. Výpis všech původních řádků hodiny včetně missing/0/duplicit, hodnoty bez tabulkového zaokrouhlení, čas/UTC offset, důvod vynechání, součet/počet/podíl i jedno desetinné místo grafu, vzorec/verze. Průměr není vážen časem; částečná historie přiznána. Prázdná hodina nedostane řádek ani průměr. Pořadí není trvalé ID, zdrojový CSV text se neuchovává; zobrazení času dosud po sekundách, interní milisekundy zachovány.
- `hourlyDay` v původním průchodu navíc skládá pro24hodin jen souvislé indexové rozsahy; podporuje rozdělenou hodinu při větším posunu času. Součty ve stejném stabilním vzestupném pořadí jako dříve. Tabulka O(s+p), s počet úseků hodiny, p≤50, bez pole všech řádků/indexů. LRU osmi dnů zachována; otevřený výpis smí držet jeden malý souhrn do zavření/invalidace, i když je vytěsněn z LRU.
- CSV/MQTT/reset/oprava/delece/stanice nebo změna porovnání výpis zavře, vyprázdní a zahodí referenci. Před stránkou kontrola identity snapshotu, pole/délky, stanice, dne a výběrů. In-place mutace nadále musí invalidovat. Escapované buňky, přístupné hlavičky/status/region posunu; žádný další request, graf ani závislost. Konfigurace/server/workflow/archiv/main neměněny.
- **180/180 Node testů**,15nových: celé původní stránky/hodnoty, nezávislé senzory,0/null/duplicity, stabilní součet, prázdno,250k se čtením pouze stránky, LRU, všechny životní cykly, XSS, kliknutí do správného datasetu a DST Praha/Lord Howe/Troll (dvě oddělené části stejné hodiny).
- Browser s reálným DOM/Chart.js a třemi původními konfiguracemi/řízeným CSV/UV: nezávislý úplný součet/počet/průměr, tři veličiny, missing i nuly,480původních záznamů vs50DOMřádků, Enter/stránky/prázdné hodiny/kliknutí na skutečný bod, skutečná CSV oprava zavře starý výpis. Obě témata320/390px, horizontální posun klávesnicí, žádné page errors/extra HTTP/Chart; screenshot prohlédnut. První harness kontroloval šířku před dokončením Chart resize; přidána150ms stabilizace testu, produktová chyba nezjištěna.
- [ETAPA11](docs/performance/ETAPA11.md): sekvenční1k/250k před/po,5vzorků/medián. První porovnání250k23,3→25,0ms, opakované4,7→5,3ms; nová funkce má režii, nejde o optimalizační tvrzení. Hustá samostatná250k hodina: otevření1,4ms/stránka0,6ms,50DOMřádků,po20cyklech prázdné tělo/nullreference, stejný počet uzlů a8grafů. CDP paměť neklesá ihned po zavření, žádný příslib vícedenního soak. Živé služby/broker/HW/firmware/fyzický mobil a přímé Pages widgety neověřeny.
- Další vhodná etapa063: dohledání původních teplotních extrémů, s přesným pravidlem shod a platností reference. Explicitní zóna048/revize zdroje a metadata071 zůstávají samostatně; nezavádět srážkovou interpretaci bez017/049.

- Uložení etapy11: [5d0a427](https://github.com/Michaltymm/Meteo_webovky/commit/5d0a4279a7c7adfc65db99955f80a8a2fa811547) odeslán na codex-dev. [Actions #19](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39733500427) Failure ve fázi testů, build16s/celkem20s, žádné nasazení. Po změně reálného dne na22.10. místní179/180 odhalilo starou fixture chybu background-refresh: `visibleDay` z dne vyhodnocení skriptu oproti později instalovanému fixnímu21.10. Date. Stejný pád reprodukován na výchozím HTML26af1c1. Test po instalaci mockDate synchronizuje počáteční snapshot; produktové HTML/verze beze změny, browser/výkon se neopakuje. Po opravě22.10. opět **180/180** (7,64s),0fail/skip. Následující výsledek publikace zaznamenat samostatně.

- Závěrečné ověření publikace etapy11: oprava fixture v[566e12c](https://github.com/Michaltymm/Meteo_webovky/commit/566e12cbfdce00db7e02e30ccd059b0a524c61d5) odeslána na codex-dev; [Actions #20](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39733762145) **Success**, build22s/deploy10s/celkem42s, jeden artefakt. Nasazené HTML odpovídá funkčnímu commitu5d0a427, verze0.8.0. Main stále2405c5d. Další dokumentační commit pouze ukládá tento stav; testy/browser/měření se kvůli němu neopakují. Přímá kontrola widgetů Pages zůstává neprovedená.

### Etapa 12: METEO-063 původní globální teplotní extrémy, v0.9.0 (22. 10. 2026)

- Čistý `08e531a` = origin/codex-dev, main stále `2405c5d`. Navázáno podle existujícího063 bez nového auditu/backlogu. Dílčí podklady globálních extrémů DONE; celé063 dál rozpracované pro roční/denní extrémy a odvozené metriky. Hotové077/078/hodinové podklady zachovány.
- Ve společné kartě Statistika dvě nativní tlačítka + details/volba min/max. Původní vybraný řádek, přesná T a původní doprovodné RH/P/V, čas se sekundami/UTC offsetem, pořadí aktuální historie, validní/vynechané teploty a přesné shody, verze/pravidlo. Rozsah všech načtených záznamů včetně chybějících T; quick400 označen částečný, full celá dostupná načtená historie. Není to denní/roční filtr ani ověřený klimatický rekord. Pořadí není ID backendu, kalibrace/umístění071/zóna048 nejsou předstírány.
- `dataAggregates.temperature` přidává count,minIndex/maxIndex,minTies/maxTies v původním jediném průchodu. Číselné nuly i duplicity platí, shody přesně před zaokrouhlením. Přísná porovnání a původní minRow/maxRow identity zachovány: první v sestupném zdroji, při shodném čase původní pořadí. Bez seznamů shod/kopií historie a bez statistik z vizuální redukce. Otevření nad hotovým souhrnem max3čtení vybraného/prvního/posledního řádku i při250k shodách; jeden DOMřádek.
- Stav jen snapshot/kind/index/stanice/fullLoaded. Invalidace i změna identity/délky/denní cache/stanice/fullLoaded nebo zavření zahodí ref a HTML. In-place mutace musí nadále invalidovat. Buňky escapované, kontext textContent; žádný další request/graf/závislost. Konfigurace/server/workflow/archiv/main neměněny.
- **193/193 Node testů**,13nových v temperature-record: přesné výhry/shody/indexy, rozdílné hodnoty stejně zaokrouhlené v kartě, min=max0, null/nefinite/řetězec a nezávislé RH/P/V, quick/full,250k max3čtení a žádné seznamy, všechny zdrojové/CSV/MQTT/in-place/stanice/reset/den/fullLoaded/close cesty, XSS, nezávislost ročních/porovnávacích filtrů, oba UTC offsety při DST02:30. Původní souhrny a výsledky zachovány.
- Browser reálný DOM/Chart/start/parser, tři původní konfigurace s řízeným CSV/UV: quick400→full1000 zavře staré podklady, úplné nezávislé počty/shody/řádek, Enter/volby,0T/allmissingT, skutečná oprava starého CSV a změna stanice. Obě témata320/390px bez overflow, horizontální posun klávesnicí;0pageerrors/extraHTTP/grafů. Screenshot prohlédnut; pevná hlavička na elementovém snímku překrývá horní část při posunu kvůli screenshotu.
- [ETAPA12](docs/performance/ETAPA12.md): cílené sekvenční1k/250k před/po,5vzorků. Cold refresh250k48,4→45,7ms, opakovaný21,0→21,2ms; nejde o optimalizační tvrzení. Podklady maxima0,5ms/minima0,3ms, po20cyklech prázdné tělo/nullref,8grafů. CDP paměť se neuvolní okamžitě, žádný příslib vícedenního provozu. HTML+7414B. Živé služby/broker/HW/firmware/fyzický mobil a přímé Pages widgety neověřeny, nasazení doložit samostatně.
- Další vhodná malá etapa063: dohledání původních vstupů pro odvozené Td/AH/VPD, s platným oborem a jasným rozlišením vypočtených hodnot. Roční/denní extrémy a další rozsahy zachovat jako samostatné dílčí pokračování063, nevydávat globální podklady za úplné DONE celéhoID.

- Uložení a publikace etapy12: [d16acdb](https://github.com/Michaltymm/Meteo_webovky/commit/d16acdb4b093d2fa8f4c18824bb8f4817919900a) odeslán do codex-dev, [Actions #21](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39735320314) **Success**, build19s/deploy14s/celkem42s, jeden artefakt. Main stále2405c5d. Následující commit jen ukládá tento stav; HTML0.9.0, testy/browser/profily se kvůli dokumentaci neopakují. Workflow je důkaz deploymentu, nikoli přímé kontroly živých widgetů.

### Etapa 13: Analytické grafy, v0.10.0 (22. 10. 2026)

- Explicitní nové zadání uživatele nahrazuje dřívější další krok063. Výchozí čistý `df1beb5`, main2405c5d. Práce na codex-dev, hotové063/077/078 a všech83ID zachovány. Nové ID nevzniká; konkrétní dílčí004/007/019/020/025/028/029/030/032/034/036/037 jsou doplněné v roadmapě, nikoli falešné obecné DONE.
- [ANALYTICKE_GRAFY](docs/ANALYTICKE_GRAFY.md): devět karet T/min/max, RH/Td/T, P, raincounter, T/V, V/mVh/denníVextrémy/nočníúsek, XY T/V/r/regrese/den-noc, T všech3stanic/ΔT a vlastní T/RH heatmapa. Období24h/7/30/90/365/all/custom, vlastní datum v localDayBounds,3/2/1sloupce, společný/samostatný výřez+kurzor, zoom/pan, nativní legenda, rozšíření/Escape a PNG. Canvas dotyk/klávesnice, ovládání44px. Stávající vzhled/témata zachované.
- Historie aktivní stanice nadále store/relace/ensureFullData, i po změně stanice. Čistý parseHistoryCSV vytažen z původního parseAndStore, stejné řazení/rok/null/0/uvozovky. Cizí stanice získávají actual cfg a export až pro porovnání, sekvenčně, dedup/abort/identityguard, nikdy switchStation ani commit do aktivního store. Cache T Float64Array16B/validní řádek,8MiB/stanice a16MiB/LRUcelkem; neuchovává cizí CSV/ostatní senzory. Ruční obnova, stáří a chyba/starácache viditelné; nejde o obecný TTL návrh004.
- Plné Welford a statistiky předsamplingem. Model sdílí jeden rozsah a memo pro vyhlazení/noční text/porovnání. Časový minmax≤600 včetně nulových značek velkých mezer, XY≤580 skutečných24×24 reprezentantů+extrémy, derivative≤396minmax bodů z plných sousedních párů pro0<Δt≤3h. Smoothing5měření není časově vážené. Porovnání jen původní časy, nejbližší nepoužitý do10min, při shodě dřívější/firstduplicate; O(nlogm), exact rychlá větev O(n), ne globální optimum. Počty/odchylky uvedené.
- Lazy nové grafy u viewportu, překreslení jen viditelné. Max8nových Chart+heatcanvas, po odchodu destroy/disconnect/abort a model=null, hlavní dashboard stále8grafů a bez nových analytických výpočtů/requestů. Heatmapa stránkuje14dnů se záznamy,24místních hodin, skutečné n/min/max/průměr; vlastníResizeObserver, dotyk/šipky/detail/legenda. DST opakovaná hodina společně, bez procent dostupnosti.
- Fyzikální meze explicitní: rain/rainInc reset/jednotky neověřeny017/049, takže diagnostika čítače/maxpřírůstku, ne skutečné úhrny/intenzita. V je napětí, mV/h není I/SOC/energie; nabíjení není potvrzené. T je vzduch, ne článek; r není kauzalita/p-value. Časy dál browserzone/CSV bez offsetu,048/071 a firmware metadata zůstávají. Není nová produkční knihovna/framework/build/server/konfigurace/workflow.
- **226/226 Node testů**,33nových:22datových v analytics-data (parser/obory/plné summary/Welford/derivative/sampling/compact/range/DST+400referencí párování),11lifecycle (cizísource/dedup/abort/A→B→A/sourcechange/failure/stalecache/budget/destroy/gap/250k cache). Původních193zachováno. Opraven skutečný párovací bug za duplicitními dřívějšími B; reference a asymptotika uvedené.
- Browser reálný Chart/DOM/start/parser a3actualcfg s řízeným CSV/UV:9karet, quick400→full3000, všechny rozsahy/prázdno, nezávislá plná reference85°C v čase i XYose, missing/0V,3stanice, legendy/zoom/pan/reset/sync/expand/Escape/PNG, heatdetail, chyba obnovy a pozdní cizí odpověď, opakované enter/exitbezChartleaku.1440/800/390/320obě témata bez overflow, touch-enabled mobile tooltip/cell/keyboard/lazy,0pageerrors. Screenshot prohlédnut. XY `parsing:false` neplatné pro nesetříděnéX způsobovalo oříznutí extrému; scatter nyní standardně parsuje Chart, actualaxis regression chrání.
- [ETAPA13](docs/performance/ETAPA13.md): sekvenční1k/10k/100k/250k před/po,5vzorků. Warm250k dashboard24,8→22,0ms, nejde o speedup claim; všech9karet cold393,7/warm21,6ms. CPU×4/100k984,1/120,8ms. Hlavní start8Chart, po10návštěvách znovu8, uzly stabilní; compactcizí250k×2cache8MB zachována. HTML+62087B. První velký O(n) model stále blokuje, navazující008 může rozdělit práci/worker dle měření. Fyzický iPhone/WebKit/živé služby/HW/firmware ani přímé Pages widgety neověřeny.
- Kontrola GitHubu: explicitní ls-remote ukázalo stále df1beb5; lokální origin/codex-dev byl jen zastaralý tracking ref586025c, aktualizován explicitním fetchrefspec. Nebyly žádné nové cizí commity k přepisování/slučování. Další krok po této etapě: dělená příprava velkého modelu008, pak025/029/030nastavitelné veličiny/tolerance. Publikaci doložit samostatně.

- Uložení a publikace etapy13: [da16a8d](https://github.com/Michaltymm/Meteo_webovky/commit/da16a8d5381d4ef0712154dda0838af82cd24924) odeslán na codex-dev; [Actions #22](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39742818313) **Success**, build22s/deploy20s/celkem50s, jeden Pages artefakt. Main stále2405c5d. Následující dokumentační commit pouze zaznamenává výsledek; HTML0.10.0, hotové testy/browser/profily se kvůli dokumentaci neopakují. Workflow potvrzuje deployment, nikoli přímou kontrolu živých widgetů.

### Etapa 14: Samostatná stránka analytiky, v0.11.0 (22. 10. 2026)

- Výchozí7bc2b0e, čistýcodex-dev; main2405c5d. Výslovné zadání mění umístění hotové analytiky, neopakuje analýzu všech83návrhů. METEO-030 rozšířen, širší návrh zůstává rozpracovaný.
- `page-main` a `tab-analytics` jsou sourozenecké hlavní obsahy. Horní sticky navigace má skutečné odkazy #prehled/#analytika a aria-current. Původní dashboard/sticky lišty jsou skryté v analytice; stanice/nastavení/status společné. Přesun původních9karet, nikoliv nová implementace grafů/parseru.
- `showAppPage`/`appPageFromHash` řídí přímé otevření i browser Zpět/Vpřed. Opakovaná událost téže stránky nevytváří historii ani znovu model. Modifikovaný klik používá nativní chování odkazu. Po změně stránky scroll nahoru, hlavní dolní tab zůstává vybraný. Obnova aktualizuje pouze aktivní hlavní obsah; skrytý callback nemůže přepočítat dashboard grafy.
- Prázdný/resetovaný store neschová horní navigaci. Analytická mřížka a staré údaje jsou skryté, stav uvádí právě vybranou stanici. Otevření bez dat nevyvolá ensureFullData se starou konfigurací. Příjem původním transportem ukáže grafy, návrat ničí jejich instance a ruší cizí požadavky; cache měření se zachová.
- Původních226 Node testů a4nové v `tests/page-navigation.test.js` prošly: viditelnost/obnova záložky, uchování dat a cache, destroy, URL bez duplicit, refresh jen aktivní stránky, pozdní callback a prázdný/resetovaný store bez fetch. `scripts/check-analytics-grid-browser.py` nyní používá horní odkazy a ověřuje sourozenecké stránky, Back/Forward, klávesnicový návrat, mobilní přímý odkaz a původní9grafové regrese.1440/800/390/320px a obě témata bez overflow,0pageerrors, screenshot desktop/mobil prohlédnut, žádný refetch při přepnutí již úplné historie. Fyzický Safari/iOS ani živé externí služby tím ověřené nejsou.
- Profilovací `showTab` rozumí nové horní stránce a zachovává kompatibilitu se starší HTML referencí. Smoke `--counts 1000 --grid` prošel:0pageerrors,8základních/16otevřených/8po10návratech Chart instancí; nejde o nové srovnávací měření výkonu. Žádná změna výpočtů/redukce/konfigurací/závislostí/workflow. Bez nového výkonnostního tvrzení se velké profily etapy13 neopakují. Další prioritou zůstává008 příprava modelu.


- Uložení a nasazení etapy14: [ef23a26](https://github.com/Michaltymm/Meteo_webovky/commit/ef23a266ddac00ee5f4b16bd3b8b8edc3b9100dd) odeslán na codex-dev; [Actions #23](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39745845016) **Success**, build17s/deploy12s/celkem37s, jeden Pages artefakt. Main stále2405c5d. Vývojová analytika: https://michaltymm.github.io/Meteo_webovky/dev/#analytika. Deployment potvrzuje workflow; přímé živé widgety ani fyzický iOS nebyly kontrolovány. Tento následný dokumentační záznam nemění HTML0.11.0 a neopakuje hotové testy.

### Etapa 15: Rozbalovací popisky analytických grafů, v0.11.1 (22. 10. 2026)

- Ověřeno230/230 Node testů (8,01s) a skutečný Chromium/Chart.js s řízeným CSV/UV všech3konfigurací. Aktualizovaný browser harness ověřuje9zavřených panelů, zachování textu, kliknutí/Enter/mezerník/dotyk, žádný další request ani novou Chart instanci po rozbalení, samostatné Možnosti, viditelnou heatlegend/detail a původní grafové/navigační regrese.1440/800/390/320px v obou tématech bez overflow,0pageerrors; desktop/mobil screenshoty prohlédnuté. Živé zdroje ani fyzický Safari tím ověřené nejsou.

- Výchozí b80169c na codex-dev. V devíti kartách jsou původní popisy a dynamické anaNote0–8 přesunuté do nativních zavřených details.ana-info; samostatná šipka „Podrobnosti grafu“. Oba texty zachované, ID poznámek a jejich aktualizace beze změny. Kliknutí/dotyk/Enter/mezerník bez vlastního JS, 44px řádek a viditelný fokus.
- Graf, jednotky/legendy, prázdný stav, ovládání a heatmapová legenda/detail zůstávají mimo popisky. Není změna parseru, dat, statistik, stanic, transportů, cache nebo Chart instancí. METEO-030 doplněno, obecné030/010 nejsou DONE. Změna je pouze zobrazení, bez nových výkonových tvrzení a opakování velkých profilů.


- Publikace etapy15: [666b487](https://github.com/Michaltymm/Meteo_webovky/commit/666b4871aaa2ddfff7d0002d8eaffd0962cd534b), [Actions #24](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39747969927) **Success** (build16s/deploy8s/celkem33s). Nasazení potvrzené workflow, přímé živé widgety neověřeny; main stále2405c5d. Tento dokumentační záznam nemění HTML0.11.1.

## INSTRUCTIONS FOR FUTURE AI AGENTS

1. Nejprve přečti QUICK CONTEXT; potom jen sekce relevantní k zadání.
2. Audit není vždy aktuální: ověř důležité skutečnosti ve zdrojovém kódu a zkontroluj související ID/rizika.
3. Po změně aktualizuj dotčené záznamy a ověřené příkazy; DONE až po skutečném ověření, s jeho výsledkem.
4. Nové problémy/nápady přidej se stabilním ID; nevytvářej duplicity ani zbytečný backlog.
5. Nedělej celý audit znovu, pokud to úkol nevyžaduje. Zachovej důležitá rozhodnutí a oprav rozpor dokumentace/kódu.
6. Použij existující izolovaný checkout; bez výslovné žádosti nevytvářej Git worktree. Zachovej cizí změny.
7. Odděluj fakta, hypotézy a návrhy i prošlé, selhané a neprovedené testy. Chybu sítě nevydávej za chybu aplikace.

## Bezpečnostní dávka B — v0.11.3

SEC-003/005: limity stream/CSV/MQTT před mutací historie; nepřijímají se prázdné MQTT záznamy. HTTPS vždy WSS. 8 nových regresí a45 souvisejících testů prošlo, Chromium harness s3 skutečnými konfiguracemi a řízenými zdroji prošel. Limity a srovnání výkonu: docs/performance/SECURITY.md. Živý broker/ACL neověřeny.

## Bezpečnostní dávka C — v0.11.4

METEO-055: SRI Chart4.4.0/Paho1.1.0, Actions stejné major připnuté na SHA a všechnycheckouty persist-credentials:false. Dependabot připraven pouze na codex-dev; automatický běh nepotvrzen (vyžaduje defaultbranch). SEC-006 preventivně: preview implicitně127.0.0.1, GET/HEAD, bezwildcardCORS, nosniff/CORP/XFO; Pages těmito hlavičkami nejsou ovlivněny. Server/Pages11testů a Chromium SRI (originál přijme/pozměněný skript odmítne) prošly. Viz scripts/check-security-browser.py.

## Bezpečnostní doplnění při finální kontrole

SEC-007: historický vstup mimo Pages měl samostatný potvrzený nález; vzhledem k výslovnému zadání auditu celého projektu opraveno pouze bezpečné vykreslení textu v obou tabulkách, bez migrace/záměny aplikace. Skutečný Chromium test původního parseru a rendererů prošel; soukromá reprodukce před opravou byla pozitivní. Úplná modernizace archivní aplikace není provedena, pro nasazení stále nutné další ověření.

Bezpečnostní publikace: [Actions #25](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39824209785), c19e246, **Success38s/build17s/deploy11s**. v0.11.4, main2405c5d bezezměny. Následná změna pouze dokumentace. Přímý Pages host podle politiky prostředí neověřen.

## Nový design dashboardu — v0.12.0

Výchozí revize3e2d2cd, výhradněcodex-dev. Nová virtuální stránka#moderni má vlastní horní odkaz a zcela přepracované responzivní rozložení/barvy/typografii/karty. Zachována jediná implementace komponent a originální měření, theme/state synchronizace i bezpečné názvy.8původních grafů před/po,0nových requestů při změně vzhledu. Node251/251 + moderní browser8layoutů a původní analytický browser prošly,0pageerror. Screenshot desktop/mobil prohlédnut. Konfigurace/workflow/main/archiv neměněny. Fyzický Safari/iOS a živý Pages host neověřeny.

Publikování ověřeno: [Actions #26](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39832057768) pro [acfa3ba](https://github.com/Michaltymm/Meteo_webovky/commit/acfa3ba) **Success** (build24s/deploy9s/celkem42s), jeden Pages artefakt. Vývojové HTML v0.12.0, main zůstává2405c5d7326909a24c41e7066bfdc4a9d1622208. Přímý živý Pages host není v síťové politice prostředí povolen, potvrzení nasazení vychází z workflow. Následný commit mění pouze dokumentaci.


## Sjednocení nápovědy — 2026-10-22, v0.13.0

Dílčí UI etapa METEO-010/011/012/030/063 podle zadání: ⓘ u teplotních extrémů, vlhkostních metrik, analytických grafů a dalších vysvětlujících sekcí. Text není trvale rozbalený; myš otevře při najetí a zavře po odjetí, dotyk přepíná, klávesnice má fokus/Enter/Tab/Escape. Interaktivní tabulky, stránkování a výběry zůstávají skutečným DOM, přesouvá se pouze obsah do jednoho panelu v body. Tím se nevytvářejí duplicitní ID a panel není oříznut kartou. Datové/statistické výpočty, původní hodnoty a nabídky skutečných akcí grafů zůstávají zachované.

Ověření: 251/251 Node regresí; `scripts/check-info-browser.cjs` v Chromium 153 se skutečnými SRI-matching Chart.js/Paho a řízeným CSV/UV. Ověřeno minimum/maximum a návrat obsahu, hover přechod na panel, odjetí, klávesnice/fokus, dotykové otevření/druhé klepnutí/mimo, 1440/390/320px, obě témata a oba přehledy, živé poznámky analytiky, dynamické srážkové ikony, programové otevření podkladů z grafu a invalidace při změně dat/stanice. Nápověda nevyvolá fetch ani konstrukci Chart; 0 pageerror. Desktop i mobilní screenshoty prohlédnuty. Ověření běželo s aktivními bezpečnostními kontrolami knihoven a prohlížeče.

Fyzický Safari/iPhone a živé meteorologické zdroje nejsou tímto testem ověřeny. Širší přístupnost, personalizace karet, další odvozené veličiny a původ dalších výpočtů zůstávají původními otevřenými úkoly. Nasazení se dokládá samostatně výsledkem Pages workflow.


## Prodleva nápovědy — 2026-10-22, v0.13.1

Dílčí METEO-010/011: nápověda na hover čeká 1500 ms souvislého pobytu myši nad stejnou ikonou. Při odjetí nebo změně ikony se čekání ruší; nová ikona má vlastní celou prodlevu. Časovač se ruší také při Escape, navigaci, scrollu mimo panel, resize, skrytí stránky a invalidaci dat. Skrytý/odpojený prvek se dodatečně neotevře. Kliknutí, dotyk a klávesnice zůstávají okamžité. Jediný čekající časovač; žádná příprava obsahu, načtení dat nebo nový graf před jeho dokončením.

Ověřeno:254/254Node testů (3 nové regrese čekání/záměny/zrušení/neplatného cíle) a rozšířený `scripts/check-info-browser.cjs` vChromium153 s původními Chart.js/Paho a řízeným CSV/UV. Krátké přejetí po1000ms zůstalo zavřené i po původním termínu, přechod po850ms začal celé čekání znovu; ověřeno i přepnutí zotevřeného panelu, Escape během čekání, okamžitý dotyk, navigace/invalidation a původní všechny scénáře.0pageerror. Předchozí v0.13.0 byla nasazena v89bf6d3, Actions#27Success; nové nasazení se ověřuje zvlášť. Fyzický Safari/iPhone neověřen.

## Personalizace moderního přehledu — v0.14.0

Před zahájením načteny cizí změny89bf6d3 a4a88d7e fast-forwardem; následná úprava navazuje na jejich ovladač nápovědy, neopakuje audit. Karty sID sensorCard-* a checkboxy modernShow-* zůstávají ve společném DOM; zobrazení řídí pouze moderní preference. Ostatní stavy obnovují všech7karet. Temperatura/RH/Td a statistika jsou pevné. Nativní details není data-info a nepřevádí se na hover tooltip; panel se zavírá Hotovo/Escape/kliknutím mimo nebo změnou stránky/stanice. Pořadí klíčů je pevné, unknown/poškozené/velké preference se bezpečně normalizují. Při skrývání se zavře i živý portál nápovědy; bez kopírování obsahu či statických klonů.

Ověřeno263/263Node (9nových) a Chromium154 s původními configs a řízenými CSV/UV: reload/per-station izolace/klasika/empty/reset/keyboard/Hotovo,8layoutů2témata,0pageerror, Chart8→8 a0nových fetch při nastavení. Původní info harness prošel včetně1500ms/touch. Screenshotdesktop+mobil prohlédnut. Browser test nyní zaznamenává fetch přímo ve chvíli volání s currentPage: legitimní cizí historie analytiky se nesměšuje s přepnutím vzhledu; návrat nevytváří žádné další volání. Syntetický VM benchmark1k/10k/100k/250k řádků je v performance/MODERNI_KARTY.md; neměří DOM layout ani živý mobil.

Další vhodná etapa: METEO-009 — jasně rozlišit stáří měření, poslední synchronizaci a neúplnou historii; stav ověřovat proti načítacímu kontextu bez nových požadavků. Konfigurace/workflow/main/archiv vtéto etapě neměněny.

Publikování v0.14.0 ověřeno: [Actions #29](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39915420587) pro [e0a8ba4](https://github.com/Michaltymm/Meteo_webovky/commit/e0a8ba445a7fcbc8dfd5f661e272a7904ea1570c) **Success** — build 17 s, deploy 11 s, celkem 36 s. Odesláno pouze do `codex-dev`; `main` zůstává `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Přímý živý Pages host není podle síťové politiky tohoto prostředí dostupný; nasazení potvrzuje workflow. Následující commit mění pouze dokumentaci.


## Stav a stáří dat — v0.15.0, METEO-009

Evidence transportu je samostatná od pollAttempts (pokusy pouze omezují
frekvenci opakování). recordSheetsSuccess se volá až po přijetí platného exportu
nebo shodě s již ověřeným exportem, ve všech čtyřech quick/full větvích.
Neúspěch zachová předchozí successAt, původní store i fullLoaded. MQTT připojení
není měření; čas receivedAt se nastaví teprve při platném senzorovém payloadu.
Kombinovaný zdroj vede oba časy odděleně a provenance nejnovějšího řádku se
obnoví při přijetí CSV. Metadata nepřidávají pole do každého měření.

Vše chrání existující stationContext generace. Reset vymaže předchozí časy i
stavové texty a renderDataStatus používá jen první řádek/délku. Aktualizace přes
stávající minutový timer se ve skrytí neprovádí, po návratu ano. Nezměněný obsah
nezapisuje DOM; žádné nové requesty, Chart, změny schémat/config/statistik.
273/273 Node, 10 cílených regresí a 3 Chromium harnessy prošly; přehled důkazů,
výkladu časů a rozsahu historie v docs/STAV_DAT.md. Browser testy nyní před
kontrolou rozložení/dotykových souřadnic čekají na asynchronní resize/stabilitu.

Následující etapa METEO-050 má získat počty a důvody odmítnutí přímo při parseru;
nesmí veřejně vypisovat celé měření či citlivý obsah. METEO-048 (výslovná zóna)
a METEO-027/045 (měřicí plán, výpadky) nejsou touto etapou dokončeny.
Produkční větev, konfigurace, publikační workflow a archiv se nemění.


Publikování v0.15.0 ověřeno: [Actions #30](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39942543568)
pro [f45d1cf](https://github.com/Michaltymm/Meteo_webovky/commit/f45d1cf6765a7bba478e0c64f64f484263449d8f)
**Success** — build 17 s, deploy 15 s, celkem 40 s. Odesláno pouze do codex-dev;
main stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Přímý živý Pages host
není podle síťové politiky prostředí dostupný; nasazení potvrzuje workflow,
nikoli přímá návštěva. Existující upozornění na runtime Actions a ubuntu-latest
přetrvávají, workflow se v této etapě neměnilo. Následující commit je jen evidence.


## CSV diagnostika — v0.16.0, první část METEO-050

parseHistoryCSV má volitelný lokální collector. Původní pole řádků vrací beze
změny; čistý parser cizí historie dál nepublikuje metadata. Aktivní parseAndStore
vytvoří jediný omezený report a publikuje jej pod generační kontrolou, i při
nulovém výsledku nebo syntaktické/limitní chybě. Při chybě se původní store ani
čas úspěšného transportu nemění. Report obsahuje jen počty, enumy, čas/rozsah
a nejvýše osm pořadí; ne původní data, poznámky, URL nebo zprávy výjimek.

Pořadí eviduje existující CSV lexer jako logické záznamy včetně prázdných,
nikoli fyzické řádky s newline v poznámce. Dočasné pole čísel zanikne po parsování;
ve store zůstává jen původní měření a vedle něj malý report. Čítače senzorů jsou
v původním průchodu. Vykreslení ⓘ čte pouze report se 7 senzory / 8 ukázkami,
nikdy znovu celou historii; nepřidává fetch, Chart ani timer. Null/nula,
půlnoc při prázdném čase, tolerantní pf a duplicity beze změny. Úvodní čtyři
záznamy zůstávají heuristikou, nejsou nově považovány za ověřenou hlavičku.

283/283 Node včetně 10 nových regresí; rozšířený check-data-status-browser.py
(3 konfigurace, všechny pohledy, 24 layoutů, chybné CSV a obnova) a info harness
prošly. Viz docs/VALIDACE_CSV.md a měření parseru v docs/performance/VALIDACE_CSV.md.
METEO-050 dále časování transport/parser/render a MQTT čítače; METEO-047/048
stále samostatně. Main, konfigurace, archiv a publikační workflow nezměněny.


Doplnění v0.16.1: pokud po neúspěšném rozboru přijde dříve přijatý nezměněný
export, recordSheetsSuccess obnoví jeho acceptedValidation místo ponechání
neúspěšného reportu. Čas původního rozboru, reference store, cache a počet renderů
se nezmění; nepřidává se další parse/fetch. Na chybu se navíc uchovává pouze
odkaz na poslední přijatý report, nikoli další historie. Jedna nová regrese
ověřuje quick i full větev a browser i obnovený obsah ⓘ. **284/284 Node**;
11 nových testů CSV diagnostiky. Výsledná verze etapy je 0.16.1, původní
283/283 výše označuje první krok v0.16.0. Příští krok METEO-050: časování.


Publikování výsledné v0.16.1 ověřeno 2026-10-23: [Actions #32](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39948737532)
pro [a26b55f](https://github.com/Michaltymm/Meteo_webovky/commit/a26b55ffb4d6a1443f7db6dba218c46a124447f5)
**Success** — build 23 s, deploy 10 s, celkem 40 s. První část v0.16.0 je
[7844995](https://github.com/Michaltymm/Meteo_webovky/commit/7844995d5f51bfddbc50ef836e3c683345968940),
[Actions #31](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39948346233) také Success.
284/284 lokálních Node regresí a finální Chromium ověření prošly. Odesláno jen
do codex-dev; main zůstává `2405c5d7326909a24c41e7066bfdc4a9d1622208`.
Živý Pages host nelze z tohoto prostředí kvůli síťové politice přímo navštívit;
nasazení potvrzuje workflow. Známá upozornění runtime Actions/ubuntu-latest
přetrvávají, workflow se neměnilo. Následující commit ukládá pouze tento záznam.
Další pokračování: METEO-050, rozlišit dobu přenosu / parseru / renderu;
CSV čítače a jejich testy se bez související změny znovu neimplementují.


## Časování obnovy — v0.17.0, další část METEO-050

fetchSheets vytváří request-local newSheetsTiming a monotónní počátek pouze
pro skutečně nový požadavek. timedSheetsText měří stationText včetně readLimitedText
a neúspěchů; measureSheetsWork měří parser a synchronní UI v oddělených finally.
První UI blok obsahuje commit/invalidation/refresh, druhý případné full-load
callbacky. Celkový čas zahrnuje yield/retry/další obsluhu a končí před zveřejněním
reportu. Nelze jej ztotožnit s čistým RTT, frame paint nebo asynchronním lazy grafem.

Snapshot dataStatus.sheets.timing: scope, completedAt, outcome, unchanged,
totalMs a tři dvojice runs/ms. Jen poslední dokončená obnova, bez user dat,
URL či chybových zpráv, žádný storage/export. V finally se zveřejní jen při
isCurrentStation; staré návraty jej nepřepíší. Chybějící/neplatné performance.now
neblokuje načítání, pouze nedodá dobu. Kalendářní hodiny délky neovlivňují.
Nezměněný export nevyvolá parse/UI; starý acceptedValidation report zůstává
oddělený od nového přenosu. Generační kontext a pravidla původního loaderu zachovány.

296/296 Node včetně 12 deterministických regresí (tělo odpovědi, fallback,
chyba/obnova, callbacky, coalescing/upgrade, reset, clock failure, jiné zdroje,
bezpečné metadata). Rozšířený check-data-status-browser.py prošel ve všech
3 konfiguracích/pohledech a 24 layoutech; nový popup má sbalené vysvětlení
a po native details toggle se přepozicuje. Živý host/Safari tím neověřeny.
Viz docs/CASOVANI_OBNOVY.md a docs/performance/CASOVANI_OBNOVY.md.

Dále METEO-050: MQTT počty/důvody odmítnutí, bez kopírování payloadu. Velké
synchronní parsingové časy z předchozích profilů trvají (METEO-008). Main,
archiv, konfigurace a workflow zůstávají beze změny.


Publikování v0.17.0 ověřeno 2026-10-23: [Actions #33](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39957537357)
pro [4ae2a09](https://github.com/Michaltymm/Meteo_webovky/commit/4ae2a091bb6707f7c818a0187997a9816764d522)
**Success** — build 17 s, deploy 9 s, celkem 35 s. 296/296 lokálních Node testů
a finální řízený Chromium browser prošly. Odesláno pouze do codex-dev; main
stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`. Přímý živý Pages host není
podle síťové politiky prostředí dostupný, nasazení potvrzuje workflow.
Existující upozornění na runtime Actions/ubuntu-latest přetrvávají; workflow
se v této etapě neměnilo. Následující commit mění pouze tuto evidenci.
Další pokračování: METEO-050 — lokální čítače/důvody odmítnutí MQTT bez raw
payloadu; znovu neimplementovat dokončené CSV čítače a časování.

## MQTT diagnostika — v0.18.0, dokončení METEO-050

Navázáno na ověřený bod068db56 bez opakování CSV analýzy. Dosavadní první
kontroly onMessageArrived dostaly pevné čítače důvodů. Platné měření se počítá
v okamžiku původního unshift; následující chyba aplikace nezpůsobí druhé
odmítnutí nebo nepravdivý INVALID_JSON. Limity20/s,65536UTF-8B,300křádků,
jejich pořadí i původní převod/aliasy/čas/duplicity zachovány.

emptyDataStatus nově vytváří diagnostics se scope aktivní datové relace;
reconnect jej nemění, reset ano. Pouze čítače/pevné kódy/časy, bez obsahu,
topicu/hostu nebo výjimek a bez persistence. O(1), žádná nová kopie historie.
refreshMQTTDiagnostics nepracuje s DOM mimo otevřenou rozbalenou diagnostiku.
Přijímací invalidace zachovává jen aktivní dataValidationTrigger, aby bylo
možné sledovat součty; CSV/reset/stanice a podklady původních měření nadále
zavírají nápovědu. Zbytek společného hover/touch/keyboard chování zachován.

308/308 Node,12nových v tests/mqtt-diagnostics.test.js. Rozšířený skutečný
Chromium154 harness:24původních a12MQTTlayoutů v obou tématech/třech pohledech,
320/1440px; stejný DOM čítačů, živé hodnoty, izolace CSV/timing, reconnect,
size-limit bez reconnectu, reset a ochrana starých klientů, bez pageerror.
Původní info harness prošel také, včetně1500ms hoveru, klávesnice a dotyku.
Žádný broker/socket kontaktován, Client náhrada; původní konfiguraceSheets.
Fyzický iOS/Safari, ACL/certy/firmware a živé MQTT nejsou touto etapou ověřeny.

Sekvenční před/po handleru s1k–250k: zachováno pořadí/reference a nuly/převody;
250k 100přijetí8,47→8,52ms,1000odmítnutí8,86→7,83ms. Metadata310BJSON;
neprokazuje to zrychlení, cenu celého UI ani nulový memory leak. Viz
docs/MQTT_DIAGNOSTIKA.md a docs/performance/MQTT_DIAGNOSTIKA.md.

METEO-050 DONE v rozsahu provozního panelu; log/export dál METEO-064,
fyzikální kvalita METEO-047, zóny048. Další METEO-008 podle existujícího
profilu etapy13: rozdělit první tvorbu velkého analytického modelu a ověřit
nezměněné plné výpočty. Main/archiv/config/workflow se zde neupravují.

Publikování v0.18.0 ověřeno 2026-10-23: [Actions #34](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39973854413)
pro [17e46ba](https://github.com/Michaltymm/Meteo_webovky/commit/17e46badf8697b084336dc93c952f28484cc57a5)
**Success**, build20s/deploy10s/celkem39s,1artefakt. Implementace i ověření
308/308 Node a oba browser harnessy dokončené; nasazení potvrzené workflow.
Přímý živý Pages host je mimo síťovou politiku, skutečné MQTT/neřízené zdroje
neověřeny. Vzdálený codex-dev potvrzen na17e46ba, main stále
`2405c5d7326909a24c41e7066bfdc4a9d1622208`. Existující varování runtime
Actions/ubuntu-latest bez změny workflow. Následující commit je jen tato evidence;
příští etapa METEO-008 podle výše uvedeného checkpointu.

## Dávkovaný analytický model — v0.18.1, první část METEO-008

Výchozífcdcbba, bez opakování hotové diagnostiky050. analyticsModelSteps,
analyticsSummarySteps a sampleExtremaSteps nesou původní pořadí operací,
synchronní API je dokončí přes finishSteps. UI od10k vybraných řádků, při
Sheets a společném výřezu, sdílí jednu analyticsState.job. Žádná kopie řádků,
jen jedno předalokované pole odkazů; O(n) výpočty a původní statistiky zachovány.
Kontrolní body1024položek, rozpočet~8ms/max64kroků na setTimeout(0) callback;
časovač sheetsNow sdílen jako bezpečné čtení performance.now. Rozpočet je měkký.

analyticsInvalidate/Stop, všechny změny výřezu/dat/stanice a visibility zavřou
generátor a zruší timer; current kontroluje identitu, context, zdroj/délku,
doménu a aktivní/viditelnou stránku/zdroj. Zveřejnění až po dokončení, potom
jen viditelné karty. Stará plátna/heat detail se během přípravy nepoužijí,
aria-busy a stav jsou viditelné; PNG má disabled i guard do překreslení karty.
Pád úlohy má obecný stav a čeká na uživatelskou invalidaci bez auto retry.
Malé a nezávislé rozsahy i streamingmqtt/both ponechány synchronní, aby
opakované appendy nezpůsobily hladovění stále rušeného modelu.

321/321 Node (13nových; doplněná streaming větev znovu cíleně13/13).
Nový reálný Chromium154 harness, všechny3konfigurace,100kmodel/9grafů,
zoom/reset/PNG,320/1440px a obě témata, zrušení přes skutečné ovládání
s pozastavenými hranicemi callbacků; bez pageerror nebo socketů. Původní
info harness také prošel. Skutečný broker/živé CSV a fyzické iOS neověřeny.

Sekvenční před/po1k–250k aCPU×4/100k, SHAcelých souhrnů/samples/XY shodné.
250k nejdelší blok389,6→10,7ms, celek389,6→685,6ms, heap poGC43 324 124→
43 361 896B. CPU×4/100k blok834,4→20,1ms, celek834,4→925,2ms. Menší bloky
za delší celkové čekání, nikoli důkaz zrychlení/INP/paměťové úspory. Profil
izoluje model, další synchronní práce a Charts zůstávají otevřené.
Viz docs/performance/ANALYTICKY_MODEL.md, reprodukovatelné oba nové Python
skripty a13testů; žádná produkční závislost, změna configů/workflow/archivu.

METEO-008 Rozpracováno; příště nejprve změřit přípravu porovnání a rozdělit
nejdražší průchod podle výsledků. Velký parser, smoothing/night/heatmapa,
nezávislé výřezy a streaming snapshot samostatné zbývající části.

Publikování v0.18.1 ověřeno 2026-10-23: [Actions #35](https://github.com/Michaltymm/Meteo_webovky/actions/runs/40012622055)
pro [3314c6c](https://github.com/Michaltymm/Meteo_webovky/commit/3314c6cbd5b241897655421e671efbc6ecb78244)
**Success** (build25s,deploy9s,celkem43s,1artefakt).321/321lokálních Node,
13/13cílené po závěrečné ochraně použití starých XY os a oba browser harnessy
prošly. Implementované/otestované a workflow-nasazené se rozlišuje; přímý živý
Pages host je mimo síťovou politiku, skutečné zdroje/broker/fyzické iOS neověřeny.
Vzdálený codex-dev3314c6c, main stále
`2405c5d7326909a24c41e7066bfdc4a9d1622208`. Původní upozornění Actions runtime/
ubuntu-latest trvají, bez změny workflow. Následující commit je pouze evidence;
další checkpoint008: profil navazujícího porovnání, nikoli opakování hotového modelu.

## Dávkované porovnání stanic — v0.18.2, druhá část METEO-008

Výchozí9fd455b. Profil pouze comparison nad připraveným modelem/cache:
250k/+5s149,5ms, matcher140,5ms (~94 %). CPU×4/100k266ms. Důvod rozdělení,
bez opakování modelového profilu nebo CSV auditu. Matcher a typed min/max
sampler dostaly resumable generátory; synchronní API je dokončí finishSteps.
Stejná pořadí porovnání/součtů a pravidla10min/earlier/one-to-one/duplicity,
žádný výpočet statistik z vizuálních bodů. Zachovány všechny3konfigurace.

analyticsComparison má volitelný cooperative UI režim; Sheets+sync a10k
vybraných řádků aktivního nebo cizího zdroje. comparisonJob je jen pro kartu8,
workSlice sdílený s modelem (~8ms/max64kroků; matcher512,ostatní1024).
Metadata snapshotu: context,model,domain,entry refs/loading/errors. Guard před
dávkou/commitem; změna zdroje/cache/modelu/mezi/relace zahazuje starý výsledek,
viditelná karta začne aktuální. analyticsInvalidate/Stop/visibility ruší,
ale samostatný foreign abort/network/cache se tím nemění. Busy pouzecard8,
staré plátno/PNG nejsou dostupné do překreslení; ostatní karty/model zachovány.
Chyba bez raw textu a bez nekonečného retry stejného podpisu; další změna/obnova
dovolí nový pokus. Memo drží jeden hotový výsledek na modelu; transientní
cache reference nepředstavují celkový RAM limit16MiB.

332/332Node,11nových targeted, původní matcher oracle400historií zachovaný.
Rozšířený reálný Chromium154 harness100k/9grafů/3konfigurace/0/nullV/zoom/PNG,
busy jen8, výměna cache/pozdní callback/navcancel a oba režimy320/1440px,
bez pageerror nebo socketů. Původní info harness také prošel. Vzdálené služby,
skutečné MQTT a fyzický Safari/iOS tím ověřeny nejsou.

Před/po1k–250k shodných/+5s timestampů aCPU×4/100k, sekvenčně.
Podpis celých výsledků a raw match statistik přesně shodný.250k/+5s blok
149,5→8,5ms, celek149,5→281,8ms; CPU×4/100k blok266→9,6ms a celek266→445,2ms.
Heap poGC250k/+5s31 817 752→31 902 908B; není peak/RSS nebo důkaz úspory/
nulového úniku. Profil izoluje přípravu, ne síť/CSV/Chart/paint/INP. Žádná nová
produkční závislost nebo změna config/workflow/main/archivu.
Viz docs/performance/POROVNANI_STANIC.md, reprodukční script/profileJSON a testy.

METEO-008 Rozpracováno. Dále profil heatmapových buněk/vyhlazení/noční analýzy,
pak nejdražší malý průchod. Velký parser/worker/persistence, nezávislé výřezy
a konzistentní streaming snapshot zůstávají dalšími částmi.

Publikování v0.18.2 ověřeno 2026-10-23: [Actions #36](https://github.com/Michaltymm/Meteo_webovky/actions/runs/40016084617)
pro [cebf40a](https://github.com/Michaltymm/Meteo_webovky/commit/cebf40ac4f0e9aae63bd307857f0429376018f76)
**Success** (build28s,deploy46s,celkem82s,1artefakt).332/332lokálních Node,
rozšířený skutečný100k browser i info harness prošly; implementaci/ověření
a workflow-nasazení rozlišovat od přímé kontroly živého Pages hostu, který
není v síťové politice. Živé služby/MQTT/fyzické iOS neověřeny. Vzdálený
codex-devcebf40a, main stále `2405c5d7326909a24c41e7066bfdc4a9d1622208`.
Původní upozornění Actions runtime/ubuntu-latest trvají; bez změny workflow.
Následující commit jen evidence, další checkpoint008: profil heatmapových
buněk/vyhlazení/noční analýzy; nevracet se k dokončenému modelu a porovnání.

## METEO-008 — výběr nočního intervalu, v0.18.3 (2026-10-24)

Třetí malá část je implementovaná a ověřená; celé ID zůstává **Rozpracováno**.
Výchozí0f2ad15. Dokončené model/párování ani METEO-050 se neopakují. Nový
profil zbývající heatmapy/vyhlazení/noci na1k/10k/100k/250k ukázal zbytečný
průchod celé historie při výpočtu jediného nočního úseku v kartě6. Heatmapa
pravidelné historie už omezuje14dní, vyhlazení je volitelné. Opravena pouze noc.

Dvě binární meze ve vzestupném původním modelu vyberou západ≤čas≤východ,
včetně všech duplicit. Následuje stejný výpočet se stejným pořadím a kontrolou
V/mezery>3h. O(log n+k), pomocně O(1), žádná redukce pro statistiky, nový
plánovač/cache/request nebo změna konfigurací. Astronomie, místní zóna/DST,
pozorovaný rozdíl mV a délka částečného úseku zůstávají. Není odhad energie,
kapacity ani potvrzené nabíjení; METEO-020 není touto optimalizací celé hotové.

Sekvenční před/po:250k regular32,7→0,1ms, dense68,6→12,0ms, night85,9→36,3ms;
CPU×4/100k regular63,6→0,8ms, dense109,9→0,2ms, night156,1→61,9ms. SHAcelého
textu nočního výsledku, všech heatmapových buněk a bodů vyhlazení se na všech
12scénářích přesně shoduje. Hustá noc stále znamená O(k) synchronního průchodu,
nikoli záruku16ms nebo INP. Vyhlazení/heatmapa se neměnily; jejich kolísání
není vydáváno za přínos změny. Paměť, síť a celý paint se touto etapou neměřily.
[Metodika, výsledky a surová data](performance/NOCNI_ANALYZA.md).

342/342 Node,10nových v analytics-night.test.js: nezávislá původní lineární
reference, hranice/duplicity/0/null/nonfinite, mezery, prázdná a částečná noc,
předvýchodový fallback, skutečná astronomie přes DST ve3zónách,100náhodných
historií, dense20k a250k Proxy s<200přístupy, neměnnost dat. Starší test
minutového stavu dat selhal i na výchozím HTML kvůli kalendářnímu snapshotu
z data stroje. Fixture nově srovná visibleDay se svými hodinami; produkční
visibility se nemění, opravená fixture10/10 prošla i s výchozím HTML.

Další checkpoint008: využít již změřené volitelné vyhlazení a omezit/rozdělit
jeho plné dočasné pole bodů při zachování přesného pořadí průměrů a vzorkování.
Hustá noc, heatmapa, velký parser, nezávislé rozsahy a streaming snapshot
zůstávají samostatně. Worker/persistence až podle měření. Jen codex-dev,
žádná změna main, původních konfigurací, archivu nebo workflow.

Skutečný Chromium154 browser po změně prošel:100k původních řádků, všech9grafů,
3původní konfigurace (včetně0/nullV), přesná noční poznámka/memo v kartě6 bez
nových requestů, zoom/reset/2PNG, rušení modelu i porovnání a320/1440px ×2témata.
Bez pageerror a bez otevřených socketů. Data jsou lokální řízené CSV/UV,
živé služby/broker a fyzický Safari/iOS se neověřovaly. Sada342/342 Node
zahrnuje původní Pages sestavení/server a regresní funkce všech stanic.
