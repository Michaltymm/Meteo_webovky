# Analytické grafy — v0.11.1

Samostatná analytická stránka navazuje na stávající `store.rows`, Chart.js 4.4.0, přepínání
stanic, řízení relací, CSV parser, binární výběr historie a min/max redukci.
Neobsahuje další knihovnu, build ani druhý zdroj aktivních měření.

## Obrazovka

Od v0.11.0 horní navigace přepíná dvě samostatná zobrazení: **Hlavní přehled**
a **Analytické grafy**. Analytika už není dolní záložkou pod aktuálními hodnotami.
Má vlastní hlavní obsah vedle původního dashboardu; jeho karty, starší záložky
a lišty Slunce/Měsíc/přehled stanic jsou při analytice skryté. Společná hlavička,
stanice, nastavení a stav přenosu zůstávají přístupné.

Přímý vývojový odkaz je https://michaltymm.github.io/Meteo_webovky/dev/#analytika,
přehled používá `#prehled` (nebo původní adresu bez kotvy). Funguje Zpět/Vpřed,
klávesnice i otevření odkazu v nové kartě. Přepnutí stránky posune obsah nahoru;
při návratu zůstane vybraná původní záložka přehledu. Jde o dvě stránky v jedné
aplikaci se sdílenými daty, takže přepnutí neobnovuje celý dokument ani nestahuje
znovu již načtenou historii. Grafy analytiky se při odchodu uvolní, po návratu
vznikají opět podle viditelnosti. Na pozadí se nepřekreslují grafy přehledu;
po návratu se obnoví jeho aktuální záložka. Během načítání nové stanice se místo
starých grafů zobrazí prázdný stav, nikoliv grafy předchozí stanice.

Desktop od 1200 px má 3 sloupce, tablet 2, telefon do 650 px 1. Karty mají v řádku
stejnou výšku, graf obvykle245/260 px. „Zvětšit“ poskytne celou šířku a větší
výšku; Escape vrátí mřížku. Nativní fullscreen API se nevyžaduje.
Rozšíření tak funguje i tam, kde je fullscreen canvasu omezený.

Společný panel používá skutečnou aktivní konfiguraci a názvy tří stanic.
„Všechny“ otevře porovnání; ostatních sedm fyzikálních pohledů a heatmapa
zůstávají pro stanici výslovně uvedenou ve stavovém řádku. Změna stanice
využívá původní `switchStation`, neruší její nastavení nebo datový kontrakt.

Období 24 h/7/30/90/365 dní se počítá dozadu od nejnovějšího načteného záznamu,
nikoli od počítačového času. „Všechna“ znamená všechna načtená data.
Vlastní datum zahrnuje celou místní koncovou noc včetně 23/25h dní.
Výřez, poslední měření a quick/full stav jsou viditelné nad grafy.
Chybné vlastní období neuchová starý graf jako nový výsledek.

Od v0.11.1 má každá karta pod grafem zavřené **Podrobnosti grafu** s nativní
rozbalovací šipkou. Obsahují původní stručný popis i celé statistické a metodické
poznámky včetně podrobné diagnostiky porovnání stanic. Texty se nadále aktualizují
podle zvolených dat, ale nezahlcují mřížku. Otevřít je lze kliknutím, dotykem
nebo klávesami Enter/mezerník. Rozbalení nevyžaduje další stahování ani nový graf.
Samostatné **Možnosti grafu** zůstávají pro ovládání; legendy, osy, zprávy o prázdných
datech a barevná legenda i vybraná buňka heatmapy zůstávají mimo podrobnosti.

## Devět grafů

| Karta | Vstupy a výpočet | Význam a omezení |
| --- | --- | --- |
| Teplota | Původní T, denní min/max vybraného výřezu; volitelný průměr posledních 5 měření | °C; extrémy z úplných dat, i při vizuální redukci. Klouzavý průměr je vážen počtem vzorků, nepřemosťuje chybějící vstupy či interval >3 h. |
| RH a rosný bod | Původní RH/T, dosavadní `dewPoint(T,RH)` stejného řádku | RH na ose%, T/Td na°C. RH≤0/>100 nebo chybějící vstup nemá Td. Původní zaokrouhlení výpočtu Td se nemění. |
| Tlak | Původní P, rozdíl původních krajních řádků; volitelný průměr5měření | hPa; žádná náhradní krajní hodnota, neověřený typ redukce tlaku zůstává metadata071. |
| Srážkový čítač | Původní rain, denní maximum čítače a maximum rainInc jednoho záznamu | mm; **nejde o ověřené úhrny nebo intenzitu**. Bez kontraktu resetu/jednotek/intervalu017/049 se přírůstky nesčítají na údajné hodinové srážky. |
| Baterie a teplota | Původní V a T na samostatných osách | V/°C, nezávislé chybějící hodnoty, legenda skrývá řady. T vzduchu není teplota článku. |
| Změna napětí | V, denní min/max V,1000·ΔV/Δt[h] mezi sousedními původními řádky | mV/h jen pro0<Δt≤3h, bez přemostění null/duplicitního času. Pozorovaný poslední dokončený noční úsek podle `calcSunTimes`; není nutně celá noc. Růst může souviset s nabíjením, zátěží i teplotou, **není to proud/energie/SOC**. |
| XY T×V | Jen konečné páry téhož řádku, plné Welford r/sklon; volitelná regrese | Při n<3 nebo konstantě nedostupné. Den/noc z existujícího odhadu polohy Slunce nad reprezentanty, s předpokladem správných timestampů/polohy. Bez p-value/CI či kauzálního tvrzení. |
| Porovnání | Původní teploty3 stanic na lineární časové ose; popisné ΔT aktivní−ostatní | Samostatné skutečné časy, bez interpolace. Nejbližší nepoužitý čas do 10 min, při shodě dřívější a první nepoužitý duplicitní záznam. Není globálně optimální přiřazení ani kalibrační bias. Počet párů, vynechané body a max časová odchylka jsou uvedené. |
| Heatmapa | Plné hodinové aritmetické průměry T nebo RH | Vlastní canvas,14 dnů se záznamy na stránku,24 místních hodin. Přesná data buňky: n/min/max/průměr, dotyk i šipky. Opakovaná DST hodina je společná; šedá není nula. Jednotná legenda původních hodnot celého výřezu. |

Denní souhrn může mít neúplný okrajový den. Součty, průměry, extrémy,
korelace, regresní koeficienty a párování se vždy počítají z úplných
platných původních dat, nikdy ze 600 grafických bodů. Duplicity se nemažou.
Časy CSV se stejně jako jinde v aplikaci interpretují v zóně prohlížeče;
nejednoznačnou DST hodinu bez offsetu nelze rekonstruovat. Explicitní
zóna stanice/firmware kontrakt048 zůstává otevřený; bez něj se nevyvozuje
přesná mezistátní časová synchronizace nebo spolehlivá solární energetika.

## Ovládání

- +/− přibližuje časový výřez, šipky a vodorovné přetažení posouvají.
  Svislé gesto ponechá posouvání stránky. Tlačítka mají dotykovou výšku 44 px.
- Checkbox synchronizuje časové výřezy i časový kurzor mezi viditelnými
  časovými grafy. Bez něj má karta vlastní výřez. XY +/− mění osy T/V;
  časovou množinu XY dál určuje společné období/výřez.
- Legenda Chart.js skrývá/zobrazuje řady. Tooltip obsahuje původní čas
  s UTC offsetem a hodnotu; denní souhrn a regresní přímka jsou odlišené.
- Canvas s fokusem reaguje na+/−,0 a levé/pravé šipky. Heatmapa šipkami
  vybírá buňku a aktualizuje text pro čtečku. Reset je dostupný i nad mřížkou.
- PNG vzniká pouze na kliknutí, s názvem stanice a rozsahem. Heatmapa
  přidává i číselnou legendu/jednotku. Export nezískává žádná další data.

## Načítání a paměť

1. Na hlavním dashboardu se nevytvoří žádná analytická Chart instance,
   neběží analytický interval ani výpočet. Start zůstává 8 stávajících grafů.
2. Záložka nejprve využije rychle načtená data a původním `ensureFullData` sdílí
   jeden full request. Totéž platí po změně aktivní stanice. Časový filtr,
   zoom, legenda a heatmapa nevyvolávají další síťové požadavky.
3. `IntersectionObserver` vytváří grafy až u viditelných karet a překresluje
   jen aktuálně viditelné. Nejvýše 8 nových Chart instancí + vlastní heatmapa.
   Po odchodu se instance i observer/ResizeObserver zničí, model uvolní
   a rozpracované cizí requesty zruší. Pozdní odpověď neobnoví UI ani data.
4. `parseHistoryCSV` je čistě extrahovaná původní CSV→řádky implementace;
   používá ji aktivní `parseAndStore` i cizí historie. Zachovává řazení,
   rok bez roku, uvozovky, null/0 a původní validaci. Parser cizí stanice
   nesmí volat `switchStation`, `_applyCfgObject` nebo přepisovat `store`.
5. Ostatní stanice čtou skutečné konfigurační JSONy až pro viditelnou kartu
   porovnání, volbu„Všechny“ nebo explicitní obnovu. Nejvýše dva potřebné
   zdroje postupně, s původním timeoutem/CORS fallbackem a vlastní abort
   relací. Konfigurace zdroje se ověřuje i před commitem cache.
6. Cizí historie se po parsování převádí na dvě Float64Array (timestamp,T)
   po 16 bajtech na platný teplotní záznam, bez uchování CSV či ostatních
   senzorů. Limit 8 MiB na stanici a 16 MiB celkem, LRU. Příliš velká historie
   má vysvětlenou chybu, nikoli tajně oříznutá „všechna“ data.
   Je to limit kompaktní cache, **nikoli celé RAM prohlížeče**. Aktivní
   historie a dočasný parse/model/grafy mají samostatnou cenu.
7. Cache má čas načtení a ruční obnovu; **není automatický TTL polling**.
   Při chybě obnovy zůstává poslední cache zřetelně označená. Neúspěchy se
   bez nové uživatelské akce znovu nestahují. Obecná per-station cache004
   pro rychlé přepínání hlavního dashboardu tím ještě není hotová.

Jeden model aktuálního rozsahu sdílí plné souhrny, menší vizualizace a memo
porovnání/nočního výsledku/vyhlazení. Alternativní nezávislé rozsahy nemají
neomezenou cache. Min/max časový výběr má≤600 bodů včetně vizuálních null
značek velkých mezer; XY≤580 skutečných reprezentantů24×24buněk a krajních
hodnot. Počet XY bodů neznamená hustotu výskytu. mV/h má≤396 reprezentantů
min/max časových binů, statistický počet původních sklonů je zvlášť.

Párování používá binární meze O(n log m), pro přesně sladěné exporty rychlou
lineární větev. Vyhne se kvadratickému průchodu duplicit. Je deterministické
monotónní chamtivé, nikoli hledání globálně největšího počtu párů.

## Rozšíření a otevřené práce

Centrální stavy zůstávají v [roadmapě](NAPADY_A_ROADMAP.md), bez nových ID:
004/007/019/020/025/028/029/030/031/032/034/036/037.

- Skutečné úhrny017/049 až s resetem, jednotkami a firmware kontraktem.
- Potvrzená detekce nabíjení/energetické cykly021/057 až se zapojením,
  proudem a teplotou článku; samotné V nepostačí.
- Obecný X/Y výběr030, další veličiny a nastavitelná tolerance025/029,
  nejistota vztahů031 a metadata071 zůstávají dalšími etapami.
- Heatmapa srážek/pokrytí034 potřebuje srážkový/měřicí kontrakt; nevyvozuje
  se dostupnost senzoru z počtu buněk.
- Pro skutečně obrovské historie lze podle měření přidat dělené přípravy
  modelu/worker nebo ověřené serverové agregace. První úplný250k výpočet
  má cenu O(n); žádný příslib nulové prodlevy nebo fyzického iOS měření.

Ověření a surové profily: [ETAPA13](performance/ETAPA13.md). Safari/WebKit
v tomto prostředí není instalovaný; testované je skutečné Chromium včetně
mobilního dotyku, nikoli fyzický iPhone nebo živé externí služby.
