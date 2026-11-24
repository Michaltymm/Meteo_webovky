# Denní srážky v Průzkumníku

METEO-008, v0.21.11. Výchozí revize `7399f38`.

Předchozí výpočet vytvářel textový klíč dne pro každý dostupný záznam.
Nový výpočet formátuje datum při změně místního dne. Sousední hodnoty
aktualizují jedno denní maximum a při opětovném výskytu stejného dne se
použije stejná položka. Zachovává se místní kalendářní datum, chybějící
hodnoty, skutečné nuly, pořadí podle času maxima a první záznam při shodě.

Výpočet pracuje s úplným vybraným intervalem. Jedna výsledná řada se
použije pro Chart.js i pro statistiky. Každý den se stále vykresluje jako
jeden sloupec s nejvyšší pozorovanou hodnotou čítače v daném výřezu.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, viewport 390 px, zpomalení CPU ×4,
pásmo Europe/Prague a pevný čas prohlížeče. Osm střídavých opakování po
zahřátí pro každou variantu. Samostatný profil měří původní a nový výpočet
denních hodnot. První vykreslení měří `refreshTab('explorer')` s metrikou
Srážky a rozsahem Vše nad již načtenou historií, včetně přípravy grafu.
Měření nezahrnuje přenos ani vykreslení snímku.

| Historie | Formátování data před → po | Denní agregace před → po (ms) | První vykreslení před → po (ms) |
| --- | ---: | ---: | ---: |
| 400 minutových měření | 400 → 1 | <1 → <1 | 64 → 70 |
| 100 000 hodinových měření | 100 000 → 4 168 | 68 → 24,5 | 264,5 → 226 |
| 250 000 minutových měření | 250 000 → 175 | 131 → 39 | 254,5 → 158 |

Časy jsou mediány. Počet formátování se ověřil samostatným opakováním
výpočtu mimo měřený úsek. U nejmenšího výřezu se zrychlení prvního vykreslení
neprojevilo. Ve všech vzorcích se přesně shodovaly popisky, denní hodnoty,
statistiky i počet původních záznamů. Chart.js nadále dostává všechny dny.

## Ověření

Prošlo 487/487 testů Node. Dvě cílené regrese prošly i v pásmu Europe/Prague.
Kontrolují opakovaný výskyt dne, přechod z letního času, nulu, chybějící
hodnoty, pořadí a počet formátování. Chromium porovnal denní vrcholy s
přímým průchodem původní historie při šířce 320 px. Prošly přepnutí metriky,
prázdný výřez i kontrola Moderního přehledu 2 se třemi stanicemi.

Další krok METEO-008 je změřit náklady vykreslení tisíců sloupců a prověřit
úpravu, která zachová denní maxima, statistiky a přístup ke každému dni.
