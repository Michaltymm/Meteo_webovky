# Dávkování dlouhých výřezů Průzkumníku

METEO-008, v0.21.19. Základ měření je v0.21.18 z `3ea9c35`.

Po potvrzení výřezu s alespoň 75 000 řádky se výběr bodů a přesný souhrn
připravují v dávkách. Používají stejný generátor jako synchronní cesta.
Výpočet pokračuje pouze na viditelné záložce Průzkumníku a graf se
statistikami se vykreslí najednou v samostatné úloze. Nový pohyb posuvníku,
změna metriky nebo období a invalidace dat ruší rozpracovaný výpočet.
Po návratu k nezměněnému výřezu se práce obnoví ze stejného místa.

## Měření

Offline Chromium 154, Chart.js 4.4.0, 390 × 844 px, CPU ×4, Europe/Prague,
snížený pohyb. Na syntetické pětiminutové historii posouváme levou hranici
mezi 5 a 9 %. Střídáme pořadí revizí v pěti párech běhů. Po zahřátí
počítáme mediány ze 16 potvrzení pro každou velikost a metriku. Nejdelší
obsluha porovnává čas události `change` s nejdelším voláním pracovního
callbacku včetně závěrečného Chart.js. Celkový čas končí po aktualizaci
grafu a zahrnuje čekání mezi dávkami. Síť ani následné vykreslení snímku
prohlížeče se neměří.

| Historie | Metrika | Obsluha potvrzení (ms) | Nejdelší obsluha (ms) | Celkem (ms) |
| ---: | --- | ---: | ---: | ---: |
| 100 000 | Teplota a vlhkost | 43,5 → 1 | 43,5 → 28,5 | 44 → 72,5 |
| 100 000 | Absolutní vlhkost | 38,5 → 1 | 38,5 → 24 | 39 → 53,5 |
| 250 000 | Teplota a vlhkost | 67,5 → 1 | 67,5 → 27,5 | 67,5 → 102 |
| 250 000 | Absolutní vlhkost | 61 → 2 | 61 → 24 | 61 → 83 |

Shodovaly se finální řady, popisky, souhrny a krajní časy ve všech šesti
kombinacích včetně synchronního výřezu z 20 000 měření.
Doplňkové měření 32 potvrzení u 20 000 měření ukázalo 30,5 → 36 ms pro
teplotu a vlhkost a 28 → 30 ms pro absolutní vlhkost. U menších výřezů se
tedy zrychlení nepotvrdilo. Dávkování zkracuje souvislou práci u velkých
výřezů za cenu delšího čekání na celý výsledek.

První načtení rozsahu dál používá synchronní cestu. Dokončení grafu
napětí nadále obsahuje samostatnou regresi nad úplným nedávným výřezem.
METEO-008 může dále změřit obě cesty a volit další zásah podle délky
největších bloků.

## Ověření

Prošlo 498/498 testů Node. Regrese ověřují pozastavení při odchodu a
skrytí, pokračování se stejným výřezem, zrušení po změně výběru, dat
nebo stanice a jedinou aktualizaci grafu a souhrnu. Offline Chromium
ověřil potvrzení myší v 1440 px, dotykem v 390 px a klávesnicí, přepnutí
záložky a zrušení při změně metriky. Prošly také kontroly analytiky
baterie a vlhkosti a Moderního přehledu se třemi původními konfiguracemi.
V konzoli se neobjevily chyby stránky.
