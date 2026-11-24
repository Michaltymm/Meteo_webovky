# Odložená konstrukce grafu Průzkumníka

METEO-007, v0.21.9. Výchozí revize `2b99614`.

Průzkumník vytváří první instanci Chart.js při vykreslení a používá ji pro
všechny následující rozsahy, metriky, prázdné výřezy i oba typy grafu. Plátno
má vyhrazenou velikost během načítání historie. Dokončení asynchronního
načtení respektuje aktuální rozsah a aktivní záložku. Po návratu na záložku
se využije mezitím dokončená historie.

Zachovává se zpracování hodnot, redukce vykreslovaných měření u čárového
grafu a výpočet statistik z úplného výřezu. Denní srážky dál používají
nejvyšší pozorovanou hodnotu každého dne jako v předchozí verzi.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, osm opakování v obou verzích po
zahřátí. Start měří součet časů v konstruktorech bez síťového načtení.
První vykreslení měří synchronní `refreshTab('explorer')` po nastavení
metriky a rozsahu Vše nad již dostupnými hodinovými měřeními. Hodnoty jsou
mediány. Profil nezahrnuje přenos ani čas do vykreslení snímku.

| Profil | Metrika | Konstrukce při startu před → po (ms) | První vykreslení před → po (ms) |
| --- | --- | ---: | ---: |
| 1440 px, 400 měření | Teplota a vlhkost | 13,5 → 13,0 | 7,0 → 22,5 |
| 1440 px, 400 měření | Srážky | 15,0 → 13,5 | 5,0 → 11,0 |
| 390 px, CPU ×4, 100 000 měření | Teplota a vlhkost | 54,5 → 39,0 | 97,5 → 126,0 |
| 390 px, CPU ×4, 100 000 měření | Srážky | 49,5 → 39,5 | 193,0 → 242,5 |

V izolovaném startu vznikly dvě instance místo tří. Při prvním vykreslení
se práce přesunula do Průzkumníka. Typ grafu, strukturované hodnoty Chart.js,
text obsluhy a HTML statistik zůstaly ve všech srovnáních shodné. Pro velký
rozsah srážek proběhlo i samostatné měření s obalením `Chart.update` a
počítáním formátování dat. Ve stejném zpomaleném scénáři s 100 000 řádky
zabraly synchronní aktualizace grafu v mediánu 212 ms, práce mimo ně 105 ms.
Formátování data proběhlo jednou na řádek. Jde o oddělený profil s přidanou
instrumentací. Další optimalizace může omezit formátování po skupinách dnů
a změřit také náklady na vykreslení dlouhé denní řady.

## Ověření

Prošlo 485/485 testů Node. Přidané scénáře kontrolují prázdný výřez při
prvním vykreslení, přechod srážky → teplota a vlhkost, zachování nul a
chybějících hodnot a doběh historie ve skryté záložce. Chromium na šířce
320 px ověřil první vykreslení sloupců, přechod na dvě čáry, návrat k
prázdnému výřezu, absenci vodorovného přetékání a žádný dodatečný požadavek
při již dostupné historii. Prošly i oba moderní přehledy a devět
analytických karet se 100 000 záznamy.

## Publikace

[GitHub Actions #70](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45392555682)
potvrdily sestavení a publikaci `5c22df4` z `codex-dev` za 64 s. Větev `main`
při ověření zůstala na revizi `2405c5d`.
