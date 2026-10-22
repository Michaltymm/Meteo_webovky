# Bezpečnostní limity parseru — 2026-10-22

Node 24, skutečný parser v projektové VM, stejná fixture před/po; medián tří běhů s GC před během. Baseline ae40f95, výsledek v0.11.3. Paměť je heap po běhu, nikoli peak/RSS; nejde o prohlížeč, síť ani měření telefonu.

| Řádků | Před (ms) | Po (ms) | Heap po před/po (MiB) |
| --- | --- | --- | --- |
| 1000 | 8 | 11 | 6/6 |
| 10000 | 74 | 76 | 18/18 |
| 100000 | 710 | 716 | 74/74 |
| 250000 | 1720 | 1781 | 181/181 |

Všechny původní řádky zachovány včetně duplicit. U250k je medián o61ms (~3,5%) vyšší; měření není důkaz nulové režie ani interaktivní plynulosti. Ochrana omezuje neúměrné vstupy, neřeší blokování hlavního vlákna dlouhým legitimním exportem. Další profilování vMETEO-008.

Reprodukce: `node --expose-gc scripts/benchmark-security-parser.cjs`; pro baseline nastavit `METEO_TEST_HTML` na HTML získané z uvedené revize. Spouštět sekvenčně, ne současně s browser testy.

Limity: stream odpovědi64MiB skutečných bytů, konfigurace64KiB, UV256KiB; CSV300000logickýchřádků (včetně hlaviček),64sloupců,3miliony buněk,16384znaků/pole. Data se při odmítnutí neořezávají a platný store se nepřepíše. Velká historie nad limitem vyžaduje budoucí stránkování/backend; limit není tvrzení, že libovolná kombinace pod limity poběží plynule na mobilu.

MQTT:64KiB/zpráva,20zpráv/s,300000uloženýchřádků. Překročení zastaví příjem bez mazání historie a bez automatického reconnectu; nové připojení ručně. Ochrana prohlížeče nenahrazuje ACL/rate limits brokeru ani zastavení přenosu před Paho dekódováním.
