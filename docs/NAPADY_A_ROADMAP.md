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
| A/B datum a čas | České datum, někdy bez roku; lokální JS Date, ne spolehlivý UTC kontrakt. AUD-010 stále otevřeno. |
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
| METEO-004 Cache historie podle stanice/zdroje: omezená LRU + TTL, čerstvost viditelná, návrat bez čekání | Současné CSV, čas validace | S / P0 | Méně opakovaných přenosů; omezený nárůst RAM | METEO-002, kontrakt invalidace níže | Připraveno k realizaci |
| METEO-005 Pozastavení periodických refreshů v neaktivní kartě, po návratu jedna obnova dle stáří | Současná data / visibility | N / P0 | Ve skrytí bez periodických Sheets/UV/overview; návrat dle stáří bez nového MQTT klienta | Ověřeno v0.2.2, detaily etapa4 | Dokončeno |
| METEO-006 Spolehlivá inkrementální historie a menší overview odpověď | Backend revize, změny/smazání a ověřené typy GViz | V / P0 | Zásadně menší CSV; zachovat opravy historie | FUT-005/010, METEO-049 | K posouzení |
| METEO-007 Lazy konstrukce grafů a uvolnění dlouho nepoužívaných instancí | Současná UI | S / P1 | Méně startovní RAM/JS, možná prodleva prvního otevření | METEO-001, měření startu | Připraveno k realizaci |
| METEO-008 Worker pro parsing/agregace, případně IndexedDB | Současná historie | V / P2 | Méně blokování UI, cena kopírování/persistence | Benchmark skutečných CSV, METEO-004 | K posouzení |

## 2. Uživatelské rozhraní a responzivita

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-009 Stav a stáří: rozlišit poslední měření, poslední sync, chybu zdroje a neúplnou historii | Timestampy / stav transportu | S / P1 | Malý DOM update, bez dalších fetchů | METEO-048 | Připraveno k realizaci |
| METEO-010 Klávesnice a mobil: ARIA taby, fokus dialogů, dotykové cíle, kontrast v obou tématech | Současná UI | S / P1 | Zanedbatelný; bez efektů | IMP-006 | Připraveno k realizaci |
| METEO-011 Kompaktní dashboard a výběr karet, per-station preference | Současné metriky / localStorage | S / P2 | Méně DOM při menším počtu karet | METEO-054 validace storage | Nápad |
| METEO-012 Jednotné formátování, jednotky a zdroj odvozených hodnot | Současná data / metadata | N / P1 | Malý, cache formatterů | METEO-048 | Připraveno k realizaci |

## 3. Meteorologické metriky

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-013 Absolutní vlhkost, VPD, rozdíl T−Td: obsah páry a podmínky kondenzace | Současná T + RH ve stejném řádku | N / P1 | O(n), odvozené hodnoty na vyžádání | Testované jednotky/vzorce, RH 0–100 | Připraveno k realizaci |
| METEO-014 Teplotní amplituda, trendy 1/3/6/24 h a rychlost °C/h | Současná T + skutečné Δt | S / P1 | Agregace O(n), cache po revizi | METEO-048, mezery v měření | Připraveno k realizaci |
| METEO-015 Mrazové/letní/tropické dny a hodiny pod nulou | Současná historie T | S / P2 | O(n), malé denní agregace | METEO-038,048; interpolace jen přes malé mezery | Nápad |
| METEO-016 Tlakové trendy hPa/h, 3/6/24 h, rekordní vzestupy/poklesy | Současný tlak | S / P1 | O(n), bez nového fetch | Ověřit absolutní/redukovaný tlak, METEO-048 | Připraveno k realizaci |
| METEO-017 Úhrny, intenzita, srážkové a suché dny | Rain/rainInc + potvrzený reset a interval | S / P1 | Denní cache, bez nového senzoru pokud kontrakt postačí | FUT-007; METEO-049 | K posouzení |
| METEO-018 Heat index v platném oboru; wind chill až s větrem | T/RH nyní; vítr nový HW | N / P2 | Nízký výpočet | Dokumentovaný obor vzorce; mimo něj nezobrazovat | K posouzení |

## 4. Baterie, napájení a energetická analytika

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-019 Teplota × napětí: společný časový graf, XY a korelace | Současná T/V se společným timestampem | S / P1 | Výpočty O(n), nejvýše 800 vizuálních bodů | METEO-031; návrh modulu níže | Připraveno k realizaci |
| METEO-020 Noční pokles / denní nárůst mV/h, min/max napětí | Současná V + čas / poloha | S / P1 | Denní agregace O(n) | METEO-048, dostatečné pokrytí; bez odhadu kapacity | Připraveno k realizaci |
| METEO-021 Zimní/letní režim a pravděpodobné nabíjecí cykly | Současná V/T; potvrzení solárního napájení | S / P2 | O(n), počítat až v modulu | METEO-019/020; prahy kalibrovat podle zapojení | K posouzení |
| METEO-022 Nízké napětí a neobvyklý pokles s hysterezí | V, chemie baterie, mezní napětí od uživatele | S / P1 | Inkrementální vyhodnocení | METEO-044, chybějící údaje nezastupovat odhadem | K posouzení |
| METEO-023 Dlouhodobé stárnutí a energetická bilance | Proud, teplota článku, cykly a kalibrace: HW/firmware | V / P3 | Dlouhodobé agregace | METEO-057; samotné V nestačí | Nápad |
| METEO-024 Přesné SOC/kapacita pouze z napětí | Jen V | — / P3 | Žádná implementace | Chybí chemie, zatížení, proud, kalibrace | Zamítnuto |

## 5. Porovnávání meteostanic

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-025 Tři stanice v jednom grafu T/RH/V; přehled rozdílů | Současné exporty, různé senzory/intervaly | V / P1 | Až 3 historie; lazy fetch, omezená cache | METEO-004/029/048; návrh níže | Připraveno k realizaci |
| METEO-026 Srovnání denních minim/maxim a počtu měření | Současná data všech stanic | S / P1 | Sdílené denní agregace | METEO-025/038 | Nápad |
| METEO-027 Dostupnost, typický interval a nejdelší výpadek | Timestampy + očekávaný měřicí plán | S / P1 | O(n), malý výsledný souhrn | METEO-045; interval fetch není interval senzoru | K posouzení |
| METEO-028 Teplotní rozdíl lokalit po párování, kalibrační bias | T, umístění/kalibrace stanic | S / P2 | O(n+m) po seřazení | METEO-025/029; lokalita není senzorová chyba | Nápad |

## 6. Analýza závislostí mezi veličinami

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-029 Časové párování a tolerance: uvést spárované/odmítnuté vzorky | Timestampy dvou řad | S / P1 | Dva ukazatele O(n+m), bez kartézského součinu | METEO-048, policy níže | Připraveno k realizaci |
| METEO-030 Záložka Analýza a závislosti: výběr X/Y, společný graf, scatter, r | Současné páry T/RH/P/V + odvozené veličiny | S / P1 | Lazy výpočet, vizualizace oddělená od statistik | METEO-019/029/031 | Připraveno k realizaci |
| METEO-031 Pearson/regrese a počet validních párů z úplných dat | Současná párovaná data | S / P1 | O(n); stabilní součty, nulový rozptyl → nedostupné | Dokumentace korelace ≠ příčina | Připraveno k realizaci |
| METEO-032 Časový posun, klouzavé průměry, oddělení den/noc a sezón | Současná historie | V / P2 | Výpočet jen zvolených lagů; cache, žádné n² | METEO-029/048; nepravidelné intervaly | Nápad |

## 7. Grafy a vizualizace

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-033 Min/max redukce pro průzkumník, plné statistiky a zoom | Současná historie | S / P0 | Max 800 pozorovaných bodů; bez animace; zachová extrémy každé veličiny | AUD-013 / Opus P07 | Dokončeno |
| METEO-034 Kalendářní a hodinová heatmapa T/RH/srážek/pokrytí | Současné denní/hodinové agregace | S / P2 | Malá mřížka, lazy render | METEO-038/048, srážky METEO-017 | Nápad |
| METEO-035 Histogram a teplotní profil hodiny/dne/měsíce | Současná historie | S / P2 | O(n) agregace, desítky sloupců | METEO-038; volba časového vážení | Nápad |
| METEO-036 Skutečná časová osa, mezery a tooltip původního vzorku | Současné timestampy | S / P1 | Lineární timestamp osa bez nové date knihovny | METEO-033/048; nyní category osa | Připraveno k realizaci |
| METEO-037 Fullscreen a PNG export grafu | Aktuální vykreslený graf | N / P2 | Export jen na kliknutí | METEO-010; popisek rozsahu/stanice | Nápad |

## 8. Historická data a statistiky

| ID / název a přínos | Data | N / P | Dopad na výkon | Závislosti | Stav |
| --- | --- | --- | --- | --- | --- |
| METEO-038 Sdílené hodinové/denní/měsíční agregace s pokrytím | Úplná validní historie | S / P1 | v0.2.2 společné hlavní/dnešní souhrny a denní/měsíční T/RH; hodiny/pokrytí zbývají | Invalidace dat a místního dne, METEO-048; průměry vzorkové | Rozpracováno |
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
| METEO-054 Validace konfigurace a odolný storage wrapper; lokální zámek jasně popsat | Config/localStorage | S / P1 | Malý, zabrání chybám startu | IMP-004/005; UI heslo není autentizace | Připraveno k realizaci |
| METEO-055 Závislosti a testovatelné moduly: CDN integrita, malé čisté funkce, Pages allowlist | Zdrojový kód | S / P2 | Méně duplikací; nový build není podmínkou | IMP-007/008; ověřit file: a Pages | K posouzení |
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
Připraveno k realizaci. Dnešní řádky stačí pro přehled původu, trvalé odkazy na
opravené řádky potřebují ID/revizi backendu. Vztah METEO-047/050: ty evidují
kvalitu a počty; toto je dohledatelná cesta konkrétního výsledku.
**Řešení / výkon:** výsledek nese descriptor výpočtu a indexy/timestampy zdrojů,
detaily se sestaví až po otevření. Bez kopií celé historie a bez HTML z poznámek.
**Omezení:** timestamp nemusí být unikátní; index je platný jen pro danou revizi.
Rozlišit měření/výpočet/odhad. **Test:** shodná maxima, duplicity času, změněný
starý záznam, null vstup rosného bodu, XSS fixture, neplatná reference po refreshi.

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
