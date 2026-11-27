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

## Pilot další etapy

Na nasazeném kódu v offline simulaci 390 px a CPU ×4 trvala kopie výřezu
z 250 000 měření přibližně 1 ms (medián osmi výřezů). Synchronní obsluha
trvala 74,5 ms a Chromium zaznamenal dlouhou úlohu ve všech osmi případech.

Izolovaný prototyp využil stejný generátor výběru po dávkách s rozpočtem
8 ms, následovaný jedním vykreslením v samostatné úloze. V osmi střídavých
opakováních každé varianty se výstupy shodovaly. Měřily se synchronní úseky
kódu a celkový čas od zahájení do vykreslení včetně čekání mezi dávkami.
Následující časy jsou mediány v mobilní simulaci z výše uvedeného profilu.

| Historie | Metrika | Nejdelší synchronní práce (ms) | Celkem (ms) |
| ---: | --- | ---: | ---: |
| 100 000 | Teplota a vlhkost | 40,5 → 26,5 | 40,5 → 57,5 |
| 100 000 | Absolutní vlhkost | 61 → 20 | 61 → 54,5 |
| 250 000 | Teplota a vlhkost | 54,5 → 23,5 | 54,5 → 96 |
| 250 000 | Absolutní vlhkost | 57,5 → 20,5 | 57,5 → 82,5 |

Prototyp kratší souvislou prací uvolňuje hlavní vlákno, u dlouhé historie
prodlužuje čekání na finální výsledek. Další etapa METEO-008 má prověřit
omezení dávkování na dlouhé výřezy, zrušení práce při změně stanice, dat
nebo výřezu a jediný společný zápis grafu i statistik po dokončení.

## Publikace

Sestavení a nasazení `3ea9c35` z `codex-dev` proběhly úspěšně.
Produkční `main` je na `2405c5d`.
[GitHub Actions #79](https://github.com/Michaltymm/Meteo_webovky/actions/runs/46042077645)
