# Dávkovaná validace CSV řádků — v0.18.7

2026-10-25, další část METEO-008. Výchozí `b6e84e6` (v0.18.6), výsledek
v commitu tohoto dokumentu. Navazuje na hotový lexer; neopakuje jeho audit
ani předchozí grafové etapy.

## Implementace

`parseHistoryRowSteps` sdílí původní filtraci, validaci a převod řádků.
Synchronní `parseHistoryRows` dokončí stejný generátor. Filtr zachovává
pořadí, původní predikát trim/some a přesnou kompakci logických čísel
záznamů. Kontrolní body jsou po256původních, resp. neprázdných řádcích.
Převod senzorů, pravidla odmítnutí, omezené vzorky, yearState i stabilní
sestupné řazení se nemění. Všechny přijaté hodnoty se zachovají, bez redukce.

Stejný rozsah jako v0.18.6: aktivní Sheets obnova s časováním a textem
od262144UTF-16jednotek. Malé/přímé/cizí parsery a MQTT/both nadále synchronní.
`runCSVStepsAsync` sdílí dosavadní scheduler pro lexer i validaci: stávající
workSlice~8ms/max64kroků, pokračování přes setTimeout(0). Rozpočet je měkký;
bez hodin rozhoduje konečný počet kroků, nikoli čas. Filtr není streaming:
plná CSV matice a pole přijatých měření stále existují.

Report je během filtrování/převodu soukromý, žádné částečné počty nepřepisují
poslední veřejnou diagnostiku. Report/store/cache/fullLoaded/callbacky se
publikují až po úplném výsledku. Abort relace ruší timer/generátor/listener
a dokončí promise bez výsledku v obou fázích. Guard je před/po dávce i po
await před commitem, včetně změny stanice po dokončení validace před jejím
pokračováním. Přepnutí pohledu práci zachová; přepnutí stanice/zdroje ruší.

Parse.ms sčítá CPU obou fází, ne čekání ve frontě. Počet pokusů je stále
jedna na export, i při chybě kterékoliv fáze. Chyba ani nulový počet platných
řádků nepřepíše dosavadní měření. Žádný nový request/cache/závislost nebo
konfigurace. UI se při každé dávce nepřekresluje.

## Měření před/po

`scripts/benchmark-sheets-timing.cjs`, Node24.19.0, skutečné fetchSheets,
parser a commit v projektové VM; transport a refreshUI nahrazeny. Původní
fixture1k/10k/100k/250k má shodné časy, teplotu podle indexu a třetinu bezV.
Zahřátí,5vzorků, reset aGC před každým, mediány ms.0/10ms fronta se ručně
obslouží, není to reálné čekání prohlížeče. Profily před/po i další scénář
běžely sekvenčně bez souběžných testů nebo browseru.

Instrumentují se celé synchronní funkce/workSlice a zvlášť původní nativní
sort (stejný měřicí wrapper v obou revizích). Nejde o přesnou délku browser
tasku: navazující Promise microtask a skutečný commit/grafy mají další cenu.

| Řádků | Celý pipeline před → po | Nejdelší sledované volání před → po | Samotný sort před → po |
| ---: | ---: | ---: | ---: |
| 1 000 | 10,95 → 11,86 | 10,35 → 11,05 | 0,19 → 0,23 |
| 10 000 | 92,19 → 89,74 | 82,96 → 9,91 | 2,38 → 2,26 |
| 100 000 | 807,34 → 870,49 | 750,59 → 23,59 | 14,08 → 16,93 |
| 250 000 | 2073,35 → 2010,67 | 1906,76 → 40,14 | 33,05 → 33,71 |

Další deterministický scénář `--shuffled --counts=100000`: časy i*7919 mod
86400, data nejsou seřazená a po86400se opakují. Celý pipeline1066,56→1023,28ms,
nejdelší volání997,92→242,61ms; samotný sort261,56→238,00ms. Potvrzuje,
že cena řazení není z profilu se shodnými časy obecně odvoditelná.

SHA256 **všech řádků a celého reportu** (jen checkedAt normalizován) přesně
shodné ve všech5scénářích. Součet/count/min/max nestačí; porovnává se i
pořadí duplicit, všechny senzory, poznámky a čítače odmítnutí.

Přínosem jsou menší souvislé úseky, ne doložené obecné zrychlení celého
pipeline.1k i100k je v tomto profilu pomalejší. Reálná fronta může dokončení
dále prodloužit. Nativní sort se **neměnil a zůstává souvislý**:40ms ani243ms
nejsou zárukou16ms/plynulého snímku. Síť, INP, rendering celého webu,
CPU×4 a fyzické iOS se neměřily. Heap po běhu není peak/RSS nebo důkaz
úspory RAM či dlouhodobé stability; paměťová optimalizace se netvrdí.

## Ověření a další krok

8nových testů v `tests/csv-rows-cooperative.test.js`: soukromý průběžný report,
abort během filtrování/převodu a po finálním výsledku před commitem,
logické pozice s blank/multiline/headers, yearState přes256hranici, nulový
výsledek, chyba během převodu, stabilní pořadí po sortu. Předchozích10testů
lexeru aktualizuje jen obsluhu fronty mezi dvěma fázemi, jejich assertions
zachované. Cíleně18/18 a celá sada375/375 Node.

Browser harness je rozšířen o pozastavení a částečné dokončení validace,
ověření starého reportu/store a abort přepnutím stanice v této fázi,
vedle původních3konfigurací/12kexportů/0/nullV/navigace/coalescing/320–1440px.
Výsledek a nasazení se evidují v auditu.

Další checkpoint008: podle naměřeného neuspořádaného scénáře posoudit
náklady převodu Date v nativním comparatoru; nejprve ověřit numerické
porovnání timestampů při zachování stability, přesných časů a původních
záznamů. Vlastní sort/worker až po doložené potřebě. Dokončenou validaci
ani lexer neopakovat. UI commit/agregace, cizí parsery a streaming dále;
celé008 zůstává Rozpracováno.

## Reprodukce

```bash
git show b6e84e6:index.html > /tmp/meteo-rows-before.html
METEO_TEST_HTML=/tmp/meteo-rows-before.html node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/rows-before.json
node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/rows-after.json
```

Pro druhý scénář oba příkazy s `--shuffled --counts=100000`.
Surové profily: [před](csv-validace-before.json), [po](csv-validace-after.json),
[neuspořádané před](csv-validace-unordered-before.json), [po](csv-validace-unordered-after.json).
