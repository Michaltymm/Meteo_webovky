# Odložená konstrukce grafů Porovnat dny a Přehled

METEO-007, v0.21.10. Výchozí revize `3c47bf0`.

Porovnat dny a Přehled vytvářejí Chart.js při prvním vykreslení. Další
výběr dne, veličiny nebo rozsahu používá stejnou instanci. Přehled dál
uchovává identitu řad a nastavení legendy a aktualizuje graf při změně
vykreslených hodnot. Porovnání dál poskytuje původní hodinové podklady.
První vykreslení respektuje aktuální omezení animací a plátna mají
vyhrazené rozměry i před vytvořením.

Odložený vznik základních grafů je tím hotový. Analytické grafy se už
uvolňují při odchodu. Běžné grafy zůstávají po otevření uložené kvůli
rychlému návratu a zachování legendy. Případné uvolňování má vycházet z
měření paměti při delším používání a zachovat uživatelská nastavení.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, osm střídavých opakování každé
varianty po zahřátí, omezené animace. Start měří součet času uvnitř
konstruktorů bez síťového načtení. První vykreslení měří synchronní
`refreshTab` nad načtenou syntetickou historií s pětiminutovými vzorky a
připravenou cache souhrnů. Porovnání má teplotu a vlhkost pro dva dny,
Přehled zobrazuje teplotu za celou historii. Časy jsou mediány a
nezahrnují přenos ani vykreslení snímku.

| Profil | První otevřená záložka | Konstrukce při startu před → po (ms) | První vykreslení před → po (ms) |
| --- | --- | ---: | ---: |
| 1440 px, 400 měření | Porovnat dny | 11,5 → 0 | 8,0 → 21,0 |
| 1440 px, 400 měření | Přehled | 12,0 → 0 | 6,0 → 14,0 |
| 390 px, CPU ×4, 100 000 měření | Porovnat dny | 40,5 → 0 | 42,0 → 106,5 |
| 390 px, CPU ×4, 100 000 měření | Přehled | 36,0 → 0 | 61,0 → 106,0 |

V izolovaném startu vzniklo nula instancí místo dvou. První vykreslení
převzalo cenu konstrukce. V každém porovnání se shodovaly strukturované
popisky, řady grafu, text souhrnu porovnání a HTML tabulky Přehledu.

## Ověření

Prošlo 485/485 testů Node. Cílené prohlížečové kontroly potvrdily
otevření původních hodinových záznamů z grafu, zachování legendy a řad
Přehledu při změně veličiny a motivu i změně velikosti okna. Prošly oba
moderní přehledy a devět analytických karet se 100 000 záznamy. Přímé
otevření Moderního přehledu 2 ve všech kontrolovaných velikostech
začíná bez instance grafu.

Další výkonnostní etapa METEO-008 má zrychlit dlouhé srážkové rozsahy
Průzkumníka. Samostatný profil našel jedno formátování data na měření
a vysoké náklady aktualizace Chart.js. Viz [profil Průzkumníka](KONSTRUKCE_PRUZKUMNIKU.md).

## Publikace

[GitHub Actions #71](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45393643147)
potvrdily sestavení a publikaci `1019cd5` z `codex-dev` za 58 s. Větev `main`
při ověření zůstala na revizi `2405c5d`.
