# Neblokující načítání Chart.js

METEO-007/055, v0.21.14. Výchozí revize `964eae0`.

Chart.js se načítá s `defer`. HTML, konfigurace, načtení měření a ovládání
stránky mohou pokračovat během přenosu knihovny. Zdroj knihovny, verze a
kontrola integrity SRI zůstávají stejné. Grafy mají během čekání stavovou
zprávu a případná chyba se zobrazí po dokončení načítání. Moderní přehled 2
zobrazuje měření bez této zprávy.

Dokončení načítání naváže na aktuální stránku, stanici, metriku a výřez.
Odložený graf 24 h zachovává pravidla viditelnosti. Průzkumník a Porovnat
dny počkají s vykreslením. Tabulka Přehledu, historie, souhrn baterie a
analytická heatmapa zůstávají dostupné i při selhání knihovny.

## Měření

Offline Chromium 154, šířka 390 px, skutečné soubory s kontrolou SRI a
řízené odpovědi stanic. Prohlížeč načte v každém běhu přímo Moderní
přehled 2. Měří se čas od navigace do prvního zápisu skutečné hodnoty
teploty do DOM. Šest párových opakování po zahřátí, pořadí variant se
střídá. Jde o izolovanou simulaci, bez měření Web Vitals a produkční sítě.

| Řízená prodleva Chart.js | První teplota před → po (ms) |
| ---: | ---: |
| 0 ms | 295,7 → 306,6 |
| 300 ms | 525,4 → 261,3 |

Časy jsou mediány. Při prodlevě 300 ms všech šest výsledků v nové verzi
zapsalo teplotu ještě před dostupností Chart.js. Obě verze zobrazily stejnou
hodnotu a nevytvořily graf. Bez přidané prodlevy se zrychlení neprojevilo.

## Ověření

Prošlo 491/491 testů Node a pět kontrol v Chromium. Test načítání drží
odpověď Chart.js až do prvního zobrazení teploty, přepnutí stanice a výběru
Průzkumníka nebo analytické karty. Po uvolnění se použila aktuální data.
Při chybě CDN zůstaly dostupné tabulka Přehledu, historie, analytická
heatmapa a Moderní přehled 2. Samostatně byly ověřeny graf 24 h, běžná
analytika a načtení obou knihoven s původní kontrolou integrity SRI.
