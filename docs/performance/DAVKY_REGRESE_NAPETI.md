# Dávkovaná regrese napětí v Průzkumníku

METEO-008 a METEO-046, v0.21.22. Výchozí revize `22cc6f0`.

Při dávkované přípravě Průzkumníku se pro metriku Napětí počítá i regrese,
pokud její vstup obsahuje nejméně 75 000 řádků. Hranice posledních tří dnů
se zachytí na začátku regrese, stejně pro oba průchody i následné vykreslení.
Vstup je pro Sheets chronologická část od této hranice. Neuspořádané zdroje
procházejí celý výřez s kontrolou času. Úplný výběr, pořadí součtů a
zaokrouhlení predikce se při stejném čase zachovávají.

Výsledná predikce se zveřejní se stejným grafem a statistikami. Novější
výběr, změna stanice nebo invalidace původních dat ruší i rozpracovanou
regresi. Krátká okna a graf Srážky & Baterie používají synchronní
průchod stejným výpočtem.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, 390 × 844 px, CPU ×4, Europe/Prague,
snížený pohyb a pevný čas prohlížeče. Přepnutí 24 h → Vše stiskem
ovládacího prvku zahrnuje přípravu modelu a Chart.js. Čtyři střídavé
páry běhů, z toho tři po zahřátí. Mediány jsou z devíti otevření na
variantu. Měříme nejdelší souvislou obsluhu, závěrečnou konstrukci řad
`voltageSeries` a celkový čas do aktualizace grafu. Čekání mezi dávkami
se započítává do celkového času.

| Historie | Interval | Závěrečné řady (ms) | Nejdelší obsluha (ms) | Celkem (ms) |
| ---: | --- | ---: | ---: | ---: |
| 1 000 | 5 minut | 1 → 2 | 26 → 36 | 26 → 36 |
| 10 000 | 5 minut | 1 → 2 | 27 → 28 | 27 → 29 |
| 100 000 | 5 minut | 2 → 3 | 27 → 30 | 65 → 68 |
| 250 000 | 5 minut | 1 → 3 | 29 → 28 | 98 → 89 |
| 100 000 | 1 sekunda | 17 → 2 | 48 → 30 | 71 → 108 |
| 250 000 | 1 sekunda | 40 → 2 | 69 → 30 | 112 → 144 |

Shodovaly se popisky, naměřené body, predikce, statistiky a porovnání
krajních měření ve všech šesti scénářích. U sekundových dat se výpočet
regrese přesunul ze závěru do samostatných dávek. Dávky zkrátily
souvislou obsluhu a prodloužily celkové čekání. U pětiminutové historie
se regrese do dávek nepřesunula a profil neukazuje jednotné zrychlení.

## Ověření

Prošlo 503/503 testů Node.js. Regrese ověřují zachování stejné časové
meze po posunu hodin a zrušení během regrese při změně stanice.
Offline Chromium změnil veličinu během rozpracovaného výpočtu při
1440 px klávesnicí a při 390 px dotykem. Zobrazil se jen nový výsledek.
Oba grafy napětí daly se všemi původními konfiguracemi stejné výsledky
jako v0.21.21. Prošel také Moderní přehled 2.
