# Řazení dní v přehledu v0.21.2

Přehled odvozuje pořadí dne z místního roku, měsíce a dne původního měření.
České datum slouží jako popisek. Při řazení se tedy popisky nerozkládají a
nevytvářejí se z nich objekty `Date`. Po dobu průchodu jedním dnem se znovu
použije stejný souhrn. Pokud se živá data k předchozímu dni vrátí, použije se
jeho dosavadní souhrn a hodnoty se přičtou v původním pořadí.

Výchozí revize `5c7bf39`. `scripts/benchmark-overview-render-browser.py`
měří střídání teploty a vlhkosti ve viditelném přehledu v Chromium 154 při
šířce 390 px. Historie obsahuje 1 000, 10 000, 100 000 nebo 250 000 vzorků s
odstupem pěti minut. V obou verzích se měří přímo řádek, který sestavuje a řadí
seznam dní. Celkový čas zahrnuje i graf a tabulku. Každý scénář má dvě zahřívací
a devět měřených aktualizací. [Vzorky](prehled-razeni-dnu.json)

| Historie, rozsah Vše | Medián řazení před → po | Medián celého přehledu před → po |
|---|---:|---:|
| 1 000 měření | < 0,1 → < 0,1 ms | 2,7 → 2,4 ms |
| 10 000 měření | < 0,1 → < 0,1 ms | 4,8 → 4,0 ms |
| 100 000 měření | 0,7 → < 0,1 ms | 12,2 → 9,6 ms |
| 250 000 měření | 1,1 → 0,1 ms | 16,8 → 13,5 ms |

Rozsahy 30 dní měly malou cenu řazení už před změnou. U 250 000 měření trvala
v novém běhu příprava souhrnů 4,7 ms a aktualizace grafu 6,8 ms. Rozdíl celého
přehledu zahrnuje variabilitu obou fází. Měření zachycuje synchronní práci v
lokálním prohlížeči se syntetickou historií. Odezvu fyzického telefonu neměří.

Ve všech osmi scénářích jsou podpisy celého grafu a všech stránek tabulky shodné.
Přidaná regrese ověřuje sestupnou tabulku a vzestupný graf pro neuspořádaná
data s návratem do již zpracovaného dne přes hranici měsíce a roku.

Prošlo 467 testů Node. Chromium ověřil načítání a přehled všech tří původních
konfigurací i stránkování a ovládání při šířkách 320, 390 a 1440 px.

Nasazení v0.21.2 z commitu `0a7826c` potvrdily GitHub Actions na `codex-dev`.
Běh trval 46 sekund včetně čekání. Produkční `main` zůstal na `2405c5d`.
[GitHub Actions #62](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45343361835)
