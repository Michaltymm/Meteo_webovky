# Rozvoj meteorologického dashboardu

Aktualizováno 20. 10. 2026. Centrální živý backlog pro `codex-dev`.
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
| METEO-005 Pozastavení periodických refreshů v neaktivní kartě, po návratu jedna obnova dle stáří | Současná data / visibility | N / P0 | Méně sítě/CPU na pozadí | Dedup požadavků existuje | Připraveno k realizaci |
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
| METEO-038 Sdílené hodinové/denní/měsíční agregace s pokrytím | Úplná validní historie | S / P1 | Jeden průchod; výsledky dle revize/stanice | METEO-048; odlišit vzorkový a časově vážený průměr | Připraveno k realizaci |
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
| METEO-048 Časový kontrakt: lokální den, UTC, DST, explicitní zóna stanice | Současné A/B + konfigurace; nové UTC vyžaduje backend | S / P1 | Nízký, cache formatteru | AUD-010; test půlnoci, 23/25h dní | Připraveno k realizaci |
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
