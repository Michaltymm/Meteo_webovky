# METEO-008: stabilní CSV sort po dávkách, v0.20.4

Výchozí c6d4ad4/v0.20.3. Neopakuje hotovou analýzu parseru. Navazuje na potvrzený
synchronní nativní sort z CSV_RAZENI.md, který zůstával velkým nepřerušovaným krokem.

## Rozsah a správnost

Pouze aktivní velký Sheets job (timing, text≥262144UTF16 jednotek, validních
řádků>10000) požádá parseHistoryRowSteps o cooperativeSort. Synchronní/cizí/
MQTT/both parser nadále používá původní nativní stabilní číselný comparator.
Malé exporty ponechávají původní cestu. Nemění se filtrace/validace/datum/zóny,
limity, počet requestů, statistiky nebo grafy. Žádná závislost/worker ani nový timer
nad rámec existujícího runCSVStepsAsync scheduleru.

stableHistorySortSteps nejprve po1024kontrolách ověří, zda je vstup sestupný.
Běžné seřazené/all-equal CSV vrátí přímo bez merge bufferu. Jinak bottom-up merge
po1024výstupech předá řízení existujícímu analyticsWorkSlice (~8ms/max64kroků).
Shoda timestampu dává přednost levému řádku. Původní objekty a Date/sekundy/poznámky
zachované, duplicity se neodstraňují. Jedno pomocné referenční pole O(n), ping-pong
mezi ním a soukromým parsed polem, O(n log n) průchodů; žádné kopie objektů/Date
nebo další per-row metadata. Nelze tvrdit úsporu RAM. Alokace pole je synchronní.

Celé řazení zůstává soukromé. report.complete se nastaví teprve po dokončení;
CSV job guard/abort pokrývá i merge kroky a hotový výsledek před commitem.
Stanice/reset/změna zdroje zastaví timer i generátor. Chyba nedovolí zveřejnit
částečně seřazené pole. Publikování a přesná agregace z v0.20.3 zůstávají původní.

## Ověření

446/446 Node,6nových scénářů v csv-merge-cooperative:100deterministických historií
s nezávislým native oracle a identitou frozen řádků,250kshuffled/duplicity,
descending/equal fastpath, prázdná/single/opakované identity, abort i chyba během
sortu. Starý csv-sort oracle a všechny dosavadní regrese zachované.

Skutečný Chromium/SRI/3konfigurace/12k unordered CSV/320–1440px prošel v
check-csv-cooperative-browser.py: shodné note-páry, přesné původní grafové hodnoty,
V/0/null, privátní reporty, přepínání, zrušení lexeru/validace i nově samotného
sortu přes UI. Bez pageerror/socketů. Fyzický Safari/iOS/živé služby neověřeny.

## Izolovaný Chromium profil

benchmark-csv-merge-browser.py, postupně před/po,1warmup+3vzorky. Časy již platných
Date zůstávají stejné. Descending/equal/unordered ×1k/10k/100k/250k, všechny12páry
úplné SHA pořadí shodné; každý běh navíc porovnává identitu všech řádků s native
stable sort. Raw: csv-merge-browser.json. Měří pouze sort již hotových objektů.

| Řádků / distribuce | Nejdelší část před → po ms | Celý sort před → po ms |
|---|---:|---:|
| 100k descending | 2,5 → 0,5 | 2,5 → 0,7 |
| 250k descending | 5,8 → 0,4 | 5,8 → 13,7 |
| 100k equal | 1,2 → 0,3 | 1,2 → 0,4 |
| 250k equal | 3,2 → 0,4 | 3,2 → 13,8 |
| 100k unordered | 20,9 → 2,0 | 20,9 → 136,8 |
| 250k unordered | 92,8 → 6,4 | 92,8 → 507,6 |

Mediány, malé synchronní scénáře0–1,6ms vykazují variabilitu. Dávky prodlužují
celý čas kvůli frontám;8ms není pevná garance. Nelze tvrdit Web Vitals/INP/RAM
ani obecné zrychlení nebo naměřenou odezvu na fyzickém telefonu.

## Celý CSV pipeline v Node VM

benchmark-sheets-timing.cjs --shuffled,1warmup+5vzorků, Node24.19.0, skutečný
fetchSheets/parser/scheduler/commit, nahrazená síť/UI. 0/10ms fronta obsloužená
ručně, proto nejde o dobu reálného prohlížeče. Monitorované bloky zahrnují volání
parseru i analyticsWorkSlice včetně agregací. Úplné SHA všech řádků+reportu
(normalizován pouze checkedAt) shodné ve všech4párech. Zachované měřené vzorky:
csv-merge-pipeline-before.json a csv-merge-pipeline-after.json; objemný trace
jednotlivých volání zůstává lokálně /workspace/validation/csv-merge.

| Řádků | Nejdelší sledované volání před → po ms | Celý cyklus před → po ms |
|---|---:|---:|
| 1000 | 10,50 → 12,98 | 11,10 → 13,58 |
| 10000 | 9,92 → 10,12 | 98,93 → 97,44 |
| 100000 | 53,81 → 10,36 | 967,76 → 1053,03 |
| 250000 | 140,39 → 13,01 | 2416,52 → 2745,86 |

Celková obnova velkých dat je pomalejší; přínosem jsou kratší souvislé kroky.
Heap vzorky z benchmarku závisejí na GC, neslouží k tvrzení o RAM úspoře.

## Pokračování

Dílčí checkpoint hotový, celé METEO-008 Rozpracováno. Dále profilovat konkrétní
interakce se synchronními cache miss: roční/hodinové statistiky a přehled teplot,
případně dlouhý MQTT stream/přechod dne. Další zásah až podle změřeného úseku;
neopakovat hotový lexer/validaci/sort/24h výběr/minmax/přípravu agregací.
