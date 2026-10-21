# Etapa 5: hodinové agregace a podklady porovnání

21. 10. 2026, v0.2.2 (`c37227f`) → v0.3.0. Pokračování METEO-038;
žádné nové roadmap ID. Tři konfigurace, workflow, archiv a main beze změn.

## Výpočty a význam nových údajů

`dataAggregates` nově uchovává indexový rozsah každého dne v sestupné historii.
`hourlyDay` zpracuje pouze jeho původní řádky a vypočte T/RH/P pro 24 místních
hodin, bez výběru vizuálních bodů. Zpracovává časy vzestupně a uvnitř shodných
časů zachovává původní pořadí. Součty i zaokrouhlené průměry tím odpovídají
původnímu stabilnímu sortu a plným filtrům; nulové hodnoty zůstávají platné,
null/nekonečno nejsou náhradní nula. Průměry jsou nadále vzorkové a zahrnují
duplicitní timestampy, nic se potichu nemaže.

Výsledky mají LRU nejvýše **osm dnů** v jediném aktuálním snapshotu. Změna
veličiny nebo opakované otevření stejného dne znovu nečte historii. CSV,
MQTT, reset, oprava historie a změna místního dne ruší snapshot včetně hodin.
Do cache se nekopírují původní řádky. Omezení osmi cache položek není limit
počtu uživatelem porovnávaných grafových řad; ty mohou mít vlastní paměťové náklady.

Nový rozbalovací panel v Porovnání a tooltipy ukazují:

- **Záznamy:** všechny načtené řádky daného dne, i pokud některé senzory chybí.
- **Různé časy:** počet různých interpretovaných timestampů, nikoli důkaz
  statisticky nezávislých měření. Legacy CSV bez offsetu nerozliší dva podzimní
  výskyty stejného času; tato nejednoznačnost zůstává METEO-048.
- **Číselné hodnoty:** konečné hodnoty vybrané veličiny; jde o úplnost, ne
  fyzikální validaci rozsahu nebo kalibrace čidla. T/RH mohou mít jiné počty.
- **Hodiny s daty:** počet dvojic místní hodiny + UTC offsetu s alespoň jedním
  záznamem, případně hodnotou vybrané veličiny. Jmenovatel vychází ze skutečně
  existujících hodinových skupin dne, pro moderní pravidla ověřených IANA zón.
  Jednotlivé skupiny nemusejí trvat přesně hodinu: Lord Howe může mít 25 skupin
  ve 24,5hodinovém dni. Nevzniká z toho procento dostupnosti ani pozorovaná doba.
- **Rozsah časů:** rozdíl posledního a prvního timestampu. Není to souvislé pokrytí.
- **Nejdelší rozestup:** největší rozdíl sousedních různých časů záznamů,
  bez okrajů dne. U jediného času nelze určit. Neoznačuje se automaticky za
  výpadek; senzor může mít záměrně nepravidelný plán.

Počet existujících hodinových skupin se odvodí na minutové mřížce kalendářního
dne, jednou při výpočtu cache položky. Ověřeny současné celé i půlhodinové DST
změny; historické sekundové offsetové přechody nejsou cílem tohoto modelu.
Porovnání samo má nadále 24 hodinových kategorií; opakovaná podzimní hodina
sdílí jeden průměr. Podklady ale oba offsety rozeznají, pokud je vstupní Date
skutečně rozlišuje. Prázdné hodiny zůstávají null a `spanGaps:false` je
nepřemosťuje. [Původní a opravené chování](stage5/gap-before-after.json)
bylo ověřeno stejnými dvěma měřeními s prázdnou hodinou mezi nimi.

Panel rozlišuje částečnou a celou dostupnou načtenou historii. Změna stanice
či dat vyčistí staré podklady; chybějící den znamená „žádné záznamy v načtených
datech“, nikoli dokázaný výpadek fyzické stanice. Text je vložen přes textContent.

## Metodika výkonu

Stejná metoda jako [etapa 4](ETAPA4.md): Chromium 154.0.8037.57, Chart.js 4.4.0,
viewport 390, Europe/Prague, syntetické pětiminutové měření, offline. Pět vzorků,
medián bez odstranění prvního. Měření běžela postupně bez souběžných testů.
`--comparison` přidává dva vybrané dny a T+RH, tedy čtyři řady s 24 body.
`coldCompare` invaliduje celý odvozený snapshot před voláním `buildCompare`;
opakovaný `compare` následuje bez změny dat. Zahrnuto je skutečné vytvoření
textu podkladů a synchronní Chart.js update. Mezi vzorky 350 ms pro animace.
30 cyklů navíc zkouší i porovnání; nejde o několikadenní soak nebo fyzický mobil.

```bash
git show c37227f:index.html > /tmp/meteo-before.html
python scripts/profile-history.py --comparison --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --output /tmp/before.json
python scripts/profile-history.py --comparison --html index.html --chartjs /tmp/meteo-chart.js --output /tmp/after.json
python scripts/profile-history.py --comparison --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --counts 100000 --cpu 4 --output /tmp/before-cpu4.json
python scripts/profile-history.py --comparison --html index.html --chartjs /tmp/meteo-chart.js --counts 100000 --cpu 4 --output /tmp/after-cpu4.json
node --test tests/*.test.js
python scripts/check-interval-browser.py --chartjs /tmp/meteo-chart.js --at 2026-03-30T00:30:00+02:00 --output /tmp/hourly-browser.json
python scripts/check-background-browser.py --chartjs /tmp/meteo-chart.js --output /tmp/background-browser.json
```

Chart.js a volitelné dev nástroje dle [README](README.md). Žádné nové produkční
závislosti, workers, síťové požadavky nebo konfigurace. Cold označuje aplikační
cache, nikoli chladný JIT/start browseru. Při běžném přechodu z přehledu může
být základní denní/měsíční snapshot již hotový, zde ho cold test počítá znovu.

## Výsledky

Milisekundy, medián 5 vzorků:

| Počet řádků | Porovnání po invalidaci před → po | Opakované porovnání před → po |
| ---: | ---: | ---: |
| 1 000 | 7,3 → 9,2 | 5,6 → 4,8 |
| 10 000 | 8,8 → 8,8 | 6,1 → 5,7 |
| 100 000 | 18,1 → 13,5 | 17,1 → 4,4 |
| 250 000 | 35,3 → 28,4 | 32,7 → 5,1 |

[Před](stage5/before-c37227f.json), [po](stage5/after.json).
CPU×4 při 100k: po invalidaci **98,0 → 53,5 ms**, opakované **91,3 → 21,8 ms**.
[Před CPU×4](stage5/before-cpu4.json), [po CPU×4](stage5/after-cpu4.json).
První malý scénář je pomalejší kvůli novým podkladům a určení existujících
hodin. Nejde o plošné procento zrychlení celé stránky; přínos cache roste
s historií a počtem opakovaných pohledů na stejnou revizi.

JS heap po GC při 250k po zahřátí **56,31 → 56,53 MiB**; přibližně 0,22 MiB
navíc pro tuto fixture. Osm Chart instancí zůstalo osm po30cyklech. Profil
neobsahuje reálný CSV přenos/parser, RAM celého procesu ani LCP/INP/CLS.
Desítky současně vybraných dnů mohou zatížit vykreslování i přes limit LRU.

## Ověření a navazující práce

**110/110 Node testů**, 14 nových v `tests/hourly-quality.test.js`: nezávislá
reference původního stabilního výpočtu pro T/RH/P, přesné pořadí shodných časů,
0/null/nekonečno, různé časy vs záznamy, velká mezera, chybějící den, indexový
výběr a opakování bez dalších čtení 250k, LRU, oprava/reset, tooltip/částečná
historie, Prague/NY 23/25 h, UTC+14, Lord Howe 24,5/23,5 h a dvojí podzimní offset.

[Browser](stage5/browser.json) se skutečnými konfiguracemi tří stanic,
DOM/Chart.js a zpožděným fixture transportem ověřil číselný hodinový průměr
i jeho počet, otevření detailů, tooltip, darkblue/light a mobil 390 bez
přetečení. Dvě řízené DST sady mají 2/25 a 2/23 skupin a reálný rozestup 1 h;
jarní hodina je null. Mobilní screenshot byl vizuálně zkontrolován.
[Pozadí](stage5/background.json) zachovalo 0 periodických requestů ve skrytí a
následnou obnovu bez duplicit. [Smoke](stage5/smoke.json) ověřil všechny taby
a osm veličin; jeho časy zde nejsou srovnávány. Syntax/diff kontrola prošla.

METEO-038 zůstává rozpracované: napojení ročních statistik na sdílená data
a pozorovaný čas/dostupnost podle ověřeného plánu ještě nejsou hotové. Přidání
procent podle intervalů HTTP pollingu by nebylo měřením dostupnosti senzoru.
Další samostatnou etapou může být METEO-019/020/031 bateriový panel; žádné SOC
či energie jen z napětí. Kontrakt časové zóny stanice/UV zůstává METEO-048.
Skutečné externí služby, firmware, broker, fyzický mobil a dlouhý provoz zde
nebyly ověřeny; publikování workflow evidovat odděleně.
