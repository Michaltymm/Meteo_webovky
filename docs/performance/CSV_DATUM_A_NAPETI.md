# Převod opakovaných dat a napětí v CSV

METEO-008, v0.21.24. Základ měření je v0.21.23 z `f915631`.

Parser historie během jednoho průchodu uchovává rozpoznaný zápis data
z posledního řádku. Čas, odvozený rok a kalendářní platnost ověřuje
samostatně u každého měření. Ověření zahrnuje neexistující okamžiky
při jarním posunu času. Očištění napětí použije stejná pravidla jednou
na řádek. Původní buňka je nadále podkladem pro rozlišení prázdných
a neplatných hodnot v diagnostice.

## Měření

Offline Chromium 154, 390 × 844 px, CPU ×4, Europe/Prague a původní
konfigurace stanice Sheets. Skript `scripts/benchmark-refresh-browser.py`
porovnává v0.21.23 a v0.21.24 nad stejnými 250 000 měřeními v sekundových
a pětiminutových intervalech. CSV přijde z lokální náhrady transportu.
Po jednom zahřátí následují tři měřené obnovy pro každý scénář a verzi.
Graf má při obnově pozici mimo viewport a jeho výsledná data se kontrolují
zvlášť. Součet práce parseru zahrnuje čtení polí, převod, validaci a řazení.
Celá obnova zahrnuje i lokální přenos a čekání mezi dávkami.

| Historie | Interval | Práce parseru (ms) | Celá obnova (ms) |
| ---: | --- | ---: | ---: |
| 250 000 | 5 minut | 3 600 → 3 224 | 6 932 → 6 214 |
| 250 000 | 1 sekunda | 3 311 → 2 899 | 6 393 → 5 520 |

V obou scénářích se shodovaly podpisy úplných záznamů, validační
diagnostiky, statistik a dat grafu včetně původních měření použitých
jako reference. Časy jsou mediány z offline simulace a neobsahují
latenci živých Sheets.

## Ověření

Prošlo 507/507 testů Node.js. Regrese ověřují opakované textové datum
u různých časů na přelomu roku, neplatný čas, české formáty napětí,
nulu a rozlišení prázdných a neplatných buněk. Stávající sada prošla
včetně hranic místního dne a letního času ve třech časových pásmech.
Dvě offline kontroly Chromium ověřily výměnu velkého CSV, rušení
načítání a Moderní přehled 2 se třemi původními konfiguracemi.
