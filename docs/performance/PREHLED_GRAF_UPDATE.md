# METEO-008 — Aktualizace grafu přehledu v0.20.8

Při opakovaném vykreslení porovnává přehled nová data s daty, která už Chart.js
používá. Posuzuje přesnou shodu popisků dní, zobrazených denních minim, maxim a
průměrů, barvy a jednotky. Shodný graf si ponechá původní instance datových řad
včetně aktuální volby v legendě. Po resetu stanice či neúspěšné aktualizaci se
graf sestaví při dalším zobrazení. Změny velikosti, ovládání legendy a volba
omezení pohybu používají stávající obsluhu Chart.js.

Denní statistiky stále vycházejí z celé vybrané historie. Tabulka reaguje i na
změnu počtu vzorků při shodných vykreslených hodnotách. Porovnávání pracuje s
poli přímo v grafu a navíc uchovává jen jednotku poslední úspěšné aktualizace.

Výchozí revize `af9d2b5`. Benchmark `scripts/benchmark-overview-render-browser.py`
běžel v Chromium při šířce 390 px s pevným občanským časem a syntetickými daty
v pětiminutových intervalech. Pro 1 000, 10 000, 100 000 a 250 000 řádků spouští
rozsahy 30 dní a Vše. Po zahřátí měří tři běhy. Režim `repeat` opakuje stejnou
veličinu a `change` střídá teplotu a vlhkost. Časy zachycují synchronní práci
při sestavení přehledu včetně případného `Chart.update`. Vzorky jsou v souboru
[prehled-graf-update.json](prehled-graf-update.json).

| Scénář, rozsah Vše | Medián před | Medián po | Volání `Chart.update` na běh |
|---|---:|---:|---:|
| Opakování, 100 000 řádků | 15,1 ms | 4,2 ms | 1 → 0 |
| Opakování, 250 000 řádků | 17,5 ms | 9,4 ms | 1 → 0 |
| Změna veličiny, 100 000 řádků | 21,3 ms | 23,1 ms | 1 → 1 |
| Změna veličiny, 250 000 řádků | 45,2 ms | 50,9 ms | 1 → 1 |

Všech 16 dvojic scénářů mělo shodná grafová data a serializovanou tabulku.
Při změně veličiny jsou časy v největších scénářích vyšší a aktualizace grafu
stále desítky milisekund. Měření proběhlo s lokálními zdroji v desktopovém
Chromiu a nezahrnuje odezvu reálného telefonu ani úplný čas vykreslení snímku.

Prošlo 463 testů Node. Nové regrese ověřují změnu počtu bez překreslení, odlišné
hodnoty, datum a jednotku, obnovu po chybě a reset stanice. Chromium scénář
`check-csv-cooperative-browser.py` prošel pro všechny tři konfigurace, 12 000
měření a šířky 320 až 1440 px. Ověřil také skutečné ovládání legendy, změnu
motivu a responzivní velikost grafu. Další měřený cíl je první výpočet hodinových
statistik neobvykle hustého dne.

Nasazení v0.20.8 potvrdily GitHub Actions. Běh trval 55 sekund, z toho 34 sekund
sestavení a 12 sekund publikování. CI prošlo 463 testy. Vývojová změna je v
commitu `f9741bf` na `codex-dev`. Produkční větev zůstala na `2405c5d`.
[GitHub Actions #58](https://github.com/Michaltymm/Meteo_webovky/actions/runs/44711811040)
