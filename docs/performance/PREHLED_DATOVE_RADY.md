# Datové řady grafu přehledu v0.21.1

Při změně veličiny či období používá graf stejné tři objekty řad. Chart.js
ponechá jejich řadiče i stav legendy. Nové denní hodnoty, jednotka a barvy se
prosadí v běžné aktualizaci. Po změně stanice začne graf s výchozí viditelností.
Stejná cesta nového sestavení pokrývá také opakování po chybě aktualizace.

Výchozí revize `7af8c49`. Benchmark `scripts/benchmark-overview-render-browser.py`
porovnává viditelný graf na šířce 390 px v Chromium s pevným časem. Historie
obsahuje 1 000, 10 000, 100 000 nebo 250 000 měření v pětiminutových intervalech.
Měření střídá teplotu s vlhkostí nebo 7 dní s 30 dny či celou historií. Hlavní
běh má dvě zahřátí a devět měřených aktualizací. První průzkumný běh měl jedno
zahřátí a tři měřené aktualizace. Oba jsou uložené s úplnými vzorky.
[Vzorky](prehled-rady.json)

| Scénář | Medián celého přehledu před → po | Medián Chart.js před → po |
|---|---:|---:|
| Změna veličiny, Vše, 100 000 měření | 14,7 → 8,5 ms | 9,5 → 4,8 ms |
| Změna veličiny, Vše, 250 000 měření | 14,2 → 16,7 ms | 5,8 → 6,4 ms |
| Návrat ze 7 dní na Vše, 100 000 měření | 8,0 → 8,2 ms | 4,5 → 4,9 ms |
| Návrat ze 7 dní na Vše, 250 000 měření | 17,8 → 13,0 ms | 9,6 → 5,7 ms |

U návratu na Vše jsou v tabulce pouze čtyři měřené přechody ve směru 7 dní →
Vše. Průzkumné měření střídání obou směrů u 250 000 měření mělo opačný výsledek
s mediánem 14,3 → 22,3 ms. Časy tedy závisí na scénáři, směru změny a běhu.
Měření zachycuje synchronní práci v prohlížeči s místními daty a omezeným
pohybem. Odezvu fyzického telefonu ani dokončení animace neměří.

Úplné grafy a tabulky měly shodné podpisy v 16 hlavních i 16 průzkumných
párech. Prošlo 466 testů Node. Chromium s daty tří původních konfigurací
ověřil denní hodnoty všech veličin, práci legendy včetně zachování řadiče při
změně veličiny, správnou jednotku a barvy i motiv a změnu šířky okna.

Nasazení v0.21.1 z commitu `9e8fa2b` potvrdily GitHub Actions na `codex-dev`.
Běh trval 61 sekund včetně čekání. Produkční `main` zůstal na `2405c5d`.
[GitHub Actions #61](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45342901719)
