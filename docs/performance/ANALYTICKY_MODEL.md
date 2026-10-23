# Dávkovaná příprava analytického modelu — v0.18.1

METEO-008, první dokončená část. Výchozí `fcdcbba` / v0.18.0. Navazuje na
již doložené blokování při prvním otevření velké analýzy z [etapy13](ETAPA13.md),
neopakuje audit parseru ani implementaci diagnostiky METEO-050.

## Rozsah změny

UI pro **Sheets, společný výřez a alespoň 10 000 vybraných řádků** připravuje
jeden sdílený model po dávkách. Kopie odkazů do vzestupného pořadí, úplný
souhrn, hledání mezer, vizuální min/max výběr a XY reprezentanti používají
generátory s kontrolními body po nejvýše 1 024 položkách. Výpočty i pořadí
operací jsou stejné; synchronní API pouze dokončí tytéž generátory bez čekání.
Neexistuje druhá implementace statistiky ani samplingu.

Jedna časová úloha provede kroky do přibližně 8 ms, nejvýše 64 kroků. Potom
`setTimeout(0)` vrátí řízení prohlížeči. Bez použitelného monotónního časovače
platí stále konečný limit kroků. Rozpočet není tvrdá horní mez: výpočet jednoho
kroku, GC a plánování mohou dobu překročit. Nejde o worker, paralelní CPU
výpočet nebo záruku určité snímkové frekvence. Žádné nové závislosti nebo I/O.

Malé rozsahy a nezávislé časové výřezy zůstávají synchronní. Totéž platí pro
`mqtt`/`both`: časté přírůstky by jinak mohly neustále rušit nedokončený model.
Všechny tři dodané stanice používají Sheets. Spolehlivá práce nad průběžně
měněným streamem vyžaduje samostatný kontrakt konzistentního snapshotu.

Jedna aktivní úloha, jedna kopie vybraných odkazů a omezené vizuální struktury;
žádná další cache podle období. Změna období/zoomu/dat/stanice, neplatné datum,
odchod nebo skrytí stránky zruší časovač a uzavře generátor. Starý callback
ověřuje identitu úlohy, relaci stanice, zdroj/délku a časové meze; nikdy
nezveřejní částečný souhrn. Návrat do viditelné analytiky zahájí potřebnou práci.

Při přípravě jsou stará plátna skrytá při zachování jejich plochy, karty
mají vysvětlení a grid `aria-busy`. Staré heatmapové detaily se nepoužijí.
PNG je zakázané do skutečného překreslení dané karty. Chyba přípravy dostane
obecný stav bez obsahu výjimky a nezpůsobuje nekonečné automatické opakování.

## Metodika měření

`scripts/profile-analytics-model.py`, Chromium154.0.8037.57, Europe/Prague,
390×844. Stejná syntetická data 1k/10k/100k/250k: duplicitní čas, null/nuly,
teplotní extrém85°C a původní T/V pár s napětím7V. Jedno zahřátí a pět vzorků,
medián. Před/po běželo sekvenčně, bez souběžných profilů/testů. GC před vzorkem.

Skutečný inline JS a knihovny se SRI, automatický start a překreslení grafů
záměrně vypnuté. **Měří se pouze příprava modelu**, nikoli parser, síť,
Chart/layout/paint, fyzický telefon nebo INP. Callbacky produkčního scheduleru
jsou obalené časovačem; v baseline je jediným blokem synchronní volání.
Celková doba zahrnuje čekání mezi dávkami, CPU je součet měřených bloků.
Čtyřmilisekundový heartbeat slouží jen jako doplňkový indikátor plánování.

Po každém vzorku ověřeno pořadí a identita všech původních řádků, extrémy,
počty a limity vizualizací. SHA-256 nad celým souhrnem, vybranými časovými body
a XY body je přesně shodné před/po u všech objemů i CPU×4, nikoli jen zaokrouhlené
minimum/maximum. Úvodní chybný předpoklad testovacího generátoru opraven:
voltage spike musí mít konečnou teplotu, aby byl skutečným T/V párem.

| Řádků | Nejdelší blok před → po (ms) | Celé dokončení před → po (ms) | Součet bloků před → po (ms) | Počet bloků po |
| --- | --- | --- | --- | --- |
| 1 000 | 5,7 → 6,0 | 5,7 → 6,0 | 5,7 → 6,0 | 1 |
| 10 000 | 39,9 → 9,2 | 39,9 → 29,8 | 39,9 → 29,4 | 5 |
| 100 000 | 182,1 → 9,7 | 182,1 → 286,7 | 182,1 → 188,4 | 31 |
| 250 000 | 389,6 → 10,7 | 389,6 → 685,6 | 389,6 → 422,5 | 71 |

To je výměna menšího blokování za delší celkové čekání. U250k se dokončení
prodloužilo o296ms (~76 %), měřená práce o32,9ms (~8 %); tabulka neprokazuje
rychlejší celou stránku. Nejhorší callback ze všech pěti250k vzorků byl12,4ms
(baseline430,3ms). Medián prvního volání po změně je0,3ms, samotné dokončení
ale trvá výše uvedenou dobu. Malý rozsah zůstává okamžitou synchronní cestou.

CPU×4,100k: nejdelší blok834,4→20,1ms (nejhorší nový23,4ms), celé dokončení
834,4→925,2ms; součet bloků834,4→642,3ms. Rozdíl CPU oběma směry zahrnuje
JIT a variabilitu běhu; není důkaz univerzálního zrychlení. Heartbeat maximum
v mediánu835,8→30,6ms; nejde o uživatelskou interakční metriku.

Heap po GC u250k43 324 124→43 361 896B, u100k18 999 576→19 041 780B.
Malý rozdíl není důkaz úspory nebo nulových úniků. Není změřen peak/RSS,
GPU paměť, vícedenní provoz ani dlouhé přepínání na fyzickém iOS.

## Reprodukce a pokračování

Regrese: **321/321 Node**, z toho13nových v
`tests/analytics-cooperative.test.js`. Deterministické dávky, plné výsledky,
cache/coalescing, rušení/pozdní callbacky, stanice A→B→A, skrytí/návrat,
neplatné vlastní datum, chyba/obnova, nedostupný časovač a ochrana PNG.
Malé/nezávislé a živé zdroje si zachovávají synchronní větev.

`scripts/check-analytics-cooperative-browser.py`: skutečný start/DOM/Chart.js,
původní tři konfigurace a řízené CSV/UV. Lokálně pozastavené hranice callbacků
ověřují stav přípravy a zrušení; vlastní algoritmus a kontroly se nenahrazují.
Následně normální100k dokončení,9grafů,zoom/reset/PNG,0/nullV, čtyři layouty
(1440/320px ×tmavý/světlý), bez pageerror/WebSocketů. To není výkonnostní
profil ani ověření živých externích služeb. Starší grid harness s původními
native info detaily se v této etapě nepoužívá; společné ⓘ ověřuje info harness.

```bash
git show fcdcbba:index.html > /tmp/meteo-model-before.html
python scripts/profile-analytics-model.py --html /tmp/meteo-model-before.html --chartjs /tmp/chart.js --paho /tmp/paho.js --output /tmp/model-before.json
python scripts/profile-analytics-model.py --html index.html --chartjs /tmp/chart.js --paho /tmp/paho.js --output /tmp/model-after.json
```

CPU×4 doplní `--cpu 4 --counts 100000`. Surové výsledky:
[před](model-before.json), [po](model-after.json),
[CPU×4 před](model-before-cpu4.json), [CPU×4 po](model-after-cpu4.json).

Ve v0.18.2 navazuje dokončené [dávkované porovnání stanic](POROVNANI_STANIC.md)
ve stejném rozsahu Sheets/společného výřezu. METEO-008 zůstává rozpracované:
stále synchronní jsou velký CSV parser, vyhlazení/noční analýza, heatmapové
buňky a samotné vykreslení. Další etapa má podle profilu rozdělit zbývající
práci; worker/persistence až s doloženou cenou přenosu a paměti. Zmenšování
dat nesmí nahrazovat plné statistiky.
