# Využití sestupných úseků při řazení CSV

METEO-008, v0.21.23. Základ měření je v0.21.22 z `6eefb14`.

Velký aktivní export Sheets se nejdřív prochází po dávkách. Až 32
existujících sestupných úseků se sloučí stejným stabilním slučováním.
Úplně seřazený export vrátí původní pole bez alokace druhého pole.
Při vyšším počtu úseků pokračuje slučování pevných šířek. U stejných
časů má přednost dřívější záznam, a to i přes hranice úseků a dávek.
Malé exporty a synchronní parser dál používají nativní stabilní řazení.

## Izolované měření řazení

Chromium 154, 390 px, CPU ×4. Syntetické řádky s trojicemi stejných
časových značek. Téměř seřazená varianta má dva prohozené řádky u konce.
Promíchaná varianta používá deterministickou permutaci. Mediány ze šesti
střídavých párů po zahřátí. Časy měří součet práce jednotlivých dávek
bez čekání mezi nimi. Výstupy se shodovaly s referencí v identitě všech
měření i jejich pořadí.

| Řádky | Pořadí | Řazení celkem (ms) | Počet dávek |
| ---: | --- | ---: | ---: |
| 100 000 | sestupné | 2,5 → 3 | 2 → 2 |
| 100 000 | téměř seřazené | 74,5 → 13 | 28 → 5 |
| 100 000 | promíchané | 148 → 159 | 29 → 30,5 |
| 250 000 | sestupné | 6,5 → 6,5 | 4 → 4 |
| 250 000 | téměř seřazené | 219 → 30 | 73 → 12 |
| 250 000 | promíchané | 1 031,5 → 997 | 138,5 → 134,5 |

Přínos je soustředěný na téměř seřazené exporty. Výsledky obou
promíchaných scénářů mají opačný směr a nepotvrzují obecné zrychlení.

## Příjem a zpracování exportu

Navazující profil vychází z `scripts/benchmark-refresh-browser.py`.
Používá syntetické sekundové CSV s původní konfigurací Sheets, stejnou
permutaci promíchaného vstupu a dvě prohozená měření u konce téměř
seřazeného vstupu. Odezvy CSV jsou lokální. Grafická karta zůstává mimo
viewport. Tři měřené obnovy po zahřátí na stejném profilu CPU a šířky.

| Řádky | Pořadí | Parser včetně řazení (ms) | Celá obnova (ms) |
| ---: | --- | ---: | ---: |
| 100 000 | téměř seřazené | 1 487 → 1 449 | 2 728 → 2 663 |
| 250 000 | téměř seřazené | 3 503 → 3 287 | 6 324 → 5 934 |
| 100 000 | promíchané | 2 177 → 2 241 | 4 079 → 3 977 |
| 250 000 | promíchané | 5 365 → 5 375 | 9 725 → 10 049 |

Časy parseru jsou součty práce bez pauz mezi dávkami. Obnova zahrnuje
lokální přenos a čekání mezi dávkami. Měření zahrnuje uložení dat a běžný
commit přehledu. Úplné řádky, diagnostika validace, statistiky, očekávaná
měření i závěrečné ověření grafu daly shodné podpisy ve všech čtyřech
scénářích. U silně promíchaných 250 000 řádků trvala celá obnova o 3,3 %
déle, součet práce parseru se lišil o 10 ms.

## Ověření

Prošlo 505/505 testů Node.js. Pokryly mimo jiné lichý počet sestupných
úseků, hranici 32 úseků, stabilní pořadí duplicit a rušení načítání.
Offline Chromium prošel kontrolami CSV a Moderního přehledu 2 se třemi
původními konfiguracemi. V žádné integraci se neobjevila chyba stránky.

## Další měření parseru

Izolovaný pilot znovu použil rozpoznané části stejného data v
sousedních CSV řádcích a normalizoval text napětí jednou na řádek.
Při 100 000 pětiminutových záznamech klesl medián převodu a validace
z 852 na 811 ms s využitím data a na 755 ms s oběma změnami. Při
250 000 sekundových záznamech trval 2 300 → 2 155 → 1 951 ms. Porovnání
použilo připravená CSV pole a tři střídavé běhy po zahřátí při CPU ×4.
Všechny převedené řádky i validační zprávy se shodovaly. Před zavedením
je potřeba ověřit odvození roku, přechody letního času a běžný příjem CSV.

## Publikace

Sestavení a nasazení `f915631` z `codex-dev` proběhly úspěšně.
Produkční `main` je na `2405c5d`.
[GitHub Actions #84](https://github.com/Michaltymm/Meteo_webovky/actions/runs/46071261944)
