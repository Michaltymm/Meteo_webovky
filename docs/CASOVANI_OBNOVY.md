# Doba obnovy dat — METEO-050, v0.17.0

Časování navazuje na CSV diagnostiku v0.16.1. V témže panelu ⓘ u načtené
historie jsou orientační časy **poslední dokončené obnovy aktivní stanice**,
její výsledek, rozsah exportu a počty měřených pokusů/bloků. Podrobné vysvětlení
je sbalené pod „Co časy zahrnují“. Měření nic dalšího nestahuje.

Výsledek „Obnova selhala“ popisuje závěr existujícího loaderu; sám neurčuje
příčinu chyby ani nepotvrzuje poruchu čidla nebo serveru.

| Údaj | Měřená hranice | Omezení výkladu |
| --- | --- | --- |
| Celá obnova | Vytvoření nového fetchSheets požadavku → dokončení loadSheets | Obsahuje i yield před parserem, retry a ostatní obsluhu; není součtem jen tří uvedených složek |
| Přenos CSV | stationText od fetch přes kontrolu odpovědi po přečtení celého obsahu | Součet všech úspěšných i neúspěšných pokusů, včetně fallback proxy; není čistou latencí serveru |
| Rozbor CSV | Lexer, validace, čítače a řazení; synchronní parseHistoryCSV nebo součet lexikálních dávek a parseHistoryRows | Součet práce všech pokusů, včetně odmítnutých CSV; bez čekání na frontu a bez UI |
| Data a přehled | Commit store, invalidace, zveřejnění reportu, refreshUI a případné synchronní full-load callbacky | Zahrnuje úplné statistiky a bezprostřední aktualizace grafů; nezahrnuje pozdější lazy/asynchronní grafy, layout/paint celého snímku ani samostatnou obsluhu stavu |

Data a přehled může mít dva měřené bloky: základní aktualizaci a obsluhu
čekajících ensureFullData callbacků. Jejich pořadí, výjimky a generační ochrana
se nemění. Za přenos se neoznačuje čekání na desetimilisekundový yield parseru.
Celkový čas končí před zveřejněním nového časového reportu, aby se panel neměřil sám.

Od v0.18.6 aktivní Sheets exporty od262144UTF-16jednotek dávkují lexer;
čekání mezi dávkami patří pouze do celé obnovy, nikoli do rozboru. Jeden
export stále znamená jeden parserový pokus i při lexikálním selhání.
Validace/řazení zatím zůstávají synchronní. Rozsah a omezení:
[CSV lexer](performance/CSV_LEXER.md).

Od v0.18.7 se ve stejné velké aktivní Sheets cestě dávkuje také filtrace
a validace/převod řádků. Parse.ms sčítá CPU obou fází bez fronty, jeden
export nadále znamená jeden pokus. Nativní řazení zůstává v parse čase
a je stále souvislé. [Měření a omezení](performance/CSV_VALIDACE.md).

Od v0.18.8 je číselný comparator CSV časů levnější, původní nativní stabilní
sort i hranice časování zůstávají. [Srovnání fází a celého pipeline](performance/CSV_RAZENI.md).

Od v0.18.10 je samostatně změřený také skutečný commit/přehled v prohlížeči.
24h graf používá pro Sheets existující binární meze místo kopie/průchodu celé
historie; všechny body a statistiky zůstávají. MQTT/both nadále vybírá plným
predikátem kvůli možnému posunu hodin. Hranice časování se nemění.
[Profil DOM, agregací a Chart.js](performance/OBNOVA_PREHLEDU.md).

## Výsledky a životní cyklus

- Časování je samostatné vůči poslednímu rozboru CSV i poslednímu úspěchu
  transportu. Neúspěšná obnova dostane vlastní výsledek/časy; původní měření
  a timestamp úspěchu se jí nemění.
- U nezměněného ověřeného CSV zůstává původní parser report. Nová obnova
  ukáže svůj aktuální přenos, nulový počet běhů parseru/přehledu a „Neproběhlo“.
  Nenahrazuje tyto údaje starou cenou parseru, jaká platila při prvním načtení.
- Při retry se sčítají všechny pokusy. Přechod quick → full patří do stejné
  obnovy, rozsah bude označen jako celý export. Pokud dřívější pokus parsoval
  vadný obsah a finální odpověď byla nezměněná, i neúspěšná práce zůstává zahrnuta.
- Sdílený in-flight požadavek má jediné měření. Požadavek na plnou historii,
  který čeká na quick load a poté jej rozšíří, založí samostatnou další obnovu;
  čekání na předchozí sdílený požadavek se jí nepřipisuje.
- Za běhu zůstane k dispozici předchozí dokončený report s označením, že
  probíhá další načítání. Snapshot se publikuje až ve finally pro aktuální
  stationContext. Reset jej vyčistí a stará generace jej nemůže přepsat.
- UV, overview, analytické parsování cizí stanice a MQTT do tohoto časování
  nevstupují. Pure MQTT má nadále vlastní vysvětlení dostupnosti CSV historie.

Používá se monotónní `performance.now`; kalendářní Date.now slouží pouze pro
čas dokončení v prohlížeči. Posun hodin proto nezkreslí délky. Chybějící,
neplatný či regredující časovač znamená „Měření nedostupné“, ne vymyšlenou
nulu; data se dál načítají. Naměřená nula je přípustná při omezené přesnosti
časovače. Pozadí, plánování procesoru, režim prohlížeče a rozlišení časovače
ovlivňují výsledky, nejde o SLA ani srovnání výkonu samotných stanic.

## Data, cena a ověření

`dataStatus.sheets.timing` drží jediný snapshot: scope, completedAt, outcome,
unchanged, totalMs a transfer/parse/ui s runs/ms. Žádná URL, Sheet ID, obsah,
poznámka nebo zpráva výjimky. Report se neposílá na server ani do storage;
nejde o kruhový log nebo diagnostický export METEO-064. Časovač se čte pouze
na hranicích existující práce, bez dalších průchodů historií, fetch, timerů
či Chart instancí. [Měření před/po](performance/CASOVANI_OBNOVY.md).

`tests/sheets-timing.test.js`: 12 deterministických regresí se samostatným
monotónním a kalendářním časem: načtení těla, retry/fallback, parse/UI/yield,
cache, chyby a obnova, full callbacky, sdílení, reset/stará generace, nedostupné
hodiny, jiné zdroje a bezpečný tvar reportu. Celá sada **296/296**.

Rozšířený `scripts/check-data-status-browser.py` používá původní tři konfigurace,
řízené CSV/UV a skutečné SRI knihovny. Vložené 60ms čekání v testovací trase
ověřuje měření přenosu, oddělení parseru/UI, chybu a obnovení, nulové náklady
neprovedených kroků a sbalené vysvětlení. Panel projde 24 kombinacemi tří
pohledů, dvou témat a 320/390/800/1440 px bez pageerror. Živé služby,
broker, fyzický Safari/iOS a úplné vykreslení snímku tím ověřeny nejsou.

Ve v0.18.0 navazují dokončené [čítače MQTT](MQTT_DIAGNOSTIKA.md). METEO-050
je hotové v rozsahu tohoto provozního panelu; log/export zůstává METEO-064.
Dlouhé synchronní parsování legitimní velké historie zůstává METEO-008.
