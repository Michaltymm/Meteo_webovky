# Posuvník velkých výřezů Průzkumníku

METEO-008, v0.21.17. Porovnání s v0.21.16 (`879d55d`).

Výřez nad 10 000 měření při tažení aktualizuje polohu výběru a časy
krajních měření. Text u posuvníku upozorní, že se graf a statistiky
přepočítají po uvolnění. Událost `change` platí pro myš, dotyk a klávesnici.
Ztráta fokusu nebo zrušený dotyk dokončí otevřený výřez. Výběr nového
období nebo změna dat ukončí starý náhled. Menší výřezy se překreslují hned.

Po dokončení graf používá stejný výběr extrémů a statistiky všechny validní
řádky vybraného úseku. Posuvník ani vykreslení neposílají nové požadavky.

## Měření

Offline Chromium 154, Chart.js 4.4.0, 390 × 844 px a CPU ×4. Pětiminutová
syntetická historie, Europe/Prague, snížený pohyb. Každá z osmi kombinací
velikosti a metriky měla jeden zahřívací a čtyři střídavé měřené běhy.
Rozpis nákladů měří synchronní `expSliderUpdate()` při posunu levé hranice
na 10 %. Profil tažení posílá deset událostí `input` s rozestupem časovače
16 ms a finální `change`. Reportuje součet synchronních obsluh `input`,
počet aktualizací Chart.js a dobu od `change` do následného callbacku rAF.
Časy jsou mediány. Síť a nativní vykreslení plátna nejsou součástí měření.

| Historie | Metrika | Součet obsluh `input` (ms) | Aktualizace grafu | Od `change` k rAF (ms) |
| ---: | --- | ---: | ---: | ---: |
| 1 000 | Teplota a vlhkost | 197,5 → 209,5 | 10 → 10 | 15,5 → 19 |
| 10 000 | Teplota a vlhkost | 247,5 → 269 | 10 → 10 | 11 → 13 |
| 100 000 | Teplota a vlhkost | 467 → 7 | 10 → 1 | 18,5 → 111,5 |
| 250 000 | Teplota a vlhkost | 876,5 → 9 | 10 → 1 | 12 → 150,5 |
| 250 000 | Absolutní vlhkost | 827 → 7,5 | 10 → 1 | 12,5 → 121,5 |

U 250 000 měření trvala jedna původní synchronní obsluha teploty a vlhkosti
96 ms. Z toho 28,5 ms připadlo na výběr vzorků, 31 ms na statistiky
a 22,5 ms na `Chart.update`. Během tažení se tyto fáze u velkých výřezů
vynechají. Zbývá jedna aktualizace po uvolnění. U všech osmi kombinací se
shodovaly finální popisky, datové řady, statistiky a časy krajních měření.

Další krok v METEO-008 je změřit, zda lze při dokončení sdílet část průchodu
výběrem vzorků a statistikami. Součty musí zachovat pořadí původních měření.

## Ověření

Prošlo 495/495 testů Node, včetně posledního výřezu, malého výřezu a zrušení
náhledu po změně dat. Chromium s 12 000 měřeními ověřil tažení myší při
1440 px, dotykové tažení při 390 a 320 px a potvrzení klávesnicí. Konečný
graf se vykreslil jednou a jeho krajní bod a počet měření odpovídaly výřezu.
Offline kontrola baterie a vlhkosti prošla se třemi původními konfiguracemi.
Při kontrolách se neobjevily chyby stránky. Skutečný iOS nebyl součástí měření.

## Publikace

GitHub Actions ověřily sestavení a nasadily `7ad1b86` z `codex-dev`.
Produkční `main` je na `2405c5d`.
[GitHub Actions #78](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45977524767)
