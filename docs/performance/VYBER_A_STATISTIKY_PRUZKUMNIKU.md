# Společný výběr bodů a statistiky Průzkumníku

METEO-008, v0.21.18. Výchozí verze 0.21.17 z `7ad1b86`.

Při výběru bodů pro graf se každá veličina stejně musí vyhodnotit na všech
řádcích výřezu. Průzkumník při tom přičítá hodnoty k úplnému souhrnu.
Pořadí sčítání, nezávislá platnost veličin, pravidla pro mezery a výběr
krajních bodů zůstávají stejné. Výřezy do 800 bodů rovnou použijí všechna
měření. Denní srážky se dál vyhodnocují z řady denních maxim.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, 390 × 844 px, CPU ×4, snížený pohyb,
Europe/Prague. Syntetická historie v pětiminutových intervalech s chybějící
teplotou a nulovou vlhkostí. Jeden zahřívací běh a čtyři měřené páry
se střídavým pořadím. Srovnání zahrnuje rozsah Vše a posun levé hranice
na 10 %. Čas synchronní obsluhy zahrnuje Chart.js. Samostatně se měří doba
od potvrzení velkého výřezu k následujícímu callbacku rAF. Vykreslení
dalšího snímku a přenosy jsou mimo rozsah.

| Historie | Teplota a vlhkost, obsluha (ms) | Absolutní vlhkost, obsluha (ms) | Teplota a vlhkost, potvrzení až k rAF (ms) |
| ---: | ---: | ---: | ---: |
| 1 000 | 24,5 → 26 | 22 → 24 | — |
| 10 000 | 28,5 → 31 | 26,5 → 26 | — |
| 100 000 | 60 → 48,5 | 52 → 45,5 | 122 → 94 |
| 250 000 | 95,5 → 69,5 | 94 → 60 | 165,5 → 136 |

U 250 000 měření trvalo potvrzení absolutní vlhkosti do rAF 114,5 → 87 ms.
Samotný společný průchod u teploty a vlhkosti trval 37 ms. Dříve zabral
výběr 32 ms a statistiky 35,5 ms při samostatném měření obou fází.
U malých výřezů zůstává většina práce v Chart.js. Všech osm kombinací
dalo stejné řady, popisky, statistiky i datové hranice.

## Ověření

Regrese porovnává původní řádky grafu i všechny položky souhrnu včetně
záporné nuly, ztráty přesnosti při sčítání, neplatných a chybějících hodnot.
Každý vstup se pro souhrn a vzorkování vyhodnotí jednou za veličinu.
Prošlo 496/496 testů Node.js. Tři offline kontroly v Chromium pokryly
výběr období a změnu vlhkosti, analytickou mřížku a Moderní přehled 2.
Použily tři původní konfigurace stanic a proběhly bez chyb stránky.

Výběr a souhrn nad velkým výřezem stále běží synchronně. Dalším krokem
METEO-008 je změřit náklady kopírování výřezu a oddělit trvání finálního
výpočtu od nejdelšího bloku hlavního vlákna.
