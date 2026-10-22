# Etapa 13 — Analytické grafy, v0.10.0

22. 10. 2026, výchozí `df1beb5` / v0.9.0. Nová uživatelem zadaná záložka
s devíti kartami navazuje na existující METEO-030 a související ID.
Architektura, fyzikální význam a ovládání: [ANALYTICKE_GRAFY](../ANALYTICKE_GRAFY.md).
Původních 193 testů a hotové funkce předchozích etap jsou zachované.

## Metodika

Skutečný Chromium 154.0.8037.57, Chart.js 4.4.0, 390×844, Europe/Prague.
Pět vzorků a medián bez vyřazení prvního, syntetická historie po pěti
minutách se skutečným extrémem 85 °C. Běhy před/po proběhly sekvenčně,
bez souběžných testů nebo prohlížečů. Stejný generátor a velikosti,
časový počátek relativně k okamžiku jednotlivého běhu.

Základní `--aggregates` měří původní dashboard se zavřenou analytikou.
Cold refresh invaliduje společné souhrny; opakovaný používá cache.
Nové `--grid` následuje **až po základních vzorcích a 30 cyklech**:
nejprve kompaktně připraví dvě cizí teplotní historie, pak synchronně
vykreslí všech devět karet jako záměrný nejhorší případ. Skutečná stránka
vytváří a obnovuje jen karty u viewportu. Cache ostatních stanic obsahuje
stejné timestampy a posunuté teploty, tedy přesně sladěný scénář párování.

Měří se synchronní JS/DOM/Chart update. Nejde o síť, CSV parser, paint,
Web Vitals nebo dobu fyzického dotyku do vykreslení. Deset dalších návštěv
analytiky ověřuje omezené opakované použití, nikoli vícedenní provoz.

## Výsledky CPU×1

| Řádků aktivní historie | Cold dashboard před → po (ms) | Opakovaný dashboard před → po (ms) | První všech 9 karet (ms) | Opakovaně všech 9 karet (ms) |
| ---: | ---: | ---: | ---: | ---: |
| 1 000 | 21,2 → 21,7 | 19,2 → 16,8 | 39,9 | 18,9 |
| 10 000 | 22,5 → 24,4 | 16,9 → 19,3 | 71,6 | 23,6 |
| 100 000 | 42,4 → 33,6 | 18,9 → 18,6 | 202,9 | 26,2 |
| 250 000 | 51,2 → 43,2 | 24,8 → 22,0 | 393,7 | 21,6 |

[Před](stage13/before-df1beb5.json), [po](stage13/after.json).
Rozdíly lokálních vzorků nejsou tvrzením zrychlení původního dashboardu.
Podstatné je zachování osmi startovních grafů, nulové analytické práce
na hlavním dashboardu a opakované použití souhrnů. První úplná velká
analýza má viditelnou cenu O(n); nelze slibovat okamžitý 250k výpočet.

### Pomalejší CPU

Stejný 100k scénář s CDP CPU×4:

| Měření | Před (ms) | Po (ms) |
| --- | ---: | ---: |
| Cold dashboard | 135,2 | 139,6 |
| Opakovaný dashboard | 95,5 | 91,5 |
| První všech 9 karet | — | 984,1 |
| Opakovaně všech 9 karet | — | 120,8 |

[Před CPU×4](stage13/before-cpu4.json), [po CPU×4](stage13/after-cpu4.json).
To není měření fyzického telefonu. Běžné otevření menšího 7denního rozsahu
a vykreslení jen viditelných karet má menší práci; tato tabulka žádné
neprovedené mobilní INP měření nenahrazuje. Příští výkonová etapa může
rozdělit přípravu opravdu velkého modelu nebo odůvodnit worker dle těchto
profilů. Do této verze nová knihovna/worker bez nutnosti nepřibyla.

## Paměť, instance a přenosy

- Start a hlavní dashboard: stále 8 grafů, analytických 0. U 250k warm
  dashboardu JS heap 59 322 008 → 59 318 792 B; rozdíl není paměťová úspora.
- Statická DOM struktura vzrostla z 2414 na 3030 uzlů ve warm 250k scénáři.
  HTML bez komprese +62 087 B. Přibyla vlastní záložka; žádný produkční
  balíček, CDN knihovna, build ani request jen kvůli jejímu otevření bez dat.
- Při všech devíti kartách 16 Chart instancí (8 původních + 8 nových),
  devátý graf je lehký canvas. Po odchodu opět 8, model null, observer
  a požadavky zrušené. Deset návštěv počet instancí ani uzlů nenavyšuje.
- U 250k všech karet po zahřátí: heap 63 044 904 B / 3053 uzlů; po zavření
  61 202 232 B / 3044 uzlů; po deseti návštěvách 60 312 596 B / 3044 uzlů,
  stále 8 grafů. Kompaktní cizí cache 8 000 000 B zůstává úmyslně zachovaná.
  CDP heap není celé RAM, nezahrnuje všechnu nativní/GPU paměť a uvolnění
  nemusí být okamžité. Není to důkaz vícedenní stability.
- Časové reprezentace mají nejvýše 600 bodů včetně vizuálních mezer,
  XY nejvýše 580 skutečných bodů, rychlosti napětí nejvýše 396 bodů.
  Jeden graf může mít více takových řad; číslo není limit celého plátna.
  Statistiky a r/sklon mají stále plný počet původních hodnot/párů.
- Nová cizí historie přidá dva potřebné exporty, postupně a až pro kartu
  porovnání. `ovStores` obsahuje jen poslední hodnotu a historii nenahrazuje.
  Normální další návštěva/změna období sdílí cache, explicitní obnova ji
  aktualizuje. Při chybě zůstane stará cache označená, nikoli jako čerstvá.

## Ověření

**226/226 Node testů**, 33 nových:

- 22 datových: původní parser bez cizích commitů, rok/uvozovky/null/0,
  úplné statistiky a Welford ze stejných řádků, výpočet mV/h se správným
  převodem jednotek a mezerami, denní extrémy, sampling bez ztráty extrémů,
  typed cache po 16 B/platný záznam a čtyři zóny/DST délky dnů.
- Párování kontroluje i dřívější duplicitní skupiny a 400 náhodných
  historií proti nezávislé monotónní referenci. Výpočet je chamtivý
  O(n log m) s lineární přesnou větví, nikoli globální optimum.
- 11 životních cyklů: původní konfigurace cizích stanic a parser, sdílení
  rozpracovaných požadavků, odchod/abort, A→B→A, změna zdroje, chyba,
  čerstvost cache při selhání obnovy, jednotlivý/celkový rozpočet cache,
  zničení grafů, vizuální mezery bez falešných měření a 250k bounded model.

[Browser](stage13/browser.json): originální konfigurace všech tří stanic,
skutečný start/parser, řízené CSV/UV, reálný Chart.js. Quick400→full3000
jen jedním aktivním full požadavkem; všech devět karet, všechny intervaly,
prázdné vlastní období, min/max spike 85 °C i skutečný rozsah osy XY,
chybějící a nulové V, změna stanic, společný i nezávislý výřez, zoom/pan/reset,
nativní legenda, rozšíření/Escape, skutečně stažený PNG, heatmapa/detail,
chyba obnovy se starou cache a opožděná cizí odpověď po odchodu.

Osm kombinací šířek 1440/800/390/320 a dvou témat ověřilo 3/2/1 sloupec
a žádné celostránkové přetečení. Další touch-enabled mobile kontext ověřil
tooltip, dotyk buňky, klávesnici heatmapy a líné vytvoření méně než osmi
analytických Chart instancí. Žádný page error. Screenshot prohlédnut;
pevná hlavička na dlouhém elementovém snímku překrývá část řádku při snímání.

První testovací předpoklady upraveny pro odložené nativní Chart události,
čekání na skutečné dokončení nucené obnovy cache a lenivou aktualizaci
právě viditelné karty. Vizuální kontrola odhalila skutečnou chybu rozsahu
nesetříděného XY při `parsing:false`; scatter používá běžné parsování
Chart.js, test osy nyní vyžaduje zahrnutí všech bodů včetně 85 °C.
Raná exploratory série před touto opravou není finálním profilem zde.

## Reprodukce a meze

```bash
git show df1beb5:index.html > /tmp/meteo-analytics/before.html
python scripts/profile-history.py --html /tmp/meteo-analytics/before.html --chartjs /tmp/meteo-pages-validation/chart.js --aggregates --counts 1000,10000,100000,250000 --output /tmp/meteo-analytics/before.json
node --test tests/*.test.js
python scripts/check-analytics-grid-browser.py --chartjs /tmp/meteo-pages-validation/chart.js --output /tmp/meteo-analytics/browser.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-pages-validation/chart.js --aggregates --grid --counts 1000,10000,100000,250000 --output /tmp/meteo-analytics/after.json
python scripts/profile-history.py --html /tmp/meteo-analytics/before.html --chartjs /tmp/meteo-pages-validation/chart.js --aggregates --cpu 4 --counts 100000 --output /tmp/meteo-analytics/before-cpu4.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-pages-validation/chart.js --aggregates --grid --cpu 4 --counts 100000 --output /tmp/meteo-analytics/after-cpu4.json
```

Playwright/Chromium jsou pouze vývojářské nástroje. Safari/WebKit zde není
instalovaný. Fyzický iPhone, skutečné externí CSV/MQTT služby, firmware,
kalibrace, reset srážek ani přímé widgety Pages nejsou tímto ověřeny.
Nasazení se dokládá samostatně v roadmapě a auditu.
