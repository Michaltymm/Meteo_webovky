# METEO-008: stabilní pořadí 24h výřezu, v0.20.2

Výchozí revize d8e696d / v0.20.1. Dílčí etapa; celé METEO-008 rozpracované.

Sheets historie je už sestupná. Místo opakovaného stabilního sortu se zkopíruje
jen binárně vybraný výřez, obrátí a uvnitř každé skupiny shodných časů znovu
obrátí pořadí. Výsledkem je vzestupný čas a původní pořadí duplicit, včetně
hranic okna. O(k) času a jedna kopie výřezu; zdrojové řádky/objekty se nemění.
MQTT/both si ponechávají původní filtr a sort kvůli posunům živých hodin.
Žádné nové požadavky, cache, závislosti nebo změna statistického vstupu.

## Měření výběru

Skutečný Chromium, postupně před/po, 2 zahřívací a6 měřených běhů, mediány.
1000/10000/100000/250000 řádků ve třech scénářích: regular300s, dense100ms,
ties skupiny5stejných časů po100ms. Nezávislý původní filter+sort oracle kontroluje
identitu každého řádku. SHA celého pořadí pro všech12 dvojic shodné.

| Scénář | Počet | Výběr před → po (ms) |
|---|---:|---:|
| dense | 100000 | 1,60 → 0,50 |
| dense | 250000 | 5,10 → 1,25 |
| ties | 100000 | 9,65 → 0,40 |
| ties | 250000 | 26,95 → 0,40 |

Běžný regular výřez má nejvýše289 řádků, výsledky jsou pod rozlišením časovače
(~0ms); nepředstavuje doklad zrychlení celého webu. U menších scénářů0–0,15ms
převažuje šum. Syntetická hustota/duplicity nejsou tvrzením o skutečné stanici.
Nejde o měření sítě, INP, RAM nebo fyzického mobilu.

Reprodukce: `scripts/benchmark-current-order-browser.py --before <HTML-v0.20.1>
--assets <adresář-chart.js-a-paho.js> --output <JSON>`. Raw data `razeni-vyrezu-24h.json`.

## Ověření a návaznost

432/432 Node testů. Dvě nové regrese kontrolují velké skupiny duplicit s frozen
zdrojem a počet čtení timestampů. Existující100irregular historií, prázdné,
equal-time, hranice24h,250kProxy, plné statistiky a MQTT/both oracle zachované.

Profil `benchmark-refresh-browser.py` nově čeká i na dokončení currentChartJob
po fetchSheets, zaznamenává completedMs a CPU výběru/dávek/aplikace grafu.
Čas ui je nadále pouze synchronní commit, DOM mutace pouze uvnitř tohoto commitu.
Čas Chart.update zahrnuje skutečný odložený draw během obnovy. Nezávislý dodatečný
overifikační draw je dál mimo měřené časy. Výsledky tohoto rozšířeného profilu
nelze přímo zaměňovat za starší synchronní metriky.

Celý cyklus: skutečný Chromium/Chart/Paho a řízený CSV fetch/parser/commit,
3měřené běhy po warmupu, všechny1k/10k/100k/250k scénáře postupně před/po.
Regular krok300s, dense1s (24h výřez proto nejvýše86401 řádků, na rozdíl od
izolovaného100ms profilu). Úplné SHA všech řádků, statistik/reportu/DOM,
vykresleného grafu i původních měření jsou přesně shodné ve všech8párech.
Raw výsledky: `razeni-refresh-before.json`, `razeni-refresh-after.json`.

| Scénář | Synchronní UI před → po ms | Dokončení obnovy před → po ms |
|---|---:|---:|
| regular100k | 17,4 → 13,6 | 772,0 → 796,8 |
| regular250k | 23,7 → 20,8 | 1702,3 → 1989,1 |
| dense100k | 29,5 → 19,3 | 984,8 → 866,0 |
| dense250k | 25,7 → 23,9 | 2074,8 → 2094,2 |

Výběr ve skutečné obnově dense100k má medián4,2→1,3ms, dense250k2,8→1,6ms.
Zrychlení samotného výběru nedokládá obecné zrychlení celé obnovy; plné časy
jsou ovlivněné parserem, plánováním a GC. Zachována i pomalejší měření.
Žádné pageerror/sockety ani nárůst počtu Chart instancí nebo požadavků.

Další etapa METEO-008: přesné agregace (regular250k medián20,8→17,4ms,
dense250k19,7→20,3ms) jsou pořád synchronní. Nejdříve izolovat jejich průchody
pro případnou kooperativní přípravu, zachovat celé validní zdroje, cache a atomické
zveřejnění. Závěrečný draw dense250k má medián11,1→10,6ms, nikoli pevný limit.
V této etapě se parser, agregace ani renderer nemění.
