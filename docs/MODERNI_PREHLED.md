# Moderní přehled — v0.14.0

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

## Výběr karet podle stanice

Od v0.14.0 otevřete „Upravit karty“ vedle výběru stanice. Zaškrtnutím vybíráte
tlak, přírůstek srážek, celkový déšť, nádrž, napětí, absolutní vlhkost a VPD.
Volba platí pro aktivní stanici a ukládá se v tomto prohlížeči; po obnovení
stránky se zachová. Hlavní teplota, vlhkost, rosný bod a statistiky zůstávají viditelné.

„Obnovit všechny karty“ vrátí výchozí výběr právě zvolené stanice. Při skrytí
všech senzorových karet se zobrazí přímo v přehledu obnovovací tlačítko.
Klasický přehled nadále ukazuje všechny karty. Skrytím se nemění data, výpočty,
grafy ani dostupnost historie. Chybějící hodnota se automaticky neschovává.

Výběr podporuje klávesnici, Hotovo, Escape a kliknutí mimo panel. Mobilní panel
má omezenou výšku a posun obsahu; nedostupné storage umožní nastavení jen pro
aktuální relaci a tento rozsah vysvětlí. Neplatná předvolba obnoví použitelné
výchozí nastavení. Vysvětlení ⓘ z v0.13.1 nadále používají prodlevu1500ms;
skrytí zdrojové karty zavře jejich aktivní nebo čekající panel.

Předvolby používají samostatný klíč meteoModernCards se schema version1, třemi
poli povolených ID a limitem4096znaků. Vývojový web má prefix meteoDev: jako
ostatní předvolby; hodnoty se nekopírují do exportu konfigurace zdrojů.

## Ověření

`node --test tests/*.test.js`: **263/263 prošlo** ve v0.14.0; zahrnuje9nových
regresí předvoleb, izolace stanic, reloadu, obnovy, blokovaného/poškozeného storage,
klasického přehledu, odvolání hoveru a stabilních DOM aktualizací.
Moderní browser harness navíc ověřil checkboxy, Hotovo/Escape, zachování výběru
po reloadu,7→3→7karet při přepnutí vzhledu,0fetch a8→8Chart při volbě karet,
obnovu prázdného výběru a panel ve všech8kombinacích viewport/téma.
`check-info-browser.cjs` také prošel s původní nápovědou včetně1500ms a dotyku.
Podklady v této etapě: `/workspace/validation/meteo-cards/` mimo repozitář.

Původní ověření v0.12.0:

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
