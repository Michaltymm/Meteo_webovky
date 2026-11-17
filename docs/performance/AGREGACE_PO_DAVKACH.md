# METEO-008: přesné agregace po dávkách, v0.20.3

Navazuje na checkpoint244dd42 (v0.20.2). Společný dataAggregateSteps zachovává
původní jediný průchod, pořadí sčítání, počty, první vítězné reference/indexy,
počty shod, mapy dnů/měsíců/let, null/0 a původní rozsah dne. Statistiky stále
používají úplné validní řádky; žádný vstup z vizuálně redukovaných bodů.

Při načítání aktivního Sheets exportu s timingem a více než10000řádky se
soukromá statistika připraví před zveřejněním dat. Generátor předá řízení každých
256řádků a256dnů v závěrečném rainMax průchodu; existující analyticsWorkSlice
omezuje dávku přibližně na8ms/64kroků. Jediný navazující timer, žádný polling,
fetch, závislost nebo kopie zdrojových řádků navíc. DataAggregateSteps neposkytuje
částečnou cache. Nová data i dokončená cache se zveřejní atomicky po invalidaci.

AbortSignal/identita relace se kontrolují před/po každé dávce i před commitem.
Změna stanice zruší timer/generátor, chyba zachová poslední kompletní data.
Uživatel během výpočtu může dále používat předchozí data a měnit pohledy.
Rozdílný localDateKey při dokončení úmyslně cache nepublikuje; původní synchronní
miss znovu určí dnešek. Malý export, cizí zdroje, MQTT/both a přímé dataAggregates
ponechávají synchronní API. Cache invalidace pro následné mutace zůstává původní.

Diagnostika pod nápovědou historie rozlišuje „Příprava statistik“: CPU čas dávek
bez fronty, počet pokusů; bez validního performance.now je čas nedostupný.
parse/ui hodnoty zůstávají původními fázemi, celý čas obnovy zahrnuje i fronty.
Žádný vymyšlený čas nebo záměna CPU a celkového trvání.

## Izolované měření

Skutečný Chromium, Europe/Prague,1warmup+3běhy, postupně před/po, stejné řádky
300s od sebe s null/0 a původními Date. Úplné SHA snapshotů včetně všech map,
statistik a vítězných řádků shodné. Zdrojové reference ověřeny regresními testy.
Raw: `agregace-davky.json`. Reprodukce `scripts/benchmark-aggregate-slices-browser.py`.

| Řádků | Nejdelší část před → po ms | Celá příprava před → po ms |
|---|---:|---:|
| 1000 | 0,3 → 0,5 | 0,3 → 0,5 |
| 10000 | 0,5 → 0,7 | 0,5 → 0,8 |
| 100000 | 5,6 → 1,4 | 5,6 → 30,1 |
| 250000 | 6,8 → 1,9 | 6,8 → 86,6 |

Mediány. Malé cesty zůstaly synchronní a vykazují drobnou variabilitu. Přínos
je kratší souvislá práce; příprava velkých dat trvá déle kvůli frontám.
Nejde o INP/Web Vitals, síť, paměť nebo fyzický telefon a8ms není pevná garance.

## Testy a další krok

`tests/aggregate-cooperative.test.js`:8scénářů soukromého snapshotu, přesných
součtů/referencí/shod, atomického commitu, abortu, změny stanice, chyby, lokální
půlnoci, malých/MQTT/both cest a časování opakovaných pokusů. Zachovány původní
nezávislé oracles v shared-aggregates i regrese ostatních funkcí.

Celé METEO-008 stále rozpracované. Další nezměněné synchronní úseky zahrnují
nativní CSV sort, přímé cache miss při MQTT/ručních API/midnight, odvozené
hourly/annual agregace a render DOM/Chart. Pokračovat podle profilu konkrétní
interakce; nevracet se k dokončeným parserům/výběru24h/minmax/dávkování.

## Celá obnova a skutečný browser

440/440 Node prošlo. Původní IO/Chart.js browser harness prošel se všemi3původními
konfiguracemi/12k řádky, navigací,320–1440px, oběma tématy, mezerami a touch
tooltipy. Bez pageerror či nových socketů. Čtyři existující pohledy zachované.

Rozšířený profil skutečného CSV fetch/parser/commitu + dokončení dávkovaného grafu:
4regular scénáře1k/10k/100k/250k,1warmup+3běhy postupně před/po. Úplné SHA všech
řádků/statistik/reportu/DOM/grafu/původních měření shodné ve všech4párech.
Stejný počet requestů a Chart instancí. Žádný live provoz nebo fyzický Safari.
Raw: `agregace-refresh-before.json`, `agregace-refresh-after.json`.

| Řádků | Synchronní UI před → po ms | Dokončení obnovy před → po ms |
|---|---:|---:|
| 1000 | 11,0 → 9,6 | 42,0 → 36,5 |
| 10000 | 14,0 → 11,5 | 103,8 → 87,8 |
| 100000 | 15,9 → 2,5 | 779,1 → 724,1 |
| 250000 | 29,4 → 3,7 | 1730,0 → 1971,7 |

Mediány. Velký commit používá hotový snapshot (dataAggregates cachehit0–0,1ms).
Příprava není zadarmo: CPU této fáze250k v jednotlivých bězích22,7/16,9/10,5ms,
a navíc fronty; celková obnova250k je pomalejší. Netvrdíme celkové zrychlení.
Izolovaná tabulka výše měří jiný kontext s již existujícími objekty, takže její
časy nelze zaměňovat s celým CSV pipeline. Hlavní přínos je kratší synchronní
commit při zachování všech hodnot. Pro velikosti≤10k se chování výpočtu nemění.
