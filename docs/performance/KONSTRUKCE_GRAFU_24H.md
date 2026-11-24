# Odložená konstrukce grafu 24 h

METEO-007, v0.21.5. Výchozí revize `bb74a76`.

Při startu stránky dříve vzniklo osm instancí Chart.js včetně grafu 24 h.
Výpočet jeho dat už před změnou respektoval viditelnost. Nyní se při prvním
vykreslení vytvoří i samotná instance. Při dalších aktualizacích se používá
tatáž instance se stejným nastavením řad, os a legendy. Výpočty a vzorkování
se řídí dosavadními pravidly. Bez funkčního `IntersectionObserver` se graf
vytvoří při první aktualizaci aktivního přehledu.

Před inicializací má plátno stejný prostor jako obal grafu, včetně šířky
320 px. První vykreslení čte aktuální nastavení omezení pohybu. Skrytý
graf a zrušená dávka po přepnutí stanice nevytvoří novou instanci. Změna
nepřidává požadavky, časovače ani pozorovatele.

## Měření

Offline Chromium se skutečným Chart.js 4.4.0 používá HTML a CSS každé revize
s vypnutou síťovou inicializací. Čas v konstruktorech zachycuje volání
`new Chart` a synchronní práci, kterou vyvolají. První vykreslení se měří
samostatně v `buildCharts('now')` nad stejnými 400 řádky. Obě varianty se
střídají, osm vzorků po zahřátí, omezené animace. Strukturované hodnoty
vykreslených řad se shodovaly ve všech vzorcích.

| Profil | Start grafů před → po (ms) | První vykreslení 24 h před → po (ms) |
| --- | ---: | ---: |
| 1440 px, bez zpomalení | 36,2 → 28,2 | 6,5 → 19,6 |
| 390 px, procesor ×4 pomalejší | 124,9 → 101,5 | 28,9 → 60,6 |

Čísla jsou mediány. Při startu vzniklo sedm instancí místo osmi. Cena
konstrukce se přesouvá do prvního vykreslení, kde se projevuje podle
zařízení a polohy grafu. Tento profil neměří Web Vitals ani fyzické zařízení.

## Regrese

480/480 testů Node. Kontrola grafu 24 h v Chromium ověřila tři konfigurace,
odložené vytvoření po dvou úplných exportech, přesná data, obnovu viditelné
karty, přepínání stránek a fallback bez `IntersectionObserver`. Mobilní
rozvržení před vytvořením prošlo i při šířce 320 px. Prošly také prohlížečové
kontroly obou moderních přehledů a `check-analytics-cooperative-browser.py`
se 100 000 řádky a devíti analytickými kartami. Kontroly nezaznamenaly chybu
stránky.

Starší `check-analytics-browser.py` a `check-analytics-grid-browser.py` mají
neaktuální předpoklady o ovládání podpůrných panelů. Problémy se zobrazením
vnořených záznamů baterie a očekávaným textem nápovědy byly reprodukovány na
výchozí revizi. Aktualizace těchto scénářů patří do METEO-056.

## Publikace

[GitHub Actions #66](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45347027168)
potvrdily build a publikaci `87cf47a` z `codex-dev` za 55 s. `main` při kontrole
zůstala na `2405c5d`. Přímý přístup z tohoto prostředí na GitHub Pages blokovala
síťová brána při ověřování v0.21.4.

## Další krok

Při startu ještě vznikají grafy pro další záložky. Ve stejném mobilním
profilu zabraly konstruktory srážek a napětí v mediánu 33,4 a 16,4 ms.
Oba grafy plní stejná podzáložka, takže je lze odložit společně. Další
měření má zohlednit i první otevření podzáložky a cenu případné konstrukce
rovnou s připravenými daty.
