# Moderní přehled — v0.12.0

Nové samostatné zobrazení je v horní navigaci mezi hlavním přehledem a analytikou:
[otevřít vývojový přehled](https://michaltymm.github.io/Meteo_webovky/dev/#moderni).
Původní přehled zůstává pod `#prehled`, analytika pod `#analytika`.

Moderní přehled má výraznou teplotní kartu, střídmější barevnost, větší mezery,
nové senzorové a statistické karty, přehlednější záložky a vlastní výběr stanice.
Respektuje zvolené světlé/tmavé téma; grafy mají tmavý podklad pro zachování
čitelnosti stávajících barev os a legend. Na telefonu se karty skládají do
jednoho až dvou sloupců, dlouhé dolní menu lze posouvat vodorovně.

## Sdílené funkce

Oba přehledy používají stejný DOM panel a původní komponenty, měření i výpočty.
Nová stránka je samostatný stav navigace `modern`, nikoli kopie datové vrstvy.
CSS se aktivuje pouze přes `body[data-view="modern"]`; přepnutí tématu tuto
volbu nesmaže. Nikde nevznikají duplicitní ID ani druhá sada grafů.

- Výběr všech tří stanic, obnova, nastavení, historie a původní záložky fungují stejně.
- Přepnutí vzhledu zachovává stanici, zvolenou dolní záložku, data a grafové instance.
- Přepnutí nevytváří nový polling ani požadavky. Načtení celé historie při
  prvním otevření historické záložky zůstává původní línou funkcí aplikace.
- Z analytiky se při odchodu uvolní její grafy stejně jako dosud; cache zůstává sdílená.
- URL podporuje přímé otevření, nový panel prohlížeče a Zpět/Vpřed.
- Chybějící senzory zůstávají „–“, platná nula se zachovává; neodvozují se nové meteorologické hodnoty.

Volba jednotlivých karet a ukládání preferencí podle stanice z METEO-011 jsou
další samostatné části roadmapy; nová stránka je neimplementuje.

## Ověření

`node --test tests/*.test.js`: **251/251 prošlo**, včetně pěti nových regresí
navigace, sdílení stavu, prázdných/nulových hodnot a bezpečného názvu stanice.

`scripts/check-modern-dashboard-browser.py` použil skutečný Chromium154,
původní tři konfigurace a skutečné Chart.js/Paho se SRI; CSV/UV jsou řízené
fixture. Ověřil osm kombinací 1440/800/390/320px a světlého/tmavého tématu,
přepínání všech stanic, chybějící a nulové napětí, historii, přímý start na URL,
Zpět/Vpřed, prázdný stav a návrat z analytiky. Bez pageerror a vodorovného
přetečení dokumentu. Před/po přepnutí vzhledu zůstává 8 původních Chart instancí,
stejná reference dat a nulový přírůstek požadavků. Nejde o měření fyzického iOS
ani skutečné rychlosti externích služeb.

Původní `scripts/check-analytics-grid-browser.py` po změně také prošel:
devět grafů, stanice, období, zoom, PNG, dotykové ovládání a obě témata.

```sh
python scripts/check-modern-dashboard-browser.py --chartjs /tmp/chart.js --paho /tmp/paho.js --output /tmp/modern-dashboard.json
```

Použijte původní soubory CDN verzí z `index.html`. Screenshoty a výstupy patří
mimo repozitář. Změna nevyžaduje další závislosti ani úpravu Pages allowlistu.

Publikování ověřeno: [Actions #26](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39832057768) pro [acfa3ba](https://github.com/Michaltymm/Meteo_webovky/commit/acfa3ba) **Success** (build24s/deploy9s/celkem42s), jeden Pages artefakt. Vývojové HTML v0.12.0, main zůstává2405c5d7326909a24c41e7066bfdc4a9d1622208. Přímý živý Pages host není v síťové politice prostředí povolen, potvrzení nasazení vychází z workflow. Následný commit mění pouze dokumentaci.
