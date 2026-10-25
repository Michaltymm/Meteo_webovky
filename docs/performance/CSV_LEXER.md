# Dávkované čtení CSV polí — v0.18.6

2026-10-25, první část práce na velkém CSV v METEO-008. Výchozí `ef75168`
(v0.18.5). Výsledek v commitu tohoto dokumentu. Navazuje na profil
CASOVANI_OBNOVY, bez opakování dokončených grafových optimalizací.

## Rozsah a omezení

Pro skutečné načítání aktivní Sheets stanice (`timing` obnovy, zdroj `sheets`)
a text alespoň262144UTF-16 jednotek se lexikální čtení polí/uvozovek/řádků
provádí po dávkách. Nejde o hranici v bajtech ani počtu měření. Síťový64MiB
limit a všechny původní limity parseru zůstávají. Malé exporty, přímý čistý
parser, přehled ostatních stanic a MQTT/both zachovávají synchronní cestu.
Stream by vyžadoval samostatný konzistentní snapshot.

`parseCSVSteps` je původní stavový automat s kontrolním bodem po8192průchodech
znaky; pokračuje i uprostřed pole/uvozovek/CRLF. `parseCSV` jej synchronně
dokončuje přes existující finishSteps. Async cesta sdílí existující
analyticsWorkSlice (~8ms/max64kroků), další dávka přes setTimeout(0).
Rozpočet je měkký, GC/nativní operace jej mohou překročit.

Zpracované pole je stále původní úplná matice CSV, žádný streaming nebo
redukce měření. `parseHistoryRows` odděluje **nezměněnou následnou** filtraci,
validaci, převod čísel/času, diagnostiku a stabilní sestupné řazení. Tato
část zůstává souvislá a je nadále hlavní překážkou plynulosti velkého exportu.
Není tvrzeno, že celé načítání je plynulé nebo rychlejší.

Přepnutí stanice/zdroje abortuje původní relaci, ihned odstraní timer,
uzavře generátor, odstraní abort listener a dokončí čekající promise bez
výsledku. Guard platí před/po dávce i po await před validací. Odchod mezi
pohledy práci úmyslně neruší: historie je potřeba ve všech pohledech.
Do dokončení a ověření se nemění store, starý validační report, fullLoaded,
CSV cache ani callbacky. Chyba zachová stará měření a publikuje stejný
neúplný report s obecným kódem; žádná částečná data. Tři konfigurace beze změny.

Časování parseru sčítá CPU jednotlivých dávek a původní validaci, vynechává
čekání ve frontě. `parse.runs` stále znamená jeden pokus na export, nikoli
počet dávek; lexikální selhání jej také zvýší právě jednou. Celková obnova
obsahuje i čekání. Bez platného monotónního času je trvání null, práce
postupuje přes konečný počet kroků. Žádný nový request/cache/závislost.

## Měření skutečného pipeline ve VM

`scripts/benchmark-sheets-timing.cjs` rozšířen o ruční obsluhu0ms fronty,
instrumentaci skutečných parserových funkcí a SHA256 všech přijatých řádků
a celého validačního reportu (normalizován pouze checkedAt). Node24.19.0,
stejný hostitelský monotónní čas v obou revizích, řízené odpovědi a UI stub.
Stejná fixture1k/10k/100k/250k jako dříve: skutečné duplicitní časy,
číselné nuly a třetina bezV. Zahřátí, pět vzorků, reset/GC před každým.
Před/po profily postupně, žádný souběžný browser nebo další profil.

| Řádků | Celý pipeline před → po ms | Nejdelší sledované synchronní volání před → po ms | Nejdelší lexikální dávka po ms |
| ---: | ---: | ---: | ---: |
| 1 000 | 11,36 → 13,98 | 10,66 → 13,32 | synchronní cesta |
| 10 000 | 87,02 → 89,72 | 86,16 → 81,80 | 6,92 |
| 100 000 | 785,98 → 829,37 | 784,19 → 772,25 | 7,35 |
| 250 000 | 2039,23 → 2033,67 | 2036,78 → 1878,69 | 8,52 |

Poslední sloupec je medián maxima jednotlivých lexikálních dávek pěti běhů.
Před změnou je synchronním voláním celý parseHistoryCSV; po změně se sledují
jednotlivé workSlice a následný parseHistoryRows. Poslední dávka a validace
mohou následovat v jednom tasku přes Promise microtask, nejde tedy o přesné
měření celého browser tasku, snímku nebo INP. Navazující validace250k stále
zabírá zhruba1,9s; tuto etapu nelze vydávat za odstranění celého zamrzání.
Rozdíly celkového času neprokazují obecné zrychlení, malé rozsahy jsou i
pomalejší. Reálná fronta prohlížeče může celé dokončení prodloužit víc.

SHA celých dat a reportu přesně shodné na všech4objemech. Limity/uvozovky/
multiline a rušení ověřují samostatné testy. Profily jsou s transportem
a UI nahrazenými; žádná skutečná síť, Chart.js rendering, CPU throttling,
fyzický iPhone nebo dlouhodobý provoz. Heap po běhu není peak/RSS ani důkaz
úspory RAM. Velká matice CSV zůstává, paměťová optimalizace se netvrdí.

## Regrese a pokračování

`tests/csv-cooperative.test.js`:10nových testů. Úplná shoda řádků/reportu,
atomický commit, malá/přímá/streaming synchronní cesta, okamžité rušení,
pozdní callback a A→B→A včetně mezery mezi dekódováním a pokračováním,
pozdní syntaxe/limity, Unicode/escaped quotes/CRLF/multiline na8192hranici,
časování bez fronty, chybějící hodiny, jeden sdílený request a callback až
po commitu. Celá sada367/367 Node, včetně původních security/CSV/Pages testů.

Nový skutečný browser harness používá12k exporty a všechny tři původní
konfigurace: stará historie/report při pozastaveném lexeru, sdílení requestu,
přechod do moderního pohledu, přepnutí stanice během práce, dokončení sV/0/null
a320/1440px. Ověření browseru a nasazení jsou zaznamenané v auditu.

**Další checkpoint METEO-008:** převést parseHistoryRows na sdílené kroky
pro filtrování a validaci/převod řádků; zachovat logická čísla odmítnutí,
yearState, počty senzorů a atomický commit. Nativní sort změřit samostatně,
případně řešit až podle podílu ceny. Neopakovat hotový lexikální automat
nebo grafové optimalizace. Celé008 zůstává Rozpracováno.

## Reprodukce

```bash
git show ef75168:index.html > /tmp/meteo-csv-before.html
METEO_TEST_HTML=/tmp/meteo-csv-before.html node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/csv-before.json
node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/csv-after.json
```

Surové profily: [před](csv-lexer-before.json), [po](csv-lexer-after.json).
