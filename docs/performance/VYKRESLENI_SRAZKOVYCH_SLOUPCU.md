# Vykreslení srážkových sloupců v Průzkumníku

METEO-008, v0.21.12. Výchozí revize `63b935a`.

Průzkumník při opakované obnově porovná dny a jejich maxima s posledním
úspěšným vykreslením. Při shodě ponechá existující sloupce a jejich nastavení.
Souhrn a počet původních měření vypočte z úplného aktuálního výřezu. Změna
osy, hodnoty, stanice, návrat z čárového grafu nebo předchozí neúspěšné
vykreslení použijí běžnou aktualizaci Chart.js.

Pilot v předchozí etapě ukázal úsporu při vypnutí parsování. V běžném vstupu
aplikace se úspora nepotvrdila. U 4 168 sloupců trvala aktualizace Chart.js
134,5 ms s původními daty a 138 ms s předpřipravenými body. Vydaná úprava
proto ponechává stávající formát bodů a zaměřuje se na shodné obnovy.

## Měření

Offline Chromium 154 a Chart.js 4.4.0. Viewport 390 px, CPU ×4, pevný čas
v Europe/Prague. Osm střídavých opakování každé varianty po zahřátí.
První vykreslení měří synchronní `refreshTab('explorer')` s rozsahem Vše
a již dostupnými daty. Opakované vykreslení měří `buildExplorer()` pro
stejný výřez a zvlášť jeho část `chart.update()`. Třetí měření provede
opravu posledního měření, která musí změnit denní maximum. Tabulka uvádí mediány.
Měření nezahrnuje síť ani čas do vykreslení snímku.

| Historie | První vykreslení před → po (ms) | Shodná obnova před → po (ms) | Oprava maxima před → po (ms) |
| --- | ---: | ---: | ---: |
| 400 minutových měření | 72 → 74 | 17 → 2 | 17,5 → 15,5 |
| 100 000 hodinových měření | 227,5 → 221,5 | 179 → 30 | 153 → 146,5 |
| 250 000 minutových měření | 165 → 158 | 77,5 → 40 | 96 → 116,5 |

Všechna shodná opakování v nové verzi přeskočila `chart.update()`. U 100 000
měření jeho medián klesl ze 152 na 0 ms. První vykreslení a oprava maxima
procházejí běžnou aktualizací. U opravy v největším scénáři byl medián vyšší.
Porovnání před a po ověřilo oba rozsahy os, jejich popisky, data detailu a
rozměry každého sloupce i HTML statistik, před opravou i po ní.

## Ověření

Prošlo 488/488 testů Node. Cílený test ověřuje změnu počtu měření bez
překreslení, nové maximum, opakování po chybě vykreslení, návrat z jiné
metriky a reset stanice. Chromium ověřil obě osy, den a hodnotu v detailu
myší i dotykem při šířce 320 px, zachování instance při změně metriky,
prázdný výřez a žádné další požadavky při načtené historii. Prošla také
kontrola Moderního přehledu 2 se všemi třemi stanicemi.
