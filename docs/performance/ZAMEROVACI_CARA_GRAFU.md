# Překreslení zaměřovací čáry grafu

METEO-008, v0.21.13. Výchozí revize `b0f12b8`.

Plugin při změně polohy nebo skrytí čáry předá Chart.js `args.changed`.
Chart.js tak může vykreslit čáru a detail hodnoty v jednom kroku. Stejná
poloha druhé vykreslení nevyžádá. Opuštění plátna čáru skryje. Detail a
dotyk dál používají obsluhu Chart.js. Změna platí pro grafy se sdíleným
pluginem a nemění zpracování ani data grafu.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, 390 px, CPU ×4, stejné syntetické
hodinové hodnoty a vykreslení celého období z 100 000 řádků. Dvanáct
syntetických pohybů bylo do plátna posláno postupně po snímcích. Profil
měří počet volání a součet synchronních časů uvnitř `draw()`. Běželo pět
střídavých opakování pro každou verzi po zahřátí. Časy jsou mediány práce
na grafu v testu, bez měření výsledné latence nebo výkonu fyzického telefonu.

| Graf | Vykreslené body | Volání `draw()` před → po | Celkový čas `draw()` před → po (ms) |
| --- | ---: | ---: | ---: |
| Srážky | 4 168 | 24 → 12 | 770 → 395 |
| Teplota a vlhkost | 519 | 24 → 12 | 58 → 35 |

Opakování stejné polohy vyvolalo v obou grafech před úpravou jedno
vykreslení a po ní žádné. Poloha čáry a posloupnost popisků i hodnot v
detailu se přesně shodovaly. Opuštění plátna skrylo čáru i detail.

## Ověření

Prošlo 489/489 testů Node a čtyři kontroly v Chromium. Jednotkový test
ověřuje hranice osy, opakovaný pohyb, zachování požadavku jiného pluginu
a opuštění plátna. Prohlížeč ověřil detail srážek myší i dotykem při 320 px,
tooltip čárového grafu 24 h, rozkliknutí původních hodinových měření a
Moderní přehled 2 se třemi stanicemi.

## Další krok

Všechny základní grafy už vznikají odloženě. Samotná knihovna Chart.js se
stále načítá před zpracováním stránky. Kontrolovaný pilot s prodlevou
300 ms na souboru Chart.js zkrátil zobrazení teploty v Moderním přehledu 2
z 589 na 347 ms při neblokujícím načtení. Jde o medián čtyř offline
opakování s řízeným CSV a prodlevou, nikoli o měření produkční sítě.
Navazující METEO-007/055 má ověřit připravenost knihovny při rychlém vstupu
do grafů, při chybě CDN a při přepnutí stanice.

## Publikace

[GitHub Actions #74](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45396803270)
potvrdily sestavení a publikaci `dc62d35` z `codex-dev` za 60 s.
Větev `main` při ověření zůstala na revizi `2405c5d`.
