# Etapa 8 — rozklad změny RH, v0.5.0

21. 10. 2026, výchozí revize `7aa843e` / v0.4.0. Jeden navazující úkol:
**METEO-078** nad hotovými METEO-013/061. Dřívější audity a testované souhrny
se znovu neanalyzovaly. Rozsah a stav úkolu jsou v centrální roadmapě.

## Správnost a rozsah

Pro dvě původní krajní měření úseku platí:

`e = es(T) · RH / 100`

`RH2/RH1 = (es1/es2) · (e2/e1)`

`Δln(RH) = Δln(e) − Δln(es)`

Sdílený Magnus nad kapalnou vodou z předchozí etapy, −45 až 60 °C,
0<RH≤100 %. Počítá se bez zaokrouhlení, UI zaokrouhluje až výsledky.
Faktory se násobí; nepřičítají se jako procentní body. Model neidentifikuje
kauzalitu, původ vody, vodní bilanci ani průběh mezi krajními body.
Platnost kalibrace/umístění mezi body vždy označena jako neověřená.
Případná metadata epoch METEO-071 se nedoplňují odhadem.

UI je native details v průzkumníku při T/RH/T+RH/Td/AH/VPD. Zdrojové T/RH,
časy s UTC offsetem, parní tlaky, oba faktory, výsledný poměr, kontrolní RH
a logaritmické příspěvky. RH 0 je platná původní hodnota a AH=0, ale nemá
logaritmický rozklad; nevyměňuje se za sousední měření. Shodný čas,
chybějící/mimooborové vstupy a číselné podtečení mají vysvětlenou nedostupnost.
Kontrolní RH při stejném e nad 100 % se označí za formální překročení
nasycení bez kondenzace, nikoliv za naměřenou hodnotu. Nekompatibilní metrika,
prázdný či jednobodový rozsah a invalidace dat panel vyčistí/skryjí.

## Cílené měření před/po

Použit existující benchmark s volbou `--counts`: jen 1k a 250k, pět vzorků,
mediány bez odstranění prvního. Chromium 154.0.8037.57, Chart.js 4.4.0,
Europe/Prague, stejné syntetické 5minutové řádky a lokální Chart.js, offline.
Časované běhy postupně bez souběžných testů/prohlížečů. Synchronní JS +
Chart update, nikoliv pozdější paint, reálná síť nebo Web Vitals.
Časovaný viewport 1280, navazující smoke 390 px. Nový rozklad je v T+RH aktivní,
details není otevřené. Prohlížečový test níže ověřuje i rozbalený obsah.

| Řádků | Obnova před → po (ms) | Explorer T/RH před → po (ms) | Slider 20–80 % před → po (ms) |
| ---: | ---: | ---: | ---: |
| 1 000 | 24,7 → 24,6 | 6,0 → 6,9 | 5,4 → 5,7 |
| 250 000 | 28,9 → 29,7 | 47,7 → 39,5 | 23,5 → 20,3 |

[Před](stage8/before-7aa843e.json), [po](stage8/after.json).
Rozdíly oběma směry nejsou tvrzením zrychlení stávajících grafů. Nový výpočet
má O(1) nad dvěma řádky; původní O(n) statistiky/sampling nebyly měněny.
Proxy test s 250k řádky ověřil přesně2 čtení (první/poslední), žádný nový fetch.
Původní statistické texty a počet aktualizací přehledu se shodují před/po.
Rozsáhlé profily všech čtyř velikostí, CPU×4, heap a30cyklů z etapy 7 nebyly
opakované — tato etapa neoptimalizuje ani nemění správu historie/grafů.

## Ověření

**142/142 Node testů**,10 nových v `tests/humidity-change.test.js`:
ohřev při konstantním e s nezávislou zaokrouhlenou referencí es, izotermická
změna e,400 kombinací domény a nezávislý poměr RH/logaritmická identita,
identické/nasycené stavy, nedostupné/0/mimooborové vstupy, numerické podtečení
a nenulová vědecká notace pro malé hodnoty, shodný/neplatný čas a DST fold,
250k se dvěma čteními, skutečné endpointy slideru/derived metriky/clear/reset.
Toleranci 1e−9 RH pro zaokrouhlenou es referenci nelze zaměnit s 1e−12 tolerancí
testované algebraické identity; nejde o odhad nejistoty senzoru.

[Skutečný browser](stage8/browser.json) se třemi původními konfiguracemi,
řízeným CSV/UV: stejná RH a různá T dávají součin faktorů1, správné krajní
časy/UTC offsety, slider aktualizuje nové endpointy, žádné další požadavky.
Nula/missing/nasycení a přepnutí metriky/prázdný rozsah správně vysvětleny či
vyčištěny. Dvě témata a320/390 px bez ustáleného přetečení a page errors,
screenshot rozbaleného panelu prohlédnut. Po resize se čeká 100 ms na existující
Chart.js ResizeObserver; okamžitý canvas při změně viewportu není ustálený
layout. Zachovány integrační scénáře T/V/motion a opravy starého CSV.
Benchmark smoke navíc prošel všechny záložky a deset explorer voleb při 1k/250k.

Konfigurace, workflow, server, archiv, závislosti a původní data se nemění.
Živé služby/broker, firmware, fyzický mobil a přímé widgety Pages neověřeny.
Nasazení evidovat samostatně; úspěšný lokální test není deployment.

```bash
git show 7aa843e:index.html > /tmp/meteo-before.html
python scripts/benchmark-browser.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --counts 1000,250000 --output /tmp/before.json
python scripts/benchmark-browser.py --html index.html --chartjs /tmp/meteo-chart.js --counts 1000,250000 --output /tmp/after.json
node --test tests/*.test.js
python scripts/check-analytics-browser.py --chartjs /tmp/meteo-chart.js --output /tmp/browser.json
```

Dev nástroje a lokální Chart.js podle [README](README.md). Benchmarky spouštět
postupně. Další vhodná samostatná etapa: METEO-077 vliv jednotlivých dnů na
vztah T/V; metadata epoch071 a explicitní zóna048 zůstávají vlastními úkoly.
