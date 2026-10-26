# Číselné porovnávání CSV časů — v0.18.8

2026-10-26, další malá část METEO-008. Výchozí `db085ab` (HTML v0.18.7),
výsledná implementace v commitu tohoto dokumentu. Navazuje na samostatně
změřený nativní sort v CSV_VALIDACE; lexer a validace se znovu neimplementují.

## Změna a přesnost

Sdílený CSV převod ověřuje, že přijaté `ts` jsou platné Date. Nativní stabilní
sort nově používá `b.ts.getTime()-a.ts.getTime()` namísto `b.ts-a.ts`.
Odpadá implicitní převod Date na primitive při každém porovnání. Číselná
hodnota je stejný původní počet milisekund; neprovádí se zaokrouhlení,
změna zóny nebo výpočet odvozených časů. Shodné časy vracejí nulu a zachovají
původní pořadí. Původní záznamy/Date se používají přímo, žádné pomocné pole,
časový sloupec, cache nebo změna datového schématu.

Platí pro sdílený řádkový parser aktivní i cizí CSV historie včetně
synchronních cest. Nemění se scheduler, jeho prahy, MQTT, validace,
limity, reporty, generační guardy nebo konfigurace stanic. Nativní algoritmus
se nemění a nadále běží synchronně. Nevzniká worker ani další závislost,
request nebo nový sort systém. Očekávaná algoritmická cena se nezměnila;
zlevnil se jednotlivý comparator.

## Měření

`scripts/benchmark-sheets-timing.cjs`, Node24.19.0, projektová VM spouští
skutečné fetchSheets, parser, řazení a commit. Síť/refreshUI jsou náhrady,
0/10ms fronta se obsluhuje ručně. Oba benchmarky používají stejný wrapper
nativního sortu, stejné časy a měřicí hodiny. Jedno zahřátí, pět vzorků,
reset/GC před vzorkem, mediány ms. Všechny profily před/po sekvenčně,
bez souběžného browseru nebo testů.

`equal`: původní fixture se shodnými časy, T podle indexu, třetina bezV.
`unordered`: čas i*7919 mod86400, po86400záznamech opakování. Tyto distribuce
nelze zaměňovat; různý počet porovnání mění podíl ceny sortu.

| Řádků | Časy | Samotný sort před → po | Nejdelší sledované volání před → po | Celý pipeline před → po |
| ---: | --- | ---: | ---: | ---: |
| 1 000 | equal | 0,22 → 0,16 | 12,65 → 13,53 | 13,35 → 14,29 |
| 10 000 | equal | 3,23 → 1,93 | 10,60 → 11,29 | 113,11 → 115,20 |
| 100 000 | equal | 16,87 → 5,29 | 20,11 → 13,87 | 873,54 → 896,06 |
| 250 000 | equal | 35,69 → 9,92 | 41,39 → 16,81 | 2183,24 → 2580,78 |
| 100 000 | unordered | 310,05 → 51,67 | 316,77 → 59,28 | 1258,17 → 1057,90 |
| 250 000 | unordered | 1072,50 → 152,93 | 1079,77 → 156,21 | 3797,77 → 2390,63 |

SHA256 všech řádků i celého validačního reportu (pouze checkedAt normalizován)
je před/po přesně shodné ve všech6scénářích. Součty/count nestačí: podpis
zahrnuje i pořadí, jednotlivé senzory, původní časy a poznámky.

Doloženo levnější řazení a menší souvislé volání na velkých neuspořádaných
datech. Obecné zrychlení celé obnovy doloženo není; u equal scénářů je
celý pipeline v tomto měření pomalejší, v250k o397,54ms. Ostatní parserové
fáze se neměnily; jejich režii ani variabilitu nelze z tohoto profilu
vydávat za přínos. Aktuální153ms sort je stále souvislý a není záruka16ms.

Instrumentované volání není celý browser task nebo INP. Síť, skutečný UI
commit, layout/paint, CPU×4, fyzický iPhone a dlouhodobá stabilita se zde
neměřily. Heap po běhu není peak/RSS ani prokázaná úspora RAM. Žádný příslib
rychlejší celkové stránky nebo nižší celkové paměti.

## Ověření a další krok

`tests/csv-sort.test.js`:6nových testů proti původnímu comparatoru. Zachycení
skutečných objektů před řazením, přesná shoda pořadí i identity, zmrazené
řádky/Date, empty/single/1000shod, vzestupné/sestupné časy let1000–9999,
hranice epochy a půlnoci, sekundové rozdíly, neplatné časy před sortem,
100náhodných historií a UTC/EuropePrague/AmericaNewYork včetně DST.
Původní diagnostické i kooperativní testy zachované. Celá sada381/381Node.

Browser harness nově posílá12k neuspořádaných časů v párech s odlišnými
poznámkami. U každé ze3původních konfigurací ověřuje sestupnost a stabilitu
duplicit, vedle původních V/0/null, privátního reportu, rušení během lexeru
i validace, coalescing, navigace a320/1440px. Výsledek a publikování viz audit.

METEO-008 zůstává Rozpracováno. Další checkpoint: profil skutečného
commitu/refreshUI velkého CSV v prohlížeči, protože současný pipeline profil
nahrazuje UI. Oddělit DOM, úplné agregace a Chart aktualizace, zachovat
uložená měření parseru a neopakovat hotovou filtraci/validaci/comparator.
Podle nákladů vybrat další malou úpravu; další dávkování sortu/worker až
po posouzení reálné potřeby a režie, cizí parsery/streaming samostatně.

## Reprodukce

```bash
git show db085ab:index.html > /tmp/meteo-sort-before.html
METEO_TEST_HTML=/tmp/meteo-sort-before.html node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/sort-before.json
node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/sort-after.json
```

Pro unordered oba příkazy s `--shuffled --counts=100000,250000`.
Surové výsledky: [equal před](csv-razeni-before.json), [po](csv-razeni-after.json),
[unordered před](csv-razeni-unordered-before.json), [po](csv-razeni-unordered-after.json).
