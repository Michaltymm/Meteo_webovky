# Etapa 10 — původní záznamy vlivných dnů, v0.7.0

21. 10. 2026, výchozí `9c017bb` / v0.6.0. Navazuje na hotovou denní citlivost
METEO-077; nepřepočítává již dokončený audit ani nemění její statistiku.
**METEO-077 dokončeno v plánovaném denním rozsahu**, **METEO-063 rozpracováno**:
původ T/V dne hotový, maxima/hodinové a další odvozené metriky stále zbývají.

## Podklady a platnost výpisu

V nativním vnořeném details se vybírá den s největší změnou r, sklonu nebo
s nedostupným zbytkem. Pouze dostupné volby. Tabulka obsahuje všechny řádky
průniku tohoto místního dne a původního7/30/all analytického rozsahu, včetně
nepoužitých nečíselných T/V s důvodem. Nuly i duplicity zůstávají. U okraje7d
se tedy nezobrazují měření mimo analytické okno; celý den lze nadále otevřít
původními tlačítky průzkumníku.

Pořadí od nejnovějšího platí pouze pro právě načtenou historii; není to
trvalé backendové ID. Datum/sekundy/UTC offset rozlišují opakovanou místní
hodinu. Číselné hodnoty se pro tabulku nezaokrouhlují; jde o hodnoty z `store`,
nikoli o uchovaný původní CSV řetězec. V UI jsou počty plného/zbylého výpočtu,
r/sklon, vzorce centrovaných součtů a verze aplikace. Souhrny nikdy nevznikají
z jedné stránky nebo z vizuálně redukovaných bodů.

Bez otevření výpisu žádné čtení zdrojových řádků pro tabulku. Sdílené
`historyRangeBounds` vrátí dvě binární meze, bez řezu či kopie celého dne.
Nad připravenou T/V analýzou otevření O(log n+p), další stránka O(p), p≤50. Prohlížeč drží nejvýše50řádků
v těle tabulky; stav výpisu má pouze reference na aktuální snapshot/analýzu,
stanici, druh výsledku, rozsah, meze a stránku. Cache exploreru se nezmění.

CSV/MQTT, oprava/delece historie, změna stanice/rozsahu a zavření výpis
vyčistí a uvolní reference. Před stránkováním se navíc kontroluje identita
zdroje, délka, snapshot/analýza/rozsah/stanice a den cache. In-place mutace
nadále musí zavolat existující `invalidateDerivedData`. Starý index se
nepoužije k novému poli stejné délky. Data v HTML buňkách escapovaná, kontext
přes textContent. Žádná nová závislost, síťový požadavek nebo Chart instance.

## Cílené měření před/po

Pět vzorků, medián bez vyřazování prvního, skutečný Chromium154.0.8037.57,
Chart.js4.4.0,390×844,Europe/Prague,CPU×1. Stejné syntetické5minutové řádky
s extrémem85°C,1k a250k. Běhy sekvenčně, bez souběžných testů/prohlížečů.
Měřen synchronní JS+DOM+Chart update, nikoli pozdější paint/síť/parser/Web Vitals.
Opakované velké profily1k/10k/100k/250k z etapy9 zůstávají jako historie;
tato etapa jim nepřidává nové výkonnostní tvrzení.

| Párů | První T/V před → po (ms) | Opakované T/V před → po (ms) | Sestavení výpisu (ms) | Další stránka (ms) |
| ---: | ---: | ---: | ---: | ---: |
| 1 000 | 10,5 → 9,4 | 6,4 → 4,9 | 1,5 | 0,6 |
| 250 000 | 58,5 → 54,3 | 7,4 → 6,1 | 1,5 | 0,6 |

[Před](stage10/before-9c017bb.json), [po](stage10/after.json).
Rozdíly původních grafů nejsou tvrzením zrychlení: jejich algoritmy jsou
zachované a jde o lokální vzorky na sdíleném stroji. První T/V volání stále
invaliduje i sdílené agregace; opakované používá cache. Tabulka je při těchto
základních měřeních zavřená.

Nové `--records` běží **až po základních měřeních i30cyklech**, takže se
nepromítá do jejich heap/cold/warm scénářů. Obě vnořená details jsou otevřená,
viditelnost tabulky výslovně ověřená. Před vzorky se zpracuje native toggle;
pak se měří samostatné znovusestavení stejného výpisu a další stránky.
Nejde o změření prvního kliknutí do paintu. Ve fixture má vybraný den288řádků,
v DOM vždy50. Otevření zaznamenalo10 childList/characterData mutací, další
stránka2; atributy se tímto pozorovatelem nesledují.

Proxy test s250k hustšími sekundovými originály ověřuje i velký den:
<100čtení při otevření (binární meze + první50), přesně50 při další stránce,
žádné další čtení při opakované analýze se zavřeným výpisem. Není to časový
limit CI. Statistiky i původní měření zůstávají beze změny.

### Omezené opakované otevření/zavření

[Dodatečný1k běh](stage10/record-cycles-1k.json) ověřuje20otevření/stránka/
zavření; nerozšiřuje srovnání výkonu grafů. Po zahřátém výpisu CDP heap
5 894 108B/2754uzlů/10grafů, po zavření5 894 384B/2754uzlů/10grafů,
po20cyklech5 915 244B/2754uzlů/10grafů. Tělo tabulky má0řádků a stav je null.
Nodes po cyklech neroste, ale toto CDP měření nekleslo ihned při zavření;
nelze z něj tvrdit okamžité uvolnění veškeré nativní paměti nebo vícedenní
stabilitu. Je ověřený odstraněný obsah a zrušená aplikační reference.

Při 250k má stránka se zavřeným výpisem v hlavním profilu po zahřátí
2 204 uzlů oproti 2 121 před změnou, po 30 cyklech 2 206 uzlů/10 grafů. Přibyly stálé prvky
inspektoru, nepřibývají uzly za každý den nebo celou historii. Heap před/po
v tomto základním scénáři~57,2MiB, rozdíl jednotlivých vzorků není RAM úspora.
HTML bez komprese+9316B. Worker/framework ani další knihovna se nepřidávají.

## Ověření

**165/165 Node testů**,12nových v `tests/battery-records.test.js`:

- Originální pořadí/číselná přesnost, chybějící senzory,0 a shodné timestampy;
  stránkováním se dostanou všechny řádky bez změny plného r/sklonu.
- Celé/krajní stránky, meze a horní limit50; inkluzivní7d se dvěma řádky
  na hranici včetně nepoužitého a řádkem mimo rozsah.
- 250k, omezená čtení a žádná kopie historie ve stavu; líný zavřený výpis.
- Změna rozsahu, stejné dlouhé nové pole, in-place oprava/delece, stanice,
  CSV/MQTT, reset a zavření; staré reference se nepoužijí na nová data.
- Nedostupný zbytek po vynechání dne, chybějící/konstantní V, XSS kontext.
- 25h den Europe/Prague se dvěma02:30 a odlišnými UTC offsety.

[Browser](stage10/browser.json): skutečný DOM/Chart a tři původní konfigurace,
řízené zpožděné CSV/UV. Tabulka otevřená Enterem, výběr r/sklonu/nedostupného
zbytku, další stránka a reset, verze/vzorec, skutečný počet originálů/párů.
Chybějící T označena,0V po opravě starého CSV zůstává použitým párem.
Změna rozsahu výpis zavře. Obě témata320/390px bez celostránkového overflow,
region tabulky jde posouvat klávesnicí; nativní header/role/status. Žádný page
error/extra fetch/nový graf. Screenshot nového výpisu prohlédnut.
Zachovány integrační kontroly AH/VPD,078, denní citlivosti, motion a načítání.

Při přípravě testů opraveny předpoklady fixture (počet stran závisí na
vybraném dni, DOM mock vytváří prvky až na čtení a původní formát offsetu
neobsahuje závorky) a selector summary zpřesněn na přímého potomka kvůli
novému vnořenému details. Nešlo o doložené regresní chyby aplikace.
První rozšířený profil měl zavřeného předka tabulky a byl zahozen;
finální výše uvedený běh kontroluje její skutečnou viditelnost.

Konfigurace, workflow, server, archiv, zdrojová měření a main se nemění.
Živé služby/broker, skutečný HW/firmware/epochy, fyzický mobil a přímé Pages
widgety nejsou tímto ověřeny. Push a deployment se evidují samostatně.

```bash
git show 9c017bb:index.html > /tmp/meteo-before.html
python scripts/profile-history.py --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --analysis --counts 1000,250000 --output /tmp/before.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --analysis --records --counts 1000,250000 --output /tmp/after.json
python scripts/profile-history.py --html index.html --chartjs /tmp/meteo-chart.js --analysis --records --counts 1000 --output /tmp/record-cycles.json
node --test tests/*.test.js
python scripts/check-analytics-browser.py --chartjs /tmp/meteo-chart.js --output /tmp/browser.json
```

Dev nástroje a lokální Chart.js podle [README](README.md). Časované běhy vždy
postupně. Další etapa METEO-063: dohledání původních podkladů hodinových průměrů.
