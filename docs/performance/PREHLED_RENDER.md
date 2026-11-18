# METEO-008: formátování a DOM přehledu, v0.20.7

Výchozí661bb7c/v0.20.6. Navazuje na CPU měření přesných souhrnů. Nový
benchmark-overview-render-browser.py oddělil souhrny, Chart.update, formátování
počtů a Element.innerHTML setter v reálně viditelném přehledu390×844px.
Původní oddělený statistický benchmark měl Chart.update vypnutý a nelze jeho
časy vydávat za toto měření. Zjištěný podíl locale/table/Chart vedl ke dvěma
malým souvisejícím úpravám bez zásahu do modelu nebo vzhledu.

## Změny

Jediný Intl.NumberFormat('cs-CZ') se vytvoří líně při prvním použití přehledu.
Je nezávislý na stanici/metrice a nahrazuje opakované count.toLocaleString('cs-CZ').
Výstupní české formátování zůstává stejné, včetně nezalomitelných mezer. V HTML
markup se U+00A0 zapisuje &nbsp;, stejně jako jej serializuje prohlížeč, aby
porovnání fungovalo i pro počty≥1000. Čísla jsou interní celočíselné počty, ne
neověřený HTML vstup. Neběží nic navíc při startu nebo mimo přehled.

Hotový tableMarkup se porovná s aktuálním ovTableBody.innerHTML a vloží se pouze
při rozdílu. Žádná druhá cache markup/zdrojů nebo nové invalidace. Změna metriky,
počtu, hodnot, „dnes“ nebo vnější úprava DOM dál vytvoří správnou tabulku.
Nezměněné řádky zůstanou zachované. Porovnání a generování řetězce má stále cenu
O(délka HTML); není to virtualizace/stránkování ani úplné odstranění DOM nákladů.

Statistiky, matematika, původní data, grafové datasety, legendy/ovládání i všechny
4horní pohledy zůstávají. Chart.update je nadále volán. Žádný nový fetch/timer/
Chart/worker/dependency nebo požadavek na konfigurace tří stanic.

## Ověření

Lokálně459/459 celé Node sady a poté11/11cílených overview testů po normalizaci
HTML mezer.3nové regrese: počet skutečných setterů při shodném/změněném/stale
DOM, hodnoty/počty/metriky, lazy/reuse českého formatteru a native shoda počtů
0/1/999/1000/12345/250000, prázdná data a nuly. Původní přesné oracle zachované.

Actual Chromium/SRI/3konfigurace/12k unordered/320–1440px prošel v rozšířeném
CSV harnessu včetně ročního tabu, T/RH/P/Vše a identity prvního DOM řádku při
opakovaném Vše. Kontroluje i počty12 000 s mezerou ve skutečném prohlížeči.
Bez pageerror/socketů. Fyzický Safari/iOS, přímé Pages widgety/živé služby nejsou
ověřeny tímto offline testem.

## Měření

Skutečný Chromium/Chart.js, původní HTML + lokální SRI knihovny, řízená data
300s od sebe,1warmup+3vzorky. Počty1k/10k/100k/250k, rozsah30d aVše, oba režimy:
repeat (stejná T), change (T/RH střídání). Vše sekvenčně před/po,32profilů.
Pevný civilní čas2026-11-17T11:00Z/EuropePrague; performance.now/timery nativní.
Původní pokus bez pevného času změnil30d okraj mezi běhy a byl vyřazen; raw
publikované níže jsou pouze srovnatelné pevné scénáře.

Instrumentace měří Number.toLocaleString před a tentýž Intl.format po přes
wrappery, HTML setter pouze pro ovTableBody, skutečný chartOverview.update.
Součet fází není celý čas: zbývá tvorba řetězců, klíčů, získání/porovnání DOM.
Chart.update může zahrnovat vynucený layout po předchozí DOM změně; nelze jeho
změnu přičítat samostatné optimalizaci Chart algoritmu, protože se neměnil.

16párů úplných grafových i tabulkových SHA shodných (8repeat+8change).
Repeat má po úpravě0HTMLsetterů, change1 na každý měřený render, jak očekáváno.
Vše250k má869denních řádků a869formátovacích volání, nikoli vzorkování dat.
Raw: prehled-render-{repeat,change}-{before,after}.json.

| Scénář | Celý build před → po ms | Formát počtů před → po ms | HTML setter před → po ms |
|---|---:|---:|---:|
| repeat100k/Vše | 27,8 → 7,5 | 3,9 → 0,1 | 8,0 → 0 |
| repeat250k/Vše | 93,8 → 24,4 | 9,3 → 0,7 | 30,3 → 0 |
| change100k/Vše | 22,2 → 31,8 | 3,8 → 0,2 | 4,2 → 7,2 |
| change250k/Vše | 81,1 → 73,5 | 9,4 → 0,7 | 19,8 → 17,6 |

Mediány. U change100k byl Chart10,9→18,6ms a celkový výsledek pomalejší i přes
levnější formátování. Zachováno bez dodatečného vybírání příznivých běhů.
Malé/30d scénáře mají smíšenou variabilitu; nelze tvrdit univerzální zrychlení.
Nejde o Web Vitals/INP/RAM/naměřenou odezvu fyzického telefonu nebo plný paint.

## Pokračování

Dílčí checkpoint hotový, celé008Rozpracováno. Zbývá Chart.update (repeat250k/Vše
po11,1ms, change~42ms) i při nezměněných datech. Případně omezit zbytečné stejné
Chart aktualizace s korektní kontrolou jednotek/metriky/dat/legendy/tématu a resize,
nejprve cíleně ověřit tuto návaznost; samotný renderer a dlouhá změněná tabulka
zůstávají nákladné. Nepřidávat stránkování nebo sampling bez samostatného zdůvodnění.
Hotové statistiky/locale/DOM gate neopakovat. ESP084 stále blokuje firmware/API.

Nasazení v0.20.7: [1e29e92](https://github.com/Michaltymm/Meteo_webovky/commit/1e29e92),
[Actions #57](https://github.com/Michaltymm/Meteo_webovky/actions/runs/44204089921)
Success (build49s/deploy11s/celkem70s),1artefakt. CI459testová sada prošla,
lokálně459/459 celé sady +11/11cílených po normalizaci mezer. ActualChromium
3konfigurace/12k/mobil/identita tabulky a16párů plných graf/tableSHA prošly.
Implementováno/otestováno a vývojové publikování potvrzeno workflow; přímé widgety
Pages, živé služby a fyzický Safari neověřeny. Main stále
2405c5d7326909a24c41e7066bfdc4a9d1622208. Původní runtimeActions/ubuntu-latest
upozornění trvají, workflow beze změny. Dále ověřit zbytečné stejné Chart.update
se všemi vazbami; hotové locale/DOM souhrny neopakovat.
