# Moderní přehled 2 — v0.20.0

Samostatná čtvrtá karta horní navigace:
[otevřít vývojovou verzi](https://michaltymm.github.io/Meteo_webovky/dev/#moderni2).
Původní hlavní/moderní přehled a analytika zůstávají dostupné. Rozšíření
METEO-010/011 podle zadání uživatele; bez nového duplicitního ID.

## Záměr

Na jedné obrazovce pouze to, co uživatel potřebuje rychle přečíst:

- Výběr jedné ze tří skutečných stanic.
- Velká aktuální teplota.
- Vlhkost, tlak a napětí baterie v jedné řadě se zřetelnými jednotkami.
- Čas záznamu a stručné stáří/chyba. U MQTT je rozlišen čas příjmu.
- Odkaz na původní podrobný moderní přehled.

Bez grafů, tabulek, astronomické lišty, diagnostických panelů, načítání celé
historie nebo dalších voleb přímo v kartě. Nedostupné hodnoty jsou „–“;
0 zůstává 0. Chyby přenosu, budoucí/neplatný čas nejsou schované. Datum je
zobrazené stručně, plný čas s UTC offsetem je v title; stejné časové pojetí
jako zbytek aplikace. Z napětí se neodhaduje procento nabití.

Vzhled používá původní barevné proměnné pro světlé/tmavé téma, klidné neutrální
karty a jeden oranžový akcent. Na mobilu jsou čtyři navigační odkazy ve dvou
řadách, všechny přímo viditelné s plochou minimálně44px. Výběr stanice je
nativní select s fontem16px (bez typického automatického zoomu iOS při fokusu).
Duplicitní přepínač stanice v hlavičce a původní lišta obnovy/stavu jsou
schované pouze v tomto režimu. Nastavení přes ⚙ zůstává dostupné.

## Technické chování

`modern2`/`#moderni2` je samostatný stav stávajícího routeru, včetně přímého
odkazu, reloadu a Zpět/Vpřed. Nový úsporný HTML panel jen promítá poslední
řádek sdíleného store, názvy stanic, stávající fmt a existující výstup
renderDataStatus. Nemá druhý parser/store/cache nebo výpočty statistik.
Zobrazení zaokrouhluje T/RH/P na1 a V na2 desetinná místa; zdroje se nemění.

Přepnutí stránky nepřidává fetch, polling ani Chart instanci. Automatická
obnova a přepnutí stanice využívají stávající datový systém; společné výpočty
refreshUI původního dashboardu zůstávají. Tato etapa netvrdí odstranění všech
jeho nákladů. Samotná projekce je O(1), i250k historie čte jen poslední řádek.

Běžné i opožděné refreshTab se v modern2 neprovedou a zachovají dirty stav.
Skrytý24h graf se nebuduje ani bez IntersectionObserver. Po návratu původní
pohled obnoví aktivní dolní tab. Opuštění analytiky uvolní její instance jako
dosud. Žádné preference výběru karet moderního přehledu se nepřepisují.
Reset/přepnutí stanice ihned vymaže staré hodnoty i datetime, než přijdou nová
data. Jména v selectu se escapují, hodnoty se zapisují přes textContent.

## Ověření

426/426 Node;7nových regresí v tests/simple-overview.test.js: navigace,
0/null/nonfinite, reset a změna stanice, chyby/future/invalid/MQTT čas,
250kProxy/O(1), escapování jmen, dirty/no-IO guard, zrušení analytiky a
zachování původních preferencí. Původní testy zůstávají beze změny.

scripts/check-simple-overview-browser.py používá skutečný Chromium154/Chart.js,
původní3konfigurace a řízená CSV/UV. Přímý odkaz/reload, nativní výběr stanic,
pozastavená odpověď při změně stanice, chybějící/0napětí, odkazy/Zpět/Vpřed,
původní store/CFG bez dalších requestů při přepnutí, žádné nové grafy.
27kombinací šířek320–1440px, výšek568–1000px, portrait/landscape a3témat:
bez horizontálního přetečení,44px ovladače,16px select. Vizuálně zkontrolované
mobilní/desktopové snímky a skutečné barvy chybových upozornění.
Žádný pageerror/socket. Živé služby a fyzický Safari/iOS se neověřovaly.

Další návrhy případně vycházet z uživatelské zpětné vazby k této jednoduché
obrazovce; nepřidávat další metriky a diagnostiku bez konkrétního přínosu.
Výkonový checkpoint METEO-008 a blokované živé nastavení ESP084 se nemění.
