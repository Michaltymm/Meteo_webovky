# Statistiky Průzkumníku bez dočasných řad

METEO-008, v0.21.16. Výchozí kód `8ce330d` (v0.21.15).

Minimum, maximum, součet a počet se počítají přímo z úplného zvoleného
výřezu. Vykreslení dál používá vzorkování se zachováním extrémů.
Kombinace teploty a vlhkosti ušetří dvě dočasná pole o velikosti výřezu,
jednoduchá metrika jedno. Řada denních maxim srážek slouží grafu i
statistikám stejně jako dříve.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, viewport 390 × 844 px, CPU ×4,
Europe/Prague, snížený pohyb, pevný čas 27. 11. 2026 ve 12:00. Data jsou
syntetická pětiminutová měření s chybějící teplotou a skutečnými nulami
vlhkosti. Šest střídavých párů po zahřátí pro každou kombinaci velikosti a
metriky. Jeden vzorek je první `buildExplorer()` a čtyři opakování se
stejnými daty a stejným výřezem. Čas statistik zahrnuje přípravu vstupů,
souhrn a zápis do DOM. Celý čas zahrnuje aktualizaci Chart.js a vynechává
síť i vykreslení snímku. Počet položek dočasných polí je ze samostatného
instrumentovaného průchodu a nevyjadřuje velikost celého heapu.

Porovnávaly se popisky grafů, všechny vykreslené řady, text počtu a HTML
statistik. Rozsah Vše u 1 000, 10 000, 100 000 a 250 000 měření pokryl
teplotu s vlhkostí, absolutní vlhkost a denní srážky. Výstupy se přesně
shodovaly ve všech 12 kombinacích.

| Měření | Teplota a vlhkost, statistiky (ms) | První zobrazení (ms) | Opakované zobrazení (ms) | Položky dočasných polí |
| ---: | ---: | ---: | ---: | ---: |
| 1 000 | 1,0 → 0,75 | 94 → 86,5 | 24,75 → 24,25 | 2 000 → 0 |
| 10 000 | 6,25 → 2,75 | 121,5 → 117 | 40,5 → 32,75 | 20 000 → 0 |
| 100 000 | 34,75 → 17 | 184 → 160 | 77,25 → 55,5 | 200 000 → 0 |
| 250 000 | 100,5 → 33,25 | 330 → 245,5 | 160,5 → 95 | 500 000 → 0 |

U absolutní vlhkosti při 250 000 měřeních klesl čas statistik z 62,5 na
39,25 ms a dočasné pole o 250 000 položkách odpadlo. První zobrazení trvalo
200 → 202,5 ms. Zrychlení první kresby se liší podle veličiny a velikosti
historie. Počet dočasných polí u srážek zůstal stejný.

## Ověření

Prošlo 494/494 testů Node. Tři offline kontroly v Chromium prošly s
původními konfiguracemi stanic a
bez chyb stránky. Pokryly přepínání pohledů, oba moderní přehledy, podklady
baterie a výběr posuvníkem v Průzkumníku. Test korelace má pevný výchozí čas,
aby sousední dvojice měly skutečně shodné časové značky i při pomalém běhu.
