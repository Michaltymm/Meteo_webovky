# Odložená konstrukce měsíčního a ročního grafu

METEO-007, v0.21.8. Výchozí revize `d1bed2f`.

Záložky Měsíční a Roční dostanou vlastní instanci Chart.js při prvním
vykreslení. Instance vzniká s vypočtenými řadami a zůstává pro další
aktualizace a přepnutí záložky. Plátna mají vyhrazenou šířku a výšku během
načítání historie i při šířce displeje 320 px.

Výpočet využívá stejnou cache denních a měsíčních souhrnů. Zachovává původní
pořadí, limit 30 denních a 12 měsíčních souhrnů, zaokrouhlení průměrů a samostatné počty
platných hodnot teploty a vlhkosti. Aktualizace aktivní záložky nadále používá
úplná dostupná měření a dosavadní pravidla obnovy.

## Měření

Offline Chromium 154 a Chart.js 4.4.0. Střídalo se původní a upravené HTML,
osm opakování po zahřátí. Start znamená součet synchronní práce uvnitř
konstruktorů bez automatického síťového načtení. První vykreslení znamená
čas `refreshTab` pro každou záložku na čerstvé stránce s načtenými daty a
připravenou cache souhrnů. Animace byly omezené. Časy jsou mediány.

| Profil | První otevřená záložka | Konstrukce při startu před → po (ms) | První vykreslení před → po (ms) |
| --- | --- | ---: | ---: |
| 1440 px, 400 řádků | Měsíční | 25,5 → 14,5 | 4,5 → 9,5 |
| 1440 px, 400 řádků | Roční | 20,0 → 14,5 | 3,0 → 8,0 |
| 390 px, CPU ×4, 100 000 řádků | Měsíční | 79,5 → 51,5 | 21,5 → 41,5 |
| 390 px, CPU ×4, 100 000 řádků | Roční | 82,5 → 51,0 | 17,0 → 40,0 |

Při izolovaném startu vznikly tři grafy místo pěti. První vykreslení převzalo
cenu odložené konstrukce. Popisky, hodnoty a konfigurace řad se shodovaly
ve všech párech. Profil nezahrnuje přenos, čekání na vykreslení snímku ani
Web Vitals.

## Ověření

483/483 testů Node. Pokrývají oddělené vytvoření obou grafů, opětovné
využití instance, historii s nulami a chybějícími hodnotami, různá léta
se stejným dnem i sdílení souhrnů bez dalšího průchodu přes 250 000 řádků.
Chromium ověřil první otevření i návrat do záložek při 320 px bez dalšího
požadavku při již načtené historii, obě moderní varianty a funkčnost
výkonnostního scénáře `profile-history.py --aggregates`. Prošla také
kontrola devíti analytických karet se 100 000 záznamy.

V mobilním měření zabralo nejvíc času vytvoření grafu Průzkumníka
(medián 30,5 ms). Další samostatná etapa METEO-007 má odložit
její konstrukci a ponechat funkční prázdný výřez, graf srážek a přepínání
metrik a typů grafu.

## Publikace

[GitHub Actions #69](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45391456858)
potvrdily sestavení a publikaci `989511a` z `codex-dev` za 68 s.
Větev `main` při kontrole zůstala na revizi `2405c5d`.
