# METEO-008 — Hodinové statistiky v0.20.9

Porovnání dnů už prochází měření po skupinách shodných okamžiků. V této verzi
spočítá místní hodinu a posun vůči UTC jednou pro každou takovou skupinu. Počet
záznamů se přičte po skupině. Součet, počet platných hodnot a přehled zdrojových
řádků dál zahrnují jednotlivá měření v původním pořadí. Pokrytí veličiny se
započítá při její první platné hodnotě v daném okamžiku. Podzimní opakovaná
hodina tak dál spojuje oba posuny v jednom průměru a eviduje je odděleně v pokrytí.

Výchozí revize `8384748`. `scripts/benchmark-statistics-browser.py` měří první
výpočet hodinového dne v lokalizaci Europe/Prague po vymazání jeho výsledku z
cache. Základní denní index je připraven před měřením. Pro každou velikost
proběhlo jedno zahřátí a tři běhy. Běžná historie má 300 sekund mezi vzorky.
Hustá data mají buď tři záznamy se stejným časem na sekundu, nebo jedinečné časy
s odstupem 333 ms. Husté scénáře o 250 000 řádcích zasahují dva dny a měří první
z nich s přibližně 130 000 řádky, stejně jako v profilu v0.20.5.

| Velikost historie | Běžná před → po | Hustá s duplicitami před → po | Hustá s jedinečnými časy před → po |
|---:|---:|---:|---:|
| 1 000 | 0,4 → 0,4 ms | 0,7 → 0,5 ms | 0,4 → 0,5 ms |
| 10 000 | 0,3 → 0,2 ms | 2,9 → 1,4 ms | 2,3 → 2,2 ms |
| 100 000 | 0,5 → 0,4 ms | 19,9 → 11,7 ms | 20,9 → 19,0 ms |
| 250 000 | 0,2 → 0,3 ms | 27,4 → 13,0 ms | 26,8 → 23,8 ms |

Podpisy úplných hodinových, ročních a přehledových výsledků byly shodné ve
všech 12 dvojicích. U běžných historií jsou rozdíly blízko rozlišení časovače.
Mediány zachycují výpočet samotného modelu v lokálním Chromium se syntetickými
vstupy. Hustý scénář s jedinečnými časy stále trvá 23,8 ms. [Vzorky](hodinove-skupiny.json)

Prošlo 463 testů Node. Rozšířená regrese zahrnuje obě strany podzimní změny
času, duplicity, nulu, různé chybějící hodnoty i rozsahy původních záznamů.

Chromium s řízenými CSV daty všech tří stanic ověřil hodinové průměry proti
původnímu výpočtu, stránkování, ovládání klávesnicí, otevření měření z grafu a
opravu CSV. Mobilní kontrola proběhla při 320 a 390 px ve dvou motivech. Test
otevírá panel nápovědy znovu po změně velikosti a používá místní kopie knihoven
se zachovanou kontrolou integrity. Odezva na fyzickém zařízení zůstává neověřená.
