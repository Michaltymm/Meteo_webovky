# Dávkovaná příprava období Průzkumníku

METEO-008, v0.21.20. Základ měření je v0.21.19 z `0246b23`.

Otevření Průzkumníku a změny období, veličiny nebo aktivních dat používají
od 75 000 řádků stejný plánovač jako potvrzení posuvníku. U grafu se po dobu
přípravy ukazuje stav a předchozí řady, souhrn a hranice výřezu jsou skryté.
Změna výběru přeruší rozpracovaný výpočet. Při odchodu se práce pozastaví
a po návratu pokračuje, pokud je výběr stále platný. Vykreslení a souhrn se
aktualizují společně. Menší rozsahy a denní srážky používají synchronní cestu.

## Měření

Offline Chromium 154, Chart.js 4.4.0, 390 × 844 px, CPU ×4, Europe/Prague,
snížený pohyb. Přepínání z 24 h na Vše v již otevřeném Průzkumníku se
syntetickou pětiminutovou historií. Čtyři střídavé páry běhů pro každou
kombinaci, z toho tři po zahřátí. Časy jsou mediány devíti otevření období.
Nejdelší obsluha zahrnuje kliknutí a jednotlivé pracovní úlohy včetně
závěrečného Chart.js. Celkové dokončení zahrnuje i čekání mezi úlohami.
Doba přenosu a zobrazení snímku se neměřila.

| Historie | Metrika | Obsluha kliknutí (ms) | Nejdelší obsluha (ms) | Celkem (ms) |
| ---: | --- | ---: | ---: | ---: |
| 1 000 | Teplota a vlhkost | 15 → 20 | 15 → 20 | 15 → 20 |
| 10 000 | Teplota a vlhkost | 25 → 20 | 25 → 20 | 25 → 21 |
| 100 000 | Teplota a vlhkost | 43 → 3 | 43 → 28 | 43 → 86 |
| 100 000 | Absolutní vlhkost | 56 → 4 | 56 → 26 | 57 → 97 |
| 250 000 | Teplota a vlhkost | 82 → 5 | 82 → 30 | 82 → 138 |
| 250 000 | Absolutní vlhkost | 68 → 5 | 68 → 25 | 68 → 108 |

Pauzy mezi dávkami prodloužily dokončení dlouhých výřezů a uvolnily hlavní
vlákno mezi úlohami. U menších výřezů zůstala obsluha synchronní. Shoda
výsledných řad, popisků, statistik a porovnání krajních měření platí pro
všech osm kombinací velikosti a veličiny. Hranice posuvníku se po otevření
ukazují podle prvního a posledního měření nového rozsahu.

## Ověření

Prošlo 499/499 testů Node.js. Offline Chromium ověřil výběr Vše klávesnicí
při 1440 px a dotykem při 390 px s 95 000 měřeními. Test kontroloval stav
přípravy, skrytí předchozích výsledků, změnu veličiny během výpočtu,
pozastavení při odchodu ze záložky, přesné hranice a jediné vykreslení.
Prošly také kontroly baterie a vlhkosti a Moderního přehledu 2 se všemi
třemi konfiguracemi. Prohlížeč nezaznamenal chyby stránky.

## Další krok

Regrese napětí se dál počítá v závěrečném vykreslení. Doplňkový offline
pilot v mobilním profilu porovnal samotné sestavení řad napětí v osmi
střídavých opakováních. Binární mez třídenního okna nad chronologickými
daty zkrátila model z 17 na 4,5 ms při 250 000 pětiminutových měřeních.
U 250 000 sekundových měření ležela celá historie v okně. Výpočet ve dvou
průchodech se stejným pořadím součtů zkrátil model ze 74,5 na 27,5 ms.
Všechny vykreslené řady a predikce se v pilotu přesně shodovaly.
Před nasazením je třeba ověřit shody času, nulu a chybějící napětí,
neuspořádané vstupy MQTT a cenu obou variant v běžném zobrazení.

## Publikace

Sestavení a nasazení `440823c` z `codex-dev` proběhly úspěšně.
Produkční `main` je na `2405c5d`.
[GitHub Actions #81](https://github.com/Michaltymm/Meteo_webovky/actions/runs/46043976267)
