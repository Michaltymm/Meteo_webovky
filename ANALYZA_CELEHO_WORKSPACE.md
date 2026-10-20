# Technický audit celého workspace ESP_Code a VS_code

**Datum auditu:** 20. 10. 2026, Europe/Prague  
**Charakter práce:** statická analýza lokálního snapshotu, doplněná izolovanými kontrolami vybraných funkcí JavaScriptu.  
**Jediný vytvořený soubor:** tento dokument. Existující zdrojové kódy, konfigurace a dokumentace nebyly upravovány, přesouvány ani mazány.

## 1. Celkové shrnutí workspace

Workspace představuje jeden meteorologický systém rozdělený do dvou hlavních částí:

- **ESP_Code:** firmware autonomních ESP32 meteostanic, diagnostické sketche, historie vývoje a serverová logika Google Apps Script včetně návrhu novějšího tabulkového úložiště.
- **VS_code:** samostatný webový dashboard, který čte meteorologická data z Google Sheets a volitelně přes MQTT. Součástí je jednoduchý Node.js server pro obsluhu statických souborů a vnořená další pracovní kopie webu.

**Ověřený závěr:** hlavní problém není nedostatek funkcí. V prostředí existuje několik souběžných generací firmwaru, příjmu dat, tabulkového schématu i webu, mezi nimiž není jednoznačně popsána hranice aktuálního nasazení. Současně jsou v kódu konkrétní chyby ovlivňující záznamy, statistiky, přepínání stanic a obnovování dat.

**Odborný názor:** jde o hodnotný funkční prototyp s promyšlenými prvky pro provoz na baterii a při výpadcích WiFi. Jeho další růst bych nyní řídil především spolehlivostí dat, reprodukovatelností nasazení a zjednodušením údržby. Nové vizuální funkce mají menší přínos než odstranění chyb, kvůli nimž může přehledná aplikace zobrazovat nesprávná data.

Nejdůležitější body auditu:

1. Ve sjednoceném firmwaru jsou pulzy srážkoměru odebrány z čítače dříve, než je ověřeno úspěšné trvalé uložení záznamu.
2. V novějším `MASTER_Script.js` se deduplikace dívá na sloupec A obsahující pouze datum, přestože skutečný čas je uložen ve sloupci B. Opakované odeslání běžného záznamu vytváří duplicity.
3. Web používá globální stav aktivní stanice a neruší rozpracované požadavky. Pozdější odpověď původní stanice může změnit data nebo konfiguraci nové stanice.
4. Inkrementální kontrola webu vytváří nesprávnou URL a předpokládá jinou řádkovou strukturu, než jakou uvádí dokumentace starého příjmu dat.
5. Změna Google Sheets na nové schéma není dokončeným společným kontraktem: liší se význam sloupců, formát času, typy dat i umístění poznámek.
6. HTTPS firmware výslovně vypíná ověřování serverového certifikátu. Lokální statický server současně nemá omezení obsluhovaných cest a není navázán výhradně na localhost.

### 1.1 Přesný rozsah a omezení

Analyzované kořeny:

- `C:\Users\micha\OneDrive - CZU v Praze\7_Projects_3D\A__Meteo_stanice_printables\ESP_Code`
- `C:\Users\micha\OneDrive - CZU v Praze\7_Projects_3D\VS_code`

Třetí přístupný projekt `Projekt_TWA` nebyl součástí zadání a nebyl zkoumán.

| Rozsah při zahájení auditu | ESP_Code | VS_code | Celkem |
|---|---:|---:|---:|
| Soubory mimo interní adresáře .git | 116 | 11 | 127 |
| Adresáře mimo interní adresáře .git, bez samotných kořenů | 96 | 4 | 100 |
| Velikost souborů mimo .git, bajty | 2 537 951 | 368 754 | 2 906 705 |
| Soubory otevřené pro obsahovou kontrolu alespoň automaticky | 106 | 5 | 111 |
| Soubory mimo .git záměrně neotevřené | 10 | 6 | 16 |

Rekurzivní inventář včetně interních adresářů Gitu obsahoval **634 položek: 358 souborů a 276 adresářů**. Z toho 231 souborů tvoří interní data dvou Git repozitářů. Všechny nalezené cesty jsou uvedeny v přílohách. Výsledný audit není zahrnut do vstupních počtů.

Obsahová kontrola 111 souborů zahrnovala automatické čtení a výběr strukturálních údajů; klíčové soubory a rizikové úseky byly navíc ručně odborně posouzeny. **Neznamená to úplnou ruční revizi každého řádku všech historických verzí.** Příloha A rozlišuje podrobné posouzení, průřezovou kontrolu a pouhou evidenci metadat.

Omezení a hranice jistoty:

- Oba požadované kořeny bylo možné rekurzivně vypsat. Při závěrečném mapování nebyla hlášena nepřístupná podsložka.
- **Credentials.md a Credentials.txt nebyly obsahově otevřeny ani hashovány.** Jejich existence a velikosti pocházejí pouze z inventáře.
- Z preventivních důvodů nebyly otevřeny ani čtyři webové konfigurační JSON soubory, `setup.txt`, `remote_parse.txt`, šest sériových záznamů, profil CoolTerm a binární zástupce. U těchto souborů se nevyvozuje závěr o konkrétním obsahu.
- U běžných zdrojových kódů byly konfigurační hodnoty filtrovány. Jedno historické pole s jiným názvem nebylo při prvním zobrazení úseku pokryto filtrem; filtr byl následně rozšířen. Do tohoto dokumentu nebyly převzaty hodnoty hesel, tokenů, názvy sítí ani identifikátory soukromých endpointů.
- Nebyla ověřována skutečná flash na ESP32, zapojení hardware, kalibrace měřidel, kapacita nasazené NVS partition ani oprávnění živých Google tabulek a webových aplikací.
- Nebyly prováděny požadavky na projektové webhooky, MQTT broker, datové tabulky ani externí CORS proxy. Online ověření se týkalo pouze veřejné oficiální technické dokumentace.
- V prostředí nebyly nalezeny dostupné příkazy Node.js, npm, Arduino CLI ani PlatformIO. Nebyl proveden build firmwaru, start serveru, integrační test Apps Scriptu ani vizuální test v prohlížeči.
- Git byl použit pouze ke čtení seznamu sledovaných cest a stavu pracovních kopií, s vypnutými volitelnými zámky. Jednorázová volba `safe.directory` byla předána příkazu; globální konfigurace Gitu se neměnila.
- Tvrzení v existujících návodech o počtu záznamů, úspěšných migracích nebo provozní stabilitě nejsou sama o sobě důkazem skutečného současného provozu.

### 1.2 Jak číst nálezy a priority

- **Ověřeno v kódu:** přímo viditelná vlastnost či chyba lokálních souborů.
- **Ověřeno izolovanou kontrolou:** navíc reprodukováno nad vybranou funkcí nebo výrazem v paměti.
- **Potenciální riziko:** konkrétní mechanismus existuje, ale jeho výskyt v provozu závisí na hardwaru, nasazení nebo datech.
- **Odborný názor / doporučení:** návrh směru vývoje, nikoli tvrzení o změřeném provozu.

| Priorita | Význam |
|---|---|
| P0 podmíněná | Okamžitá reakce, pokud se potvrdí vystavení nechráněného serveru či citlivých údajů veřejnosti. Audit takové vystavení nedokazuje. |
| P1 | Opravit před dalším produkčním rozšířením; hrozí chybná nebo ztracená data, narušení integrity či významné bezpečnostní oslabení. |
| P2 | Zahrnout do nejbližší stabilizační etapy; údržba, výkon, diagnostika a méně časté hraniční stavy. |
| P3 | Následný úklid a uživatelská vylepšení s menším dopadem na správnost. |

## 2. Přehled struktury složek

Následující přehled shrnuje role hlavních větví. Úplný rekurzivní seznam adresářů je v příloze B a úplný seznam souborů v přílohách A a C.

~~~text
ESP_Code/
  .agents/                       Pravidla pro práci na firmwaru
  Kalibrace_CODE/                 Diagnostika, historické Apps Script zálohy, sériové logy
  New_system_google sheets/      Nový model Raw_Data + agregace, migrace a pomocné nástroje
  Same_but_not/                  Čtyři velmi podobné sjednocené sketche
    _1_Msene_lazne/
    _2_Praha/
    _3_Home_testovaci/
    _4_TEST/
  _1_Mšene_lazne/                Historie A2 až B1_17 a pozdější varianty
  _2_Praha/                     Samostatná historie včetně Aktualni a větví robust
  _3_TESTOVACI_home/             Vývoj HOME_16_6 až HOME_17_06
  Zaznamy_serial_monitor/        Prázdný adresář
  GPT_Guide.md
  Programming_guide.md
  Script_load_data_Google_sheets
  B1.1_webovka_stranka.html
  Credentials.md, Credentials.txt  Obsah vynechán

VS_code/
  .git/                          Hlavní Git repozitář
  index.html                     Hlavní dashboard
  server.js                      Jednoduchý statický HTTP server
  config*.json                   Čtyři konfigurace; obsah vynechán
  README.md
  Navrhy_Vylepseni.md
  setup.txt, remote_parse.txt     Obsah preventivně vynechán
  Git/
    MQTT_webovky/
      .git/                      Druhý, vnořený Git repozitář
      index.html                 Jiná verze dashboardu
      Git/MQTT_webovky/           Prázdná další vnořená cesta
~~~

| Větev ESP_Code | Souborů | Velikost, bajty | Poznámka |
|---|---:|---:|---|
| Kořen | 6 | 40 549 | Návody, příjem dat, starý web, vynechané Credentials |
| .agents | 1 | 3 293 | Pravidla práce |
| Kalibrace_CODE | 18 | 1 126 718 | Většinu objemu tvoří nečtené logy |
| New_system_google sheets | 15 | 326 316 | Nová datová architektura a související kopie webu |
| Same_but_not | 4 | 103 285 | Sjednocená větev pro čtyři stanice |
| _1_Mšene_lazne | 48 | 452 210 | Historické sketche a konfigurace editoru |
| _2_Praha | 15 | 217 501 | Historické a alternativní pražské verze |
| _3_TESTOVACI_home | 9 | 268 079 | Domácí testovací větev |

V obsahově kontrolované množině je 54 Arduino sketchů, 11 souborů JavaScriptu, 4 HTML soubory, 9 Markdown dokumentů, 9 textových souborů, 22 editorových JSON souborů, jeden workspace soubor a jeden skript bez přípony.

## 3. Analýza ESP_Code

### 3.1 Účel, hardware a technologie

**Ověřeno:** hlavním účelem je měřit teplotu, tlak, relativní vlhkost, srážky a napětí napájení a data odesílat do Google Sheets přes Google Apps Script.

Novější sjednocená větev používá:

- Arduino C++ na ESP32, knihovny `WiFi`, `WiFiClientSecure`, `HTTPClient`, `WiFiUDP` a `NTPClient`.
- `Preferences` jako rozhraní NVS pro persistentní denní srážky a frontu neodeslaných záznamů.
- I²C a `Adafruit_BME280` / `Adafruit_Sensor` pro BME280, standardně na adrese 0x76.
- GPIO 34 pro Hallův senzor; zdrojový komentář správně vyžaduje externí pull-up.
- GPIO 35 pro baterii, GPIO 33 pro přidané měření solárního panelu a GPIO 2 pro LED.
- Light Sleep, časové probouzení a u osazených srážkoměrů EXT1 probouzení.
- Výpočet tlaku přepočteného k hladině moře z tlaku senzoru, výšky a teploty. Zda kalibrace odpovídá požadované meteorologické metodice, nebylo fyzicky ověřeno.

Historické větve navíc používají ThingSpeak, některé ArduinoJson a některé task watchdog. Samotný `#include` je důkaz deklarované závislosti, nikoli důkaz, že je daná služba v každé verzi aktivně využívaná.

V žádném z požadovaných kořenů nebyl nalezen `platformio.ini`, `sketch.yaml`, přehled přesných verzí Arduino core a knihoven, tabulka partition ani automatizované build workflow. Historické verze s různými API watchdogu proto nelze považovat za zaměnitelné buildy.

### 3.2 Která větev vypadá jako výchozí

**Ověřeno:** `GPT_Guide.md` odkazuje na čtyři soubory v `Same_but_not`. Ty mají hlavičku s datem 11. 9. 2026 a obsahují obdobnou zkrácenou implementaci. V `_2_Praha/Aktualni` však stále leží starší varianta s jinou implementací bufferu. Název „Aktualni“ tedy není spolehlivým vodítkem.

| Soubor ve Same_but_not | Řádků | Interval měření | Výška v kódu | Srážkoměr |
|---|---:|---:|---:|---|
| Msene_lazne_unified.ino | 572 | 5 min | 220 m | Přerušení a EXT1 aktivní |
| Praha_unified.ino | 587 | 10 min | 220 m | Přerušení a Hall probouzení zakomentované |
| Home_unified.ino | 573 | 5 min | 220 m | Přerušení a EXT1 aktivní |
| TEST_unified.ino | 572 | 5 min | 400 m | Přerušení a EXT1 aktivní |

Pražské vypnutí Hallova vstupu odpovídá výslovnému požadavku v `Programming_guide.md` na stanici bez osazeného srážkoměru. Dokument `GPT_Guide.md` ovšem pro Prahu uvádí výšku 400 m, zatímco kód obsahuje 220 m. **Jde o ověřený rozpor, nikoli o důkaz, která hodnota je správná.** Referenční konfigurace z Credentials nebyla čtena a fyzická výška nebyla ověřována.

**Doporučení:** označit jeden společný základ a pro každou fyzickou stanici evidovat přesnou verzi, konfigurační profil, datum flashnutí a variantu zapojení. Během tohoto auditu nebyla žádná větev změněna ani zvolena k nasazení.

### 3.3 Datový tok sjednoceného firmwaru

1. `setup()` inicializuje periferie, otevře NVS a načte denní úhrn a metadata fronty. Při dostupné síti provede úvodní `sendData()`.
2. Čas vzniká z NTP a od poslední synchronizace se dopočítává přes rozdíl `millis()`.
3. `sendData()` ověří existenci časové synchronizace, změří baterii a solár a zprůměruje tři čtení BME280.
4. Atomicky převezme a vynuluje čítač pulzů, přičte srážky k dennímu úhrnu a sestaví záznam.
5. Záznam uloží do kruhového bufferu NVS.
6. Připojí WiFi a odešle nejvýše 30 záznamů. Záznam se odebírá při HTTP 200 a odpovědi začínající `OK`.
7. `loop()` provádí denní reset, kontroluje interval a přechází do Light Sleep.

Aktivní datový formát obsahuje devět položek:

~~~text
DD.MM.YYYY;HH:MM:SS;teplota;tlak;vlhkost;prirustek_srazek;denni_srazky;nadrz;baterie
~~~

Rozšíření na 16 položek je v `Same_but_not` připraveno, avšak jeho připojení do odesílaného řetězce je zakomentované. Solární napětí se přesto již měří. Starý příjem v kořeni projektů 16 položek parsuje, ale telemetrii do výsledného řádku také záměrně nezapisuje.

**Ověřeno:** nejde o zaručené „exactly once“ doručení. Při ztracené odpovědi může firmware znovu odeslat záznam, který již server uložil. Spolehlivou integritu musí zajistit jednoznačná identita měření a idempotentní příjem na serveru.

### 3.4 Vývojová historie a diagnostika

Historie má reálnou hodnotu:

- A2 až rané B1 dokumentují přechod od jednoduchého Hallova měření a ThingSpeak k BME280, NVS a Sheets.
- B1_6 a další přidávají ukládání při nedostupnosti sítě.
- Některé starší varianty používají posouvané `buffer_size`; novější HOME a sjednocené soubory přecházejí na `buf_head` / `buf_count`.
- Větve `robust` obsahují `AppState`, stavový automat a watchdog. Sjednocená větev jde jiným směrem a aplikační watchdog výslovně nepoužívá.
- Diagnostické sketche zkoušejí I²C adresy, Hallův senzor a WiFi. Jsou vhodné pro ruční oživení hardware, nepředstavují však regresní test celého systému.

`PR_B1_17_1_robust.ino` používá funkci `sendHTTPWithWatchdog()`. Její komentář slibuje průběžné resetování během čekání, ale vlastní smyčka okamžitě končí přes `break` a následuje blokující `http.GET()`. Reset probíhá před a po požadavku, nikoli průběžně uvnitř GET. To je konkrétní nesoulad implementace a komentáře v alternativní historické větvi; nejde o důkaz, že je tato větev aktuálně nasazena.

## 4. Analýza Google Apps Script a Google Sheets

### 4.1 Starší příjem dat

`ESP_Code/Script_load_data_Google_sheets` obsahuje `doGet(e)` pro list `Prijem_dat`. Rozpoznává starší osmipoložkový payload bez data, devítipoložkový payload a rozšířený payload s nejméně 16 položkami. Zapisuje 16 sloupců, nový řádek vkládá na pozici 3 a duplicity zkoumá v pěti nejnovějších řádcích podle data a minuty.

To je jednoduché a zpětně kompatibilní řešení, ale má hranice:

- Osmipoložkovému záznamu se doplňuje datum při příjmu. Při pozdějším odeslání z bufferu přes půlnoc nelze původní datum obnovit.
- Vkládání řádků nahoře posouvá existující obsah a zvyšuje závislost na vzorcích, rozsazích a počtu záznamů.
- Část čísel se posílá do tabulky jako text po nahrazení tečky čárkou. Výsledné typy a výpočty závisejí na locale tabulky.
- Deduplikace pěti řádků podle minuty není trvalá jedinečnost měření.
- Funkce neobsahuje `LockService` ani vlastní kontrolu oprávnění zapisující stanice.

Dokumentace `Google_sheets_guide_agent.md` popisuje další vrstvu `Hlavni_datovna` s daty A–I, poznámkami J a mnoha horizontálními výpočtovými bloky. To je **popis převzatý z lokální dokumentace**; živé listy a vzorce se neověřovaly.

### 4.2 Nový model v New_system_google sheets

Nový návrh vytváří šest listů:

| List | Role |
|---|---|
| Raw_Data | Chronologicky přidávané surové záznamy, 18 sloupců |
| Daily_Summary | Denní minima, průměry, maxima, srážky a počet vzorků |
| Monthly_Summary | Měsíční agregace |
| Dashboard | Přehled založený na vzorcích a grafech |
| Explorer | Výběr veličiny a rozsahu |
| Config | Konfigurační/příkazová data |

**Odborný názor:** oddělit surová data od agregací je správný směr. Umožňuje přepočítat statistiky a přestat využívat rozsáhlé horizontální bloky jako neformální API.

Implementace je však rozptýlena mezi několik alternativ:

- `Script_v2_Google_sheets.js`: příjem, appendRow a průběžné denní/měsíční agregace.
- `MASTER_Script.js`: podobný příjem doplněný o migrace a správní funkce; obsahuje významné rozdíly v datových typech.
- `Migrate_Data.js` a `Fixed_Migration.js`: různé migrační postupy a vlastní evidence postupu.
- `Finalize_Utils.js`, `Populate_Formulas.js` a `bundled_escaped.js`: překrývající se sestavení agregací, vzorců a dashboardu.
- `Setup_Sheets.js`: jednorázové založení listů.
- `test_webhook.js`: samostatný Node.js odesílač, který ale používá jiný protokol než příjem.
- `apply_glassmorphism.js`: nástroj pro změnu vzhledu lokálního HTML, nikoli Apps Script.

Tyto soubory **nelze bez rozmyslu vložit do jednoho Apps Script projektu**. Opakují globální funkce, například `doGet`, `sortRawData` či `clearRawData`. Názvy mohou kolidovat a není určeno jediné zdrojové místo produkčního příjmu.

### 4.3 Zásadní rozpory nového schématu

`Script_v2_Google_sheets.js` zapisuje do prvních dvou sloupců plný timestamp. `MASTER_Script.js` naproti tomu zapisuje do A datum bez času a do B plný timestamp. Převzatá deduplikace v MASTER stále čte pouze A. Izolovaná kontrola stejného payloadu dvakrát vytvořila dva řádky.

Další rozpor je mezi jednorázovým sestavením agregací a průběžným příjmem:

- `MASTER_Script.js/summaries()` zapisuje do prvního sloupce denních a měsíčních agregací textové klíče.
- `upsertDailySummary()` a `updateMonthlySummary()` hledají pouze hodnoty typu `Date`.
- Již vypočtený textový den tedy průběžný příjem nepoužije a vytvoří další řádek. Tento stav byl reprodukován v paměti.

Rovněž se mění statistická definice měsíčního průměru. Dávkové `summaries()` průměruje jednotlivá měření, zatímco průběžný výpočet průměruje denní průměry bez vah. Dny s odlišným počtem vzorků mohou dát jiný výsledek. Je třeba předem zvolit a zdokumentovat zamýšlenou definici.

## 5. Analýza VS_code

### 5.1 Webová aplikace

`VS_code/index.html` má **4 879 řádků a 190 763 bajtů**. Obsahuje HTML, rozsáhlé CSS a aplikační JavaScript v jednom souboru. Používá přímo načítané knihovny Chart.js 4.4.0 a Paho MQTT 1.1.0. Pro UV index se dotazuje Open-Meteo; další astronomické údaje počítá lokálně.

Podporované funkce zahrnují:

- tři webové stanice s oddělenou konfigurací;
- aktuální hodnoty, historii, grafy, průzkumník rozsahů a porovnání dnů;
- denní, měsíční a roční statistiky;
- poznámky, témata, lokální uložení nastavení a export/import konfigurace;
- přehled ostatních stanic;
- úvodní omezené načtení do 400 řádků a pozdější načtení celé historie;
- označení záložek jako neaktuálních a následné přepočítání právě zobrazené záložky;
- volitelný příjem MQTT zpráv.

Aplikace neobsahuje framework ani build systém. Pro aktuální rozsah to není samo o sobě chyba. Závislosti pro web jsou však mimo lokální repozitář na CDN a v inventáři není lokální alternativní kopie, manifest PWA ani service worker.

**Ověřeno:** web má tři profily, zatímco firmware dokumentuje čtyři stanice. Jejich číslování a názvy nejsou totožné. Automatickou vazbu „firmware #2 = webový index 1“ nelze bezpečně předpokládat.

### 5.2 Načítání dat a vnitřní stav

Primárním zdrojem je CSV přes Google Visualization endpoint. Konfigurace v hlavním HTML standardně ukazuje na `Hlavni_datovna` nebo `Prijem_dat`, nikoli na `Raw_Data`. Při selhání přímého čtení aplikace zkouší dvě veřejné CORS proxy.

Data jsou uložena v jednom globálním `store`; aktivní konfigurace je globální `CFG`. Přepnutí stanice vynuluje frontendu data a spustí další načítání. Původní požadavky ani jejich odložené parsování však nejsou zneplatněny.

Některé požadavky již používají `AbortSignal.timeout`. **To řeší časový limit konkrétního požadavku, ale neřeší vazbu odpovědi na stanici.** Plné načítání navíc vlastní timeout nemá. Při pomalých odpovědích a periodickém spouštění mohou požadavky překrývat.

### 5.3 MQTT větev

Web MQTT implementuje přes WebSocket klienta Paho a JSON zprávy. **V kontrolovaných ESP sketchích nebyl nalezen MQTT publisher ani knihovna MQTT.** Přímá cesta ESP32 → MQTT broker → tento web tedy není v obou projektech doložena. MQTT je dostupná frontendová možnost pro jiný nebo dosud nedoložený zdroj.

`connectMQTT()` nevytváří spravovanou sdílenou instanci klienta a při změně stanice starý klient neodpojuje. Každé spuštění může přidat další odběr a další reconnect časovač. MQTT zprávy se ukládají bez omezení délky historie a bez důsledné deduplikace vůči Sheets.

TLS režim je odhadován z čísla portu. Výslovná konfigurace `wss` / `ws` by byla srozumitelnější; podporu konkrétního brokeru nelze potvrdit bez znalosti jeho WebSocket konfigurace.

### 5.4 Lokální server

`server.js` má 28 řádků a využívá pouze standardní Node.js moduly `http`, `fs` a `path`. Není pro něj potřeba instalovat framework ani npm balíčky.

Je ovšem velmi jednoduchý:

- soubor odvozuje přímo z `req.url` a `process.cwd()`;
- neověřuje, že výsledná cesta zůstala v povoleném webovém adresáři;
- nezakazuje `.git`, konfigurační soubory a dokumentaci;
- používá synchronní čtení souborů;
- pro úspěšné odpovědi povoluje `Access-Control-Allow-Origin: *`;
- poslouchá na portu 8080 bez explicitního hostname.

Podle [dokumentace Node.js k server.listen](https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback) vynechaný hostname znamená naslouchání na nespecifikované adrese, nikoli omezení na localhost. Skutečná dostupnost zvenku závisí také na firewallu a síťové konfiguraci.

**Doporučení:** před sdílením serveru omezit obsluhu na samostatný veřejný adresář, ověřovat normalizovanou cestu a pro lokální práci explicitně použít `127.0.0.1`. Samotné `path.join` hranici adresáře nevynucuje; řeší spojení a normalizaci cesty. Viz [Node.js Path](https://nodejs.org/api/path.html#pathjoinpaths). Během auditu nebyl server spouštěn ani zkoušen požadavek na soubor mimo kořen.

### 5.5 Kopie webu a stav Gitu

`VS_code/Git/MQTT_webovky/index.html` má 165 455 bajtů a jiný hash než hlavní HTML. Navíc existuje další HTML kopie v `ESP_Code/New_system_google sheets/nepotrebne_index_v2.html` a starší ThingSpeak web `B1.1_webovka_stranka.html`. Jde o různé soubory, nikoli prokázané identické kopie.

Hlavní repozitář měl před vytvořením auditu čistý stav. Ve vnořeném repozitáři již při prvním čtení existoval změněný `index.html` a sledované chybějící cesty, například README, konfigurace a další vnořený index. **Tyto změny nevznikly auditem.**

Vnější repozitář sleduje také soubor uvnitř vnořené pracovní kopie. Tato kombinace zvyšuje pravděpodobnost commitu do jiného repozitáře, než vývojář očekává. Nebyla provedena změna větví, remote adres ani historie.

## 6. Vzájemné souvislosti a datové kontrakty

### 6.1 Současný doložený tok a připravovaná alternativa

~~~mermaid
flowchart LR
  BME[BME280 a ADC] --> ESP[ESP32 firmware]
  HALL[Hallův senzor] --> ESP
  ESP --> NVS[Lokální NVS fronta]
  NVS --> GET[HTTPS GET data]
  GET --> LEG[Starší doGet]
  LEG --> PRI[Prijem_dat]
  PRI -. návody a historické transformace .-> HL[Hlavni_datovna]
  PRI --> CSV[Veřejný CSV export]
  HL --> CSV
  CSV --> WEB[Webový dashboard]
  GET -. alternativní lokální implementace .-> V2[Nový doGet]
  V2 --> RAW[Raw_Data]
  V2 --> DAILY[Daily_Summary]
  DAILY --> MONTH[Monthly_Summary]
  RAW -. vyžaduje adaptaci schématu .-> WEB
  BROKER[Externí MQTT broker] -. volitelný WebSocket příjem .-> WEB
  OM[Open-Meteo UV] --> WEB
~~~

Plné čáry vyjadřují implementované vztahy ve zdrojích. Přerušované čáry znamenají alternativu, dokumentovaný mezikrok nebo neověřenou integraci. Diagram nepotvrzuje, která serverová varianta právě běží v Google Apps Scriptu.

### 6.2 Rozdíly mezi jednotlivými formáty

| Vlastnost | Historický payload | Sjednocený payload | Starý příjem / Hlavni_datovna | Nové Raw_Data |
|---|---|---|---|---|
| Identita stanice | Vlastní URL/konfigurace | Vlastní URL/konfigurace | Oddělení přes tabulku | Výslovné station_id chybí |
| Čas | Samotné HH:MM:SS | Datum a čas zvlášť | Datum/čas v A/B | A datum nebo timestamp podle skriptu, B timestamp |
| Počet položek | 8 | Aktivně 9, připraveno 16 | Příjem 16 sloupců; hlavní web očekává A–I + J | 18 sloupců |
| Chyba senzoru | Závisí na verzi | Náhradní číselné hodnoty | Částečně text / prázdné hodnoty | Parsování mnohdy převádí neplatnou hodnotu na 0 |
| Poznámka | Není součástí payloadu | Není součástí aktivního payloadu | Web očekává J | R, index 17 |
| Rosný bod | Není | Není | Web jej počítá | J; jiný výpočet než na webu |
| Zóna času | Různá podle verze | Ruční offset | Často pevné GMT+2 | Směs GMT+2, Europe/Prague a runtime zóny |

Význam sloupce J je zvlášť důležitý: v hlavním webu je J považováno za poznámku, v `Raw_Data` obsahuje rosný bod a ve starém `Prijem_dat` je to vyhrazené místo pro solár. Pouhé přepnutí názvu listu proto není migrací aplikace na nové schéma.

**Doporučený cílový kontrakt:** `schema_version`, `station_id`, `measurement_id`, UTC timestamp, jednotky jednotlivých veličin a explicitní příznaky kvality. Na vstupu ponechat adaptér pro osm a devět položek. Historické datum z osmipoložkových záznamů nelze zpětně spolehlivě dopočítat; takové záznamy je vhodné označit jako časově nejisté.

## 7. Technické problémy a potenciální rizika

V následující části jsou technická zjištění oddělena od navrhovaných oprav. Řádky odkazují na snapshot souborů při auditu. U souborů Same_but_not je reprezentativním příkladem `Same_but_not/_4_TEST/TEST_unified/TEST_unified.ino`, pokud není uvedeno jinak.

### 7.1 Firmware: integrita měření

**F01 — P1 — Pulzy se spotřebují před bezpečným uložením. Ověřeno v kódu.**

Důkaz: `TEST_unified.ino:360` vynuluje `pulseCount`, `:366` zapíše denní součet a až `:413` zkouší `putString` záznamu. Při chybě zápisu pouze zaloguje problém. Pulzy se nevracejí do čítače a záznam nemusí existovat ve frontě. Při výpadku napájení mezi jednotlivými zápisy mohou součet, fronta a její metadata vyjadřovat různé stavy.

Doporučení: oddělit převzetí měření od jeho potvrzeného uložení, navrhnout obnovu rozpracovaného záznamu a kontrolovat návratové hodnoty NVS. Při jednoduchém vracení pulzů je nutné zohlednit i již navýšený denní součet, aby oprava nezpůsobila dvojí započtení. Ověřit injekcí chyby zápisu a restartem v každém přechodu.

**F02 — P1 — Hranice dne není součástí jedné konzistentní operace měření. Ověřeno v kódu; konkrétní provozní dopad závisí na okamžiku restartu a pulzech.**

Důkaz: `TEST_unified.ino:508` zavolá `sendData()` v setup ještě před denním resetem v `loop():515`. Po restartu v jiném dni tak může první záznam použít starý uložený úhrn. U běžného půlnočního cyklu se zase denní součet vynuluje dříve, než se převezmou pulzy nahromaděné od předchozího měření; interval přes půlnoc se celý přiřadí podle okamžiku zpracování. Ukládaný `lastDay` obsahuje jen den v měsíci.

Doporučení: uložit plný datumový klíč, při startu nejprve ověřit platný čas a provést denní přechod, poté pořizovat nové měření. Výslovně určit, jak se srážky intervalu přes půlnoc účtují; pro přesné rozdělení je potřeba časově zachytávat pulzy nebo průběžné dílčí součty.

**F03 — P1 — Selhání BME280 vytváří věrohodná měření. Ověřeno v kódu.**

Důkaz: `TEST_unified.ino:159` nastaví při neplatných čteních 0 °C, 1013,25 hPa a 50 %. Následně se tlak ještě přepočítá podle výšky. Příznak BME se sice vypočítá, ale jeho odesílání je zakomentováno v `:395`. Server ani uživatel pak nemusí rozpoznat, že tato čísla nejsou měření.

Doporučení: používat explicitní kvalitu / nullable veličiny, uchovat reálné srážky i při vadném BME a chybu čidla zobrazit ve webu. Výběr náhradní meteorologické hodnoty nesmí zvyšovat počet platných vzorků v agregacích.

**F04 — P1 — Kapacita 500 záznamů není prokázanou kapacitou trvalého úložiště. Potenciální riziko.**

Důkaz: `MAX_BUFFER_SIZE` je 500, ale v inventáři chybí partition definice. Již samotné hodnoty 500 řetězců po přibližně 70–100 znacích potřebují 35–50 kB před započtením režie NVS, metadat a dalších klíčů. Z hodnoty konstanty tedy nevyplývá schopnost uložit 500 položek.

Při pětiminutovém intervalu odpovídá 500 měření přibližně **41 h 40 min**, při desetiminutovém **83 h 20 min**, pokud se jich skutečně podaří tolik uložit. Nejde o naměřenou offline výdrž.

Doporučení: ověřit nasazenou partition, sledovat chyby a skutečné naplnění a provést test plné fronty. Pro pravidelný záznam dat porovnat NVS s append-only žurnálem v LittleFS; rozhodnutí má vycházet z kapacity a odolnosti vůči restartu. Espressif popisuje Preferences jako úložiště vhodné především pro menší hodnoty a pro větší objemy doporučuje zvážit souborový systém. [Oficiální dokumentace Preferences](https://docs.espressif.com/projects/arduino-esp32/en/latest/tutorials/preferences.html)

**F05 — P1 — Ruční časový offset a rozpor dokumentace s implementací. Ověřeno.**

Důkaz: `TEST_unified.ino:76` používá ruční offset 2; `:478` jej předává NTPClient. `GPT_Guide.md:110` vyžaduje `gmtime()`, ale skutečný kód v `TEST_unified.ino:198` a dalších třech sjednocených souborech používá `localtime()`. Dokumentace rovněž uvádí odstranění/reset wakeup nastavení, zatímco kód obsahuje komentář o odstraněném disable volání.

Není prokázáno, že se v aktuálním běhu čas zdvojuje: při systémové zóně UTC může výsledek vycházet správně. Přidání další systémové zóny by však mohlo aplikovat offset podruhé. Pevné GMT+2 na serveru navíc není automatické přepínání Europe/Prague.

Doporučení: používat UTC jako interní čas a pojmenovanou zónu pro kalendářní zobrazení a agregace. Při migraci časového modelu zohlednit staré záznamy v bufferu; jejich čas se nesmí hromadně posunout bez znalosti původu.

**F06 — P2 — Studený start bez NTP neukládá běžná meteorologická měření. Ověřeno; jde o vědomý kompromis.**

Důkaz: `TEST_unified.ino:336` odloží celé `sendData()`, dokud neexistuje synchronizovaný čas. To chrání pulzy před původní chybou vynulování bez timestampu, ale při dlouhém výpadku po restartu se teplota, tlak a vlhkost vůbec nezapisují a pulzy zůstávají jen v RAM.

Doporučení: rozhodnout, zda požadovat RTC, obnovu posledního známého času s příznakem nejistoty, nebo pořadové číslo a dobu od bootu. Neodstraňovat NTP guard bez náhradního návrhu ochrany dat.

**F07 — P2 — Počítání CHANGE a probouzení vyžaduje hardwarový test. Potenciální riziko.**

Důkaz: `TEST_unified.ino:204` filtruje události 300 ms a `:492` připojuje přerušení na `CHANGE`. Sepnutí i rozepnutí mohou při dostatečném časovém odstupu vytvořit dva přírůstky. Zda to odpovídá kalibraci lžičky, nelze rozhodnout jen ze zdrojů.

Light Sleep zachovává stav paměti, ale CPU během spánku neprovádí běžné ISR. Je třeba ověřit skutečný přechod, probuzení a následné započtení, nikoli předpokládat nepřetržité vykonávání obsluhy. Viz [Espressif Sleep Modes](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/sleep_modes.html).

Doporučení: generátor definovaných pulzů, ověření při usínání/probouzení a porovnání s fyzickými překlopeními. Pro každý hardwarový profil evidovat polaritu, délku pulzu, pull-up a kalibraci.

**F08 — P2 — Časové a energetické náklady jsou větší, než naznačuje krátký měřicí interval. Ověřeno v kódu, provozní spotřeba nezměřena.**

Důkaz: WiFi sken, opakované pokusy, NTP synchronizace uvnitř každého úspěšného `connectToWiFi():265`, až 30 HTTP přenosů a `delay(1500)` mezi nimi. Jen pauzy při vyprázdnění 30 záznamů zaberou přibližně 45 sekund. BME průměrování přidává čtyři sekundy čekání. Dlouhé odesílání může minout časové okno `ss < 45` dalšího intervalu.

Navíc `readBatteryVoltage():167` vynucuje WIFI_OFF jen při `WL_CONNECTED`. Stav „nepřipojeno“ sám o sobě nedokazuje vypnuté rádio.

Doporučení: oddělit plán měření a přenosu, omezit přenos i celkovým časovým rozpočtem a měřit spotřebu. NTP synchronizovat podle stáří, ne bezpodmínečně při každém připojení. Zachovat požadavek na klidné napájení při ADC a nutné stabilizační prodlevy čidla.

**F09 — P2 — Vzdálená konfigurace a interval 45 minut nejsou hotová funkce. Ověřeno.**

Důkaz: `loadConfigFromSheets():304` je definovaná, ale ve sjednocené větvi se nevolá. Hlavní příjem v kořeni zároveň neimplementuje odpovídající konfigurační příkaz. `validateConfig():298` povoluje 45 minut, ale plánovač `:527` s podmínkou `minute % interval == 0` měří v minutách 00 a 45 každé hodiny, tedy se střídáním 45 a 15 minut.

Doporučení: buď funkci označit za připravenou a neaktivní, nebo dokončit obě strany protokolu a testy. Interval plánovat proti absolutnímu času dalšího měření, pokud má znamenat skutečně stejné rozestupy.

### 7.2 Serverová data, agregace a migrace

**G01 — P1 — MASTER nededuplikuje běžné opakované měření. Ověřeno izolovanou kontrolou.**

Důkaz: `MASTER_Script.js:88` čte při deduplikaci pouze A; `:131` tvoří datum bez času a `:134` jej ukládá do A. Čas z takové hodnoty se nemůže rovnat například 12:35 z payloadu. Kontrola dvou stejných vstupů vytvořila dva surové řádky.

Doporučení: jednoznačné `measurement_id`, případně přechodně ověření správného timestamp sloupce s identitou stanice. Pět posledních řádků nepokrývá dlouhý backlog ani obecné opakování po restartu.

**G02 — P1 — Příjem nechrání společné operace proti souběhu. Ověřeno v kódu; závod v živé službě nebyl vyvoláván.**

Důkaz: starý příjem i obě nové implementace odděleně provádějí „najdi / zkontroluj / zapiš“, bez `LockService`. U starého insertRows mohou souběžné požadavky přepsat řádek 3; u agregací mohou dvě aktualizace vycházet ze stejného předchozího počtu a jedna změnu druhé ztratit.

Doporučení: chránit nezbytnou sekci vhodným script lockem a definovat chování při nedostupném zámku. Zámek sám neřeší výpadek mezi zápisem Raw_Data a agregacemi. [Google Apps Script Lock Service](https://developers.google.com/apps-script/reference/lock)

**G03 — P1 — Surový zápis a agregace nemají společný obnovitelný stav. Ověřeno v kódu.**

Důkaz: `MASTER_Script.js:138` přidá surový řádek a teprve `:140` a `:143` aktualizuje souhrny. Pád nebo timeout mezi kroky může vytvořit surový záznam bez statistiky. Následný retry buď vytvoří duplicitu, nebo jej opravená deduplikace odmítne a agregaci sama nedoplní.

Doporučení: surový příjem považovat za jediný primární zápis. Agregace odvozovat opakovatelným přepočtem nebo zpracováním s potvrzeným watermarkem. Odpověď `OK` musí mít přesně definovaný význam.

**G04 — P1 — Agregace špatně zachází s nulou i typy datumových klíčů. Ověřeno izolovanými kontrolami.**

Důkaz: `MASTER_Script.js:178` a obdobné řádky používají `rowData[index] || nová_hodnota`. Platná nula je považována za chybějící hodnotu. Po minimu 0 °C a dalším měření +5 °C vyšlo minimum +5 °C. Tento vzor je také v `Script_v2_Google_sheets.js`.

Druhý problém popsaný v kapitole 4.3 vzniká tím, že `summaries():446` ukládá textový den, ale `upsertDailySummary():166` přijímá jen `Date`. Izolovaný test s již existujícím textovým dnem přidal další denní řádek.

Doporučení: odlišit 0, prázdnou hodnotu, neplatné číslo a chybějící údaj. Zvolit jeden typ klíčů a před agregací jej normalizovat. Přidat pevné příklady s teplotami přes nulu a s migrovanými daty.

**G05 — P1 — Migrace neřeší všechny kombinace typů data a času. Ověřeno v kódu; ztráta konkrétních historických časů není potvrzena.**

Důkaz: `Fixed_Migration.js:83` při typu Date v A použije `ts = rawDate` a ignoruje B. `MASTER_Script.js:334` obdobně bere datum i čas z A. Pokud A obsahuje datum o půlnoci a čas je zvlášť v B, migrace z něj udělá půlnoční měření. Pokud A již obsahuje celý timestamp, může být tento postup naopak správný. Je nutná diagnostika vstupního schématu.

Navíc zapsání dávky a posun uloženého kurzoru jsou samostatné operace. Opakování po výpadku může dávku vložit znovu. MASTER po dokončení maže postup; nové náhodné spuštění `migrate()` se může vrátit na začátek a zdvojit data. Třídění Raw_Data pouze podle A nezaručuje časové pořadí uvnitř dne.

Doporučení: deklarovat zdrojové schéma, normalizovat Date/text data i časy, kontrolovat počty a unikátnost a migraci udělat opakovatelnou podle ID. Rozlišit stav „nikdy nespuštěno“, „rozpracováno“ a „dokončeno“. Před případnou budoucí migrací vytvořit ověřenou kopii dat; při auditu se migrační funkce nespouštěly.

**G06 — P2 — Validace toleruje poškozené údaje a mění jejich význam. Ověřeno.**

Důkaz: nový příjem `parseNum` převádí chybějící i nečíselný vstup na 0. Konstruktor `new Date(...)` může normalizovat neplatný kalendářní den místo odmítnutí. Starý fallback doplňuje aktuální datum. Příjem nerozlišuje dostatečně přesně všechny povolené délky payloadu.

Doporučení: přesné verze schématu, konečná čísla, fyzikální rozsahy a ověření zpětným porovnáním složek datumu. Neplatný vstup odmítnout nebo uložit do karantény. Nulu nevydávat za univerzální náhradu poruchy senzoru.

**G07 — P2 — Pomocné vzorce a průběžné agregace sledují jinou strukturu. Ověřeno.**

Důkaz: `Populate_Formulas.js:65` používá pro „24 h“ timestamp ve sloupci A. MASTER však v A ukládá datum bez času. Filtr proto neumí přesně posledních 24 hodin. Vzorce hledající Date přes TODAY se navíc rozcházejí s variantami, které v summary ukládají text; jiné utility používají TEXT(TODAY()).

Doporučení: vytvářet vzorce ze stejné definice schématu jako zápis. Otestovat shodu dávkového přepočtu a online agregací pro různě hustě vzorkované dny, nuly a pozdní doplnění historie.

### 7.3 Web: správnost a spolehlivost zobrazení

**W01 — P1 — Odpověď původní stanice může změnit nově vybranou stanici. Ověřeno v kódu.**

Důkaz: `index.html:2687` přepíná globální `activeIdx` a `CFG`. `tryLoadConfigJson():2796` si sice uchová index pro výběr souboru, ale `_applyCfgObject():2843` zapisuje do právě aktivního indexu. Stejný problém má `fetchSheets` se společným `store` a odloženým parsováním. Starý síťový požadavek není zrušen ani odmítnut podle identifikátoru stanice.

Reprodukční scénář: zahájit pomalé načtení A, přepnout na B, dokončit požadavek A. Podmínky v kódu nebrání tomu, aby se výsledek A použil pro B.

Doporučení: zachytit identitu stanice a generaci požadavku, při přepnutí zrušit související fetch a před zápisem ještě ověřit aktuálnost. Pro konfiguraci předávat cílový profil výslovně.

**W02 — P1 — Inkrementální kontrola skládá vadnou URL a může sledovat hlavičky. Ověřeno výrazem a strukturou zdrojů.**

Důkaz: `sheetsURL():3429` již obsahuje query začínající otazníkem. `fetchSheets():3473` přidává další `?tqx=...`. Hodnota parametru sheet pak obsahuje i druhý query prefix. Izolované vyhodnocení ukázalo `Hlavni_datovna?tqx=out:csv` jako součást hodnoty názvu listu.

Kontrola současně čte `range=1:2` a porovnává poslední řádek odpovědi. Dokumentace starého listu uvádí dva hlavičkové řádky a data od řádku 3. Pokud odpověď obsahuje právě hlavičky, jejich stálost může chybně zastavit následné obnovení. U nového append-only modelu zase první data nejsou nejnovější.

Doporučení: sestavovat URL přes správu parametrů a kontrolovat skutečný poslední timestamp nebo revizi dat, nezávisle na orientaci listu a hlavičkách. Ověřit zvlášť Prijem_dat, Hlavni_datovna a budoucí Raw_Data.

**W03 — P1 — „Úspěšně načteno“ nastává dříve než úspěšné parsování. Ověřeno v kódu.**

Důkaz: `parseAndStore():3543` odkládá skutečné zpracování přes `setTimeout` a nevrací promise. Volající v `fetchSheets():3503` ihned nastavuje `fullLoaded` a spouští callbacky. Při chybě parseru už aplikace může mít příznak celé historie, dokončené čekající akce a přitom neaktuální data.

Doporučení: parsování má vrátit výsledek nebo promise a explicitní chybu. Příznaky, stav OK i aktualizace grafů nastavit až po úspěšném uložení dat správné stanice.

**W04 — P1 — Frontend není kompatibilní se všemi přítomnými schématy. Ověřeno v kódu.**

Důkaz: `parseAndStore():3566` bere poznámku z J; nové Raw_Data má v J rosný bod a poznámku až R. `parseCSDateTime` očekává čas v podobě HH:MM, zatímco `MASTER_Script.js/fixRawDataHeaders():285` formátuje B jako celé datum a čas. Prostá změna názvu listu může vést k chybnému času a k zobrazení rosného bodu jako poznámky.

Doporučení: adaptéry `legacy` / `raw_v2` s kontrolou názvů a počtu sloupců a pevným modelem dat pro UI. Pro přechod zvolit paralelní read-only ověření shody před přesměrováním uživatelů.

**W05 — P2 — UTC datum se používá jako datum místního dne. Ověřeno izolovaným příkladem.**

Důkaz: `index.html:3956`, `:4240` a `:4286` používají `toISOString().slice(0, 10)`. Jde o datum v UTC, zatímco další kód používá místní hodiny. Pro 20. 10. 2026 00:30 v Praze vychází UTC datum 19. 10. 2026.

Doporučení: při práci s dnem používat zvolenou zónu stanice důsledně pro klíč dne, výběr rozsahu i hodinové agregace. Otestovat půlnoc a oba přechody letního a zimního času.

**W06 — P2 — Parser má potvrzené hraniční chyby. Ověřeno izolovanými kontrolami.**

Důkaz: `splitCSV():3591` pouze překlápí stav na každé uvozovce. CSV položku `"a""b"` převede na `ab` místo `a"b` a dělení po řádcích neumí víceřádkové buňky. `parseCSDateTime():3408` normalizuje neplatné dny a hodiny; test 31. 2. s časem 25:99 nevydal chybu. `dewPoint():3381` s nulovou vlhkostí vrací NaN.

Doporučení: použít otestovaný CSV parser nebo plnohodnotné parsování stavovým automatem; datum ověřit po složkách; odlišit neplatnou relativní vlhkost a chybějící rosný bod. Důsledně kontrolovat `Number.isFinite` před výpočty.

**W07 — P2 — MQTT spojení nemá jasný životní cyklus a slučování zdrojů. Ověřeno.**

Důkaz: `index.html:4735` vytváří lokálního klienta bez odpojení předchozího; reconnect používá globální CFG. `:4741` neomezeně přidává zprávy do pole a používá čas přijetí místo času měření. Další fetch Sheets toto pole nahrazuje.

Doporučení: jeden spravovaný klient pro vybranou stanici, odpojení při změně režimu, limitovaná historie a explicitní identita zprávy. Stanovit, zda MQTT představuje pouze poslední živou hodnotu, nebo je rovnocenným trvalým zdrojem historie.

**W08 — P2 — Dostupnost a výkon závisejí na externích službách a velikosti celé historie. Potenciální riziko podložené implementací.**

Důkaz: CDN pro knihovny, veřejné CORS proxy, plný CSV export bez timeoutu, opakované průchody přes celé pole a `Math.max(...temps)` například v `refreshUI():3659`. S růstem historie může narůstat doba zpracování i riziko limitu počtu argumentů. Skutečné časy vykreslení a maximální bezpečný počet záznamů nebyly měřeny.

Doporučení: měřit fáze přenos/parse/agregace/render, zavést cache po stanicích, limitovat rozsah dotazů a agregovat podle zoomu. Srážky agregovat součtem přírůstků, teplotu vhodnou statistikou; prosté zahazování každého n-tého bodu by mohlo odstranit extrémy.

### 7.4 Bezpečnost a provozní ochrana

**S01 — P1 — HTTPS neověřuje identitu serveru. Ověřeno.**

Důkaz: `TEST_unified.ino:284` a další novější varianty volají `setInsecure()`. Šifrování spojení tak samo nezajišťuje ověření protistrany. Podvržená odpověď začínající OK by zároveň mohla způsobit odstranění lokálního záznamu.

Doporučení: správná důvěra CA / podporovaný certifikační bundle, kontrola očekávané odpovědi a postup obměny certifikátů. Nezavádět krátkodobě křehký pinning bez plánu údržby. Význam setInsecure dokládá [oficiální příklad Espressif](https://github.com/espressif/arduino-esp32/blob/master/libraries/NetworkClientSecure/examples/WiFiClientInsecure/WiFiClientInsecure.ino).

**S02 — P1; při veřejném vystavení P0 — Statický server může zpřístupnit soubory mimo zamýšlený web. Ověřeno návrhem kódu, externí vystavení nepotvrzeno.**

Důkaz: `server.js:7` nemá kontrolu hranice cesty, `:19` posílá wildcard CORS a `:28` neomezuje hostname. V obsluhovaném kořeni přitom existuje .git, konfigurace a dokumentace. Nejde jen o chybějící autentizaci veřejných meteorologických dat; server nemá oddělený seznam souborů určených ke zveřejnění.

Doporučení: samostatný veřejný adresář, odmítnutí neveřejných cest, kanonikalizace a kontrola kořene, jen potřebné HTTP metody a pro lokální práci explicitní localhost. Síťovou dostupnost prověřit před jakýmkoli sdílením.

**S03 — P1/P2 podle způsobu nasazení — Chybí důvěryhodné ověření zapisující stanice; heslo ve webu je pouze bariéra UI. Ověřeno v kódu.**

Důkaz: příjmové doGet neobsahují autentizaci nebo podpis měření. MASTER v návodu doporučuje Web App přístup „Anyone“. Skutečné cloudové nastavení nebylo ověřeno.

Ve webu `index.html:2757` a `:2759` porovnávají klientský hash hesla a pouze zpřístupní konfigurační panel. Uživatel s přístupem ke stránce může změnit klientský stav přímo. Tento mechanismus nechrání serverový zápis ani neveřejnost JSON konfigurace. Není však doloženo, že webová konfigurace obsahuje tajné údaje.

Doporučení: oddělit veřejné zobrazování od oprávnění k příjmu a správě dat. U stanice zvážit podpis payloadu včetně pořadového čísla a ochrany proti opakování; tajemství nesmí být součástí veřejného HTML. Pokud panel mění pouze místní nastavení prohlížeče, popsat jej jako místní nastavení, nikoli serverovou autorizaci.

**S04 — P2 — Přístupové konfigurace jsou smíchány se zdrojovými verzemi. Ověřeno strukturou kódu; rozsah zveřejnění není zjištěn.**

Zdrojové soubory obsahují síťové konfigurační bloky; existují také dva vyhrazené Credentials soubory. To vytváří riziko opomenuté kopie při změně hesla nebo budoucím publikování historického sketchu. Konkrétní hodnoty, jejich platnost ani shoda mezi stanicemi nejsou součástí tohoto auditu.

Doporučení: soukromý konfigurační vstup mimo publikované zdroje, sanitizovaná šablona a kontrola budoucích commitů. Pokud se nezávisle potvrdí zveřejnění platných údajů, změnit dotčené přístupy; samotný audit zveřejnění neprokazuje.

### 7.5 Organizace, dokumentace a testovatelnost

**D01 — P1 — Není jednoznačně určeno, co odpovídá aktuálnímu provozu. Ověřeno v lokální struktuře.**

Důkaz: souběh Same_but_not, Aktualni, mnoha verzí HOME, robust větví, starého a nového doGet a několika webů. Chybí společný manifest nasazení. Název „unified“ stále znamená čtyři fyzické kopie podobného kódu.

Doporučení: evidovat „stanice → build → hardware → konfigurace → endpoint → tabulka → webový profil“. Provozní registr má přednost před nejvyšším číslem v názvu souboru.

**D02 — P2 — Dokumentace obsahuje užitečné znalosti i neaktuální přísliby. Ověřeno.**

Důkaz: rozpor výšky Prahy a použití localtime/gmtime; Programming_guide stále uvádí Serial menu, které sjednocený kód odstranil. Hlavičky slibují změnu intervalu přes Sheets, ale příslušná funkce je neaktivní. `README.md` webu obsahuje pouze název.

`Navrhy_Vylepseni.md` popisuje jako budoucí ukládání poslední stanice, témata a porovnání dnů, zatímco hlavní HTML tyto mechanismy již obsahuje. Jiné návrhy, zejména cache a ochrana před starými požadavky, zůstávají relevantní.

Doporučení: rozlišit „implementováno“, „nasazeno“, „ověřeno na hardware“ a „nápad“. Opravit rozpory dokumentace proti určenému referenčnímu buildu; historické materiály ponechat s jasnou rolí.

**D03 — P2 — Uložený workspace odkazuje na neexistující jinou cestu. Ověřeno.**

Důkaz: `Kalibrace_CODE/konfiguracka_save.code-workspace:4` obsahuje `../../VS_code`. Vzhledem k umístění souboru se přeloží na `7_Projects_3D/A__Meteo_stanice_printables/VS_code`, která při auditu neexistovala. Druhá položka `.` ukazuje pouze na Kalibrace_CODE. Tento uložený soubor tedy neotevírá oba požadované kořeny. Nejde o tvrzení, že je právě on aktivním workspace v IDE.

Doporučení: při budoucím úklidu vytvořit jeden záměrný multi-root workspace s ověřenými cestami. V tomto auditu nebyl existující soubor změněn.

**D04 — P2 — Automatické ověřování a testovací protokol nejsou sladěné. Ověřeno.**

Důkaz: `test_webhook.js:48` odesílá JSON přes POST s krátkými názvy polí. V kontrolovaných Apps Script implementacích není `doPost` a doGet čeká jiná pole nebo středníkový data payload. Skript navíc považuje redirect či obecný HTTP 200 za úspěch bez ověření výsledného uložení.

Doporučení: testovací vstupy převzít ze skutečného protokolu stanic. Ověřit obsah ACK a následně počet a hodnoty surových záznamů ve zvláštním testovacím prostředí. Doplnit lokální funkční fixtures pro parser a agregace a reprodukovatelný build jednoho referenčního firmware.

**D05 — P3 — Existují prázdné, překrývající se a nefunkční pomocné artefakty. Ověřeno.**

Důkaz: 22 obsahově identických `.theia/launch.json`, prázdný `script zaloha V140.txt`, několik prázdných diagnostických složek a další prázdné vnoření Git/MQTT_webovky. `apply_glassmorphism.js:4` očekává `index_v2.html` ve své složce, ale takto pojmenovaný soubor v inventáři není; je zde `nepotrebne_index_v2.html`. Bez úpravy vstupu by nástroj na očekávaném souboru selhal. V `bundled_escaped.js` jsou také textové literály s viditelně poškozeným kódováním některých českých znaků.

Doporučení: označit experimenty a archivy a odstranit nejasné vstupní body z běžného návodu. Archivování a deduplikaci řešit jako samostatnou schválenou změnu; v tomto auditu se nic nemazalo.

## 8. Odborné hodnocení architektury

Tato kapitola obsahuje **odborný názor**, odvozený od předchozích technických zjištění.

### 8.1 Co považuji za dobře navržené

**Lokální fronta před odesláním** je správný základ pro zařízení s nestabilní WiFi. Kruh buf_head/buf_count je vhodnější než posouvat všechny uložené řetězce po každém ACK. Zachoval bych tuto myšlenku a posílil její obnovu po chybě.

**Oddělené fáze baterie, čidla, srážek, bufferu a přenosu** usnadňují rozpoznání chyb. Zvlášť hodnotná je znalost reálného napájecího rušení při WiFi a rozdílů hardwaru jednotlivých stanic. Tyto poznatky by neměly zmizet při „zkracování“ kódu.

**Nový model surových dat a odvozených agregací** představuje nejlepší nalezený směr rozvoje serverové části. Při spolehlivém primárním záznamu lze chybnou statistiku přepočítat.

**Web již omezuje počáteční objem dat a odkládá přepočty záložek.** To jsou užitečné optimalizace pro statický dashboard. Aplikace také většinou používá textContent pro měřené hodnoty a v tabulce poznámek explicitně escapuje obsah; nelze paušálně tvrdit, že každý výskyt innerHTML znamená nechráněné vykreslení poznámky.

**Pravidla vývoje zachycují provozní zkušenosti.** Požadavek vyvíjet na jedné testovací stanici a teprve poté rozšiřovat na další profily považuji za rozumný.

### 8.2 Co považuji za problematické

Největší architektonický dluh je **rozmnožení pravdy**: stejná informace existuje v hlavičce sketchu, průvodci, Credentials, nastavení tabulky a JavaScriptu webu. Kopírování umožňuje rychlé experimenty, ale nezajišťuje současnou opravu všech kopií.

Druhý problém je **zaměňování úspěchu operace za správnost dat**. HTTP 200, řetězec OK, uložený řádek a správná denní statistika jsou různé skutečnosti. Podobně úspěšný fetch neznamená úspěšný parser.

Třetí problém je **příliš těsná vazba aplikace na vzhled tabulky**: pozice hlaviček, textové jednotky, sloupce a řazení jsou současně uživatelským rozhraním tabulky i API. Každá kosmetická změna listu tak může ovlivnit web.

Monolitické HTML samo o sobě nezpůsobilo všechny chyby, ale zhoršuje jejich izolaci. Především konfigurace, načítání a časová logika mají přímý přístup ke stejnému globálnímu stavu. Čtyři „unified“ sketche mají obdobný problém na úrovni souborů.

### 8.3 Doporučený směr

Pro několik soukromých stanic bych zatím zachoval **ESP32 + Google Sheets + statický web**. Kompletní přepis do jiné platformy by nyní zvýšil počet současně měněných částí a ztížil ověření správnosti.

Nejprve bych zavedl společné schéma, idempotentní surový příjem a měřitelné chování při výpadku. Poté malé moduly frontendové aplikace a jeden firmware základ s hardwarovými profily. Pro čtyři stanice není nutné automaticky přidávat broker, mikroslužby ani složitý framework.

Samostatné databázové úložiště a API bych zvažoval, až měření ukáže, že Sheets nesplňují požadavky na historii, více stanic, přístupová práva či odezvu. Rozhodnutí má vycházet z počtu záznamů, délky odezvy a nároků na provoz, nikoli jen z velikosti souboru index.html.

## 9. Doporučení k optimalizaci

### 9.1 Firmware

- Oddělit pořízení měření od přenosu a pro přenos stanovit časový i záznamový limit.
- Ponechat atomické převzetí čítače, ale doplnit obnovitelný zápis záznamu a denního stavu.
- Zavést řízený backoff pro síť, NTP a server. Není nutné při každém úspěšném připojení provádět několik NTP pokusů.
- Měřit dobu aktivního cyklu, počet wakeup, počet WiFi pokusů, délku fronty a příčinu chyb.
- Publikovat kvalitu BME/ADC a datum poslední platné synchronizace; nepřidávat diagnostické údaje jako náhradu za chybějící kontrolu správnosti.
- Watchdog posuzovat podle konkrétní verze Arduino core a reálného rozpočtu operací. Jeho samotná přítomnost ani nepřítomnost není důkaz kvality architektury.
- Ukládat konfiguraci odděleně od společného programu; schopnost srážkoměru a soláru vyjádřit profilem hardware.

### 9.2 Příjem a tabulky

- Zachovat surový append-only záznam se stabilním ID a nativními datovými typy.
- Přesunout dražší agregace mimo kritickou cestu ACK, ale zajistit jejich opakovatelnou obnovu.
- Vytvářet datové exporty s přesně známými hlavičkami a typy.
- Velké operace provádět dávkově; limity služby a typ účtu ověřit před plánováním úloh. [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
- Uvažovat o jednom přehledovém listu či exportu posledních hodnot všech stanic, aby přehled webu nemusel zvlášť zkoušet několik proxy pro každou stanici.
- Pro agregace stanovit pravidla chybějících dat, pozdního doplnění, rozsahu měsíčního průměru a přesného součtu srážek.

### 9.3 Web

- Rozdělit nejprve datovou vrstvu, nikoli přepisovat současně celý vzhled: konfigurace, API klient, parser/normalizace, agregace, grafy a UI.
- Cache ukládat podle station_id, schématu a revize dat, s jasnou dobou platnosti. Při obnovení nezaměňovat starou cache za čerstvé měření.
- Zneplatnit staré asynchronní operace, zavést timeout plného načtení a omezit souběh periodických obnov.
- Pro dlouhé rozsahy používat menší agregované série; zachovat extrémy a srážkový součet.
- Nahradit maxima/minima přes rozbalení celého velkého pole průběžným výpočtem.
- Přidat viditelný údaj o stáří měření, zdroji, neúplné historii a chybě senzoru. Úspěšné spojení není totéž co čerstvá validní data.
- Po stabilizaci parseru řešit ovládání klávesnicí, modal focus, přístupné popisky a ověření mobilního layoutu. Zde neproběhl vizuální ani přístupnostní test.

### 9.4 Doporučená budoucí organizace

Následující struktura je návrh pro samostatnou implementační změnu, nikoli stav vytvořený auditem:

~~~text
firmware/
  src/                    Společná logika měření, času, fronty a přenosu
  profiles/               Necitlivé hardwarové a staniční profily
  examples/               Ruční diagnostika
  partitions/             Výslovný layout flash

ingestion/
  production/             Jeden produkční vstup a verze schématu
  migrations/             Samostatně spouštěné migrační nástroje
  fixtures/               Reálné anonymizované formáty vstupu

web/
  public/                 Pouze zveřejnitelné soubory
  src/                    Parser, načítání, stav, grafy a UI

docs/
  architecture.md
  data-contract.md
  deployment-register.md
  hardware/
  runbooks/

archive/                  Jasně označené historické varianty
~~~

O konkrétním rozdělení do jednoho nebo více repozitářů lze rozhodnout později. Podstatnější je jeden vlastník každého produkčního vstupu a jasný vztah mezi releasem firmwaru, schématem a webem.

## 10. Priority dalšího vývoje

Odhady níže jsou odborné řádové odhady pro člověka znalého projektu. Nejde o změřené pracnosti; práce na hardwaru, nasazení a migrace historie mohou trvat déle.

| Etapa | Konkrétní výstup | Nálezy | Odhad | Podmínka dokončení |
|---|---|---|---|---|
| 0: orientace a ochrana | Registr skutečných nasazení, ověření dostupnosti serveru, zvolený referenční build | D01, S02, S04 | 0,5–1 den | U každé stanice a webu je znám původ a konfigurace; neveřejné soubory nejsou obsluhovány |
| 1: správný web | Ochrana proti odpovědím staré stanice, správné čekání na parser, oprava obnovy a kontraktu sloupců | W01–W04 | 1–3 dny | Rychlé přepínání a pomalé odpovědi nemění cizí profil; nová data se opravdu obnovují |
| 2: správný příjem | Jeden příjem, stabilní ID, validace, souběh a obnovitelné agregace | G01–G07, S03 | 2–5 dnů | Opakovaný i souběžný vstup má právě jeden surový záznam a stejné statistiky po přepočtu |
| 3: firmware | Odolné uložení, denní přechody, kvalita senzoru, ověřená NVS kapacita a TLS | F01–F05, S01 | 2–5 dnů + zkoušky | Výpadky zápisu a napájení mají definovaný výsledek; žádné náhradní údaje se nevydávají za měření |
| 4: konsolidace | Jeden základ firmware, verze závislostí, čisté hranice repozitářů a aktualizované návody | D02–D05 | 2–4 dny | Nové prostředí lze sestavit a je jasné, co se nasazuje |
| 5: výkon a provoz | Měření latencí/spotřeby, cache, agregované dotazy, MQTT lifecycle | F06–F09, W05–W08 | Podle výsledků měření | Známý rozpočet odezvy, spotřeby, historie a offline výdrže |
| 6: nové funkce | PWA, rozšířená telemetrie, další stanice nebo větší úložiště | Budoucí rozvoj | Samostatný návrh | Stabilní kontrakt a předchozí provozní kritéria splněna |

**Doporučené první konkrétní zadání po tomto auditu:** zjistit skutečně nasazené varianty a provést opravu W01–W03 na jednom webovém vstupu a G01/G04 na odpovídající testovací kopii příjmu. Poté teprve zapínat další stanice a migrovat historii.

### 10.1 Přijímací scénáře pro stabilizační etapu

| Scénář | Požadované chování |
|---|---|
| Stejné measurement_id přijde 10× | Jeden surový záznam, jeden příspěvek do agregace |
| Server uloží záznam, ACK se ztratí | Retry nic nezdvojí a stanice může frontu později bezpečně potvrdit |
| Souběžně přijdou dvě různá měření | Obě se uloží a agregace zahrne obě |
| Restart během NVS zápisu | Záznam je obnoven nebo je stav výslovně nahlášen; metadata fronty zůstávají konzistentní |
| Restart po půlnoci | První nové měření používá správný den a známou politiku účtování srážek |
| Chybějící BME, funkční Hall | Srážky se uchovají; meteorologické hodnoty mají označenou chybu |
| Výpadek WiFi na kapacitní limit | Je znám počet uchovaných a ztracených záznamů; žádná tichá ztráta |
| Pomalé načítání A → přepnutí B | Výsledek A nezmění data, konfiguraci ani stav B |
| Po plném načtení přibude řádek | Web zobrazí nové měření, nikoli pouze stav „beze změn“ |
| Neplatné CSV/HTML místo dat | Chyba je viditelná a příznak fullLoaded není potvrzen |
| Den změny letního/zimního času | Správný den stanice a jednoznačná identita opakované hodiny |
| Přepnutí na Raw_Data | Správná interpretace timestampu, rosného bodu a poznámek |
| Opakování dokončené migrace | Žádné zdvojení historie |

## 11. Co bylo skutečně ověřeno a co zbývá

### 11.1 Provedené kontroly

- Rekurzivní inventarizace souborů a adresářů včetně skrytých položek.
- Obsahové otevření 111 nevynechaných souborů; struktura, funkce, importy a bezpečně filtrované výřezy. Podrobněji posouzeno 29 souborů, dalších 82 průřezově / automaticky.
- Porovnání skutečných hashů obsahově otevřených souborů: potvrzeno 22 identických launch.json; hlavní HTML a vnořený HTML soubor jsou rozdílné.
- Kontrola Git seznamů sledovaných cest a stavu obou pracovních kopií.
- Ověření relativní cesty uloženého workspace a existence jejího cíle.
- Izolované vyhodnocení vybraných JavaScript funkcí a výrazů v paměti, bez spuštění projektových skriptů a bez síťového zápisu.
- Závěrečná kontrola výsledného dokumentu a porovnání vstupních souborů s inventářem a hashi tam, kde bylo čtení obsahu povoleno.

### 11.2 Výsledky izolovaných kontrol

Tyto kontroly reprodukují konkrétní logiku. **Nenahrazují test ve skutečném Apps Script runtime, na ESP32 ani v prohlížeči.** Serverové služby byly nahrazeny malými objekty v paměti a pomocná funkce formátování data měla deterministické chování; testy neposuzovaly konfiguraci cloudové časové zóny.

| Kontrola | Očekávaný stav | Skutečný výsledek |
|---|---|---|
| MASTER: dva stejné payloady ve 12:35 | 1 surový řádek | 2 surové řádky |
| MASTER: minimum 0 °C, další měření +5 °C | Minimum 0 °C | Minimum +5 °C |
| MASTER: den již existuje jako textový klíč | Aktualizace řádku | Přidán další denní řádek |
| CSV: položka s escapovanou uvozovkou `"a""b"` | `a"b` | `ab` |
| Parser: 31. 2. 2026, 25:99 | Odmítnutí | Normalizované datum v březnu |
| Rosný bod při RH=0 | Výslovně neplatná hodnota | NaN bez ošetření v dané funkci |
| Složení inkrementální query | Čistý název listu | Druhý otazník uvnitř hodnoty sheet |
| UTC datum pro pražskou půlnoc 20. 10. 2026 | Místní datum 20. 10. | ISO datum 19. 10. |

Během přípravy kontrol byly opraveny pomocné testovací výřezy a mocky; tabulka uvádí pouze úspěšně provedené reprodukce. V projektu nevznikl žádný testovací soubor a žádná zjištěná chyba nebyla tímto auditem opravována.

### 11.3 Co nelze tímto auditem potvrdit

- Která verze firmwaru je právě ve fyzických stanicích a zda obsah odpovídá některému lokálnímu souboru.
- Zda cloudový Apps Script obsahuje starý doGet, Script_v2, MASTER, nebo další úpravy.
- Aktuální oprávnění a veřejnost tabulek, účtové kvóty a počet skutečně uložených řádků.
- Reálnou odolnost NVS při brownoutu, životnost flash, odběr v Light Sleep a skutečnou offline výdrž.
- Přesnost tlaku, napěťového děliče a objemu na jeden pulz bez schématu a měření.
- Stav sériových logů, vynechaných konfigurací, platnost přístupových údajů a obsah Git historie.
- Úplnou funkčnost a přístupnost UI na konkrétních prohlížečích a telefonech.

## 12. Použité oficiální technické zdroje

Externí dokumentace byla použita k ověření významu konkrétních API a doporučení. Nálezy týkající se projektu vycházejí z lokálních souborů. Verze veřejné dokumentace sama neurčuje verzi knihoven nainstalovaných uživatelem.

- [Espressif: Preferences](https://docs.espressif.com/projects/arduino-esp32/en/latest/tutorials/preferences.html) — účel NVS a práce s většími objemy.
- [Espressif: Sleep Modes](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/sleep_modes.html) — uspání a zdroje probuzení.
- [Espressif: příklad WiFiClientInsecure](https://github.com/espressif/arduino-esp32/blob/master/libraries/NetworkClientSecure/examples/WiFiClientInsecure/WiFiClientInsecure.ino) — vypnutí verifikace TLS.
- [Google: Apps Script Lock Service](https://developers.google.com/apps-script/reference/lock) — ochrana sdílených operací před souběhem.
- [Google: Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) — provozní limity služby.
- [Google: Visualization Query Language](https://developers.google.com/chart/interactive/docs/querylanguage) — dotazy nad tabulkami.
- [Node.js: Path](https://nodejs.org/api/path.html) — spojování a normalizace cest.
- [Node.js: Net](https://nodejs.org/api/net.html) — chování server.listen bez hostname.

## Příloha A — Seznam skutečně kontrolovaných a vynechaných souborů

Jde o úplný seznam **127 vstupních souborů mimo .git**, nikoli seznam odhadnutý z názvů. Cesty jsou relativní k uvedenému kořeni. Počet řádků je z obsahového čtení; u neotevřených souborů není odhadován.

**D:** obsah otevřen a ručně podrobně posouzen v relevantních částech; neznamená automaticky každý řádek nebo runtime ověření. **S:** celý soubor otevřen při automatické strukturální kontrole a posouzen jen průřezově. **M:** pouze cesta a metadata, obsah neotevřen. Interní Git soubory jsou zvlášť v příloze C.

### A.1 ESP_Code

| Cesta | Režim | Bajty | Řádků | Rozsah / důvod vynechání |
|---|---|---:|---:|---|
| `_1_Mšene_lazne/A2_Rain_gauge_esp32_hallsensor/A2_Rain_gauge_esp32_hallsensor.ino` | S | 3042 | 109 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/A3_Rain_gauge_esp32_hallsensor/A3_Rain_gauge_esp32_hallsensor.ino` | S | 4340 | 142 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/A4_Rain_gauge_esp32_hallsensor/A4_Rain_gauge_esp32_hallsensor.ino` | S | 4406 | 148 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/A5_Rain_gauge_esp32_hallsensor/A5_Rain_gauge_esp32_hallsensor.ino` | S | 5632 | 192 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/A6_Rain_gauge_esp32_hallsensor/A6_Rain_gauge_esp32_hallsensor.ino` | S | 5665 | 194 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/A7_Rain_gauge_esp32_hallsensor_EEPROM/A7_Rain_gauge_esp32_hallsensor_EEPROM.ino` | S | 6049 | 207 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_10_csv_buffer_deepsleep/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_10_csv_buffer_deepsleep/B1_10_csv_buffer_deepsleep.ino` | S | 7048 | 239 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_11_oprava_casu_U_buffer_dat/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_11_oprava_casu_U_buffer_dat/B1_11_oprava_casu_U_buffer_dat.ino` | S | 12923 | 391 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_12_oprava_casu_U_buffer_dat/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_12_oprava_casu_U_buffer_dat/B1_12_oprava_casu_U_buffer_dat.ino` | S | 13779 | 402 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_13_oprava_wifi_U_bufferu/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_13_oprava_wifi_U_bufferu/B1_13_oprava_wifi_U_bufferu.ino` | S | 16573 | 470 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_14_funkcni_all/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_14_funkcni_all/B1_14_funkcni_all.ino` | S | 17456 | 491 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_15_2_vypis_sily_signalu/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_15_2_vypis_sily_signalu/B1_15_2_vypis_sily_signalu.ino` | S | 20025 | 568 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_15.1/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_15.1/B1_15.1.ino` | S | 19806 | 561 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_15/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_15/B1_15.ino` | S | 19714 | 554 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_16_0_Gemini_uprava/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_16_0_Gemini_uprava/B1_16_0_Gemini_uprava.ino` | S | 48878 | 850 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_16_1_Gemini_uprava/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_16_1_Gemini_uprava/B1_16_1_Gemini_uprava.ino` | S | 37826 | 710 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_16_2_mereni_U_baterie/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_16_2_mereni_U_baterie/B1_16_2_mereni_U_baterie.ino` | S | 21693 | 483 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_16_3_wifi_static/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_16_3_wifi_static/B1_16_3_wifi_static.ino` | S | 22144 | 497 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_2_Rain_gauge_esp32_hallsensor_EEPROM/B1_2_Rain_gauge_esp32_hallsensor_EEPROM.ino` | S | 4700 | 182 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_2_Rain_gauge_esp32_hallsensor/B1_2_Rain_gauge_esp32_hallsensor.ino` | S | 6791 | 216 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_3_Rain_gauge_esp32_hallsensor_a_Google_sheets/B1_3_Rain_gauge_esp32_hallsensor_a_Google_sheets.ino` | S | 7230 | 229 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_4_Rain_gauge_esp32_hallsensor_a_Google_sheets/B1_4_Rain_gauge_esp32_hallsensor_a_Google_sheets.ino` | S | 6385 | 218 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_5_Rain_gauge_esp32_hallsensor_a_Google_sheets_/B1_5_Rain_gauge_esp32_hallsensor_a_Google_sheets_.ino` | S | 7171 | 266 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI_oprava_duplicit/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI_oprava_duplicit/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI_oprava_duplicit.ino` | S | 8094 | 262 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI.ino` | S | 7906 | 265 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1_8_oprava_casu_U_buffer_dat/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/B1_8_oprava_casu_U_buffer_dat/B1_8_oprava_casu_U_buffer_dat.ino` | S | 8455 | 269 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1.0_Rain_gauge_esp32_hallsensor/B1.0_Rain_gauge_esp32_hallsensor.ino` | S | 6157 | 211 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/B1.1_Rain_gauge_esp32_hallsensor/B1.1_Rain_gauge_esp32_hallsensor.ino` | S | 6104 | 200 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/ML_B1_17_0_robust/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_1_Mšene_lazne/ML_B1_17_0_robust/ML_B1_17_0_robust.ino` | S | 15340 | 453 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/Msene_lazne_17_05_pajive_pole_Claude.txt` | S | 708 | 16 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `_1_Mšene_lazne/Msene_lazne_17_05_pajive_pole_Claude/Msene_lazne_17_05_pajive_pole_Claude.ino` | S | 35373 | 966 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_1_Mšene_lazne/Msene_lazne_17_06_GMT_time_capture/Msene_lazne_17_06_GMT_time_capture.ino` | D | 35741 | 958 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `_1_Mšene_lazne/script meteo.txt` | S | 6521 | 146 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `_2_Praha/Aktualni/PR_B1_16_6_PERFECT/PR_B1_16_6_PERFECT.ino` | D | 25946 | 777 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `_2_Praha/B1_16_3_wifi_static/B1_16_3_wifi_static.ino` | S | 22169 | 497 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_2_Praha/LM promt.txt` | S | 150 | 3 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `_2_Praha/PR_B1_16_3_wifi_static/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_2_Praha/PR_B1_16_3_wifi_static/PR_B1_16_3_wifi_static.ino` | S | 31171 | 951 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_2_Praha/PR_B1_16_4/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_2_Praha/PR_B1_16_4/PR_B1_16_4.ino` | S | 30153 | 926 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_2_Praha/PR_B1_16_5/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_2_Praha/PR_B1_16_5/PR_B1_16_5.ino` | S | 26117 | 775 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_2_Praha/PR_B1_16_6/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_2_Praha/PR_B1_16_6/PR_B1_16_6.ino` | S | 27277 | 797 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_2_Praha/PR_B1_17_0_robust/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_2_Praha/PR_B1_17_0_robust/PR_B1_17_0_robust.ino` | S | 15338 | 453 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_2_Praha/PR_B1_17_1_robust/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_2_Praha/PR_B1_17_1_robust/PR_B1_17_1_robust.ino` | D | 38166 | 1091 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `_3_TESTOVACI_home/HOME_16_6/.theia/launch.json` | S | 169 | 8 | Automaticky otevřeno; shodné editorové konfigurace porovnány SHA-256. |
| `_3_TESTOVACI_home/HOME_16_6/HOME_16_6.ino` | S | 27411 | 799 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_3_TESTOVACI_home/HOME_17_01/HOME_17_01.ino` | S | 32839 | 934 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_3_TESTOVACI_home/HOME_17_02/HOME_17_02.ino` | S | 32956 | 920 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_3_TESTOVACI_home/HOME_17_03_nepajive_pole/HOME_17_03_nepajive_pole.ino` | S | 34647 | 986 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_3_TESTOVACI_home/HOME_17_04_pajive_pole_Battery_cal/HOME_17_04_pajive_pole_Battery_cal.ino` | S | 35341 | 984 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_3_TESTOVACI_home/HOME_17_05_pajive_pole_Claude/HOME_17_05_pajive_pole_Claude.ino` | S | 35296 | 963 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `_3_TESTOVACI_home/HOME_17_06_pajive_pole_Claude_uprava_V2/HOME_17_06_pajive_pole_Claude_uprava_V2.ino` | D | 38804 | 1008 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `_3_TESTOVACI_home/HOME_17/HOME_17.ino` | S | 30616 | 890 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `.agents/AGENTS.md` | D | 3293 | 32 | Ruční posouzení dokumentace nebo hlavní přijímací logiky. |
| `B1.1_webovka_stranka.html` | S | 8503 | 250 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `Credentials.md` | M | 3726 | — | Neotevřeno na výslovný pokyn; pouze metadata. |
| `Credentials.txt` | M | 5120 | — | Neotevřeno na výslovný pokyn; pouze metadata. |
| `GPT_Guide.md` | D | 13997 | 318 | Ruční posouzení dokumentace nebo hlavní přijímací logiky. |
| `Kalibrace_CODE/ESP32_LED_Blinking – zástupce.lnk` | M | 1458 | — | Binární zástupce; cíl nebyl otevírán. |
| `Kalibrace_CODE/konfiguracka_save.code-workspace` | D | 156 | 13 | Přečten celý obsah a ověřeno rozlišení relativní cesty. |
| `Kalibrace_CODE/Script_Zaloha/___UpravaDat_zaloha.txt` | S | 7725 | 162 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `Kalibrace_CODE/Script_Zaloha/__actual_nacitani dat_speed.txt` | S | 2657 | 66 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `Kalibrace_CODE/Script_Zaloha/script zaloha V140.txt` | S | 0 | 0 | Otevřeno jako prázdný soubor, bez zdrojového obsahu. |
| `Kalibrace_CODE/Script_Zaloha/Script zaloha_V1_funkcni_B1_7.txt` | S | 3620 | 73 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `Kalibrace_CODE/Script_Zaloha/Script zaloha_V1_funkcni_bez bufferu B1_5.txt` | S | 3525 | 80 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `Kalibrace_CODE/Script_Zaloha/Script zaloha_V118_funkcni_B1_14.txt` | S | 6651 | 141 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `Kalibrace_CODE/TEST_BME_BMP-280_adresy/TEST_BME_BMP-280_adresy.ino` | S | 2424 | 93 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `Kalibrace_CODE/test_hall_sensor/test_hall_sensor.ino` | S | 336 | 13 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `Kalibrace_CODE/test_wifi__/test_wifi__.ino` | S | 4251 | 115 | Průřez: importy, funkce a vybrané provozní konstrukce; bez úplné ruční revize. |
| `Kalibrace_CODE/Zaznamy_serial_monitor/1_CoolTerm Capture (1_test_log.CoolTermSettings) 2025-05-17 21-56-57-732.txt` | M | 9040 | — | Sériový záznam; obsah preventivně vynechán kvůli síťové diagnostice. |
| `Kalibrace_CODE/Zaznamy_serial_monitor/1_test_log.CoolTermSettings` | M | 3788 | — | Profil komunikačního nástroje; obsah vynechán. |
| `Kalibrace_CODE/Zaznamy_serial_monitor/2_CoolTerm Capture (1_test_log.CoolTermSettings) 2025-05-17 22-04-15-841.txt` | M | 173492 | — | Sériový záznam; obsah preventivně vynechán kvůli síťové diagnostice. |
| `Kalibrace_CODE/Zaznamy_serial_monitor/3_CoolTerm Capture (1_test_log.CoolTermSettings) 2025-05-18 21-37-33-766.txt` | M | 98358 | — | Sériový záznam; obsah preventivně vynechán kvůli síťové diagnostice. |
| `Kalibrace_CODE/Zaznamy_serial_monitor/4_CoolTerm Capture (1_test_log.CoolTermSettings) 2025-05-19 21-32-34-551.txt` | M | 114104 | — | Sériový záznam; obsah preventivně vynechán kvůli síťové diagnostice. |
| `Kalibrace_CODE/Zaznamy_serial_monitor/5_CoolTerm Capture (Untitled_0) 2025-05-22 14-05-21-988.txt` | M | 339309 | — | Sériový záznam; obsah preventivně vynechán kvůli síťové diagnostice. |
| `Kalibrace_CODE/Zaznamy_serial_monitor/6_CoolTerm Capture (Untitled_0) 2025-05-30 19-40-14-381.txt` | M | 355824 | — | Sériový záznam; obsah preventivně vynechán kvůli síťové diagnostice. |
| `New_system_google sheets/apply_glassmorphism.js` | D | 4113 | 130 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/bundled_escaped.js` | D | 14921 | 303 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/Finalize_Utils.js` | D | 9066 | 202 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/Fixed_Migration.js` | D | 10453 | 284 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/Google_sheets_guide_agent.md` | D | 15568 | 414 | Ruční posouzení dokumentace nebo hlavní přijímací logiky. |
| `New_system_google sheets/Google_Sheets_Vzorce.md` | S | 4254 | 103 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `New_system_google sheets/MASTER_Script.js` | D | 17956 | 477 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/Migrate_Data.js` | D | 8898 | 231 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/nepotrebne_index_v2.html` | S | 194515 | 4992 | Průřez struktury a funkcí dalšího HTML artefaktu; bez vizuálního testu. |
| `New_system_google sheets/Populate_Formulas.js` | D | 8393 | 168 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/Postup_prace_agent.md` | S | 7284 | 150 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `New_system_google sheets/Promt_google_sheets_agent.md` | S | 11430 | 398 | Automaticky otevřeno, strukturální údaje a výběr úseků; bez podrobné ruční revize. |
| `New_system_google sheets/Script_v2_Google_sheets.js` | D | 11938 | 316 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/Setup_Sheets.js` | D | 4188 | 94 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `New_system_google sheets/test_webhook.js` | D | 3339 | 82 | Přečten celý odesílač; protokol porovnán s příjmem; nespouštěno. |
| `Programming_guide.md` | D | 3098 | 48 | Ruční posouzení dokumentace nebo hlavní přijímací logiky. |
| `Same_but_not/_1_Msene_lazne/Msene_lazne_unified/Msene_lazne_unified.ino` | D | 25542 | 572 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `Same_but_not/_2_Praha/Praha_unified/Praha_unified.ino` | D | 26591 | 587 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `Same_but_not/_3_Home_testovaci/Home_unified/Home_unified.ino` | D | 25604 | 573 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `Same_but_not/_4_TEST/TEST_unified/TEST_unified.ino` | D | 25548 | 572 | Podrobně vybrané mechanismy měření, času, bufferu, přenosu či historické odlišnosti. |
| `Script_load_data_Google_sheets` | D | 6105 | 124 | Ruční posouzení dokumentace nebo hlavní přijímací logiky. |

### A.2 VS_code

| Cesta | Režim | Bajty | Řádků | Rozsah / důvod vynechání |
|---|---|---:|---:|---|
| `config_praha_baterie.json` | M | 262 | — | Obsah preventivně vynechán jako připojovací konfigurace; žádné tvrzení o konkrétních klíčích. |
| `config_praha_okno.json` | M | 256 | — | Obsah preventivně vynechán jako připojovací konfigurace; žádné tvrzení o konkrétních klíčích. |
| `config_stanice3.json` | M | 291 | — | Obsah preventivně vynechán jako připojovací konfigurace; žádné tvrzení o konkrétních klíčích. |
| `config.json` | M | 233 | — | Obsah preventivně vynechán jako připojovací konfigurace; žádné tvrzení o konkrétních klíčích. |
| `Git/MQTT_webovky/index.html` | D | 165455 | 3219 | Porovnání přepínání, fetch a parseru s hlavním webem; bez samostatného runtime testu. |
| `index.html` | D | 190763 | 4879 | Podrobně datová vrstva, čas, konfigurace, statistiky a MQTT; vzhled pouze staticky. |
| `Navrhy_Vylepseni.md` | D | 6856 | 139 | Ruční posouzení dokumentace nebo hlavní přijímací logiky. |
| `README.md` | D | 15 | 1 | Ruční posouzení dokumentace nebo hlavní přijímací logiky. |
| `remote_parse.txt` | M | 2932 | — | Obsah preventivně vynechán pro možné připojovací či serverové údaje. |
| `server.js` | D | 813 | 28 | Podrobně relevantní funkce, kontrakty, migrace nebo vzorce; nespouštěno nad projektovými daty. |
| `setup.txt` | M | 878 | — | Obsah preventivně vynechán pro možné připojovací či serverové údaje. |

### A.3 Konkrétní rozsah ručního posouzení

Pro orientaci jsou zde hlavní skutečně zkoumané úseky. Čísla níže upřesňují úroveň D; ostatní části téhož souboru prošly automatickou strukturální kontrolou.

- Hlavní web: inicializace a konfigurace od ř. 2646, časové a CSV helpery 3369–3599, fetch 3428–3532, UI/statistiky 3626 a dále, denní porovnání 4239 a dále, poznámky 4700 a MQTT/start 4731 a dále. Statické části HTML/CSS byly mapovány strukturálně.
- Vnořený web: switchStation od ř. 1101, fetchSheets od ř. 1825 a parseAndStore od ř. 1932, včetně porovnání funkcí a velikosti s hlavním webem.
- TEST_unified: celý filtrovaný výpis 1–572. Ostatní sjednocené varianty: porovnání společné logiky a hardwarových/časových odlišností, nikoli nezávislý build každé stanice.
- Historické HOME_17_06 a Msene_17_06: čas, NTP guard, buffer, ACK, setup a denní reset. Praha Aktualni: posouvaný buffer a Hall konfigurace. Praha robust: AppState, watchdog a blokující HTTP úsek.
- Starý doGet v kořeni: celá přijímací funkce. Script_v2: příjem a denní/měsíční agregace. MASTER: příjem, agregace, migrace a sestavení summaries; navíc izolované reprodukce.
- Pomocné migrační a formula skripty: relevantní větve parsování Date/text, práce s kurzorem, zápisy a clearing, volané funkce, typy souhrnných klíčů a vazby vzorců. Nebyly spuštěny.
- Návody: hlavní architektonický průvodce, pravidla programování a dokumentace tabulkových schémat byly porovnány s implementací. U podkladů označených S proběhlo pouze průřezové čtení.

## Příloha B — Úplný seznam adresářů mimo .git

Obsahuje všech **100 nalezených adresářů mimo .git**, bez samotných dvou kořenů. Prázdné adresáře jsou výslovně označeny; názvy nepředstavují důkaz, že obsahují funkční aplikaci.

### B.1 ESP_Code

~~~text
_1_Mšene_lazne/
_1_Mšene_lazne/A2_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/A3_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/A4_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/A5_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/A6_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/A7_Rain_gauge_esp32_hallsensor_EEPROM/
_1_Mšene_lazne/B1_10_csv_buffer_deepsleep/
_1_Mšene_lazne/B1_10_csv_buffer_deepsleep/.theia/
_1_Mšene_lazne/B1_11_oprava_casu_U_buffer_dat/
_1_Mšene_lazne/B1_11_oprava_casu_U_buffer_dat/.theia/
_1_Mšene_lazne/B1_12_oprava_casu_U_buffer_dat/
_1_Mšene_lazne/B1_12_oprava_casu_U_buffer_dat/.theia/
_1_Mšene_lazne/B1_13_oprava_wifi_U_bufferu/
_1_Mšene_lazne/B1_13_oprava_wifi_U_bufferu/.theia/
_1_Mšene_lazne/B1_14_funkcni_all/
_1_Mšene_lazne/B1_14_funkcni_all/.theia/
_1_Mšene_lazne/B1_15/
_1_Mšene_lazne/B1_15_2_vypis_sily_signalu/
_1_Mšene_lazne/B1_15_2_vypis_sily_signalu/.theia/
_1_Mšene_lazne/B1_15.1/
_1_Mšene_lazne/B1_15.1/.theia/
_1_Mšene_lazne/B1_15/.theia/
_1_Mšene_lazne/B1_16_0_Gemini_uprava/
_1_Mšene_lazne/B1_16_0_Gemini_uprava/.theia/
_1_Mšene_lazne/B1_16_1_Gemini_uprava/
_1_Mšene_lazne/B1_16_1_Gemini_uprava/.theia/
_1_Mšene_lazne/B1_16_2_mereni_U_baterie/
_1_Mšene_lazne/B1_16_2_mereni_U_baterie/.theia/
_1_Mšene_lazne/B1_16_3_wifi_static/
_1_Mšene_lazne/B1_16_3_wifi_static/.theia/
_1_Mšene_lazne/B1_2_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/B1_2_Rain_gauge_esp32_hallsensor_EEPROM/
_1_Mšene_lazne/B1_3_Rain_gauge_esp32_hallsensor_a_Google_sheets/
_1_Mšene_lazne/B1_4_Rain_gauge_esp32_hallsensor_a_Google_sheets/
_1_Mšene_lazne/B1_5_Rain_gauge_esp32_hallsensor_a_Google_sheets_/
_1_Mšene_lazne/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI/
_1_Mšene_lazne/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI_oprava_duplicit/
_1_Mšene_lazne/B1_6_Rain_gauge_esp32_buffer_pri_vypadku_WIFI_oprava_duplicit/.theia/
_1_Mšene_lazne/B1_8_oprava_casu_U_buffer_dat/
_1_Mšene_lazne/B1_8_oprava_casu_U_buffer_dat/.theia/
_1_Mšene_lazne/B1.0_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/B1.1_Rain_gauge_esp32_hallsensor/
_1_Mšene_lazne/ML_B1_17_0_robust/
_1_Mšene_lazne/ML_B1_17_0_robust/.theia/
_1_Mšene_lazne/Msene_lazne_17_05_pajive_pole_Claude/
_1_Mšene_lazne/Msene_lazne_17_06_GMT_time_capture/
_2_Praha/
_2_Praha/Aktualni/
_2_Praha/Aktualni/PR_B1_16_6_PERFECT/
_2_Praha/B1_16_3_wifi_static/
_2_Praha/PR_B1_16_3_wifi_static/
_2_Praha/PR_B1_16_3_wifi_static/.theia/
_2_Praha/PR_B1_16_4/
_2_Praha/PR_B1_16_4/.theia/
_2_Praha/PR_B1_16_5/
_2_Praha/PR_B1_16_5/.theia/
_2_Praha/PR_B1_16_6/
_2_Praha/PR_B1_16_6/.theia/
_2_Praha/PR_B1_17_0_robust/
_2_Praha/PR_B1_17_0_robust/.theia/
_2_Praha/PR_B1_17_1_robust/
_2_Praha/PR_B1_17_1_robust/.theia/
_3_TESTOVACI_home/
_3_TESTOVACI_home/HOME_16_6/
_3_TESTOVACI_home/HOME_16_6/.theia/
_3_TESTOVACI_home/HOME_17/
_3_TESTOVACI_home/HOME_17_01/
_3_TESTOVACI_home/HOME_17_02/
_3_TESTOVACI_home/HOME_17_03_nepajive_pole/
_3_TESTOVACI_home/HOME_17_04_pajive_pole_Battery_cal/
_3_TESTOVACI_home/HOME_17_05_pajive_pole_Claude/
_3_TESTOVACI_home/HOME_17_06_pajive_pole_Claude_uprava_V2/
.agents/
Kalibrace_CODE/
Kalibrace_CODE/bme280test/  [prázdný]
Kalibrace_CODE/i2c_address_detect/
Kalibrace_CODE/i2c_address_detect/i2c_address_detect/  [prázdný]
Kalibrace_CODE/Rain_gauge_esp32_hallsensor/  [prázdný]
Kalibrace_CODE/Script_Zaloha/
Kalibrace_CODE/tesBME280/  [prázdný]
Kalibrace_CODE/TEST_BME_BMP-280_adresy/
Kalibrace_CODE/test_hall_sensor/
Kalibrace_CODE/test_wifi__/
Kalibrace_CODE/Zaznamy_serial_monitor/
New_system_google sheets/
Same_but_not/
Same_but_not/_1_Msene_lazne/
Same_but_not/_1_Msene_lazne/Msene_lazne_unified/
Same_but_not/_2_Praha/
Same_but_not/_2_Praha/Praha_unified/
Same_but_not/_3_Home_testovaci/
Same_but_not/_3_Home_testovaci/Home_unified/
Same_but_not/_4_TEST/
Same_but_not/_4_TEST/TEST_unified/
Zaznamy_serial_monitor/  [prázdný]
~~~

### B.2 VS_code

~~~text
Git/
Git/MQTT_webovky/
Git/MQTT_webovky/Git/
Git/MQTT_webovky/Git/MQTT_webovky/  [prázdný]
~~~

## Příloha C — Interní metadata Git: úplný inventář bez obsahové analýzy

Tyto položky byly rekurzivně zmapovány podle cest, typu a velikosti. Jednotlivé objekty, konfigurace, hooky a historie nebyly ručně obsahově analyzovány. Read-only příkazy git status a git ls-files používaly interní metadata Gitu; nebyly prováděny checkout, reset, clean, commit ani změny konfigurace. Tento seznam není bezpečnostní prověrkou historie na přítomnost tajných údajů.

<details>
<summary>VS_code/.git/ — 153 souborů, 115 adresářů včetně kořene této .git složky</summary>

Cesty uvnitř uvedeného .git adresáře; D = adresář, F = soubor, poslední údaj u souborů je velikost v bajtech.

~~~text
D ./
F .MERGE_MSG.swp | 12288
F COMMIT_EDITMSG | 74
F config | 478
F description | 73
F FETCH_HEAD | 103
F HEAD | 21
D hooks/
F hooks/applypatch-msg.sample | 478
F hooks/commit-msg.sample | 896
F hooks/fsmonitor-watchman.sample | 4726
F hooks/post-update.sample | 189
F hooks/pre-applypatch.sample | 424
F hooks/pre-commit.sample | 1649
F hooks/pre-merge-commit.sample | 416
F hooks/pre-push.sample | 1374
F hooks/pre-rebase.sample | 4898
F hooks/pre-receive.sample | 544
F hooks/prepare-commit-msg.sample | 1492
F hooks/push-to-checkout.sample | 2783
F hooks/sendemail-validate.sample | 2308
F hooks/update.sample | 3650
F index | 1035
D info/
F info/exclude | 240
D logs/
F logs/HEAD | 4892
D logs/refs/
D logs/refs/heads/
F logs/refs/heads/backup-main | 161
D logs/refs/heads/copilot/
F logs/refs/heads/copilot/vscode-mmnurih9-jetz | 352
F logs/refs/heads/main | 3986
D logs/refs/remotes/
D logs/refs/remotes/origin/
D logs/refs/remotes/origin/copilot/
F logs/refs/remotes/origin/copilot/vscode-mmnurih9-jetz | 312
F logs/refs/remotes/origin/HEAD | 141
F logs/refs/remotes/origin/main | 2734
D objects/
D objects/02/
F objects/02/a5e81a40cc1440faba4a5c158795f9d82b8ea4 | 201
D objects/03/
F objects/03/5b52aba05e779b1b89c50b669266c4d354b3f8 | 355
D objects/04/
F objects/04/911602a6dbdc10d388bf1c7d9325f1b3022236 | 178
D objects/07/
F objects/07/1ad404ea7c55cfba43c678be98509acd359316 | 48758
D objects/09/
F objects/09/16e9d1843356d3aec55d7ccd9341a5b888d5a7 | 40683
F objects/09/3ed29385b177fc993edd9513eddb0ef6485a16 | 232
D objects/0b/
F objects/0b/d4f5e3e1cca631a512026fcceb25a306762bbb | 714
D objects/0d/
F objects/0d/67f0c2d867ef66000a03b49e16f035f76e2867 | 1204
D objects/10/
F objects/10/0f9155eff790b3d74d38088e4c57d775004629 | 929
D objects/11/
F objects/11/ad474b4734ac8303c623231eadb42f0c6ac535 | 210
D objects/1b/
F objects/1b/1ecaf737896de0c12cee33e8cf3679b060da6d | 288
D objects/1c/
F objects/1c/1221b3ab250a13f8bcd8fb5aa794194c2d914b | 54
D objects/1d/
F objects/1d/8845f390d8e4bccb87c04b539f45659dd83c52 | 265
D objects/1e/
F objects/1e/2fb45b2178605e320accaa4575580ae19b699f | 288
D objects/1f/
F objects/1f/975088f01ec16b7053a591d58642f7abadfb5f | 191
D objects/20/
F objects/20/1f1c90278af90662d5364f20911125cee50f29 | 48769
F objects/20/e558ac7cc851e461c31dc91846bbd0eaff7321 | 3178
D objects/21/
F objects/21/e907631d99b5456e1aae4f0176faee56dda02d | 46520
D objects/25/
F objects/25/9f8cb548e74243b976549d4b3a0e3c5385eb38 | 46761
D objects/29/
F objects/29/088b9599a4cdcd2b0eb67502cfd99b59f0d999 | 55
D objects/2a/
F objects/2a/d13496a6715f1eaf74dd474cc5f64e5b5fb16b | 1203
D objects/2b/
F objects/2b/9bc46a0cd68a71ac06ae5cbb9f4d33ea59f094 | 256
F objects/2b/f75a1363aae5ff49b2cb9e2bc4fa0559378016 | 77
D objects/2c/
F objects/2c/9450e2b4ee731c863d3ccf5e40956a3aef1373 | 190
D objects/31/
F objects/31/1f80ea0872d394ee822b98de2cd838212e5665 | 882
F objects/31/7ac18b7aae4bee3b1cdafe5aa719988dbb1382 | 128
F objects/31/98ddf68738febc862907cb4846cc218aa1ab07 | 54
D objects/32/
F objects/32/3c4289276b800b809b25d7a175ab595cfb721a | 791
F objects/32/67b9bca935b1ff066d7c771a74866ee3226df1 | 198
D objects/39/
F objects/39/219f13df0a3386078e217e390824640d6ab6cf | 1984
F objects/39/7059c5f850c668180163eacee1042fca13a2ac | 226
D objects/3a/
F objects/3a/7aa4731ce56f584ab1c2fbddf5d53f52763e19 | 196
D objects/3d/
F objects/3d/f41a543371dbfa9f71773c3806f56ea14b7a3b | 16837
D objects/44/
F objects/44/147731920e141ed4d1430f67ee5ab9afe6c408 | 416
F objects/44/cb892563ecf6ee8197d8b116063e06c48e6c1b | 194
D objects/48/
F objects/48/05e26b9aad2192e96d954134149e373bce0361 | 54
F objects/48/16494ae79e7bcd25e0e928e161aa3dd7cf0bf0 | 1204
D objects/4c/
F objects/4c/abd0d526de27ccc26ab761677cba356048ad7d | 46521
D objects/4d/
F objects/4d/584ec9692887e31bc320f5fe85391c54cac968 | 929
D objects/55/
F objects/55/fb849b9d4e5c64a9a16e970df3e41c2a182a62 | 55
D objects/59/
F objects/59/1a50f4d898d9b7220dfd2f00e8a4fa6462f489 | 255
D objects/5a/
F objects/5a/48058b016ec3002d8d7570450298a66cbdd192 | 355
D objects/5c/
F objects/5c/12d04f7ec17e27bbc49f53d4b68aaf657f0dee | 231
D objects/63/
F objects/63/0aa5544013ce7809e06de83ac7191d8f0c72fe | 648754
D objects/64/
F objects/64/214e3e55d4664b3c2c040797a4f81e0e1db623 | 92
D objects/66/
F objects/66/3e636b6e2245ff2547735318b8be5ac691cbc4 | 276
D objects/68/
F objects/68/a057b13f5b99f5342ded9119986b7643c28228 | 929
D objects/69/
F objects/69/4c3652aed21bd77ed4c253baacf317a92ef19b | 55
D objects/6c/
F objects/6c/b73ece9c0397745a48c1cd7989b68d803f6f91 | 163
F objects/6c/cf61f33cee7b40c0a119ada49d075ae763730c | 289
D objects/70/
F objects/70/df01555732d70733e5fd25f02a015157b15c82 | 55
D objects/73/
F objects/73/0936fc828a141b2345c90edb04ecaca58f8358 | 233
F objects/73/0d461c2f694abb972d849a266a855fe005bb31 | 46520
D objects/76/
F objects/76/a41430e62c8019bc41bef1c0c68d00b29085e0 | 231
D objects/7a/
F objects/7a/2066d7856e02bb3b909a3335046a82afdbfadf | 446
F objects/7a/4a1e78be84c574c09906f02968f83dc0f83a79 | 143
D objects/7c/
F objects/7c/139220a8f0f61e7586d38772f0189834cf8d45 | 229
D objects/7d/
F objects/7d/ce7bd85d61717535d011f1d2ebefdd84212bf6 | 929
D objects/7f/
F objects/7f/4479b5ec4645efa4e9bd9cdf9827142757e1db | 929
D objects/80/
F objects/80/2bba16f4b0494e57fdcf65a31bbb8d3b3812ad | 397
D objects/82/
F objects/82/670e5a42e7e8783a1f284df7d505e34aac477b | 162
D objects/83/
F objects/83/11c2d12613c70b968b7b2f821e2b786a18a9db | 581
D objects/86/
F objects/86/d5b4fbaf234d075aac25a54df1c81aeb7ccdf2 | 37396
D objects/8d/
F objects/8d/768dba3b7314e64c5c35ae34192e5cddae3ef2 | 226
F objects/8d/f61f3ce713d5840d4046f1e8ab4bc6da2ac06c | 226
D objects/8f/
F objects/8f/04f6b235599f5f56603f4e2329c71e82996140 | 54
D objects/92/
F objects/92/34e26c122dc4f9b6e02b36f348a4323800a8e8 | 70540
D objects/93/
F objects/93/ea6a16805ecdbb889fe19f72ecbee9f6a1f690 | 174
D objects/94/
F objects/94/3ce793ea627a29f528b62b52188848dc49a0e3 | 159
D objects/9b/
F objects/9b/27fc42e5d73834eaf608629e7b913c9d1d2771 | 327
D objects/ac/
F objects/ac/4c49f79209ebfa2446feb06e9805ef3bcec2c9 | 54
D objects/ad/
F objects/ad/509ba6f148e69b1895b9e4d811b9bc854c0ba5 | 323
D objects/af/
F objects/af/c263be44a16084958929d999f9ec70ae2c2a47 | 40504
D objects/b0/
F objects/b0/2cd6aa3f3c361a9081a7ea5fe33f1a10d9ace8 | 201
D objects/b5/
F objects/b5/3738d41378f898077f0feafa831df7ca5aea68 | 77
D objects/b7/
F objects/b7/80261cf13dad6b045e671fd48de2778b6f46ba | 1997
F objects/b7/fe17528abd849c518b73e3097a2fa702fa0185 | 195
D objects/b8/
F objects/b8/3bf725287240e1714787b01419c21887f2c94c | 226
D objects/bc/
F objects/bc/b35ad808eac72d60a29d3158fb79bbede9b5f6 | 256
D objects/bd/
F objects/bd/32b212746821fa524dc0280abbd9f08f19db8c | 69971
F objects/bd/7358dc7208041ddca5b539126d859d1746f88f | 1160
D objects/c1/
F objects/c1/e42ebf8de0035370edbfb2da5f326af7fb7b2e | 235
D objects/c3/
F objects/c3/5f008293af41e12e751bb244bb655d945bbce5 | 931
D objects/c8/
F objects/c8/0657371da704ae3822959f20f54024a03fee92 | 208
D objects/ca/
F objects/ca/f5042238e4dadf42232ea3e85e2cbba7b0c00f | 197
D objects/cc/
F objects/cc/3095ec9e5aca1bb0a18541361262c02df41b8b | 179
D objects/cd/
F objects/cd/571909b39f8766b15322a6d709d7dbac9244ec | 215
F objects/cd/afee5d45f9c6e4c1c92619d04bb780e5f36b50 | 1204
D objects/ce/
F objects/ce/254bfd911c243956f848e37a92dc9b0466ef2b | 451
F objects/ce/a208622328f8d866dff21594ac3a8b3252d686 | 55
D objects/d5/
F objects/d5/5adb7e3e530597c348fb858e3648aed5ee1130 | 193
D objects/d8/
F objects/d8/68f427239d2d72c2e0bd6725f878c0070808f5 | 194
D objects/d9/
F objects/d9/964ba50304f14579e9c4b3055a22548d5290d2 | 31
D objects/da/
F objects/da/70e0aeead5ad2ebe3b609d214e5c77bfd3bf14 | 177
D objects/db/
F objects/db/82d4c98d403513205399a1c0ebb1cd6d022591 | 190
D objects/de/
F objects/de/cde97b3444d38fd6d1d278cc5a950c43adddf8 | 54
D objects/df/
F objects/df/be58dcf578338f72c6108bd6dbe68d34ba8dbd | 960
D objects/e2/
F objects/e2/18ac6045dcc890d1ab961fa4f5fffa81030b50 | 288
F objects/e2/664583707e96bb020ef1e4756aafed70f519c9 | 256
D objects/e4/
F objects/e4/2d8a17ecdbb83864c86fa9198b0e55015660d3 | 288
F objects/e4/83880041f2e14ff98cbb47de89f646cf811fdd | 214
D objects/e7/
F objects/e7/08318ac708a4e097d8e46601e09a8c3b9b1fa5 | 1203
F objects/e7/a8b3a363608e2573dccc8e02ef308f9c471ade | 929
D objects/e8/
F objects/e8/25238b23a745faa4eaf7e16a9cbc9e71fb7336 | 1203
F objects/e8/758e6f8e25b6cc55adb95710a54f9f3e1edfac | 218
D objects/ec/
F objects/ec/2bf3994bc82b5b1c7469cef9cd7105460cc8a2 | 187
D objects/ee/
F objects/ee/08e0b6b60e59d078fe6f4d0128daf51c4d7cb6 | 42204
D objects/ef/
F objects/ef/0c70585bb1c8c280e5d9bd1540c2851c152794 | 184
D objects/f0/
F objects/f0/fe58aab52f83994546a078deea94c700d33980 | 489
D objects/f1/
F objects/f1/27e31f6e78ce1e2953998359110b9d9279d5ad | 157
D objects/f3/
F objects/f3/ae08ca7aa34af81054b10439b7c401ea213eb4 | 356
D objects/f4/
F objects/f4/e7592e8a205cec1a2602bce0e60526ed0dc645 | 48246
D objects/f6/
F objects/f6/2a9f665d4f9143a168ff5f17caf23b62e8bda9 | 977
D objects/fb/
F objects/fb/b96596de63c61e5f8f6bfb41e61689f4cac659 | 203
D objects/fc/
F objects/fc/48fd4665927340820c8a92778a7d29689ff388 | 195
D objects/fe/
F objects/fe/b6520ec3866405dab16c772284ffeb7a61a4a2 | 219
F objects/fe/c0abcdfb3589518073d46aa5f722a2401733ca | 1203
D objects/info/
D objects/pack/
F ORIG_HEAD | 41
D refs/
D refs/heads/
F refs/heads/backup-main | 41
D refs/heads/copilot/
F refs/heads/copilot/vscode-mmnurih9-jetz | 41
F refs/heads/main | 41
D refs/remotes/
D refs/remotes/origin/
D refs/remotes/origin/copilot/
F refs/remotes/origin/copilot/vscode-mmnurih9-jetz | 41
F refs/remotes/origin/HEAD | 30
F refs/remotes/origin/main | 41
D refs/tags/
~~~

</details>

<details>
<summary>VS_code/Git/MQTT_webovky/.git/ — 78 souborů, 61 adresářů včetně kořene této .git složky</summary>

Cesty uvnitř uvedeného .git adresáře; D = adresář, F = soubor, poslední údaj u souborů je velikost v bajtech.

~~~text
D ./
F COMMIT_EDITMSG | 23
F config | 248
F description | 73
F FETCH_HEAD | 103
F HEAD | 23
D hooks/
F hooks/applypatch-msg.sample | 478
F hooks/commit-msg.sample | 896
F hooks/fsmonitor-watchman.sample | 4726
F hooks/post-update.sample | 189
F hooks/pre-applypatch.sample | 424
F hooks/pre-commit.sample | 1649
F hooks/pre-merge-commit.sample | 416
F hooks/pre-push.sample | 1374
F hooks/pre-rebase.sample | 4898
F hooks/pre-receive.sample | 544
F hooks/prepare-commit-msg.sample | 1492
F hooks/push-to-checkout.sample | 2783
F hooks/sendemail-validate.sample | 2308
F hooks/update.sample | 3650
F index | 794
D info/
F info/exclude | 240
D logs/
F logs/HEAD | 562
D logs/refs/
D logs/refs/heads/
F logs/refs/heads/master | 562
D logs/refs/remotes/
D logs/refs/remotes/origin/
F logs/refs/remotes/origin/main | 670
D objects/
D objects/09/
F objects/09/16e9d1843356d3aec55d7ccd9341a5b888d5a7 | 40683
F objects/09/3ed29385b177fc993edd9513eddb0ef6485a16 | 232
D objects/1c/
F objects/1c/1221b3ab250a13f8bcd8fb5aa794194c2d914b | 54
D objects/1d/
F objects/1d/8845f390d8e4bccb87c04b539f45659dd83c52 | 265
D objects/21/
F objects/21/e907631d99b5456e1aae4f0176faee56dda02d | 46520
D objects/2b/
F objects/2b/9bc46a0cd68a71ac06ae5cbb9f4d33ea59f094 | 256
D objects/31/
F objects/31/7ac18b7aae4bee3b1cdafe5aa719988dbb1382 | 128
F objects/31/98ddf68738febc862907cb4846cc218aa1ab07 | 54
D objects/32/
F objects/32/3c4289276b800b809b25d7a175ab595cfb721a | 791
F objects/32/67b9bca935b1ff066d7c771a74866ee3226df1 | 198
D objects/39/
F objects/39/7059c5f850c668180163eacee1042fca13a2ac | 226
D objects/44/
F objects/44/cb892563ecf6ee8197d8b116063e06c48e6c1b | 194
D objects/48/
F objects/48/05e26b9aad2192e96d954134149e373bce0361 | 54
D objects/4c/
F objects/4c/abd0d526de27ccc26ab761677cba356048ad7d | 46521
D objects/5c/
F objects/5c/12d04f7ec17e27bbc49f53d4b68aaf657f0dee | 231
D objects/64/
F objects/64/214e3e55d4664b3c2c040797a4f81e0e1db623 | 92
D objects/69/
F objects/69/4c3652aed21bd77ed4c253baacf317a92ef19b | 55
D objects/6c/
F objects/6c/b73ece9c0397745a48c1cd7989b68d803f6f91 | 163
F objects/6c/cf61f33cee7b40c0a119ada49d075ae763730c | 289
D objects/70/
F objects/70/df01555732d70733e5fd25f02a015157b15c82 | 55
D objects/73/
F objects/73/0d461c2f694abb972d849a266a855fe005bb31 | 46520
D objects/76/
F objects/76/a41430e62c8019bc41bef1c0c68d00b29085e0 | 231
D objects/7a/
F objects/7a/4a1e78be84c574c09906f02968f83dc0f83a79 | 143
D objects/7c/
F objects/7c/139220a8f0f61e7586d38772f0189834cf8d45 | 229
D objects/82/
F objects/82/670e5a42e7e8783a1f284df7d505e34aac477b | 162
D objects/83/
F objects/83/11c2d12613c70b968b7b2f821e2b786a18a9db | 581
D objects/86/
F objects/86/d5b4fbaf234d075aac25a54df1c81aeb7ccdf2 | 37396
D objects/8d/
F objects/8d/768dba3b7314e64c5c35ae34192e5cddae3ef2 | 226
F objects/8d/f61f3ce713d5840d4046f1e8ab4bc6da2ac06c | 226
D objects/8f/
F objects/8f/04f6b235599f5f56603f4e2329c71e82996140 | 54
D objects/94/
F objects/94/3ce793ea627a29f528b62b52188848dc49a0e3 | 159
D objects/af/
F objects/af/c263be44a16084958929d999f9ec70ae2c2a47 | 40504
D objects/b0/
F objects/b0/2cd6aa3f3c361a9081a7ea5fe33f1a10d9ace8 | 201
D objects/b7/
F objects/b7/fe17528abd849c518b73e3097a2fa702fa0185 | 195
D objects/b8/
F objects/b8/3bf725287240e1714787b01419c21887f2c94c | 226
D objects/bc/
F objects/bc/b35ad808eac72d60a29d3158fb79bbede9b5f6 | 256
D objects/c8/
F objects/c8/0657371da704ae3822959f20f54024a03fee92 | 208
D objects/ca/
F objects/ca/f5042238e4dadf42232ea3e85e2cbba7b0c00f | 197
D objects/cc/
F objects/cc/3095ec9e5aca1bb0a18541361262c02df41b8b | 179
D objects/ce/
F objects/ce/a208622328f8d866dff21594ac3a8b3252d686 | 55
D objects/d5/
F objects/d5/5adb7e3e530597c348fb858e3648aed5ee1130 | 193
D objects/d8/
F objects/d8/68f427239d2d72c2e0bd6725f878c0070808f5 | 194
D objects/d9/
F objects/d9/964ba50304f14579e9c4b3055a22548d5290d2 | 31
D objects/da/
F objects/da/70e0aeead5ad2ebe3b609d214e5c77bfd3bf14 | 177
D objects/de/
F objects/de/cde97b3444d38fd6d1d278cc5a950c43adddf8 | 54
D objects/e2/
F objects/e2/18ac6045dcc890d1ab961fa4f5fffa81030b50 | 288
F objects/e2/664583707e96bb020ef1e4756aafed70f519c9 | 256
D objects/ec/
F objects/ec/2bf3994bc82b5b1c7469cef9cd7105460cc8a2 | 187
D objects/ef/
F objects/ef/0c70585bb1c8c280e5d9bd1540c2851c152794 | 184
D objects/f1/
F objects/f1/27e31f6e78ce1e2953998359110b9d9279d5ad | 157
D objects/fc/
F objects/fc/48fd4665927340820c8a92778a7d29689ff388 | 195
D objects/info/
D objects/pack/
F ORIG_HEAD | 41
D refs/
D refs/heads/
F refs/heads/master | 41
D refs/remotes/
D refs/remotes/origin/
F refs/remotes/origin/main | 41
D refs/tags/
~~~

</details>

## Příloha D — Evidence zachování existujících souborů

Před vytvořením dokumentu byl uložen inventář cest, velikostí a časů změny. U 111 obsahově kontrolovaných souborů byly navíc v paměti zachyceny SHA-256. Závěrečné ověření porovnává stejné množiny a očekává jedinou novou cestu, VS_code/ANALYZA_CELEHO_WORKSPACE.md. Vynechané citlivé soubory se kvůli ověření znovu obsahově neotevírají; jejich kontrola je omezená na metadata.

### Výsledek závěrečného porovnání

- Vstupní inventář: **634 položek**; závěrečný inventář: **635 položek**.
- Jediná nová cesta: **VS_code/ANALYZA_CELEHO_WORKSPACE.md**.
- Zmizelé původní cesty: **0**.
- Změněná metadata původních položek (typ, velikost nebo čas změny): **0**.
- Porovnané obsahové SHA-256: **111**; rozdílné hashe: **0**.
- Hlavní Git pracovní kopie po auditu vykazuje pouze nový nesledovaný dokument. Stav vnořené pracovní kopie odpovídá stavu zaznamenanému před vytvořením auditu.

U vynechaných souborů tento výsledek potvrzuje shodu dostupných metadat, nikoli nezávislý důkaz obsahové shody. U 111 obsahově čtených souborů je shoda doložena i kontrolními součty. Vstupní inventář a kontrolní součty byly po dobu práce drženy v paměti; nevznikl žádný další pomocný soubor.




