# Mikroměření synchronizace moderního přehledu — v0.14.0

Srovnání předchozí revize4a88d7e a nové implementace; Node24.19.0, původní JS vprojektové VM. Každý vzorek je1000volání syncModernStation,7opakování sGC před vzorkem, uveden medián po zahřátí. Store obsahuje uvedený počet syntetických původních měření; synchronizace je neprochází. DOM je testovací náhrada: nejde o layout, vykreslení, špičku paměti, síť ani fyzický mobil.

| Řádků v historii | Před:1000volání (ms) | Po:1000volání (ms) |
| --- | --- | --- |
| 1000 | 1.92 | 3.26 |
| 10000 | 1.82 | 2.91 |
| 100000 | 1.76 | 2.69 |
| 250000 | 1.82 | 3.11 |

Režie nové kontroly je zde přibližně0,9–1,3ms na1000synchronizací (~1µs na jednu). Výsledky nejsou důkazem zrychlení; účel změny je personalizace UI. Nezměněné preference nevyvolávají další zápisy viditelnosti (Node regrese). Změna výběru sahá pouze na7karet/checkboxů a malé preference; neinvaliduje statistiku ani nečte historii.

Reprodukce: `node --expose-gc scripts/benchmark-modern-preferences.cjs [baseline-index.html]`; bez argumentu se použije aktuální index. Baseline získat příkazem `git show 4a88d7e:index.html` do souboru mimo repozitář. Spouštět sekvenčně mimo browser/ostatní profily.

Skutečný browser: nezměněná reference store.rows,8→8původních Chart a0nových fetch při volbě karet, obnově nebo přepínání obou vzhledů. Nápověda má zachovanou prodlevu1500ms. Takové kontroly neprokazují rychlost živých služeb ani WebVitals.
