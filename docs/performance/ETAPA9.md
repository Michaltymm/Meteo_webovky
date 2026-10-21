# Etapa 9 — denní citlivost T/V, v0.6.0

21. 10. 2026, výchozí `21e0f3f` / v0.5.0. Jedna navazující denní etapa
**METEO-077**; původní r/sklon, data a grafické reprezentanty zachovává.
Přímý výpis jednotlivých párů s revizí zdroje zbývá s METEO-063;
průzkumník dne se za tento výpis nevydává. Centrální roadmapa zachovává077
jako rozpracované, nepřidává další ID ani znovu neanalyzuje hotovou078.

## Výpočet a omezení

Páry jsou pouze konečné T/V ze stejného řádku, v aktuálním7/30/all rozsahu
končícím nejnovějším měřením. Duplicity ani skutečné nuly se neodstraňují.
Ve stejném průchodu jako plné statistiky vznikají centrované Welford souhrny
po místních dnech. Spojení dvou skupin A,B používá:

`w = nA · nB / (nA+nB)`

`M2 = M2A + M2B + (meanB−meanA)² · w`

`C = CA + CB + (meanTB−meanTA) · (meanVB−meanVA) · w`

Prefix/suffix skládání vytvoří výsledek bez každého dne v O(n+d), bez
odečítání téměř stejných surových čtverců a bez d opakovaných skenů historie.
Dočasně O(d) souhrnů, bez dalších kopií původních řádků. Nová cachovaná
citlivost obsahuje jen počty, rozsahy a nejvýše3 příklady dnů; O(1) nad
existujícím cachovaným výsledkem jednoho rozsahu. Při invalidaci dat se zahodí.

Minimum3 místní dny s páry; po každém vynechání≥3 páry, nenulový rozptyl
obou veličin a konečné číselné výsledky. Plný nedostupný vztah není základem
pro měření vlivu. Nedostupné zbytky se započítají a zobrazí, nevstupují do
rozsahu platných výsledků. Samostatné pořadí podle |Δr| a |Δsklonu|, při
přesné shodě novější den. Zaokrouhlení až v UI. Nejde o interval spolehlivosti,
p-value, identifikaci vadného senzoru nebo vliv T na baterii; bez SOC/energie.

Nativní details ukazuje podklady a omezení. Tlačítka nastaví den existujícího
průzkumníku a napětí, lze přepnout T. Bez fetch a nového grafu. Otevírá se
celý místní den, případně i data mimo okraj analytického rozsahu; UI to uvádí.
Časový kontrakt prohlížeče zůstává METEO-048. Synteticky posunutý den není
důkaz změny kalibrace; skutečné epochy METEO-071 nejsou známé.

## Měření před/po

Existující `profile-history.py --analysis`, offline skutečný Chromium
154.0.8037.57 / Chart.js4.4.0,390×844,Europe/Prague,CPU×1.
1k/10k/100k/250k syntetických5minutových původních řádků s vloženým extrémem,
pět vzorků v každé čerstvé stránce; mediány bez vyřazování prvního.
Běhy před a po **postupně**, bez souběžného browseru či Node testů.
Měřen synchronní JS+Chart update, nikoli pozdější paint/Web Vitals/síť/parser.
Panel při časování zavřený, výpočet již probíhá při otevření T/V záložky.

| Párů | První T/V před → po (ms) | Opakované T/V před → po (ms) |
| ---: | ---: | ---: |
| 1 000 | 8,7 → 8,9 | 5,6 → 4,7 |
| 10 000 | 11,7 → 14,9 | 7,9 → 7,0 |
| 100 000 | 38,9 → 37,3 | 6,6 → 5,8 |
| 250 000 | 57,2 → 71,1 | 6,6 → 6,3 |

[Před](stage9/before-21e0f3f.json), [po](stage9/after.json).
První volání invaliduje i sdílený aggregate snapshot, pak vykreslí T/V.
Nová analytika má při250k měřitelnou cenu+13,9ms; **nejde o optimalizaci**.
Ostatní rozdíly oběma směry nejsou důkazem plošného zrychlení. Při250k je
synchronní práce stále delší než50ms; neprezentovat jako zaručenou plynulost
slabého telefonu. Další krok výkonu by měl měřit skutečný slabý mobil a
rozlišit agregace/výpočet/Chart, teprve pak zvažovat rozdělení práce.
Worker či knihovna se nepřidávají na základě jediného lokálního měření.

Opakovaný T/V build zaznamenal0 změn childList/characterData, pozorovatel
**nesleduje atributy**. Nový panel má stálé DOM prvky, nepřidává řádek pro každý
den ani nový Chart. Při250k po zahřátí heap59 979 784B (57,20MiB), po30cyklech
60 261 648B (57,47MiB),10grafů v obou; DOM2121→2122uzlů. Proti předchozí verzi
teplý heap+57 324B (~56KiB); nejde o celou RAM ani důkaz vícedenní stability.
HTML bez komprese+7392B. Node Proxy test potvrdil jediný průchod zdroje pro
analýzu po připraveném aggregate snapshotu a žádný při opakování cache.
Výsledek nové citlivosti má i při250k serializaci<1500B; neuchovává d souhrnů.

## Ověření

**153/153 Node testů**,11 nových v `tests/battery-sensitivity.test.js`:
nezávislý dvouprůchodový přepočet nad každým vynecháním, lineární±, jediná
vlivná dvojice/celý posunutý den, konstantní zbytek/nedostatek párů, méně než3
dny/nedostupný plný vztah, null/0/duplicity, velké offsety,250k/jeden průchod/
malá cache,7d/reset stanice, přesné shody/číselný rozsah, opakovaná hodina
Europe/Prague s místním seskupením. Žádný časový limit v CI.

[Browser integrační výstup](stage9/browser.json): skutečný DOM/Chart.js a tři
původní konfigurace, řízené zpožděné quick/full CSV, UV fixture, MQTT CDN
zablokován. T/V924párů/r≈1; bez V0párů;0V platné/konstantní r nedostupné.
Denní stavy, otevření dne do napětí a přepnutí T, žádné nové requesty/grafy,
oprava starého CSV a reset. Vložený vlivný den je správně označen; bez něj
konstantní zbytek výslovně nedostupný. Nativní panel a obě témata320/390px
bez ustáleného overflow, žádné page errors. Otevřený panel screenshotem
prohlédnut. Zachovány původní scénáře AH/VPD,078, animací i skrytého full load.

Při tvorbě rozšířeného testu opraveny dvě testovací předpoklady: změna
stanice má vlastní konfigurační request (analytika ho nepřidává), přímá mutace
fixture musí po invalidaci výslovně vykreslit aktivní panel. Nešlo o doložené
chyby aplikace; uvedené finální výsledky jsou po opravě scénářů.

Konfigurace, workflow, server, archiv a produkční main se nemění.
Živé služby/broker, skutečné HW/firmware/epochy, fyzický mobil a přímé Pages
widgety nejsou ověřeny. Úspěšný místní test ani push není deployment.

```bash
git show 21e0f3f:index.html > /tmp/meteo-before.html
python scripts/profile-history.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --analysis --counts 1000,10000,100000,250000 --output /tmp/before.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --analysis --counts 1000,10000,100000,250000 --output /tmp/after.json
node --test tests/*.test.js
python scripts/check-analytics-browser.py --chartjs /tmp/meteo-chart.js --output /tmp/browser.json
```

Dev nástroje a lokální Chart.js podle [README](README.md); časované běhy vždy
postupně. Další logická etapa METEO-063/077: omezený výpis originálních párů,
líně sestavený a platný jen pro aktuální datový snapshot.
