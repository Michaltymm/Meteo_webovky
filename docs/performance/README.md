# Reprodukce měření výkonu

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
