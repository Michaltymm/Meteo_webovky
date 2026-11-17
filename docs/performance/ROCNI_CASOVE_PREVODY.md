# METEO-008: profil statistik a roční časová aritmetika, v0.20.5

Výchozí bb0effa/v0.20.4. Další měření cache miss bez opakování parserových auditů.
benchmark-statistics-browser.py spouští skutečný Chromium/Chart/Paho s řízenými
řádky, bez živých služeb. Základní dataAggregates je připravené mimo měřený úsek.
Před každým cold během se maže hourly/annual cache, následuje také warm lookup.
Přehled teplot používá všechna data a pro profil CPU má vypnuté chartOverview.update;
jeho výsledek se kontroluje, ale tabulka nezahrnuje Chart layout/paint ani interakční INP.
1warmup+3měření, postupně před/po, Europe/Prague, CPU bez škrcení.

Regular řádky300s od sebe, dense po3vzorcích na sekundu, T/RH/P null/0 a čítač
s resetovými úseky. Base2026-11-17T12 lokálně. Počet celkových řádků není počet
v konkrétním ročním/dnešním výřezu; regular250k zasahuje více roků. Všechny8páry
úplných SHA hodinového modelu, ročního modelu a grafových dat přehledu jsou shodné.
Raw: statistiky-interakce-before.json/statistiky-interakce-after.json.

## Změna

Profil ukázal cold annualStats250k dense208,5ms. Ve dvou místech se původní Date
odčítaly přes implicitní převod na číslo. Nativní stabilní sort čítače nově používá
comparator `a.ts.getTime()-b.ts.getTime()` s původním vzestupným směrem. Pro okno24h se timestamp pravého bodu načte jednou
a levý se čte přes getTime. Platné původní Date jsou součástí kontraktu store.

Nemění se algoritmus, 24h hranice, shody/tie pořadí, směr, přesné původní hodnoty,
Date vítězného bodu, průměry/součty/statistiky nebo cache. Nevzniká další pole,
metadata, redukce, worker, závislost či síťový požadavek. Čítačový rozdíl je nadále
legacy diagnostika, nikoliv ověřený srážkový úhrn; fyzikální omezení se nezamlčují.

## Naměřené mediány ms

| Historie | Roční cold před → po | Hodinové cold před → po | Přehled CPU před → po |
|---|---:|---:|---:|
| regular1k | 0,6 → 0,4 | 0,6 → 0,6 | 0,6 → 0,6 |
| regular10k | 5,0 → 1,0 | 0,3 → 0,3 | 3,7 → 3,9 |
| regular100k | 40,5 → 4,7 | 0,3 → 0,3 | 36,2 → 33,7 |
| regular250k | 39,7 → 5,4 | 0,4 → 0,2 | 89,9 → 94,2 |
| dense1k | 0,8 → 0,1 | 0,8 → 1,1 | 0,6 → 0,4 |
| dense10k | 7,8 → 1,3 | 2,7 → 2,7 | 2,5 → 2,2 |
| dense100k | 83,7 → 14,0 | 21,9 → 24,7 | 24,0 → 29,8 |
| dense250k | 208,5 → 36,6 | 25,7 → 29,8 | 58,3 → 55,2 |

Warm roční/hodinové lookupy mají převážně0–0,1ms (rozlišení časovače).
Hodinové a overview výpočty se neměnily, jejich variabilita není dokladem zlepšení
nebo regrese způsobené touto změnou. Roční výpočet zůstává synchronní a36,6ms není
16ms garance. Nejde o benchmark sítě, celé CSV obnovy, RAM, fyzického telefonu
ani Web Vitals. Ověřený přínos je levnější konkrétní cold annual výpočet.

## Ověření a checkpoint

448/448 Node.2nové regrese se starým nezávislým full-scan modelem nad100irregular
historiemi a přesnými24h/+1ms hranicemi, nulami/resetem/shodnými časy a identitou
původní vítězné Date. Původní annual-statistics oracle zůstává beze změny.
Skutečný Chromium/SRI/3konfigurace/12k unordered/320–1440px prošel; rozšířený
CSV browser harness otevře roční tab a porovná starou čítačovou aritmetiku i Date
pro každou stanici. Žádné pageerror/sockety; přímé živé služby/Safari neověřeny.

Celé METEO-008 Rozpracováno. Další kandidát: CPU buildTempOverview (~90ms při
regular250k) znovu prochází celou historii a vytváří vals pole pro každý den,
i když existují denní indexové rozsahy. Vybrat malou optimalizaci dle tohoto
profilu; zachovat původní pořadí sum, null/0, tlak, časový filtr včetně okrajového
dne a metriky. Nezaměňovat omezení okna za aproximaci statistik. Hodinové dense
~30ms a roční dense~37ms případné další dávkování až podle návazností.
