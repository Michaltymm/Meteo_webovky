# Rozvoj meteorologického dashboardu

Aktualizováno 21. 10. 2026. Centrální živý backlog pro `codex-dev`.
Zadání: postupný rozvoj; nejprve doložené problémy výkonu, potom analytika.
Produkční `main` se mění až po schválení. Dokončený kód není důkaz nasazení.

## Výchozí stav a datové toky

Ověřeno v kořenovém `index.html`, `server.js`, čtyřech konfiguracích, `scripts/`,
`tests/`, `.github/workflows/pages.yml` a dosavadních auditech:

- Tři konfigurace → veřejné Google Sheets CSV → validace a parser → `store.rows`
  sestupně podle času → společný přehled a aktivní záložka Chart.js 4.4.0.
  Nejprve dotaz na 400 záznamů, úplná historie na vyžádání. Po jejím načtení
  periodická obnova stahuje úplný export, aby zachytila i opravy starých řádků.
- Volitelný MQTT → JSON → stejný store; spravovaný klient a rušení relací existují.
  Dodané konfigurace používají Sheets. Živý broker nebyl ověřen.
- Open-Meteo → hodinové UV; ostatní astronomické údaje jsou výpočty.
- Node server pouze poskytuje soubory. GitHub Pages publikuje statické soubory,
  `main` v kořeni a `codex-dev` pod `/dev/`, bez databáze a instalace npm.
- Nastavení prohlížeče je oddělené prefixem `meteoDev:`. Chart instance vznikají
  zatím všechny při startu; datové aktualizace nyní respektují aktivní záložku.
- Starší `Git/MQTT_webovky/index.html` je odlišná kopie; tento plán ji nemigruje.

### Co skutečně máme

| Vstup | Dostupnost / význam / omezení |
| --- | --- |
| A/B datum a čas | České datum, někdy bez roku; lokální JS Date. AUD-010 DONE v0.2.1, explicitní zóna/UTC kontrakt dále METEO-048. |
| C teplota, D tlak, E RH | °C, hPa, %; jednotlivé senzory mohou chybět. Žádné dosazování nuly. |
| F přírůstek, G srážky | Nutno ověřit reset/úhrn a interval pro každou stanici před novou srážkovou analytikou. |
| H nádrž | Význam/kalibrace vyžadují potvrzení; nepřevádět na litry bez kontraktu. |
| I napětí | V, část stanic ho nemá; bez proudu, chemie a teploty baterie nelze určit přesné SOC ani kapacitu. |
| J poznámka | Platí pro současný frontend. `Raw_Data` má jiné sloupce (J rosný bod, R poznámka). |
| Poloha + čas | V konfiguraci; astronomické výpočty jsou odhady, UV externí předpověď. |
| Firmware / Apps Script | Pouze kontext širšího auditu; zdroje a reálné nasazení nejsou ověřeny v tomto repozitáři. |

Zdroje rozhodnutí: [projektová paměť](../PROJECT_AUDIT.md), [audit Opusu](../Navrhy_Vylepseni.md),
[audit celého systému](../ANALYZA_CELEHO_WORKSPACE.md). Jejich Wxx ID se liší.
Historické nálezy se nemažou; současný stav se zaznamenává zde a v paměti.

## Pravidla evidence

- ID `METEO-NNN` je stabilní. Existující problém má jeden návrh a odkazy na původní ID.
- Stavy: **Nápad**, **K posouzení**, **Připraveno k realizaci**, **Rozpracováno**,
  **Dokončeno**, **Zamítnuto**. „Dokončeno“ vyžaduje kód i ověření, ne pouze návrh.
- P0 = zásadní výkon/spolehlivost, P1 = výrazný přínos, P2 = rozšíření,
  P3 = experiment. Náročnost N/S/V = nízká/střední/vysoká, nikoli závazný termín.
- „Současná“ znamená dostupné typy dat; skutečná úplnost a kvalita se musí kontrolovat.
  „Backend“, „firmware“, „HW“ výslovně označují nové potřebné zdroje.
- Tabulky uvádějí název, konkrétní přínos/popisek, data, náročnost, prioritu,
  očekávaný dopad na výkon, závislosti a stav. Závislost „—“ = žádná nová.
- Při každé etapě aktualizovat stav, důkaz, rizika a nové nápady; nepřidávat duplicity.

## 1. Výkon a optimalizace

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-001 Aktivní grafy: při obnově aktualizovat pouze viditelnou záložku | Současná | N / P0 | 6 → 1 chart update na přehledu | IMP-003 | Dokončeno |
| METEO-002 Cache rozsahu: jedno pole referencí a binární vyhledání v seřazené historii; rychlá změna veličiny | Současná historie | S / P0 | Bez opakovaného sort/filter celé historie; O(log n + k) | AUD-002/004 hotové | Dokončeno |
| METEO-003 Stejný rychlý export: opakované CSV do 400 řádků neparsovat a nepřekreslovat | Současné CSV | N / P0 | Méně CPU; přenos zatím stejný | AUD-008 | Dokončeno |
| METEO-004 Cache historie podle stanice/zdroje: omezená LRU + TTL, čerstvost viditelná, návrat bez čekání | Současné CSV, čas validace | S / P0 | Kompaktní T cache pro porovnání v0.10.0: 8 MiB/stanice, 16 MiB celkem, ruční obnova a stáří; obecný návrat na dashboard/TTL dále | METEO-002, kontrakt invalidace níže | Rozpracováno |
| METEO-005 Pozastavení periodických refreshů v neaktivní kartě, po návratu jedna obnova dle stáří | Současná data / visibility | N / P0 | Ve skrytí bez periodických Sheets/UV/overview; návrat dle stáří bez nového MQTT klienta | Ověřeno v0.2.2, detaily etapa4 | Dokončeno |
| METEO-006 Spolehlivá inkrementální historie a menší overview odpověď | Backend revize, změny/smazání a ověřené typy GViz | V / P0 | Zásadně menší CSV; zachovat opravy historie | FUT-005/010, METEO-049 | K posouzení |
| METEO-007 Lazy konstrukce grafů a uvolnění dlouho nepoužívaných instancí | Současná UI | S / P1 | v0.10.0 analytika lazy dle viewportu, max8 nových Chart + canvas; po odchodu destroy. Původních8 startovních grafů dále | METEO-001, měření startu | Rozpracováno |
| METEO-008 Worker pro parsing/agregace, případně IndexedDB | Současná historie | V / P2 | Méně blokování UI, cena kopírování/persistence | Benchmark skutečných CSV, METEO-004 | K posouzení |

## 2. Uživatelské rozhraní a responzivita

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-009 Stav a stáří: rozlišit poslední měření, poslední sync, chybu zdroje a neúplnou historii | Timestampy / stav transportu | S / P1 | Malý DOM update, bez dalších fetchů | METEO-048 | Připraveno k realizaci |
| METEO-010 Klávesnice a mobil: ARIA taby, fokus dialogů, dotykové cíle, kontrast v obou tématech | Současná UI | S / P1 | v0.4.0 omezení pohybu; v0.13.0 společné ⓘ: hover/touch/klávesnice, ARIA, Escape a návrat fokusu, panel ve viewportu; ostatní taby/fokus dále | IMP-006 | Rozpracováno |
| METEO-011 Kompaktní dashboard a výběr karet, per-station preference | Současné metriky / localStorage | S / P2 | v0.12.0 samostatný moderní přehled, responzivní karty a sdílené komponenty bez dalšího fetch/grafů | METEO-054; výběr karet a per-station preference dále; viz MODERNI_PREHLED.md | Rozpracováno |
| METEO-012 Jednotné formátování, jednotky a zdroj odvozených hodnot | Současná data / metadata | N / P1 | v0.4.0 AH/VPD s jednotkami/vzorci/oborem hotové; sjednocení ostatních veličin dále | METEO-048 | Rozpracováno |

## 3. Meteorologické metriky

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-013 Absolutní vlhkost, VPD, rozdíl T−Td: obsah páry a podmínky kondenzace | Současná T + RH ve stejném řádku | N / P1 | v0.4.0 AH/VPD aktuálně i v průzkumníku hotové; T−Td dále, nulové RH neznamená platný Td | Testované jednotky/vzorce a vodní reference, RH 0–100 | Rozpracováno |
| METEO-014 Teplotní amplituda, trendy 1/3/6/24 h a rychlost °C/h | Současná T + skutečné Δt | S / P1 | Agregace O(n), cache po revizi | METEO-048, mezery v měření | Připraveno k realizaci |
| METEO-015 Mrazové/letní/tropické dny a hodiny pod nulou | Současná historie T | S / P2 | O(n), malé denní agregace | METEO-038,048; interpolace jen přes malé mezery | Nápad |
| METEO-016 Tlakové trendy hPa/h, 3/6/24 h, rekordní vzestupy/poklesy | Současný tlak | S / P1 | O(n), bez nového fetch | Ověřit absolutní/redukovaný tlak, METEO-048 | Připraveno k realizaci |
| METEO-017 Úhrny, intenzita, srážkové a suché dny | Rain/rainInc + potvrzený reset a interval | S / P1 | v0.3.1 roční popisky opravené: přírůstek záznamu a rozdíl čítače nejsou ověřené úhrny; vlastní úhrny dále | FUT-007; METEO-049 | K posouzení |
| METEO-018 Heat index v platném oboru; wind chill až s větrem | T/RH nyní; vítr nový HW | N / P2 | Nízký výpočet | Dokumentovaný obor vzorce; mimo něj nezobrazovat | K posouzení |

## 4. Baterie, napájení a energetická analytika

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-019 Teplota × napětí: společný časový graf, XY a korelace | Současná T/V se společným timestampem | S / P1 | v0.4.0 základní T/V, v0.10.0 společný panel i libovolné časové období a XY den/noc/regrese; podmíněná srovnání dále | METEO-031; čas max800, XY max582 originálů, žádná hustota z reprezentantů | Rozpracováno |
| METEO-020 Noční pokles / denní nárůst mV/h, min/max napětí | Současná V + čas / poloha | S / P1 | v0.10.0 plné denní min/max V, sousední ΔV/Δt pro0<Δt≤3h a pozorovaný noční úsek; úplné solární cykly dále | METEO-048, dostatečné pokrytí; bez odhadu kapacity | Rozpracováno |
| METEO-021 Zimní/letní režim a pravděpodobné nabíjecí cykly | Současná V/T; potvrzení solárního napájení | S / P2 | O(n), počítat až v modulu | METEO-019/020; prahy kalibrovat podle zapojení | K posouzení |
| METEO-022 Nízké napětí a neobvyklý pokles s hysterezí | V, chemie baterie, mezní napětí od uživatele | S / P1 | Inkrementální vyhodnocení | METEO-044, chybějící údaje nezastupovat odhadem | K posouzení |
| METEO-023 Dlouhodobé stárnutí a energetická bilance | Proud, teplota článku, cykly a kalibrace: HW/firmware | V / P3 | Dlouhodobé agregace | METEO-057; samotné V nestačí | Nápad |
| METEO-024 Přesné SOC/kapacita pouze z napětí | Jen V | — / P3 | Žádná implementace | Chybí chemie, zatížení, proud, kalibrace | Zamítnuto |

## 5. Porovnávání meteostanic

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-025 Tři stanice v jednom grafu T/RH/V; přehled rozdílů | Současné exporty, různé senzory/intervaly | V / P1 | v0.10.0 skutečné časové T všech3stanic, lazy exporty/kompaktní cache; RH/V srovnání dále | METEO-004/029/048; návrh níže | Rozpracováno |
| METEO-026 Srovnání denních minim/maxim a počtu měření | Současná data všech stanic | S / P1 | Sdílené denní agregace | METEO-025/038 | Nápad |
| METEO-027 Dostupnost, typický interval a nejdelší výpadek | Timestampy + očekávaný měřicí plán | S / P1 | O(n), malý výsledný souhrn | METEO-045; interval fetch není interval senzoru | K posouzení |
| METEO-028 Teplotní rozdíl lokalit po párování, kalibrační bias | T, umístění/kalibrace stanic | S / P2 | v0.10.0 popisné ΔT z časových párů s počty/odchylkami; kalibrační bias bez metadata071 se neodhaduje | METEO-025/029; lokalita není senzorová chyba | Rozpracováno |

## 6. Analýza závislostí mezi veličinami

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-029 Časové párování a tolerance: uvést spárované/odmítnuté vzorky | Timestampy dvou řad | S / P1 | v0.10.0 monotónní one-to-one nejbližší čas do10min: O(n log m), přesně sladěná rychlá větev O(n); konfigurovatelná tolerance dále | METEO-048, policy níže | Rozpracováno |
| METEO-030 Záložka Analýza a závislosti: výběr X/Y, společný graf, scatter, r | Současné páry T/RH/P/V + odvozené veličiny | S / P1 | v0.10.0 devět grafů, sdílené období/zoom, lazy model; v0.11.0 samostatná stránka s horní navigací/Zpět/Vpřed; v0.13.0 sjednocené vysvětlení pod ⓘ u názvu grafu; obecný výběr libovolné X/Y dále | METEO-019/029/031 | Rozpracováno |
| METEO-031 Pearson/regrese a počet validních párů z úplných dat | Současná párovaná data | S / P1 | v0.4.0 Welford r/sklon z úplných T/V, n/časy/dny; intervaly po dnech/nejistota dále | Korelace ≠ příčina, bez p-value a SOC, při n<3/konstantě nedostupné | Rozpracováno |
| METEO-032 Časový posun, klouzavé průměry, oddělení den/noc a sezón | Současná historie | V / P2 | v0.10.0 volitelný průměr5měření T/P a odhad den/noc v XY; lagy a sezónní rozklad dále | METEO-029/048; nepravidelné intervaly | Rozpracováno |

## 7. Grafy a vizualizace

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-033 Min/max redukce pro průzkumník, plné statistiky a zoom | Současná historie | S / P0 | Max 800 pozorovaných bodů; bez animace; zachová extrémy každé veličiny | AUD-013 / Opus P07 | Dokončeno |
| METEO-034 Kalendářní a hodinová heatmapa T/RH/srážek/pokrytí | Současné denní/hodinové agregace | S / P2 | v0.10.0 vlastní canvas T/RH,14dnů×24hodin na stránku, plné průměry a detail; srážky/pokrytí dále | METEO-038/048, srážky METEO-017 | Rozpracováno |
| METEO-035 Histogram a teplotní profil hodiny/dne/měsíce | Současná historie | S / P2 | O(n) agregace, desítky sloupců | METEO-038; volba časového vážení | Nápad |
| METEO-036 Skutečná časová osa, mezery a tooltip původního vzorku | Současné timestampy | S / P1 | v0.10.0 nová analytika na lineární epochové ose, původní tooltipy/UTC offsety a null mezery; starší category grafy dále | METEO-033/048; nyní category osa | Rozpracováno |
| METEO-037 Fullscreen a PNG export grafu | Aktuální vykreslený graf | N / P2 | v0.10.0 celá šířka/Escape a PNG s metadaty pro analytické karty; ostatní grafy/nativní fullscreen dále | METEO-010; popisek rozsahu/stanice | Rozpracováno |

## 8. Historická data a statistiky

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-038 Sdílené hodinové/denní/měsíční agregace s pokrytím | Úplná validní historie | S / P1 | v0.3.1 sdílení i s ročními statistikami hotové; pozorované časy/počty hotové v0.3.0, dostupnost čeká na plán senzoru | Invalidace dat/dne, LRU8 dnů, lazy roky aktuálního snapshotu, METEO-048; vzorkové průměry | Rozpracováno |
| METEO-039 Bezpečné min/max velkých polí bez spread argumentů | Současná historie | N / P0 | O(n), bez pádu na limitu zásobníku | FUT-004 / Opus W07 | Dokončeno |
| METEO-040 Historie se stránkováním a vyhledáním rekordů | Současná historie / poznámky | S / P1 | Omezený DOM místo 100k řádků „Vše“ | AUD-011 hotové, zachovat export všech dat | Připraveno k realizaci |
| METEO-041 Porovnání období např. říjen 2025/2026, absolutně i anomálie | Víceletá historie | S / P2 | Agregované řady | METEO-038/048; neúplné období označit | Nápad |

## 9. Predikce, detekce anomálií a upozornění

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-042 Skoky a zamrzlý senzor: označení podezření bez přepsání originálu | T/RH/P/V + Δt, šum/rozlišení senzoru | S / P2 | Klouzavé okno O(n), bez ML | METEO-047/048; dlouhá konstantní hodnota nemusí být závada | Nápad |
| METEO-043 Denní/měsíční souhrn extrémů a zajímavých událostí | Agregace / flagy kvality | S / P2 | Šablony z hotových statistik | METEO-038/042; žádný generativní model nutný | Nápad |
| METEO-044 Alerty s hysterézí, cooldownem a stavem kvality | Potvrzené prahy T/P/V, četnost měření | S / P2 | Inkrementální, bez opakovaných notifikací | METEO-009/047; web push vyžaduje backend | K posouzení |
| METEO-045 Výpadky měření vs. výpadek zdroje a pravděpodobné poruchy | Timestampy + úspěchy/chyby synchronizace | S / P1 | O(n) na vyžádání | METEO-009/027, známý měřicí plán | Připraveno k realizaci |
| METEO-046 Prediktivní model až po backtestu oproti jednoduchému baseline | Dostatečně dlouhá/kvalitní historie, případně backend | V / P3 | Nákladné učení mimo běžný render | METEO-047, train/test podle času; r není důkaz predikce | K posouzení |

## 10. Kvalita, dostupnost a validace dat

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-047 Flagy kvality a deduplikace: původní/opravované/odvozené údaje odděleně | Timestamp, ID pokud dostupné, validace | V / P1 | O(n), omezené indexy | FUT-009, definice duplicit před slučováním | Připraveno k realizaci |
| METEO-048 Časový kontrakt: lokální den, UTC, DST, explicitní zóna stanice | Současné A/B + konfigurace; nové UTC vyžaduje backend | S / P1 | Nízký, cache formatteru | AUD-010 DONE v0.2.1; další zóna stanice/CSV offset a UV hourly kontrakt | Rozpracováno |
| METEO-049 Verzovaný adaptér legacy/Raw_Data, kontrola schema a jednotek | Skutečné anonymizované exporty obou backendů | V / P1 | O(n), validace před commitem | FUT-008; nikdy pouhá změna názvu listu | K posouzení |
| METEO-050 Provozní panel: počty odmítnutých řádků, chybějící senzory a poslední validace | Výsledky parseru/transportu | S / P1 | Čítače během parseru | METEO-009/047 | Připraveno k realizaci |

## 11. Export a sdílení

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-051 CSV/JSON export filtrovaných originálů a analytických výsledků | Úplný rozsah, jednotky, zóna a quality flags | S / P1 | O(n) pouze na klik; velký export po blocích | METEO-047/048; CSV quoting/formula injection policy | Připraveno k realizaci |
| METEO-052 Odkaz na stanici/rozsah/graf, oblíbené analýzy | Parametry UI | N / P2 | Malý localStorage/URL, žádné kopie historie | METEO-054; nesdílet soukromé konfigurace | Nápad |
| METEO-053 Offline historie a instalovatelná PWA | Poslední validní data, verze assetů | V / P2 | IndexedDB/SW, větší disk a údržba | METEO-004/008/009; cache stáří viditelné | K posouzení |

## 12. Architektura, bezpečnost a údržba

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-054 Validace konfigurace a odolný storage wrapper; lokální zámek jasně popsat | Config/localStorage | S / P1 | v0.11.2 schema/rozsahy/allowlist, atomické odmítnutí importu, odolné storage a vysvětlený lokální zámek | IMP-004/005; náhled diffu, schema verze a migrace dále; viz SECURITY_ROADMAP | Rozpracováno |
| METEO-055 Závislosti a testovatelné moduly: CDN integrita, malé čisté funkce, Pages allowlist | Zdrojový kód | S / P2 | v0.11.4 SRI obou CDN a pevné SHA Actions; Pages allowlist již ověřen | IMP-007/008; moduly, pravidelné CDN advisories a file: ověření dále | Rozpracováno |
| METEO-056 Reprodukovatelné výkonnostní scénáře a regresní brány | Syntetické 1k/10k/100k, reálné anonymní CSV později | S / P0 | Vývojový nástroj, žádná produkční režie | FUT-003; metodika níže | Rozpracováno |
| METEO-060 Verze webu a release notes: rozeznat načtený obsah a změny vydání | Verze v HTML, RELEASE_NOTES.md | N / P1 | Bez fetchů a závislostí, statický odkaz | Pravidla vydávání v AGENTS.md | Dokončeno |

## 13. Nové senzory a budoucí rozšíření

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-057 Proud, panel V/I a teplota článku pro skutečnou energetickou bilanci | Nový HW + firmware + backend | V / P3 | Více sloupců; sdílené agregace | METEO-049; kalibrace a jednotky | Nápad |
| METEO-058 ESP32 diagnostika: deep sleep, probuzení/restarty, failed sends, RSSI | Firmware + backend | V / P2 | Malé čítače, méně dohadů o výpadcích | METEO-049/045 | Nápad |
| METEO-059 Vítr, směr, záření a skutečné UV/srážková kalibrace | Nové senzory + firmware + backend | V / P3 | Další lazy metriky | METEO-049; odlišit měření od Open-Meteo předpovědi | Nápad |

## Přijímací podmínky další etapy

### Cache a načítání (METEO-004/005/006)

Začít RAM cache, nikoli automaticky IndexedDB. Klíč musí obsahovat index stanice,
source, sheetId, sheetName a verzi parseru; URL ani MQTT topic nejsou zaměnitelné.
Omezit počet položek i celkový počet řádků/bajtů, evidovat validaci a stáří,
plnou/částečnou historii. Změna configu a zdroje musí invalidovat, nesmí se obnovit
starý stav při A→B→A. Ruční refresh vynutí validaci. TTL a limit zvolit po měření
RAM; návrh počítá s nejvýše třemi stanicemi, nikoli neomezenými snapshots.

Cache se může zobrazit okamžitě s časem poslední synchronizace. Síťové selhání
nesmí převést cache na „aktuální data“. Testovat opravu starého řádku, smazání,
paralelní quick/full, odlišný Sheet ID na stejném indexu a MQTT overlay.
Na pozadí se mají zastavit periodické dotazy; návrat má vyvolat nejvýše jeden
potřebný refresh, ne nového MQTT klienta. Stávající full-text cache šetří parse/render,
nikoli přenesené bajty. Inkrementální endpoint musí uvést revizi a změny/smazání,
nikoli jen poslední timestamp.

### Analýza a závislosti / baterie (METEO-019/029/030/031)

První verze: stanice + rozsah + T/V; jeden časový graf se samostatnými osami °C/V,
XY graf, počet platných párů, Pearson r, volitelná lineární regrese a text
„Souvislost hodnot sama neprokazuje vliv teploty na baterii.“

- V jedné stanici párovat T/V ze stejného původního řádku. Nepárovat nejbližší
  náhradní hodnotu za chybějící senzor. Min/max/průměr/r i regrese z plných párů.
- Regresi nezobrazovat při nedostatku vzorků nebo nulovém rozptylu. Zveřejnit
  velikost vzorku/rozsah; autokorelovaná měření neprezentovat jako nezávislé důkazy.
- Scatter redukovat pro zobrazení při zachování dvourozměrného pokrytí; časový
  min/max sampling není automaticky vhodný pro XY. Vyhodnotit mřížkové biny.
- Den/noc podle lokálního času/polohy, zima/léto s explicitní definicí měsíců.
  Vzduchová teplota není teplota baterie. Nabíjení, zátěž, umístění a stav článku
  jsou další možné příčiny změny napětí.
- Noční ΔV / délka intervalu je mV/h, ne mAh. Cyklus podle růstu V označit
  „pravděpodobné nabíjení“; stárnutí/SOC vyžaduje METEO-057.
- Stávající přímková predikce napětí je jednoduchá extrapolace. Backtest,
  horizont a nejistota patří do METEO-046; není to AI ani údaj o zbývající kapacitě.

### Porovnání tří stanic (METEO-025–028)

Společný časový rozsah, přepínač T/RH/V, samostatná barva a seznam chybějících
senzorů. Historie ostatních stanic načíst až při otevření porovnání; zachovat
identitu zdroje i po změně aktivní stanice. Nikdy nevolat `switchStation` pro
skryté získání dat do porovnání.

Pro rozdíly/correlation párovat nejbližší timestamp v explicitní toleranci,
jedno měření použít nejvýše jednou; deterministicky řešit shodu a vykázat počet
odmítnutých párů i rozdělení časových odchylek. Bez interpolace přes velké výpadky.
Nastavení obnovy webu (`interval`) není měřicí plán ESP32. Procentuální dostupnost
počítat až při známém plánu; jinak ukázat pouze pozorované intervaly/mezery.

### Metriky a vizualizace

Rosný bod již existuje. První nové veličiny: absolutní vlhkost v g/m³ a VPD v kPa
z T/RH; vzorec, obor platnosti a jednotky přidat do testů s referenčními hodnotami.
Pro srážky předem potvrdit reset kumulátoru; nelze sčítat denní kumulované hodnoty
po řádcích. Wind chill bez rychlosti větru neimplementovat.

U velkých grafů zůstává Chart.js: benchmark zatím nedokládá nutnost migrace.
Min/max je nyní O(n), zachová extrémy každé zobrazené veličiny a endpointy.
Na bucket uchovává i jeden null marker; není bezeztrátovou reprezentací všech
mezer. Detail vrátí více originálních bodů při zúžení slideru.
LTTB porovnat až při požadavku na věrnější tvar; LTTB samo nezaručuje všechna
extréma několika veličin současně. Statistiku nikdy nepočítat z redukovaného grafu.

## Etapa 1 — ověřené výsledky

Implementace: [index.html](../index.html), [testy výkonu](../tests/performance.test.js).
METEO-001/002/003/033/039 jsou hotové. Cache rozsahu se invaliduje při přijetí
CSV, MQTT a resetu stanice; jde o jedno pole referencí bez persistence.
CSV quick cache uchovává jednu aktuální odpověď; shoda šetří parser/render.
Výpočty regresní přímky napětí v exploreru používají všechny validní body,
nikoli vizuální vzorek. Slider řeže kompletní data a až potom redukuje graf.

Ověření: 54 Node testů; nové testy před opravou reprodukovaly limit 800 statistik
a RangeError ve `refreshUI` při 250k řádcích. Browser/Chart.js ověřil 1k/10k/100k
a šířku 390 px bez JS chyb a horizontálního přetečení v měřených pohledech.
Reálné Sheets a MQTT nejsou tímto fixture testem ověřeny.

Kód odeslán na `codex-dev` v `0c80c9d`. [Actions #8](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39482044092)
sestavily Pages artefakt, ale deploy odmítlo pravidlo prostředí `github-pages`
pro větev `codex-dev`. Živá verze těchto změn zatím není potvrzena;
[postup povolení vývoje](PAGES.md). `main` zůstává beze změny.

Mediány pěti opakování, Chromium 154.0.8037.57, viewport 1280×900, zóna Prague,
syntetické měření každých 5 minut. Časy zahrnují synchronní JS + skutečný Chart.js
update, bez čekání na dokončení animace. Oba běhy na stejném stroji.

| Řádků | Obnova přehledu před → po | Průzkumník „Vše“ před → po | Slider 20–80 % před → po |
| --- | --- | --- | --- |
| 1 000 | 56,9 → 20,8 ms | 28,7 → 5,7 ms | 13,8 → 5,3 ms |
| 10 000 | 67,7 → 23,1 ms | 33,6 → 7,5 ms | 17,3 → 4,9 ms |
| 100 000 | 148,6 → 53,8 ms | 43,2 → 14,8 ms | 18,2 → 10,8 ms |

Přehled aktualizuje 1 místo 6 grafů. U 100k dat se kreslí 534 namísto 800
bodů (limit 800; počet závisí na extrémech), statistiky ale nyní zahrnují **100k**.
Vložené maximum 85 °C dříve zmizelo u 10k/100k a nyní zůstává. Je to testovací
fixture výhradně v benchmarku/testech, ne produkční data.

Reprodukce: [scripts/benchmark-browser.py](../scripts/benchmark-browser.py),
volitelný Python Playwright a Chromium; lokální kopie Chart.js **4.4.0**.
Původní HTML: `git show c0bfddf:index.html > /tmp/meteo-before.html`.
Příkazy a surová měření: [performance/README.md](performance/README.md).

**Nezměřeno:** reálné LCP/INP/CLS, latence Sheets, skutečné rychlosti přepnutí
stanic, RAM před/po a síťové bajty. Fixture benchmark obchází startup i síť;
tyto metriky z něj nelze odvozovat. 54 ms při 100k stále může blokovat UI;
další kandidát jsou sdílené agregace a opakované skeny historie.
Worker/IndexedDB/migrace knihovny zatím nejsou odůvodněny tímto měřením.

## Doporučené následující etapy

1. P0: METEO-004/005 (bounded cache a background refresh); změřit request count,
   bajty, RAM a A→B→A před/po, doplnit síťově nezávislé testy invalidace.
2. P1: METEO-048 časový kontrakt a METEO-038 sdílené agregace; nejprve půlnoc/DST.
3. P1: METEO-013 a METEO-019/031 první meteorologické metriky a baterie.
4. P1: METEO-025/029 porovnání stanic, kvalita a transparentní párování.
5. P2: heatmapy, diagnostika anomálií; P3 predikce až po backtestech.

Žádná z těchto budoucích funkcí není vydávána za implementovanou.

## Etapa 2 — analýza nad rámec původních 60 návrhů (21. 10. 2026)

Výchozí kód `1473437` / v0.1.0, čistá větev codex-dev. Znovu porovnány oba
audity, konfigurace, skutečné načítání/CSV/MQTT, renderery a výpočty, 54 testů,
Pages workflow a dosavadní benchmark. Níže je **15 samostatných nových návrhů**
METEO-061–075. Samotná korelace, posun řad, sezónnost, heatmapy, alerty, export
CSV ani offline cache nové ID nedostávají. Jejich rozpracování je uvedeno zvlášť.

### Nové návrhy: interakce a důvěryhodnost výsledků

#### METEO-061 — Porovnání krajních měření vybraného úseku

**Přínos / priorita / obtížnost:** konkrétní rozdíl T/RH/P/V a uplynulý čas
mezi dvěma měřeními; P1, nízká. **Stav:** Dokončeno ve v0.2.0 (slider).
**Vstupy / proveditelnost:** současné timestampy a naměřené hodnoty, bez nového
HW/firmwaru/backendu. Rozšiřuje ovládání METEO-033, není další průměr METEO-014.
**Řešení / výkon:** použít první a poslední originální řádek intervalu z obou
úchytů slideru; ukázat oba časy/vstupy, Δ a Δt. O(1) navíc při každém posunu,
žádný fetch; příště lze doplnit přesné A/B kliknutí a klávesnici.
**Omezení:** chybějící krajní hodnota zůstane nedostupná, neposouvat tajně endpoint
k nejbližšímu validnímu vzorku. RH rozdíl v procentních bodech. Žádné SOC, energie,
srážkový úhrn ani důkaz monotónního průběhu mezi body. Duplikované časy nedovolí
počítat rychlost; první verze ukáže jen rozdíl a dobu. Závisí na METEO-033/047;
časový údaj platí v současném modelu Date, zóna stanice METEO-048 zůstává otevřená.
**Test:** nulové/null hodnoty, jedna položka, shodné timestampy, převrácený slider,
250k originálů proti 800 vizuálním bodům, změna metriky/stanice a prázdný rozsah.

#### METEO-062 — Společný časový kurzor více grafů

**Přínos / priorita / obtížnost:** číst T/P/V téhož okamžiku bez hledání na každém
grafu; P2, střední. **Stav:** Nápad. Současná data postačí, bez nového zdroje.
Samostatná interakce nad METEO-036/025; neznamená synchronizaci měření METEO-029.
**Řešení / výkon:** sdílet timestamp, ne pixel ani index downsamplingu; najít
nejbližší originál binárně, zobrazit jeho časovou odchylku. Jeden requestAnimationFrame
pro viditelné grafy, jeden draw na snímek; ukazatel na dotyku uzamknout tapnutím.
**Rizika:** různá měřicí četnost, mezery, tooltip k redukovanému bodu může lhát.
Nedostupné protějšky zobrazit jako chybějící. **Test:** dvě různě velké osy,
nerovnoměrné timestampy, resize/scroll/touch, jeden aktivní RAF, žádný nový fetch.

#### METEO-063 — Rodokmen výpočtu až k původním řádkům

**Přínos / priorita / obtížnost:** po kliknutí na maximum nebo odvozenou hodnotu
vidět vzorec/verzi, vstupní řádky a důvody vyloučení; P1, střední. **Stav:**
Rozpracováno — podklady vlivných T/V dnů dokončeny v0.7.0, hodinových průměrů T/RH/P v0.8.0 a globálních teplotních extrémů v0.9.0; roční/denní extrémy a další odvozené výpočty dále.
Dnešní řádky stačí pro přehled původu, trvalé odkazy na
opravené řádky potřebují ID/revizi backendu. Vztah METEO-047/050: ty evidují
kvalitu a počty; toto je dohledatelná cesta konkrétního výsledku.
**Řešení / výkon:** výsledek nese descriptor výpočtu a indexy/timestampy zdrojů,
detaily se sestaví až po otevření. Bez kopií celé historie a bez HTML z poznámek.
**Omezení:** timestamp nemusí být unikátní; index je platný jen pro danou revizi.
Rozlišit měření/výpočet/odhad. **Test:** shodná maxima, duplicity času, změněný
starý záznam, null vstup rosného bodu, XSS fixture, neplatná reference po refreshi.

**Ověřená etapa10 (T/V077):** rozbalovací výpis původních záznamů dne
s největší změnou r/sklonu nebo nedostupným zbytkem. Průnik dne a původního
rozsahu7/30/all, včetně vynechaných nečíselných T/V s důvodem. Zóna/UTC offset,
nezkrácená číselná hodnota, pořadí v právě načtené historii, počty párů,
vzorce r/sklonu a verze aplikace. Duplicity času jsou samostatné řádky,
pořadí není trvalé ID zdroje. Bez kopie dne/historie, binární meze O(log n)
a nejvýše50 řádků O(p) na stránku nad připravenou T/V analýzou. UI pouze na vyžádání; reference na aktuální
snapshot/analýzu/rozsah/stanici, při mutaci CSV/MQTT/resetu se výpis vyčistí
a zavře. Nahrazení pole i změna délky má dodatečnou kontrolu před stránkováním.
Žádný fetch nebo nový graf. Regrese 12nových/165celkem a skutečný browser.
**Zbývá:** obdobné podklady maxim, hodinových průměrů a dalších odvozených
veličin; žádné globální DONE063 ani domnělé backendové ID/epochy071.

#### METEO-064 — Diagnostická časová osa relace a anonymizovaný report

**Přínos / priorita / obtížnost:** reprodukovat postup k chybě a rozlišit fetch,
parser a render; P1, střední. **Stav:** Připraveno k realizaci. Vstupy jsou události
webu, dostupné dnes; žádné HW/backend změny. METEO-050 je aktuální stav dat,
zde jde o časové pořadí operací a export kontextu chyby.
**Řešení / výkon:** kruhový buffer max 200 strukturovaných událostí, délka/doba,
generace relace, kód chyby a verze. Export JSON pouze na kliknutí, allowlist polí;
nevkládat URL/Sheet ID/poznámky/polohu/tokeny ani raw exception s URL. O(1) zápis,
omezená RAM, bez automatického odesílání. Závislosti METEO-009/050/060.
**Rizika/test:** i timestampy mohou identifikovat používání; uživatel musí vidět
exportovaný obsah. Test 10k událostí, pořadí A→B→A, chyby fází a redakce citlivých
hodnot v uměle škodlivé chybě; report musí být verzovaný a znovu čitelný.

#### METEO-065 — Co se změnilo od poslední návštěvy

**Přínos / priorita / obtížnost:** nové rekordy, doplněná historie a opravy starých
výsledků bez ručního porovnání; P2, střední. **Stav:** Nápad. Současné agregace
stačí pro změnu souhrnů, úplný seznam změn/smazání vyžaduje revize backendu.
METEO-004 řeší rychlost cache, toto uživatelský rozdíl dvou verzí výsledku.
**Řešení / výkon:** malý snapshot statistik dle zdroje/verze algoritmu v lokálním
úložišti; zobrazit staré→nové a dobu srovnání. Žádná druhá kopie historie.
Závisí na METEO-038/054/060. **Rizika:** nový rekord nesmí být zaměněn s novým
výpočtem po upgradu; partial/full nemíchat. **Test:** oprava starého extrému,
backfill, smazání, nový algoritmus, jiná stanice a odvolání lokální persistence.

### Nové návrhy: využití dlouhodobých měření

#### METEO-066 — Vyhledávání podobných dnů

**Přínos / priorita / obtížnost:** najít historické dny se srovnatelným ranním
vývojem a prohlédnout, jak pokračovaly; P2, vysoká. **Stav:** K posouzení.
Současná T/RH/P a časy postačí po ověření pokrytí; bez HW/backendu. METEO-041
porovnává uživatelem zvolené období, zde je vyhledání podle tvaru.
**Řešení / výkon:** na vyžádání hodinové vektory, robustní standardizace zvlášť
T/RH/P, vážená vzdálenost jen společných pozorovaných hodin; top 5 dnů a skóre
pokrytí. Cache denních vektorů METEO-038, O(počet dní × 24 × veličiny), bez
kvadratického DTW. METEO-048/071 jsou nutné pro lokální den a homogenní úsek.
**Rizika:** shoda rána není předpověď odpoledne; filtr kandidátů pouze podle
informace dostupné k referenční hodině, pozdější vývoj ukázat jako historii.
**Test:** vložené podobné dny, chybějící hodiny, změna umístění, absence vhodné
shody; časově oddělený backtest proti náhodnému výběru bez úniku budoucích dat.

#### METEO-067 — Teplotní sumy a expozice nad zvoleným prahem

**Přínos / priorita / obtížnost:** kvantifikovat intenzitu i trvání tepla/chladu,
např. stupňohodiny nad 25 °C; P2, střední. **Stav:** Nápad. Současná T/čas,
bez nového zdroje. METEO-015 počítá dobu/dny; toto integrál max(T−práh,0)·dt.
**Řešení / výkon:** po částech lineární integrace s přesným průsečíkem prahu,
gap limit, platný/nezahrnutý čas vedle výsledku. O(n), sdílený denní cache
METEO-038/048. Uživatelský práh, jednotka °C·h; GDD až s explicitní metodikou.
**Omezení:** teplota u okna není teplota plodiny; žádný termín sklizně bez modelu.
**Test:** konstantní, lineární a práh křížící řada s analytickým integrálem,
nerovnoměrné intervaly, 23/25h den, velká mezera bez domyšlené expozice.

#### METEO-068 — Teplota mokrého teploměru a potenciál odpařovacího chlazení

**Přínos / priorita / obtížnost:** ukázat fyzikální mez odpařovacího chlazení,
odlišnou od rosného bodu a RH; P2, střední. **Stav:** K posouzení.
T/RH/absolutní tlak mohou být dostupné dnes; ověřit typ tlaku a podmínky senzoru,
nový HW nutný jen pokud tlak chybí. METEO-013 řeší obsah páry/VPD, ne Tw.
**Řešení / výkon:** validovaný psychrometrický solver s omezeným počtem iterací
a oborem nad nezamrzající vodou; ukázat „vypočteno“, vzorec a vstupy METEO-063.
Výpočet nejprve pro aktuální vzorek O(1), historii až po benchmarku.
**Rizika:** tlak redukovaný na hladinu moře není místní tlak, numerická konvergence,
ledová fáze, nejde o zdravotní doporučení. **Test:** nezávislé referenční tabulky,
RH=100 → Tw=T, Td≤Tw≤T ve vymezeném oboru, null/nekonvergence bez náhradní nuly.

#### METEO-069 — Potenciál větrání podle měrné vlhkosti dvou lokalit

**Přínos / priorita / obtížnost:** zjistit, zda by výměna vzduchu teoreticky
snížila obsah vodní páry; P2, střední. **Stav:** K posouzení. T/RH/P současných
dvou stanic mohou stačit, ale uživatel musí určit vnitřní/venkovní stanici a
ověřit umístění. Není doloženo, že dnešní tři profily tento pár tvoří; případně
nový vnitřní senzor. Závisí na METEO-025/029/013/071.
**Řešení / výkon:** porovnat měrnou vlhkost kg páry/kg vlhkého vzduchu a vypočtenou RH
venkovního vzduchu po ohřátí na vnitřní teplotu za daného tlaku; párovat jen
časově blízké záznamy. O(n+m) lazy, žádné dotazy při běžném přehledu.
**Rizika:** nejde o odhad průtoku, odstraněných litrů ani kvality vzduchu/CO₂;
bez validního páru nevydávat doporučení. **Test:** chladný vlhký a teplý suchý
vzduch, identické stavy, chybějící tlak, stará vnější data a explicitní jednotky.

#### METEO-070 — Přechody mezi režimy mikroklimatu

**Přínos / priorita / obtížnost:** jak dlouho setrvává lokalita ve zvoleném stavu
a do kterého přechází, místo samotných histogramů; P2, střední. **Stav:** Nápad.
Současná T/RH/P, uživatelské hranice; bez HW/backendu. METEO-035 popisuje četnosti,
METEO-042 anomálie; zde matice přechodů a doby setrvání.
**Řešení / výkon:** deterministická klasifikace s hysterezí a minimálním trváním,
chybějící úsek jako samostatně neznámý; počítat epizody i pozorovanou dobu O(n).
METEO-047/048 a jednotný krok pouze s explicitním resamplingem.
**Rizika:** prahy nejsou univerzální meteorologické klasifikace, delší sampling
schová krátký přechod. **Test:** známá sekvence stavů, šum kolem prahu, gap
rozdělující epizody a report nepozorovaného času; bez tvrzení o predikci.

#### METEO-071 — Epochy stanice: umístění, čidlo a kalibrace v čase

**Přínos / priorita / obtížnost:** neplést přemístění čidla s klimatickou změnou;
P1, střední. **Stav:** Připraveno k realizaci. Uživatel doplní časové intervaly
umístění/kalibrace, historie dnes postačí; pro sdílení metadata soubor v repu,
nový firmware není podmínka. METEO-047 řeší řádek, toto platnost konfigurace v čase.
**Řešení / výkon:** intervalový index O(log e), vizuální přerušení grafu a filtr
epoch; originály nezměnit. Volitelná korigovaná řada vždy odděleně s verzí korekce.
Závislosti METEO-054/048/063. **Rizika:** neznámá historie umístění znamená
„neověřeno“, nikoli homogenitu; samotný detektor skoku není kalibrační důkaz.
**Test:** mezní okamžik, překryv epoch odmítnout, změna senzoru, chybějící metadata,
export surových i korigovaných hodnot s jednoznačným označením.

#### METEO-072 — Rozlišení a kvantování senzoru / ADC

**Přínos / priorita / obtížnost:** zjistit, zda drobné údajné trendy tvoří pouze
kroky rozlišení nebo zaokrouhlení exportu; P2, střední. **Stav:** Nápad.
Současná V/T/RH a pokud možno specifikace rozlišení; bez HW, pro oddělení ADC
od zaokrouhlení může být potřeba firmware s raw ADC. Vztah METEO-042: konstanta
není automaticky zamrzlý senzor; tento nástroj diagnostikuje diskrétní rozlišení.
**Řešení / výkon:** histogram sousedních nenulových rozdílů v krátkém homogenním
okně, robustní kandidáti kroku, uvést n a nejistotu; omezený počet binů O(n).
METEO-071/047. **Rizika:** přirozené stabilní prostředí, desetinný export a noise
vytvářejí falešné kroky; nevyvozovat počet bitů ADC bez raw hodnot.
**Test:** známé kroky 0,01/0,05 V, šum, konstantní průběh, změna zaokrouhlení;
při nedostatku informace vydat „nelze určit“.

### Nové návrhy: reprodukovatelnost a srovnání s okolím

#### METEO-073 — Přehrávání historické situace

**Přínos / priorita / obtížnost:** posunout „teď“ do minulosti a krokovat karty
a grafy při konkrétní události; P2, vysoká. **Stav:** Nápad. Současná historie,
bez HW/backendu. METEO-053 offline řeší dostupnost, toto deterministický časový
kontext celé aplikace. METEO-064 zaznamenává používání, ne počasí.
**Řešení / výkon:** explicitní referenční clock ve výpočtech, binary slice,
play/pause s omezením FPS. Oddělený režim s výrazným časem; zastavit živé přepisování,
UV předpověď ani dnešní astro údaje nevydávat za historické. Cache METEO-002/038,
čas METEO-048. **Rizika/test:** únik budoucích vzorků do predikce/rekordů, MQTT
overlay a návrat do live; fixture s extrémem v budoucnu se nesmí zobrazit předčasně.

#### METEO-074 — Rozpočet nejistoty odvozených veličin

**Přínos / priorita / obtížnost:** poznat, zda rozdíl 0,1 °C nebo vypočteného VPD
převyšuje nejistotu senzorů; P1, střední. **Stav:** K posouzení.
Současné T/RH/P + specifikace čidel/kalibrace od uživatele; bez nového HW,
bez specifikací jen výpočet citlivosti, ne interval spolehlivosti.
**Řešení / výkon:** propagace tolerancí nebo malý deterministický výpočet na
hranách oboru, nikoli náhodný Monte Carlo na každém refreshi; uvést předpoklady
závislosti chyb. METEO-013/063/071. Je to metrologická nejistota jednotlivého
měření, odlišná od statistické nejistoty korelace METEO-031.
**Rizika:** sdílený bias nelze odstranit velkým n, tolerance není automaticky
směrodatná odchylka. **Test:** monotónní vztahy, referenční perturbace T/RH,
nulové/nespecifikované tolerance, korelované chyby a změna kalibrace.

#### METEO-075 — Regionální referenční řada jako kontext lokality

**Přínos / priorita / obtížnost:** odlišit místní odchylku od plošného počasí;
P2, vysoká. **Stav:** K posouzení. Nový externí zdroj pozorování/reanalýzy,
nikoli dnešní UV forecast. Vyžaduje výběr licence, API/kvóty a metadata výšky,
zpravidla cache/backend; žádné automatické nové požadavky v této etapě.
**Řešení / výkon:** explicitně zvolený hodinový zdroj, cache, převod jednotek,
samostatná vrstva „referenční pozorování“ / „model“, párování METEO-029/048.
METEO-025 porovnává vlastní tři stanice; zde jde o nový datový kontrakt/zdroj.
**Rizika:** vzdálenost, výška, zástavba a modelový grid; rozdíl není důkaz chyby
senzoru. **Test:** timezone/units fixture, nedostupná licence/API, nepravidelná
časová řada, odlišná výška a chybějící data bez vyplnění falešnými nulkami.

### Rozpracování existujících ID — žádné duplicitní návrhy

| Existující ID | Nové konkrétní řešení / přijímací kritérium |
| --- | --- |
| METEO-001 | Při refreshUI/updateOvBar přepsat textContent jen při změně výsledného textu. Zachovat platnou nulu, šipku trendu i bezpečné zobrazení názvu. Hotovo ve v0.2.0; po zahřátí 46 → 0 childList/characterData mutací ve scénáři nezměněných dat, atributy se tím neměří. |
| METEO-002 / Opus W14 | Binární vyhledání čtyř protějšků „Dříve touto dobou“ v sestupné historii; zachovat ostrou toleranci <30 min, novější při shodné vzdálenosti a první duplicitní řádek. Neměnit HTML pokud výsledek zůstal stejný; otestovat proti lineární referenci. |
| METEO-019 | Porovnávat napětí při obdobné T v ranních/večerních oknech, po epochách METEO-071 a délce dne; uvést počet dnů, rozsah T a pravidlo párování, žádná univerzální korekce V podle T. Umělá data s vlivem nabíjení musí odhalit, že prosté r je zavádějící. |
| METEO-020/021 | Normalizovat čas vzhledem k východu/západu a výšce Slunce (existující calcSolarElevation); hledat opakovaný kladný sklon s hysterezí a souvislým pokrytím. Solární napájení/umístění panelu potvrdit. Skrytý panel, oblačnost a zátěž neumožňují převést růst V na výkon panelu. Test stejné teploty v různém solárním čase, chybějící noci a krátkého dne. |
| METEO-022/023 | Porovnat noční ΔV s vlastními dny podobné teploty/délky noci, medián + MAD a nejméně stanovený počet referenčních dnů; ukázat důvod odchylky a datum baseline. Nulový MAD i změna baterie musí vrátit nejistotu/reset baseline. Výsledek „neobvyklé chování“, ne diagnóza kapacity. |
| METEO-031 | Efektivní množství informace: n párů, n různých dnů, pokrytí a interval r z blokového bootstrapu po dnech; bez předpokladu nezávislosti všech vzorků. Výpočet jen na vyžádání s pevným seedem/limitem. Test autokorelovaných řad a Simpsonova paradoxu; žádné p-value z tisíců zdánlivě nezávislých bodů. |
| METEO-032/043 | Zarovnat okna k počátku ověřené srážkové epizody; souhrn tlakových změn před/po s mediánem a kvantily po událostech. Nedešifrovat začátek z kumulátoru bez METEO-017. Oddělit události minimální pauzou, test vícečetných prohlížených lagů a kontrolní okna bez deště. |
| METEO-036/043 | Události jako značky na skutečné časové ose, po kliknutí na původní interval METEO-063. Shlukování při oddálení, maximálně omezený počet značek; žádné canvas objekty pro každý z 250k vzorků. |
| METEO-010/011 | Respektovat prefers-reduced-motion pro Chart animace, CSS i smooth scroll; velké touch cíle slideru, bez animovaného skeletonu. Jeden kompaktní přehled T/RH/P/V s explicitními jednotkami, ne skryté chybějící senzory. Ověřit OS nastavení i 320px. |
| METEO-038 | Cache souhrnů invalidovat na revizi dat i změně lokálního dne; stejné rows reference bez půlnoční invalidace nestačí. Průměr vzorků nezaměnit s časovým průměrem; mezery ovlivňují pokrytí. Porovnat každý výsledek proti plnému výpočtu. |
| METEO-050 | U každého odmítnutí parseru kód důvodu a pořadí logického CSV řádku; ne fyzického řádku kvůli víceřádkovým poznámkám. Ukázat omezený bezpečný vzorek, nikdy automaticky celou historii do diagnostiky METEO-064. |
| METEO-051 | Tiskový denní report z již načtených agregací: stanice/epochy, zóna, čas exportu, verze výpočtu, pokrytí a zdroj. Print CSS a stránkování, žádný screenshot skrytého canvas; test černobílého A4/PDF a null hodnot. |
| METEO-054 | Před aplikováním importu zobrazit strukturální diff zdroje/stanice, validovat rozsahy a umožnit zrušení bez přerušení relace. Lokální konfigurace má schema version; migrace storage na kopii a rollback, nikdy tajné klíče v exportu. |
| METEO-056 | Doplněn profil heap po GC, DOM mutací, počtu Chart instancí, 250k a CPU×4. 30 cyklů není vícedenní soak, JSHeapUsedSize není celková RAM. Test parseru přes pomalý transport má oddělit čekání od parse/render. |

### Co jsme nezařadili a proč

Přesné SOC/energie z V zůstává zamítnuté METEO-024. Pseudopřesná lokální předpověď
deště z tlaku bez validace není nová funkce. Výpočet větru z kolísání tlaku,
diagnóza plísně bez teploty povrchu a zdravotní rady z mokrého teploměru nejsou
podložené dostupnými daty. Nová knihovna grafů/worker nejsou automatické cíle.

### Srovnání otevřených projektů

Dne 21. 10. 2026 přečteny veřejné README
[WeeWX](https://github.com/weewx/weewx/blob/master/README.md) a
[Belchertown](https://github.com/poblabs/weewx-belchertown/blob/master/README.md).
WeeWX generuje reporty z archivovaných měření na serveru; přínos zde je princip
oddělení archivních agregací od UI, nikoli přidání Python serveru na Pages.
Belchertown popisuje builder grafů, live MQTT, mobilní layout a historické rekordy.
Volba grafů odpovídá našemu METEO-052, MQTT už máme a regionální reference
METEO-075 musí výslovně odlišit model od měření. Kopírování forecastů nebo jejich
závislostí bez potřeby nepřináší důvod k migraci. Jde o srovnání dokumentovaných
funkcí, ne o benchmark nebo audit kódu těchto projektů.

### Druh výsledku a hranice dostupnosti

Žádná nová položka nevydává odhad za přímé měření. Pro orientaci:

| ID | Výsledek a podmínky |
| --- | --- |
| 061 / 062 | Naměřené krajní/nejbližší hodnoty, vypočtený rozdíl/čas; chybějící protějšek není interpolace. |
| 063 / 064 / 065 | Evidence původu, provozní události a vypočtené rozdíly verzí; nepřidávají meteorologická měření. |
| 066 | Vypočtená podobnost historických průběhů; pokračování dne je původní pozorování, nikoli předpověď. |
| 067 | Vypočtený integrál s uvedeným modelem interpolace; nepozorovanou dobu nezapočítat jako naměřenou. |
| 068 / 069 | Vypočtené psychrometrické veličiny z naměřených vstupů; žádné přímé měření Tw ani odhad skutečného průtoku. |
| 070 | Vypočtená klasifikace podle explicitních pravidel; není standardizovaný klimatický typ. |
| 071 | Metadata zadaná uživatelem; případná korekce je oddělená vypočtená řada. |
| 072 | Odhad kroku rozlišení; bez raw ADC nelze identifikovat jeho původ. |
| 073 | Původní měření a výpočty v historickém čase; žádné domyšlené chybějící vzorky. |
| 074 | Vypočtená citlivost/nejistota podle dodaných tolerancí, nikoli nové měření či automatické statistické CI. |
| 075 | Externí pozorování nebo modelový odhad musí mít odlišný štítek a zdroj. |

### Etapa 2 — implementace a ověřené výsledky

Realizovány právě tři malé změny, bez dalších závislostí, nových síťových volání
nebo změn konfigurací: METEO-061, rozšíření METEO-002 (historické protějšky)
a METEO-001 (nezměněné texty). Nová verze **0.2.0**. Původní měření, plné
statistiky, tolerance historie i výběr při shodné vzdálenosti zůstávají zachované.
METEO-061 používá oba úchyty existujícího slideru; libovolné kliknutí A/B a
synchronizovaný kurzor ještě implementované nejsou. Nový panel uvádí časovou
zónu prohlížeče a offset; neřeší dosud otevřený globální kontrakt METEO-048.

**63/63 Node testů**, devět nových regresí v `tests/interval-history.test.js`.
Kontroly přepisování DOM prokazatelně selhaly na původním HTML. Skutečné Chromium
s Chart.js ověřilo tři konfigurace, zpožděné fixture CSV, sloučení dvojího full
požadavku do jednoho, slider, změnu metriky/stanice,
prázdný rozsah, dvě témata, mobil390 a oba offsety opakované hodiny DST.
Jednotkové testy ověřují chybějící hodnoty; prohlížeč navíc všechny záložky a osm
metrik. Živý quick CSV všech tří zdrojů vrátil HTTP200; schéma/firmware tím
ověřené nejsou, obsah odpovědí nebyl tímto probe validován.

[Podrobná metodika, výsledky a surová měření](performance/ETAPA2.md).
Při 250k historie klesl medián samotného hledání protějšků **17,3 → 0,1 ms**;
nezměněné texty přestaly vytvářet sledované DOM mutace. Celá obnova v první
sérii **118,7 → 110,8 ms** při 250k, ale **63,4 → 75,1 ms** při 100k.
CPU×4 opakování potvrzuje kolísání: obnova **233,0 → 213,4 ms**, zatímco první
CPU×4 série byla pomalejší. Nelze proto slíbit plošné procentuální zrychlení UI.
Při 250k JS heap po GC zůstává přibližně **56 MiB**; počet Chart instancí je
stále osm. Neoptimalizovali jsme paměť ani agregace a neměřili Web Vitals.

### Doporučené pořadí po této etapě

1. **METEO-048 / AUD-010:** sjednotit lokální den a zónu; získat časový kontrakt
   exportu včetně opakované hodiny DST. Předpoklad všech denních analýz.
2. **METEO-038 + 005:** sdílet agregace dle revize a dne, přerušit polling na
   pozadí. Zbylé O(n) průchody a hlavní vlákno jsou měřitelný problém; každou
   cache porovnat s plným výpočtem a invalidovat po opravě starých dat/půlnoci.
3. **METEO-004:** cache mezi stanicemi až s rozpočtem paměti a eviction; tři
   plné 250k historie nelze na mobilu bez rozmyslu držet vedle raw CSV.
4. **METEO-063/071/074:** dohledatelnost výsledku a metadata pro důvěryhodné
   srovnání. Získat historii umístění, typ tlaku a tolerance čidel.
5. **METEO-019/020/031 a 067:** první analytická etapa — bateriový panel se
   společnými časy, vlastní baseline a kvalitou párování; teplotní expozice.
   Potvrdit solární zapojení, chemii/limity baterie a zda T měří okolí či článek.
   Potom podobné dny METEO-066 a události METEO-043. Srážkové události blokuje
   kontrakt rain/rainInc/reset (METEO-017/049), ne chybějící grafová knihovna.

Velké nové moduly zůstávají návrhy. Worker až po profilu skutečného parseru a
posouzení ceny přenosu; regionální API pouze s licencí, kvótou a cache.

### Publikace etapy 2

Kód `14af6c8` a analýza `c5fe1bf` odeslány na codex-dev.
[Actions #10](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39589555415)
pro c5fe1bf: **Success**, build i deploy prošly, celkem 27s, jeden artefakt.
Vývojový HTML obsah má v0.2.0, main zůstává 2405c5d. Přímá kontrola živých
widgetů z prostředí nebyla provedena; rozlišovat lokální prohlížečový test,
úspěšný GitHub deployment a uživatelské zobrazení skutečných měření.
Následující commit projektové paměti obsahuje pouze dokumentaci.

## Etapa 3 — kalendářní dny, v0.2.1 (21. 10. 2026)

Pokračování prvního bodu roadmapy: **AUD-010 dokončeno**, **METEO-048
rozpracované**. [Časový model](CAS_A_KALENDAR.md) odlišuje dnešní zónu
prohlížeče od budoucí explicitní zóny stanice a nerozlišitelného CSV času.

- Denní klíče porovnání, „Dnes“, startovní datumy a datum UV cache používají
  místní rok/měsíc/den, stejně jako parser a hodinové popisky. Žádné UTC datum
  připojené k lokální hodině. Zóna je vidět v informaci u porovnání.
- Osm rychlých voleb a „Včera“ se odvozují kalendářně, neopakují/vynechávají
  den při DST. Jeden den/vlastní rozsah s prázdným „do“ zahrne celých 23/25h
  až po milisekundu před další půlnocí; i explicitní datum „do“ je celý den.
- Dnešní statistiky nezahrnují sousední den. Chybějící dnešní hodnoty smažou
  starý text, nula zůstává platná. Původní řádky a plné výpočty zachovány.
- 24 hodinových skupin porovnání zůstává vzorkovým průměrem. Dvě podzimní
  hodiny se průměrují společně, jarní mezera je null; UI to vysvětluje.

**Ověření:** 80/80 Node testů, 17 nových. Pět zón, půlnoc, přelom roku,
leap day, 23/25h i historický posun o půlnoci, chybějící a neplatná data.
Dvě regrese prokazatelně selhaly na 3e236bc. Skutečný Chromium/Chart.js se
všemi třemi konfiguracemi a řízenou sítí ověřil startovní datumy, osm voleb,
sloučení požadavků a skutečné datumové vstupy. [Jarní](testing/calendar-spring.json)
a [podzimní](testing/calendar-autumn.json) výsledky; přesná reprodukce v časovém
modelu. Žádný nový fetch, závislost nebo změna konfigurace. Tato etapa není
optimalizace výkonu, nedeklaruje nové zrychlení a nemění main.

**Otevřeno pod METEO-048:** potvrdit zónu firmware/Sheets a DST kontrakt;
explicitní zóna stanice vyžaduje migraci parseru a výstupů. UV API používá zónu
podle polohy, zatímco současný hodinový index je zóna prohlížeče; musí přejít
na ověřené časové značky odpovědi včetně 23/25h, pouhá oprava cache nestačí.
METEO-038 sdílené agregace navážou na nyní jednotný lokální den, s revizní
invalidací i půlnocí; poté METEO-005 obnova na pozadí. Výsledky nesmí vycházet
z vizuální redukce a cache nesmí maskovat opravy starých dat.

Publikováno v [076bc08](https://github.com/Michaltymm/Meteo_webovky/commit/076bc0865a34961ebef4cd14e98062976c3ef956)
na codex-dev. [Actions #11](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39593972552)
**Success** včetně build/deploy, 44s. Main stále2405c5d. Jde o potvrzení workflow
nasazení; skutečná živá měření na Pages z tohoto prostředí přímo neověřena.

## Etapa 4 — sdílené souhrny a pozadí, v0.2.2 (21. 10. 2026)

**METEO-005 dokončeno:** skrytá karta nepouští periodické Sheets/UV/overview
požadavky ani astronomický render. Rozpracované přenosy a MQTT se neruší,
ruční obnova a start zůstávají explicitní akce. Při návratu jedna potřebná
obnova na zdroj podle posledního pokusu/intervalu, žádný nový MQTT klient.
Ruční refresh resetuje periodický věk a následující timer nepřidá druhý request.
UV/overview sdílejí pending Promise; chyby UV se nepokouší znovu při každém
přepnutí viditelnosti. Čekající konfigurace a staré generační timery jsou chráněny.

**METEO-038 rozpracované:** jeden snapshot odkazuje na úplná originální data;
společné globální extrémy, denní maxima rain, dnešní souhrny a denní/měsíční
T/RH součty/počty pro karty a grafy. Invalidace po CSV/MQTT/resetu, výměně pole
a lokálním dni; in-place opravy vyžadují invalidateDerivedData. Neuchovává tři
historie, nespočítá statistiky z vizuální redukce. Vzorkové průměry, pořadí
sčítání a výběr při shodných extrémech zachovány. Procentuální pokrytí bez
měřicího plánu se nevymýšlí. Hodinové skupiny a sdílení s ročními statistikami
zůstávají další část, proto není celé ID dokončené.

**Ověření:** 96/96 Node testů (16 nových), skutečný DOM/Chart.js/timery,
řízené visibility události, všechny tři konfigurace, mobil390, všechny záložky
a osm metrik. [Metodika, tabulky a surové JSON](performance/ETAPA4.md).
Při250k refresh po invalidaci89,4→46,3ms, opakovaný79,1→23,1ms,
denní karty33,0→0,2ms. Heap po GC56,36→56,48MiB, stále osm Chart instancí.
Malý1k scénář mírně kolísá i opačně, nejde o zrychlení každého snímku.
Skryto10min/24h:0 periodických fixture HTTP; návrat10min:3, další den:4
s UV nového dne. Jedná se o lokální kontrolované testy, ne živou síť/OS sleep.
Konfigurace, workflow, archiv a main nezměněny. Navrhy_Vylepseni.md má jen
aktualizovanou úvodní evidenci, žádný paralelní backlog.

**Další etapa:** hodinové agregace a kvalita/pokrytí METEO-038 (samostatně
počet platných vzorků, pozorovaný čas a dostupnost podle ověřeného plánu).
Potom METEO-019/020/031 bateriový modul z úplných dat; METEO-048 explicitní
zóna/UV timestampy a METEO-004 omezená cache stanic zůstávají samostatné.
Před kapacitou baterie a srážkovými událostmi potvrdit potřebné HW/datové kontrakty.

Publikováno v [83da84c](https://github.com/Michaltymm/Meteo_webovky/commit/83da84ca3eb2a335407c4a9c3b9c011af76e9b83)
na codex-dev. [Actions #12](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39598503481)
**Success**, build i deploy prošly, celkem 33s. Main zůstává 2405c5d. Přímé
živé widgety Pages nebyly z prostředí ověřeny; místní prohlížečové testy jsou
s řízenými transporty. Následující commit aktualizuje pouze dokumentaci.

## Etapa 5 — hodinové souhrny a podklady, v0.3.0 (21. 10. 2026)

Pokračování **METEO-038**, dílčí **METEO-036**; bez nových ID.
Porovnání používá hodinové T/RH/P z originálních řádků vybraného dne a LRU
nejvýše osmi dnů. Indexové meze dne navazují na stávající sdílený snapshot,
invalidují se s daty, stanicí i dnem. Vzestupné součty zachovávají pořadí
shodných timestampů původního stabilního sortu; průměry se numericky nemění.
Nula zůstává validní, null/nekonečno zůstávají chybějící, duplicity se nemažou.

Rozbalovací podklady a tooltip rozlišují počet záznamů, různých časů a číselných
hodnot veličiny. Počet hodinových skupin s daty má jmenovatel skutečných dvojic
místní hodiny+offsetu daného dne; podporuje 23/25h i půlhodinové DST. Rozsah
časů a nejdelší rozestup jsou popsané jako časové rozdíly, ne souvislé pokrytí
nebo prokázaný výpadek. Bez měřicího plánu se nevydává procento dostupnosti.
Porovnání nepropojuje null hodiny, zdůrazňuje částečnou/celou načtenou historii.
Legacy CSV bez offsetu nadále nemůže rozlišit dvojí podzimní čas METEO-048.

**Ověřeno:** 110/110 testů (14 nových), nezávislá reference výpočtů,
250k lookup/cache bez opakovaných scanů, LRU a invalidace, čtyři zóny včetně
Lord Howe. Skutečný Chromium/Chart.js se třemi konfiguracemi a řízenou sítí,
podklady/tooltip, mobil390/dvě témata, 2/25 a2/23 hodinových skupin,
null jarní hodina a bez pageErrors/přetečení. Původní přemosťování mezery
reprodukované na c37227f, screenshot nové sekce zkontrolovaný.

[Měření a surové výsledky](performance/ETAPA5.md): při250k cold compare
35,3→28,4ms a opakované32,7→5,1ms. Nové podklady mají cenu v prvním malém1k
scénáři7,3→9,2ms; toto není plošné procento zrychlení celé stránky. Heap po GC
56,31→56,53MiB, osm Chart instancí, žádný nový fetch/závislost/config/workflow.

**Další krok:** sdílení ročních statistik a popis pozorovaného času oproti
skutečné dostupnosti podle plánu v METEO-038. Plán senzoru není HTTP polling.
Následně METEO-019/020/031 teplota×napětí s počty a kvalitou časových párů;
kapacita/SOC/energie z napětí samotného zůstává zamítnutá METEO-024.

Publikováno v [07e63b1](https://github.com/Michaltymm/Meteo_webovky/commit/07e63b1f1808d9dfe97529e6e6f8139f64d6a494)
na codex-dev. [Actions #13](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39602279948)
**Success**, build i deploy prošly, celkem 30s, jeden artefakt. Main zůstává
2405c5d. Přímé živé widgety Pages nebyly z prostředí ověřeny. Následující
aktualizace projektové paměti obsahuje jen dokumentaci.

## Etapa 6 — sdílené roční statistiky, v0.3.1 (21. 10. 2026)

Dokončené roční sdílení v **METEO-038**, dílčí oprava interpretace popisků
**METEO-017/049**, žádné nové ID. Historické návrhy a stavy výše zachovány.

`dataAggregates` eviduje meze originálů jednotlivých let. `annualStats`
spočítá jen požadované roky a uchovává malé výsledky ve snapshotu aktuální
stanice; měsíční průměry sdílejí stávající součty/počty. Roční součty zůstávají
v původním pořadí řádků, stejně jako výběr data při shodě rekordů a kalendářní
pořadí shodných měsíců. Bez kopií celé historie, bez statistik ze vzorkovaného
grafu, bez nových požadavků či produkčních závislostí. CSV/MQTT/reset/oprava
i změna místního dne invalidují i roky. Zaniklý rok/empty vyčistí filtr.

Původní srážkové výpočty zachovány, opravené popisky: maximum denního čítače
není roční součet; maximum rainInc patří záznamu, ne automaticky hodině;
legacy rozdíl rain v posuvném okně do 24h není prokázaný 24h úhrn. Algoritmus
neřeší reset a nepřechází hranici roku. **METEO-017 není tímto dokončené**;
pro skutečné úhrny potvrdit jednotky, reset, interval a čas měření METEO-049.

**Ověřeno:** 119/119 Node testů (9 nových), nezávislá reference všech osmi
žebříčků a ročních hodnot přes více let, floating-point pořadí, shody/0/null,
nonfinite, cache bez opakovaného čtení 250k, výběr roku, oprava/smazání, CSV,
MQTT, stanice, hranice roku ve dvou zónách a duplicitní/resetované rain.
Skutečný DOM/Chart.js načetl tři konfigurace s řízeným transportem; všechny
tabulky i číselné srážkové výsledky se shodují s bf31182 před/po opravě
starého záznamu. Filtr nepřidává requesty, dvě témata, 390/1280px bez přetečení
a page errors. Mobilní screenshot vizuálně zkontrolovaný, syntax/diff prošly.

[Metodika a surová data](performance/ETAPA6.md): 1k/10k/100k/250k, po invalidaci
při 250k **177,2→98,9ms**, opakovaně **160,7→1,2ms**. CPU×4/100k opakovaně
**368,6→3,7ms**. Cold refresh při 250k 54,1→54,2ms, neuvádět jako zrychlení.
Heap po GC 56,88→56,83MiB, stále osm Chart instancí a stejný DOM po 30 cyklech.
První výpočet je stále možný delší blok hlavního vlákna; reálná síť, firmware,
broker, několikadenní provoz a živé widgety Pages neověřeny.

**Další etapa:** METEO-019/020/031 teplota×napětí z plných časově spárovaných
měření, s počty a kvalitou párů; nejprve ověřit skutečné umístění teplotního
senzoru. Nikdy neodvozovat SOC, kapacitu či energii pouze z V (METEO-024).
Sdílení všech současných souhrnů METEO-038 je hotové; procenta dostupnosti
čekají na ověřený plán senzoru, nikoliv CFG.interval HTTP pollingu. Explicitní
zóna/UV METEO-048 a omezená cache stanic METEO-004 zůstávají samostatné.

Publikováno v [f807173](https://github.com/Michaltymm/Meteo_webovky/commit/f807173f77a033a4648ab4af1667798649941d10)
na codex-dev. [Actions #14](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39606840157)
**Success**, build 16s/deploy 9s, celkem 33s, jeden artefakt. Main zůstává
2405c5d. Přímé živé widgety Pages nebyly z prostředí ověřeny. Následující
commit aktualizuje pouze dokumentaci; verze HTML zůstává0.3.1.
## Etapa 7 — druhá rozvojová analýza nad 75 návrhy (21. 10. 2026)

Výchozí revize `fcb8ca4`, web v0.3.1. Zkontrolovány pravidla AGENTS, QUICK
CONTEXT a relevantní audit, historický Opus, celá centrální roadmapa, metodiky
výkonu, release notes, aktuální renderery/CSV/MQTT/čas/cache, tři konfigurace,
regresní testy a Pages workflow. Produkční main zůstává mimo změny.

Původní zadání mluví o60návrzích, ale aktuální plán již obsahuje75. Tentokrát
zařazujeme **8 skutečně samostatných podnětů METEO-076–083**. Další kandidáti
níže rozšiřují existující ID; nenavyšujeme počet přes dvojí pojmenování stejné
funkce. Původní ID, historie a stavy zůstávají zachované.

### Nové samostatné návrhy

#### METEO-076 — Simulátor úspornějšího měřicího plánu

- **Přínos / priorita / obtížnost / stav:** zjistit, které extrémy a události by
  unikly při měření každých15/30/60minut místo současné četnosti. P1, střední,
  K posouzení. Samostatný návrhový nástroj pro firmware, nikoli dostupnost027
  nebo samotná vizuální redukce033.
- **Vstupy / proveditelnost / nové požadavky:** současné úplné T/RH/P/V a časy
  stačí pro zpětnou simulaci; bez nového HW/backendu. Skutečná změna plánu by
  vyžadovala firmware a potvrzení vlastníkem, nikoliv automatický zápis z webu.
- **Řešení / výkon:** pro několik explicitních period i fází vybrat skutečné
  historické vzorky v toleranci, spočítat ztrátu extrémů, změnu vzorkového
  průměru a zachycení uživatelem definovaných epizod. O(k·n) pro omezené k,
  spustit na klik, cache podle revize/plánu, žádné nové síťové požadavky.
- **Závislosti / omezení:** METEO-038/048/043; neznáme dění mezi původními
  vzorky, proto simulace nedokazuje zachycení kratších jevů. Počet plánovaných
  měření není energie ani prodloužení výdrže; spotřeba potřebuje METEO-057.
  Vyhodnotit různé fáze, ne pouze každé n-té měření, jinak vzniká aliasing.
- **Test:** vložená krátká špička, denní sinus, mezery, různé fáze periody,
  nepravidelné časy a23/25h den; kontrolovat originální extrema i počty,
  při nedostatečné referenční četnosti vrátit „nelze posoudit“.

#### METEO-077 — Jak moc závěr stojí na jediném měření

- **Přínos / priorita / obtížnost / stav:** rozlišit stabilní vztah T/V od r
  vytvořeného jedinou odlehlou dvojicí nebo jediným dnem. P1, střední,
  **Dokončeno v0.7.0 v plánovaném denním rozsahu** — výpočet v0.6.0,
  dohledání původních záznamů dne s063 v0.7.0.
  METEO-042 hledá podezřelý senzor a074 toleranci měření; zde je vliv vzorku
  na konkrétní analytický závěr bez označení vzorku za chybný.
- **Vstupy / proveditelnost / nové požadavky:** současné úplné časové páry;
  bez změn HW/firmwaru/backendu. Nepotřebuje automatické odstranění odlehlostí.
- **Řešení / výkon:** porovnat plný r/sklon s leave-one-day-out výsledky,
  zobrazit rozsah a nejvlivnější den s dohledáním původních řádků. Stabilní
  souhrny po dnech a jejich sloučení O(n+d), nikoli d úplných kopií historie.
- **Závislosti / rizika:** METEO-031/038/063/048. Výsledná citlivost není
  interval spolehlivosti ani důkaz chybného senzoru; dva dny nejsou dostatečný
  základ a nulový rozptyl po vynechání musí být výslovně nedostupný.
- **Test:** lineární vztah, jediná vlivná dvojice, extrémní celý den,
  konstantní zbytek, změna epochy; proti nezávislému opakovanému přepočtu.
- **Ověřeno v etapě9:** plné denní vynechání, samostatné vlivy na r/sklon,
  počty dostupných/nedostupných výsledků, explicitní hranice≥3dnů a≥3párů
  po vynechání. Stabilní Welford + prefix/suffix O(n+d), malá cachovaná odpověď,
  bez změny plného r/sklonu či vyřazení měření. Přechod do průzkumníku celého
  dne bez fetch; neznamená výpis všech jednotlivých dvojic nebo měření epoch.
  11 nových regresí včetně jediného vlivného páru/celého posunutého dne,
  konstantního zbytku, duplicit, velkého offsetu, DST a250k. Metadata epoch071
  nejsou dostupná — posunutý den je syntetický scénář, nikoli rozpoznaná změna
  kalibrace. **Doplněno v etapě10/v0.7.0:** přímý stránkovaný výpis všech
  původních záznamů vybraného dne v analytickém rozsahu, včetně vynechaných
  řádků/důvodů a platnosti reference pro aktuální snapshot. Tím splněna
  plánovaná denní funkcionalita077; obecný rodokmen ostatních výpočtů063
  a metadata071/048 pokračují samostatně, nepřidávat duplicitní ID.

#### METEO-078 — Proč se změnila relativní vlhkost

- **Přínos / priorita / obtížnost / stav:** vysvětlit, zda pokles RH odpovídá
  hlavně ohřevu, nebo změně parního tlaku. P1, nízká, **Dokončeno v0.5.0**
  (krajní měření úseku v průzkumníku; platnost kalibrace/umístění označena jako neověřená).
  METEO-013 dává stavové veličiny; toto rozkládá změnu mezi dvěma stavy.
- **Vstupy / proveditelnost / nové požadavky:** dvě původní T/RH se známými
  časy, bez nového zdroje. RH musí být>0 pro logaritmický rozklad.
- **Řešení / výkon:** e=RH·es(T)/100; přesná identita
  Δln(RH)=Δln(e)−Δln(es(T)) oddělí příspěvky páry a teploty. Ukázat původní
  hodnoty, logaritmické příspěvky a kontrolní RH při nezměněném e. O(1) pro
  endpointy061; výsledky neoznačit za rozdělení procentních bodů RH.
- **Závislosti / rizika:** METEO-013/061/063/071; jedná se o termodynamickou
  identitu nad senzory, ne určení zdroje vody, větrání či kauzality. RH=0,
  chybějící vstup a jiná epocha bez odpovídajícího upozornění nepřipustit.
- **Test:** ohřev při konstantním e, změna e při konstantní T, kombinace,
  identické stavy, RH=0/100, null a numerické uzavření identity.

#### METEO-079 — Ztrácejí se měření častěji při chladu či nízkém napětí

- **Přínos / priorita / obtížnost / stav:** zjistit možné výběrové zkreslení:
  dlouhá historie může systematicky postrádat chladné či energeticky slabé
  situace. P1, vysoká, K posouzení. METEO-027/045 měří mezery, zde jde
  o vztah jejich výskytu k poslednímu pozorovanému stavu a zkreslení závěrů.
- **Vstupy / proveditelnost / nové požadavky:** časy a T/V před mezerou jsou
  dostupné. Pro výpadek proti plánu potřebujeme potvrzený měřicí plán;
  bez něj pouze vztah k dlouhým pozorovaným rozestupům. Rozlišení ztráty
  přenosu od neměření vyžaduje sekvenční čítač a measurement/send časy
  z firmwaru/backendu METEO-058/049.
- **Řešení / výkon:** předem definované intervalové skupiny a stavové biny,
  míra následujících dlouhých rozestupů, počty dnů/epizod a kontrola sezóny;
  O(n), malé tabulky, žádné domýšlení hodnot uvnitř mezery.
- **Závislosti / omezení:** METEO-027/045/048/071/031. Poslední V nemusí být
  příčinou mezery; absence extrému neprokazuje příznivé podmínky. Bez
  denominátorů/počtů a minima nezávislých dnů nezobrazovat srovnávací skóre.
- **Test:** náhodné mezery vs mezery po nízkém V, změna plánu v zimě,
  blokovaný transport, žádné mezery a malý vzorek; deterministická simulace
  musí odhalit i sezónní confounding, ne jen globální korelaci.

#### METEO-080 — Společný synoptický signál a lokální reziduum tlaku

- **Přínos / priorita / obtížnost / stav:** odlišit změnu sdílenou všemi
  stanicemi od jedné lokální odchylky bez externího API. P2, vysoká, Nápad.
  METEO-028 porovnává dvě lokality/bias, zde jde o společnou komponentu
  celé sítě a rezidua, nikoliv další přepínač stejného grafu.
- **Vstupy / proveditelnost / nové požadavky:** současný tlak a časy všech tří
  stanic mohou stačit po potvrzení srovnatelných jednotek a typu tlaku.
  Žádný nový HW/backend; načítání až na explicitní otevření jako METEO-025.
- **Řešení / výkon:** časově párované změny tlaku za stejnou délku intervalu,
  robustní medián napříč lokalitami, residuum každé stanice. O(n+m+p), malé
  výsledné řady; uvést počet přispívajících lokalit a vzdálenosti.
- **Závislosti / rizika:** METEO-025/029/016/048/071. Tři čidla nejsou pravda
  země, sdílená chyba projde do společné složky. Při méně než třech platných
  zdrojích nesmí výstup předstírat síťový konsenzus. Začít tlakem, nikoli
  automaticky zobecnit na teplotu rozdílných mikroklimat.
- **Test:** vložený společný trend+lokální drift, změna výšky/epochy,
  nesoučasné intervaly, chybějící jedna/dvě stanice a všem shodný bias.

#### METEO-081 — Protokol změny zařízení s kontrolní lokalitou

- **Přínos / priorita / obtížnost / stav:** posoudit, zda výměna krytu či
  orientace panelu změnila pozorované chování více než současné počasí.
  P2, vysoká, K posouzení. METEO-071 eviduje epochu; zde je předem definovaný
  experiment a vyhodnocení změny proti kontrolní lokalitě.
- **Vstupy / proveditelnost / nové požadavky:** historie, čas zásahu, přesný
  popis zásahu a vhodná kontrolní stanice od uživatele. Frontend může
  vyhodnotit data bez nového HW/backendu; energie/výkon vyžadují proud057.
- **Řešení / výkon:** předem zvolit veličinu/okna, párovat stejné denní časy
  a podmínky, zobrazit změnu rozdílu před/po s počty dnů a placebo termíny.
  O(n+m) plus malá skupinová statistika, pouze na vyžádání.
- **Závislosti / rizika:** METEO-071/025/029/077. Bez srovnatelné kontroly
  pouze popisné před/po, žádné kauzální tvrzení. Souběžný upgrade firmware,
  sezóna nebo přesun čidla mohou experiment znehodnotit; hypotézu uložit
  před výběrem příznivého výsledku.
- **Test:** známý vložený efekt, společná změna počasí bez efektu, odlišný
  trend kontroly, dvě souběžné změny a placebo bez zásahu.

#### METEO-082 — Empirický sezónní profil lokality

- **Přínos / priorita / obtížnost / stav:** určit, jak neobvyklý je dnešní
  průběh proti vlastním srovnatelným dnům předchozích let. P2, střední,
  Nápad. Odlišné od041 ručního porovnání dvou období a034 heatmapy surových
  hodnot: výstupem je referenční kalendář s percentily a počtem roků.
- **Vstupy / proveditelnost / nové požadavky:** víceletá T/RH/P, místní čas,
  epochy; dnešní typ dat stačí, skutečná délka archivu zatím není ověřena.
  Bez nových HW/firmwaru/backendu. Krátký archiv může funkci zablokovat.
- **Řešení / výkon:** denní/hodinové souhrny v explicitním okolí dne roku,
  stejná váha roků, kvantily a leave-one-year-out zařazení zvoleného roku;
  samostatné řešení29.února. O(n+d·w), souhrny podle revize/epochy.
- **Závislosti / omezení:** METEO-038/048/071. Neoznačovat za klimatický normál
  ani návratovou periodu extrému. Nesmí se porovnávaný rok učit sám na sobě;
  uvést počet roků a chybějící sezóny, ne vydávat pět let za třicetiletý normál.
- **Test:** sezónní sinus, nerovnoměrná četnost mezi lety, chybějící zima,
  přestupný rok, změna epochy a vložený extrém mimo referenční roky.

#### METEO-083 — Ověření původu podepsaných měření

- **Přínos / priorita / obtížnost / stav:** ověřit, že exportované hodnoty
  pocházejí z určeného zařízení a dávka nebyla pozměněna. P3, vysoká,
  K posouzení. Schema049 a CDN integrita055 neověřují autorství měření.
- **Vstupy / proveditelnost / nové požadavky:** současný nepodepsaný CSV nestačí.
  Nutný firmware nebo důvěryhodný příjem s podpisem kanonických dávek,
  veřejný klíč spravovaný vlastníkem a backend přenášející podpis/revizi.
  Nejde o funkci realizovatelnou jen změnou webu.
- **Řešení / výkon:** verzovaný kanonický manifest, hash obsahu, podpis,
  identita klíče a monotónní sekvence proti opakování. O(bajty) asynchronní
  ověření na přijetí dávky, ne na renderu, jen s podporovanou kryptografií.
- **Závislosti / rizika:** METEO-049/058/055. Hash bez důvěryhodného podpisu
  není autenticita; podpis příjmového serveru neprokazuje správnost senzoru.
  Rotace/ztráta klíče a kompromitovaný frontend potřebují samostatný návrh,
  žádné klíče v klientské konfiguraci ani falešná zelená značka pro legacy CSV.
- **Test:** kanonické známé vektory, změněný bajt/pořadí, stará sekvence,
  rotace/odvolání klíče, chybějící podpis a nepodporovaný algoritmus.

### Rozšíření existujících ID — bez dalších čísel

| ID | Konkrétní nový přínos a přijímací podmínka |
| --- | --- |
| METEO-013/012 | Absolutní vlhkost a VPD vzduchu se stejnými T/RH, explicitní vodní referencí a oborem vzorce; RH=0 je platná pro AH/VPD, nikoli logaritmus rosného bodu. Jednotky g/m³/kPa, null mimo obor, zdroj i vzorec dostupné v UI. |
| METEO-019/031 | První bezpečný modul: původní páry téhož řádku, časový pohled °C/V a XY, n/počet časů/dnů, r bez p-value. Cache jen jednoho rozsahu; scatter samplovat po XY buňkách a v tooltipu skutečný reprezentant, hustotu nesmí reprezentovat počet nakreslených bodů. |
| METEO-020/021/022 | Odlišit plošinu regulátoru, zátěžový pokles a pravděpodobné nabíjení podle známého zapojení. Bez potvrzené topologie nepřidat univerzální prahy. Srovnávací dny musí mít společný teplotní obor, jinak vrátit nepoužitelné srovnání. |
| METEO-031/032 | Vedle prostého r nabídnout změny mezi vzorky a podmíněné vztahy po denních blocích; žádné automatické nejlepší z desítek lagů. Reportovat zvolená okna a zamítnuté hypotézy, CI až s blokovým backtestem. |
| METEO-028/071 | Kalibrační sezení společně umístěných čidel oddělit od vzdálených lokalit; odhad biasu, zpoždění odezvy a možné závislosti odchylky na sluneční výšce jen proti stíněné referenci. Žádný důkaz radiační chyby pouze z T vs Slunce. |
| METEO-038/041 | Nabídnout vzorkový a časově vážený průměr jako dva odlišné výsledky s modelem interpolace a vyloučenými mezerami, ne tiše nahradit stávající průměry. Ověřit analytický lineární průběh a nestejné intervaly. |
| METEO-017/049 | Diagnostikovat, kdy součet potvrzených přírůstků nesouhlasí s rozdílem kumulátoru; nejprve explicitně zvolený reset/policy. Nesouhlas je nález kontraktu, nikoliv automatická oprava původních hodnot. |
| METEO-042/072 | Rozlišit ořezávání na limitu od kvantování a přirozeně konstantního prostředí; používat doložený rozsah senzoru a čítače četnosti. RH=100 může být skutečné nasycení, ne automaticky závada. |
| METEO-010/011 | Živě respektovat prefers-reduced-motion v Chart.js/CSS/smooth scroll, obnovit původní režim po změně preference, nikdy znovu nezapnout animaci exploreru/velkého analytického grafu. |
| METEO-050/064 | Doba příjmu, parsování a renderu odděleně; report jen allowlist, kruhový buffer a verze bez Sheet ID, poznámek nebo celých chyb s URL. |
| METEO-054/060 | Validovat zdroj při importu a zobrazit změny před aplikací; verze konfigurace, výpočtu a načteného HTML jsou rozdílné údaje. Neslibovat deployment jen podle čísla verze. |
| METEO-056/008 | Nově měřit i cenu nového analytického modulu a první invalidované výpočty. Dále změřit skutečný CSV parser a špičku paměti včetně raw textu; Worker má smysl až při doloženém interakčním problému a ceně přenosu. |

### Výběr implementace a kritické hranice

Zvolené nejvýše tři změny: první explorativní modul T/V (METEO-019/031),
AH/VPD aktuálně i v existujícím průzkumníku (METEO-013/012) a omezení pohybu
(METEO-010). Bez nových závislostí, configů, úprav firmware nebo automatických
síťových dotazů. Načtení plné historie jen při otevření analytiky využije
existující ensureFullData. Nové návrhy 076–083 zatím zůstávají návrhy.

Nevydávat prosté r za statisticky prokázaný efekt: n vzorků není počet
nezávislých dnů, teplota senzoru není ověřená teplota baterie, nabíjení/zátěž
jsou možné společné příčiny. Nulový rozptyl nebo málo párů → výsledek
nedostupný. SOC/kapacita/energie jen z V zůstává zamítnuté024.

Srovnání WeeWX a Belchertown už je doložené v etapě2; jejich audit ani síťové
čtení neopakujeme. Použitelný princip zůstává explicitní původ agregací a
oddělení archivu od UI. Nepřebíráme jejich server, forecast API nebo další
závislosti. Časová zóna/UV048, skutečné srážky017/049 a plán dostupnosti027
mají stále své datové blokery, neskrývat je novou vizualizací.

### Etapa 7 — implementace a ověřené výsledky

Vydání **v0.4.0**, právě tři výše vybrané změny; podrobnosti a surové důkazy
v [ETAPA7](performance/ETAPA7.md). Nové návrhy 076–083 nejsou implementované.
METEO-019/031 mají základní explorativní modul s rozsahem7/30 × 24 h/all,
časovým a XY pohledem, původními páry, Welford r/sklonem a počty. Měření
nahraná víckrát zůstávají ve statistikách, různé časy/dny jsou samostatné
počty; nejde o test nezávislých pozorování. Cache jeden rozsah, +2 lazy grafy,
čas≤800/XY≤582 skutečných bodů. Žádný p-value, SOC, kapacita či energie.
METEO-013 AH/VPD v přehledu i průzkumníku včetně vzorců/oboru; T−Td dále.
METEO-010 motion initial/live hotové, obecné ARIA/fokus/dotyk dále.

**132/132 Node testů**, třináct nových; skutečný browser se třemi konfiguracemi,
řízeným CSV/UV,924 párů, chybějící V i platné0V, plná historie, oprava starého
měření a odchod z tabu během full bez tvorby skrytých grafů. AH/VPD,
motion při startu/změně preference a CSS, dvě témata, 390px, deset explorer
voleb a všechny taby bez chyb/přetečení. Screenshot zkontrolovaný.
Nový modul si při explicitním otevření vyžádá jednu plnou historii stejně
jako existující historické taby; rozsahy 0nových fetch, start/obnova beze změn.

Měřeno sekvenčně 1k/10k/100k/250k. Běžné pohledy mají rozdíly oběma směry:
250k cold refresh61,5 → 54,2 ms, explorer40,4 → 43,5 ms; CPU×4/100k cold130,9 → 139,6 ms.
Nejde o plošnou optimalizaci webu. Nový modul250k cold55,7/warm6,1 ms,
VPD explorer29,2 ms; CPU×4/100k141,4/28,8/66,4 ms. Zavřená analytika8 Chart,
po otevření10i po 30 cyklech; při 250k heap57,55 MiB není celá RAM. Živá síť,
skutečný parser velkého CSV, fyzický mobil a několikadenní soak neověřeny.

**Doporučené pořadí:**

1. Metadata čidla/epoch071 a časového kontraktu048; teplota vzduchu není
   automaticky teplota článku a HTTP interval není měřicí plán.
2. METEO-019/020/031: srovnání při podobné T a solárním čase až po potvrzení
   napájení/umístění, bloková nejistota a077 citlivost výsledku na jednotlivé dny.
3. METEO-078 rozklad RH nad013/061; výpočet bez nového HW a dalších fetchů.
4. METEO-076 simulátor plánu po ověření četnosti referenční historie.
5. METEO-082 sezónní profil až s dostatečným počtem homogenních roků.

Pro srážky017/049 a skutečnou dostupnost027 zůstávají blokery reset/interval/
schema. Nové podpisy083 jsou pouze nákladný návrh s firmware/backendem,
nikoliv podmínka dnešního provozu. Původní historie roadmapy zachována;
starší Navrhy_Vylepseni zůstává pouze referencí, žádný konkurenční backlog.

### Publikace etapy 7

Analýza [d6e343c](https://github.com/Michaltymm/Meteo_webovky/commit/d6e343c472f8cf291c2d191161b763cb1226a7df)
a implementace [25b7048](https://github.com/Michaltymm/Meteo_webovky/commit/25b7048eba1b806b55b2b195cf70ec402dc69618)
odeslány na codex-dev, vzdálené SHA ověřeno.
[Actions #15](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39614305462)
**Success**, build16s/deploy30s, celkem57s, jeden artefakt. Main stále2405c5d.
To potvrzuje nasazení workflow, nikoli přímé ověření živých widgetů z tohoto
prostředí. Následující commit doplňuje pouze dokumentaci; HTML zůstává v0.4.0.

## Etapa 8 — rozklad změny RH, v0.5.0 (21. 10. 2026)

Po ověření shody čistého `7aa843e` s origin vybrán **METEO-078 (P1/nízká)**,
navazující na hotové výpočty013 a endpointy061. Není potřeba nový firmware,
senzor ani externí zdroj. Hotová předchozí práce zachována; žádný nový audit
ani opakování čtyřvelikostních/CPU profilů etapy 7.

**METEO-078 Dokončeno:** rozbalovací „Rozklad změny relativní vlhkosti“
v průzkumníku pro T/RH/T+RH/Td/AH/VPD, s původními krajními T/RH a časy,
teplotním faktorem es1/es2, faktorem parního tlaku e2/e1, jejich výsledným
poměrem RH, kontrolní RH při stejném e a logaritmickými příspěvky. Výpočty
v plné přesnosti, původní měření a stávající statistiky beze změny.

Kalibrace/umístění mezi body je vždy označeno jako neověřené (metadata071
nejsou vymyšlená). Nejde o kauzální atribuci, přírůstek hmotnosti vody ani
průběh mezi endpointy. RH 0, chybějící/mimooborové hodnoty, shodné časy
či číselné podtečení mají důvod nedostupnosti. Kontrolní RH nad 100 % pouze
formální překročení nasycení, nikoliv měření. Prázdný/jednobodový úsek,
nesouvisející metrika a invalidace vyčistí/skryjí panel; slider stále používá
plné originály, nikoliv nakreslené reprezentanty.

**Ověřeno 142/142 Node testů (10 nových)**, skutečný DOM/Chart.js/tři původní
konfigurace s řízeným CSV/UV, pohyb slideru, stejné RH při různých T,
UTC offsety,0/missing/nasycení/clear a obě témata při 320/390 px. Žádné další
requesty či page errors, screenshot rozbaleného panelu prohlédnut. Smoke
všech tabů/deseti explorer voleb prošel při 1k/250k.

[Cílené měření a JSON](performance/ETAPA8.md): výpočet přečte pouze2 krajní
řádky i při 250k, O(1). Sekvenční srovnání5 vzorků před/po: slider 1k 5,4 → 5,7 ms,
250k 23,5 → 20,3 ms; explorer 1k 6,0 → 6,9 ms,250k 47,7 → 39,5 ms. Není to tvrzení
zrychlení grafů, jejich původní O(n) práce se nemění. Reálná síť/parser,
HW/firmware/broker/OS mobil ani živé widgety Pages nejsou tímto ověřeny.

Další vhodný krok **METEO-077**: citlivost T/V vztahu na jednotlivé dny,
s použitím existujících plných párů a stabilních souhrnů. Epochy071 a
časový kontrakt048 nadále samostatně; srážky017/049 a dostupnost027 čekají
na datové kontrakty. METEO-013/019/031/010 zůstávají v dosavadním dílčím
stavu, nedostávají neoprávněné globální DONE. Počet stabilních ID stále 83.

### Uložení a stav nasazení etapy 8

Kód, testy a dokumentace odeslány v
[1003743](https://github.com/Michaltymm/Meteo_webovky/commit/100374322a4b675c74c904afe56831ca7a8ff724)
na codex-dev; vzdálené SHA i veřejná stránka commitu ověřeny. Main stále2405c5d.
Místní testy a browser úspěšné. Veřejné Actions i přehled pages.yml při
závěrečné kontrole zobrazovaly jako nejnovější
[run #15](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39614305462)
pro25b7048/v0.4.0; nový běh pro1003743 nebyl nalezen. Nasazení v0.5.0 je
proto **neověřené**; z toho nelze usuzovat na chybu CI nebo její důvod.
Přímé widgety Pages nejsou z prostředí ověřeny. Následující commit upravuje
pouze paměť; kontrola publikace nevyžaduje opakovat hotovou implementaci/testy.


## Etapa 9 — denní citlivost T/V vztahu, v0.6.0 (21. 10. 2026)

Výchozí čistý `21e0f3f` ověřen proti origin; METEO-078 i předchozí hotové
souhrny zachovány. Vybrána navazující **denní etapa METEO-077 (P1/střední)**
nad existujícími páry019/031 a cache038. Žádné nové ID, počet zůstává83.

**Dokončeno a ověřeno:** nativní rozbalovací panel v T/V, rozsah r/sklonů
po vynechání každého dne, počet dostupných/nedostupných výpočtů a zvlášť den
s největší absolutní změnou r a sklonu. Každý uvádí zbývající/vynechané páry;
ukazuje i příklad dne s nedostupným zbytkem. Při přesné shodě novější den.
Nejde o interval spolehlivosti, test významnosti ani označení čidla za chybné.
Minimum3 místní dny; po vynechání≥3páry a nenulový rozptyl obou veličin.

Ve stejném průchodu plných párů vznikají centrované denní souhrny;
prefix/suffix skládání O(n+d) neodečítá téměř shodné surové čtverce.
Do cache jednoho rozsahu jdou jen počty, meze a nejvýše3 příklady dnů;
páry a denní/prefixové souhrny se neuchovávají. Původní plné r/sklon,
nuly, duplicity, pořadí a reprezentanti grafů zachováni. Bez dalších závislostí.

Tlačítka otevřou existující průzkumník celého místního dne v napětí, lze
přepnout na teplotu. Žádný nový fetch, graf nebo odhad epoch. Den může
obsahovat i hodnoty mimo okraj klouzavého rozsahu T/V, UI to vysvětluje.
**METEO-077 zůstává rozpracované:** přímý výpis původních jednotlivých párů
s referencí platnou pro snapshot dokončit společně s existujícím METEO-063.
Prohlédnutí grafu dne se za tento výpis nevydává; není potřeba znovu dělat
hotový denní výpočet. Metadata kalibrace071 a zóna048 stále vlastní úkoly.

**153/153 Node testů**,11 nových; nezávislé opakované přepočty nad originály,
lineární vztahy, jeden vlivný pár i celý posunutý den, konstantní zbytek,
malé N, null/0/duplicity, velký offset, číselný rozsah,250k/jeden průchod/cache,
rozsah/reset a dvojí místní hodina při DST. Chromium se skutečným DOM/Chart.js
ověřilo tři konfigurace s řízeným CSV/UV, přechod dne, nulový/chybějící senzor,
opravu starého CSV, reset a obě témata při320/390px. Žádné page errors ani
přidané požadavky. Screenshot otevřené analýzy prohlédnut.

[Měření před/po a JSON](performance/ETAPA9.md): první T/V otevření při250k
57,2→71,1ms, opakované6,6→6,3ms. Nová funkce má měřitelnou cenu, nejde o
zrychlení. Po30cyklech stále10grafů, žádná historie kopií v nové cache.
Reálný mobil, síť/parser, firmware, broker a živé Pages tím nejsou ověřeny.

**Další etapa:** METEO-063 omezený výpis původních párů vlivného dne,
po stránkách a sestavený až na vyžádání; invalidovat reference při CSV/MQTT,
opravě historie a změně stanice. Poté dokončit návazný detail077.
Nedělat souběžný konkurenční backlog ani znovu rozsáhlý audit.
Uložení na GitHub a deployment evidovat odděleně; produkční main se nemění.

### Uložení a publikace etapy 9

Implementace a důkazy v
[8457fde](https://github.com/Michaltymm/Meteo_webovky/commit/8457fdeb6ca8e6ecfdad22f4ae823c9f43361f9d)
odeslány na codex-dev; vzdálené SHA ověřeno. Publikační
[Actions #17](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39638764748)
pro8457fde **Success**, build14s/deploy10s/celkem34s, jeden Pages artefakt.
Main stále2405c5d. To potvrzuje nasazení workflow, ne přímou kontrolu widgetů.
Zároveň veřejné Actions nově potvrdily předchozí
[#16](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39627880077)
pro1003743/v0.5.0 jako Success44s; dřívější nejistota etapy8 je uzavřena.
Následující commit upravuje pouze dokumentaci, HTML zůstává0.6.0.


## Etapa 10 — původní záznamy vlivných dnů, v0.7.0 (21. 10. 2026)

Po fetch ověřeno čisté `9c017bb` = origin/codex-dev, main stále2405c5d.
Hotová denní citlivost077 z etapy9 zachována, navazuje **METEO-063/077**.
Neprováděl se nový audit83návrhů ani opakování rozsáhlého profilu všech velikostí.

**METEO-077 Dokončeno v plánovaném denním rozsahu:** nativní vnořený výpis
„Původní záznamy vlivného dne“ pro největší změnu r/sklonu a nedostupný zbytek.
Přesně průnik místního dne a původního rozsahu analýzy; celý den je nadále
k dispozici původními tlačítky průzkumníku. Výpis obsahuje všechny původní
řádky tohoto průniku, včetně nepoužitých, po50 na stránce. Časy s UTC offsetem,
nezkrácené T/V, důvod použití/vyloučení, pořadí od nejnovějšího v této historii,
počty plného/zbylého výpočtu, vzorce a verze. Pořadí není backendové ID.

**METEO-063 Rozpracováno:** tato etapa dokončila původ T/V vynechaného dne.
Maxima, hodinové průměry a další odvozené metriky ještě nemají obecný proklik
na vstupy. Žádný další METEO ID;077 nyní DONE,063 má konkrétní dílčí důkaz.

Líné sestavení: bez otevření žádné čtení zdrojových řádků pro výpis. Sdílená
binární `historyRangeBounds` vrací jen meze, neposouvá explorer cache a nekopíruje
historii. Otevření O(log n+p), další stránka O(p), p≤50; souhrny nejsou z tabulky.
Výpis drží pouze referenci na aktuální snapshot, identitu analýzy, stanici,
rozsah a meze/stránku. Při CSV/MQTT, opravě/deleci, změně stanice/rozsahu nebo
zavření se zahodí a odstraní řádky DOM. Změna identity/délky zdroje má také
kontrolu při stránkování. Původní nuly/duplicity/sestupné pořadí zachovány,
HTML z dat escapováno. Neurčuje kalibraci071, SOC ani meteorologickou kauzalitu.

**165/165 Node testů**,12nových: shoda výpisu s originály včetně null/0/duplicit,
celé a krajní stránky, nezměněné statistiky, inkluzivní7d mez a vynechaný řádek
na hranici,250k s<100čteními při otevření a50další stránkou, zdroj/rozsah/stanice/
CSV/MQTT/reset/close invalidace, nedostupný zbytek, chybějící/konstantní V,
XSS a obě opakované místní02:30 při25h dni s odlišnými UTC offsety.
Browser se skutečným DOM/Chart a třemi původními konfiguracemi ověřil otevření
Enterem, stránkování, výběr dnů, missing i0V po opravě starého CSV, zneplatnění
rozsahu/resetu, horizontální tabulku a obě témata320/390px. Žádný page error,
fetch nebo nová Chart instance kvůli výpisu; screenshot prohlédnut.

[Měření a surové JSON](performance/ETAPA10.md): cílené1k/250k před/po,
sekvenční profily; výpis~1,5ms a další stránka~0,6ms v obou velikostech,
bez tvrzení zrychlení původní analýzy. Původní velké profily etapy9 zachovány.
Skutečná síť/parser, fyzický mobil, HW/firmware/broker a přímé widgety Pages
nejsou tímto ověřeny; nasazení dokládat samostatně.

**Další vhodná etapa:** METEO-063 rozšířit dohledání podkladů na hodinové
průměry Porovnání dnů (původní T/RH, počty a důvody vyloučení, obě DST hodiny),
se stejným omezením DOM a platností reference. Hotový077 znovu neanalyzovat.

### Uložení a publikace etapy 10

Kód/testy/dokumentace a důkazy v
[d1e42e3](https://github.com/Michaltymm/Meteo_webovky/commit/d1e42e3f9edb47cf39375b7a893c93a003498509)
odeslány na codex-dev, vzdálené SHA ověřeno. Publikační
[Actions #18](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39677857017)
pro tento commit **Success**, build17s/deploy10s/celkem36s, jeden artefakt.
Main stále2405c5d. Workflow deployment není přímá kontrola živých widgetů.
Následující commit doplňuje pouze tuto paměť, HTML zůstává0.7.0 a testy se
kvůli dokumentaci neopakují. Hotový denní077 dál pouze udržovat; navázat063.


## Etapa 11 — podklady hodinových průměrů, v0.8.0 (21.–22. 10. 2026)

Navázáno na čistý `26af1c1` na codex-dev. **METEO-063 má dokončenou dílčí
etapu hodinových průměrů**, širší rodokmen maxim a odvozených hodnot je dál
rozpracovaný. Hotové077/078 zachovány; žádný opakovaný audit ani nové ID.

Porovnání dnů umí otevřít podklady konkrétního bodu grafu nebo vybraného
místního dne/hodiny/veličiny. T/RH/tlak mají nezávislou validitu. Tabulka
ukazuje všechny původní záznamy hodiny po50, i missing, nuly a duplicity,
s nezaokrouhlenými hodnotami, časem a UTC offsetem, důvody vynechání,
přesným součtem/počtem/podílem a zaokrouhleným výsledkem grafu. Uvedený
vzorec/verze, částečná historie i nevážený aritmetický charakter průměru.
Prázdná hodina nemá vymyšlené měření. Pořadí platí pouze v aktuální historii;
backendové ID/revize a explicitní zóna zdroje zůstávají samostatnou závislostí.

`hourlyDay` používá stejný úplný průchod a stabilní pořadí sčítání, navíc
si pamatuje pouze numerické souvislé indexové úseky jednotlivých hodin.
Nespoléhá na pevný60min UTC interval: opakovaná hodina se stejným průměrem
může mít více úseků a odlišné offsety. LRU stále8dnů, tabulka O(s+p), p≤50.
Výpis nemá kopii historie ani pole všech indexů. Změna dat/stanice/výběru
porovnání ho zavře a vyčistí; stránkování kontroluje aktuální snapshot.
Žádné další síťové požadavky nebo grafy.

**180/180 Node testů**,15nových. Původní hodinové výsledky dál shodné
s úplným stabilním výpočtem, T/RH/P nezávislé,0/null/duplicity, přesné
stránky, prázdné hodiny,250k omezená čtení, LRU, CSV/MQTT/reset/oprava/
stanice/výběr, XSS a proklik grafu. DST Praha, půlhodinový Lord Howe a
Troll s dvouhodinovým rollbackem a oddělenými úseky stejné hodiny.

Browser skutečné tři konfigurace + řízené CSV/UV/Chart ověřil původní
měření i součty, klávesnici, stránky, volby, skutečný bod grafu a CSV opravu.
Obě témata320/390px, bez celostránkového přetečení nebo page errors;
vodorovný posun tabulky klávesnicí, screenshot prohlédnut.
[Měření a důkazy](performance/ETAPA11.md): cíleně1k/250k před/po,
250k první porovnání23,3→25,0ms, opakované4,7→5,3ms; malá režie nové
funkce, nikoli tvrzení zrychlení. Hustý250k výpis1,4ms/stránka0,6ms.
Živé služby/fyzický mobil/firmware/broker ani přímé widgety Pages neověřeny.

**Další vhodná etapa:** v rámci063 dohledání původních teplotních extrémů,
nejprve malé samostatné řešení se shodami, nulami a invalidací. Explicitní
časový kontrakt048 a metadata071 nepředstírat. Nasazení dokládat samostatně.


### Uložení etapy 11 a oprava testovacího času

Funkce/testy/dokumentace uloženy v
[5d0a427](https://github.com/Michaltymm/Meteo_webovky/commit/5d0a4279a7c7adfc65db99955f80a8a2fa811547)
na codex-dev. Publikační [Actions #19](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39733500427)
skončily **Failure** ve fázi testů (build16s/celkem20s), bez artefaktu/deploymentu.
Místní opakování po změně skutečného data na22.10. našlo179/180: test návratu
přes půlnoc měl `visibleDay` ze skutečného dne inicializace skriptu, ale mock
Date se instaloval až potom a posunul se z21. na22.10. Stejná chyba testu
reprodukována nad výchozím HTML26af1c1; nejde o novou regresi webu.
Fixture nyní po instalaci svého času synchronizuje počáteční `visibleDay`.
Produkční HTML/verze se kvůli opravě testu nemění; browser ani výkon znovu
neměřit, dokud se nezmění produkt. Nový výsledek testů/nasazení doplnit níže.

Po opravě fixture22.10. opět **180/180 testů prošlo**,0fail/skip,7,64s.

### Úspěšná publikace etapy 11

Oprava testovacího času v
[566e12c](https://github.com/Michaltymm/Meteo_webovky/commit/566e12cbfdce00db7e02e30ccd059b0a524c61d5)
odeslána na codex-dev; [Actions #20](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39733762145)
**Success**, build22s/deploy10s/celkem42s, jeden Pages artefakt. Funkce
v HTML stále ze5d0a427, verze0.8.0; main stále2405c5d.
Následující commit pouze zaznamenává výsledek; nové testy či verze kvůli
dokumentaci nejsou potřeba. Workflow potvrzuje deployment, přímé widgety
vývojového webu z tohoto prostředí nebyly ověřeny.


## Etapa 12 — původní globální teplotní extrémy, v0.9.0 (22. 10. 2026)

Čistý `08e531a` na codex-dev, main stále2405c5d. **METEO-063 má hotovou
dílčí etapu globálních teplotních extrémů** ve společné kartě Statistika.
Širší původ ročních/denních a dalších odvozených výsledků zůstává
rozpracovaný. Hotové077/078/hodinové podklady zachovány, žádné nové ID.

Nejvyšší/nejnižší teplota mají nativní tlačítko do details se zdrojovým
řádkem, přesnou T/RH/P/V, časem a UTC offsetem, pořadím v aktuální historii,
počty validních/vynechaných T i přesných shod, verzí a pravidlem výběru.
Shody se posuzují před zaokrouhlením; stále první v sestupné historii,
při stejném timestampu původní pořadí. Celý rozsah načtených řádků se
neskrývá: quick je částečný, full celá dostupná načtená historie, nikoli
ověřený rekord stanice nebo rok vybraný v jiné záložce. Chybějící doprovodné
senzory zůstávají „–“ a výběr T neovlivňují. Nuly/duplicity zachovány.

V původní agregaci jen5číselných polí pro počet, indexy a shody; žádný
seznam všech shod nebo kopie dat. Nad hotovou cache otevření O(1)/max3čtení
i při250k stejných teplotách, DOM1řádek. Stav má platnost snapshotu, stanice,
volby a fullLoaded; při obnově/CSV/MQTT/opravených datech/resetu/stanici se
vyčistí a zavře. Původní statistiky a identity minRow/maxRow se nemění,
žádný extra request/graf/závislost. Pořadí není backendové ID a kalibrace071
ani explicitní časový kontrakt048 nejsou nově ověřeny.

**193/193 Node testů**,13nových: úplné hodnoty/počty/shody/indexy, stejně
zaokrouhlené různé T, min=max0, invalid/missing senzory, quick/full,250k
omezená čtení, všechny životní cykly, XSS, nezávislost ostatních filtrů
a dva stejné místní časy s odlišným offsetem. Browser se skutečnými třemi
konfiguracemi a řízeným CSV/UV/startem/parserem ověřil quick400→full1000,
nezávislou referenci výsledků,0T/allmissingT, klávesnici/volby a CSV opravu.
Obě témata320/390px, horizontální posun, bez celostránkového overflow,
extra HTTP/Chart/pageerrors; screenshot prohlédnut.

[Měření a důkazy](performance/ETAPA12.md): sekvenční cílené1k/250k před/po,
250k cold refresh48,4→45,7ms, opakovaný21,0→21,2ms, bez tvrzení optimalizace.
Podklady maxima0,5ms a minima0,3ms. Živé služby/HW/firmware/broker,
fyzický mobil a přímé Pages widgety neověřeny; nasazení doložit samostatně.

**Další vhodná malá etapa:** v rámci063 původní vstupy odvozených Td/AH/VPD
s přesnými podmínkami platnosti a aktuální referencí. Roční/denní extrémy
zůstávají dalším dílčím pokračováním, žádné globální DONE celého063.


### Uložení a publikace etapy 12

[d16acdb](https://github.com/Michaltymm/Meteo_webovky/commit/d16acdb4b093d2fa8f4c18824bb8f4817919900a)
odeslán na codex-dev; [Actions #21](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39735320314)
**Success**, build19s/deploy14s/celkem42s, jeden artefakt. Main stále2405c5d.
Následující dokumentační commit pouze zaznamenává výsledek, verze0.9.0
se nemění a testy se neopakují. Přímá kontrola živých Pages widgetů z tohoto
prostředí neproběhla. Další063 etapa: vstupy odvozených Td/AH/VPD.


## Etapa 13 — Analytické grafy, v0.10.0 (22. 10. 2026)

Výchozí `df1beb5`, práce výhradně na codex-dev; main stále2405c5d. Realizováno
nové explicitní zadání uživatele, které má přednost před dřívějším dalším
krokem063. Zachované hotové funkce i původních83ID, žádný duplicitní návrh.

**Dokončený rozsah tohoto zadání:** nová záložka s devíti analytickými kartami,
3/2/1 sloupec dle šířky, skutečné názvy stanic, období24h/7/30/90/365d/all
a vlastní datum, refresh, společný nebo samostatný časový výřez, časový kurzor,
zoom/pan/reset, dotyk/klávesnice, nativní legendy, rozšíření/Escape a PNG.
Karty: T s denními extrémy, RH/Td/T, P, srážkový čítač, T/V, mV/h+Vmin/max,
XY T/V s popisnou regresí/r a odhadem den/noc, porovnání T tří stanic,
stránkovaná hodinová heatmapa T/RH s detailní buňkou.

**Konkrétní dílčí stavy:**004/007/019/020/025/028/029/030/032/034/036/037
jsou rozpracované s výše uvedeným důkazem; širší obecné nápady zůstávají.
030 nemá libovolný X/Y selector,025 nemá historické srovnání RH/V,034 zatím
neukazuje ověřené srážky nebo dostupnost,037 nerozšířilo starší grafy.
021/024/048/049/057/071 nepovažovat za vyřešené. Podklady063 zůstávají
z předchozích etap, nejsou kvůli nové záložce odstraňovány.

[Technický a uživatelský popis](ANALYTICKE_GRAFY.md) uvádí vstupy, vzorce,
metadata a přesné meze. Srážková karta záměrně diagnostikuje původní čítač
a maximum přírůstku záznamu: bez resetu a schématu017/049 nelze slibovat
hodinové/denní úhrny. Růst V nemá automatický štítek potvrzeného nabíjení,
nevypočítává SOC/proud/energii. Časový kontrakt je stále zóna prohlížeče;
nejednoznačné CSV bez offsetu nelze zpětně rekonstruovat. Regrese je popisná.

Aktivní historie používá stejný store, parser, relaci a ensureFullData;
přepnutí stanic nepoužívá skryté přepínání pro získání cizích dat.
`parseHistoryCSV` je extrakce původního parseru bez globálního commitu.
Cizí konfigurace/exporty se načítají postupně až pro porovnání, bez duplicit,
s abortem při odchodu/změně stanice. T cache po16B/záznam,8MiB/stanice,
16MiB celkem/LRU, viditelné stáří a ruční obnova; chyba obnovy přizná starou
cache. Obecný TTL/dashboard cache návrh004 tím není hotový.

Grafy vznikají podle viewportu a překreslují se jen viditelné. Při odchodu
se osm případných Chart instancí zničí, zruší se observery/requesty a model.
Start pořád8původních grafů. Jeden sdílený model a menší vizualizace, plné
statistiky před redukcí. Heatmapa14pozorovaných dnů/stránka, bez tisíců DOM
buněk. Nejbližší monotónní one-to-one párování do10min uvádí počty a odchylky,
bez interpolace a bez slibu globálního optimálního přiřazení.

**226/226 Node testů**,33nových: parser/rozsahy/statistiky/Welford/mV/h/
redukce, čtyři DST zóny, kompaktní cache, životní cyklus a opožděné cizí
odpovědi, A→B→A, změna zdroje, neúspěšná obnova, paměťový limit a250k model.
Párování navíc400náhodných referencí. Browser ověřil všechny3konfigurace,
9grafů, intervaly, úplné počty, osamocený85°C bod v grafu i rozsahu XY osy,
missing/0V, PNG, skutečnou legendu, zoom/pan/reset/rozšíření/Escape,
heatmapu, dotyk, odchod během requestu a obnovu s chybou. Obě témata
1440/800/390/320px bez přetečení,0pageerrors, screenshot prohlédnut.

[ETAPA13 a surové JSON](performance/ETAPA13.md): před/po1k/10k/100k/250k,
sekvenčně,5vzorků/medián. Hlavní250k refresh24,8→22,0ms (nikoli příslib
zrychlení); úplných9karet při250k poprvé393,7ms, opakovaně21,6ms.
CPU×4/100k: všechny karty984,1/120,8ms. První velký O(n) model dál umí
blokovat hlavní vlákno; další vhodná výkonová etapa je dělená příprava nebo
změřený worker008. Při zavření i po10návštěvách opět8grafů, bez růstu uzlů.
HTML+62087B; žádná nová produkční knihovna. Není měřen fyzický iPhone,
Web Vitals, reálné služby/firmware/HW nebo přímé widgety Pages.

**Další doporučení:** rozdělit přípravu opravdu velkých modelů dle profilu008,
poté konfigurovatelná tolerance a RH/V porovnání025/029, obecný X/Y030.
Skutečné úhrny či energetiku řešit až po potvrzení metadata017/049/057/071.
Neopakovat hotové analýzy063/077/078 bez nového důvodu.


### Uložení a publikace etapy 13

[da16a8d](https://github.com/Michaltymm/Meteo_webovky/commit/da16a8d5381d4ef0712154dda0838af82cd24924)
odeslán na codex-dev; [Actions #22](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39742818313)
**Success**, build22s/deploy20s/celkem50s, jeden Pages artefakt. Main stále2405c5d.
Následující commit pouze ukládá ověřený stav nasazení, nemění HTML0.10.0
ani neopakuje testy. Přímá kontrola widgetů živého webu z tohoto prostředí
neproběhla; lokální browser výsledky a hranice měření jsou v ETAPA13.


## Etapa 14 — Samostatná stránka analytických grafů, v0.11.0 (22. 10. 2026)

Na výslovnou úpravu zadání uživatele pokračuje METEO-030: devět hotových grafů
má vlastní hlavní obsah a horní přepínač **Hlavní přehled / Analytické grafy**.
Analytika je přesunutá z dolních záložek mimo karty hlavního dashboardu.
Původní přehled se všemi staršími záložkami zůstává zachovaný; po návratu
se obnoví naposledy vybraná záložka. Širší METEO-030 zůstává Rozpracováno,
žádné nové ID ani duplicitní backlog nevzniká.

**Dokončeno:** dvě samostatná zobrazení, přímé `#analytika`/`#prehled`,
Zpět/Vpřed a otevření v nové kartě, horní navigace s označením aktivní stránky,
dotyk a klávesnice. Analytika neobsahuje původní aktuální karty ani lišty
Slunce/Měsíc/přehled stanic. Hlavička, nastavení, datový store a načítání jsou
sdílené. Přepnutí nad již načtenou historií nemá další datový požadavek.
Po odchodu se analytické Chart instance zničí; obnovování dat nebo pozdní
callback starší záložky nevykresluje skryté grafy přehledu. Nová stanice
nedostává grafy předchozí stanice ani předčasný požadavek se starou konfigurací.

**Ověření:** původních226 Node testů a4nové regresní testy navigace prošly.
Reálný Chromium/Chart.js s původními3konfiguracemi a řízeným CSV/UV ověřil
oba hlavní obsahy, návrat na Denní statistiky, Zpět/Vpřed, přímé otevření
analytiky na dotykovém mobilu, devět grafů a jejich dosavadní interakce,
3/2/1 sloupce,1440/800/390/320px, obě témata bez vodorovného přetečení,
opakované návraty bez nárůstu Chart instancí a žádnou chybu JS.
Rozložení a životní cyklus se změnily; matematika, původní data a konfigurace
ne. Kompletní výkonové profily etapy13 se bez nové optimalizace neopakují.
Podrobnosti: [Analytické grafy](ANALYTICKE_GRAFY.md).

Další krok zůstává METEO-008: rozdělit první přípravu velkého analytického
modelu podle měření etapy13. Následují nastavitelné veličiny/tolerance025/029/030;
časový kontrakt048 a srážkový kontrakt017/049 nadále otevřené.

Publikace etapy14: [ef23a26](https://github.com/Michaltymm/Meteo_webovky/commit/ef23a266ddac00ee5f4b16bd3b8b8edc3b9100dd),
[Actions #23](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39745845016)
**Success** (build17s/deploy12s,37s celkem). Nasazení potvrzené workflow,
přímá kontrola živých widgetů neprovedena. Main zachován2405c5d.


## Etapa 15 — Nenápadné popisky grafů, v0.11.1 (22. 10. 2026)

Dílčí úprava METEO-030 podle požadavku uživatele: všech devět karet má
výchozí zavřené **Podrobnosti grafu** s nativní šipkou `details/summary`.
Uvnitř jsou původní popisy a celé aktualizované poznámky/statistické podklady,
včetně diagnostiky porovnání stanic. Obsah se nezkracuje ani neodstraňuje.
Ovládání je oddělené v Možnostech grafu; legendy, osy, prázdné stavy a detail
buňky heatmapy jsou mimo rozbalovací text. Bez nového JavaScriptu, závislostí,
požadavků nebo změn výpočtu. Kliknutí, dotyk a Enter/mezerník obsluhuje prohlížeč;
řádek šipky má dotykový cíl44px a zvýraznění fokusu.

Širší METEO-030 i METEO-010 zůstávají Rozpracováno, nevzniká nové ID. Další
vývojový krok zůstává008 podle dřívějšího měření; tato vzhledová úprava
neopakuje výkonové profily ani netvrdí nové zrychlení výpočtů.

Ověřeno:230/230 Node testů a skutečný Chromium/Chart.js všech tří konfigurací
s řízenými daty. Devět zavřených panelů, zachovaný obsah a fungující kliknutí,
Enter/mezerník i dotyk; rozbalení bez requestů nebo nové Chart instance.
Původní interakce grafů, prázdná data a navigace prošly.1440/800/390/320px
v obou tématech bez přetečení a0pageerrors, screenshoty zkontrolované.

Nasazeno: [666b487](https://github.com/Michaltymm/Meteo_webovky/commit/666b4871aaa2ddfff7d0002d8eaffd0962cd534b),
[Actions #24](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39747969927)
**Success**,33s. Potvrzen deployment workflow; main stále2405c5d.

## Bezpečnostní série 2026-10-22

Sekvenční audit a důkazy: [SECURITY_ROADMAP.md](SECURITY_ROADMAP.md). METEO-054 má v0.11.2 ověřenou validaci a session fallback (7 nových regresí); širší návrh diffu/verzování konfigurace zůstává otevřený. Produkční konfigurace beze změny.

Bezpečnostní dávka B (v0.11.3): METEO-047/050 získávají odmítnutí neúměrných vstupů před změnou dat; kvalita/flagy a deduplikace zůstávají samostatným plánem. METEO-008: parser1k–250k změřen před/po, viz performance/SECURITY.md. MQTT limity nenahrazují ACL brokeru.

Závěrečná bezpečnostní kontrola navíc uzavřela SEC-007 v historickém HTML cílenou opravou textového výstupu. Nepřidává nové METEO ID ani neřeší FUT-002 rozhodnutí o dlouhodobém účelu archivu.

Bezpečnostní série uzavřena v dostupném rozsahu:5potvrzených nálezů/5oprav,246/246Node regresí, browser analytika+SRI+historické tabulky prošly. Actions#25 pro c19e246 **Success**, main2405c5d bezezměny. Další bezpečnostní kroky a omezení jsou vSECURITY_AUDIT.md; další běh nemá opakovat hotové etapy.

## Moderní přehled — 2026-10-22, v0.12.0

Dílčí realizace METEO-011: nový design je třetí stránkou horní navigace (`#moderni`), původní přehled i analytika dostupné dál. Sdílený DOM/store/grafy, samostatné CSS pouze pro moderní stránku, obě témata a vlastní výběr všech3stanic. Přepnutí zachovává dolní záložku a historii bez fetchů či nových grafů. Výběr karet/per-station preference zůstávají otevřené.

Důkaz:251/251Node testů,5nových navigačních regresí; skutečný Chromium v8kombinacích1440/800/390/320px a2témat,3stanice,Back/Forward,URL,empty/nulové hodnoty, návrat zanalytiky. Původní analytický browser harness také prošel. Bez pageerror/overflow. [Rozsah a reprodukce](MODERNI_PREHLED.md).

Publikování ověřeno: [Actions #26](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39832057768) pro [acfa3ba](https://github.com/Michaltymm/Meteo_webovky/commit/acfa3ba) **Success** (build24s/deploy9s/celkem42s), jeden Pages artefakt. Vývojové HTML v0.12.0, main zůstává2405c5d7326909a24c41e7066bfdc4a9d1622208. Přímý živý Pages host není v síťové politice prostředí povolen, potvrzení nasazení vychází z workflow. Následný commit mění pouze dokumentaci.


## Sjednocení nápovědy — 2026-10-22, v0.13.0

Dílčí UI etapa METEO-010/011/012/030/063 podle zadání: ⓘ u teplotních extrémů, vlhkostních metrik, analytických grafů a dalších vysvětlujících sekcí. Text není trvale rozbalený; myš otevře při najetí a zavře po odjetí, dotyk přepíná, klávesnice má fokus/Enter/Tab/Escape. Interaktivní tabulky, stránkování a výběry zůstávají skutečným DOM, přesouvá se pouze obsah do jednoho panelu v body. Tím se nevytvářejí duplicitní ID a panel není oříznut kartou. Datové/statistické výpočty, původní hodnoty a nabídky skutečných akcí grafů zůstávají zachované.

Ověření: 251/251 Node regresí; `scripts/check-info-browser.cjs` v Chromium 153 se skutečnými SRI-matching Chart.js/Paho a řízeným CSV/UV. Ověřeno minimum/maximum a návrat obsahu, hover přechod na panel, odjetí, klávesnice/fokus, dotykové otevření/druhé klepnutí/mimo, 1440/390/320px, obě témata a oba přehledy, živé poznámky analytiky, dynamické srážkové ikony, programové otevření podkladů z grafu a invalidace při změně dat/stanice. Nápověda nevyvolá fetch ani konstrukci Chart; 0 pageerror. Desktop i mobilní screenshoty prohlédnuty. Ověření běželo s aktivními bezpečnostními kontrolami knihoven a prohlížeče.

Fyzický Safari/iPhone a živé meteorologické zdroje nejsou tímto testem ověřeny. Širší přístupnost, personalizace karet, další odvozené veličiny a původ dalších výpočtů zůstávají původními otevřenými úkoly. Nasazení se dokládá samostatně výsledkem Pages workflow.
