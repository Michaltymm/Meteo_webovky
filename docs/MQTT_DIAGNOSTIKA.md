# Diagnostika živých zpráv — METEO-050, v0.18.0

Pod ⓘ u načtené historie je v režimu `mqtt` nebo `both` sekce „Živé zprávy
MQTT“. U čistého MQTT je rozbalená, u kombinovaného zdroje sbalená. Dodané
tři konfigurace používají pouze Sheets; bez přijatých MQTT zpráv se jim tato
sekce nezobrazuje. Konfigurace ani pravidla přijetí dat se touto etapou nemění.

## Co čítače znamenají

- **Obsloužené zprávy:** callback aktivního MQTT klienta pro aktuální relaci
  stanice. Stará generace, odpojený klient a chyby samotného připojení se
  nepočítají jako zprávy. Čítač není odhadem ztrát na brokeru nebo v síti.
- **Uložená měření:** zpráva, jejíž řádek byl vložen do `store.rows`. Je to
  kumulativní počet v relaci, nikoli současná délka historie po nahrazení CSV.
  Potvrzuje přijetí původními pravidly, nikoli fyzikální správnost senzoru.
- **Odmítnuté zprávy:** první dosažená kontrola, která zabránila vložení řádku.
  Každá zpráva dostane nejvýše jeden důvod odmítnutí.
- **Chyby aplikace:** neočekávané selhání při zpracování objektu měření nebo
  aktualizaci aplikace. Může nastat po uložení; tehdy zpráva zůstává přijatá
  a současně se neoznačí za odmítnutou. Tento údaj není další kategorií,
  kterou lze přičíst k přijatým a odmítnutým zprávám.

Čítače a poslední důvod/čas odmítnutí žijí pouze v RAM aktivní stanice.
Opětovné připojení je zachová. Přepnutí stanice, reset její datové relace nebo
nové načtení stránky je vyčistí, včetně návratu A → B → A. CSV, UV a přehled
ostatních stanic je nepřepisují. Časy jsou časy prohlížeče, nikoli zařízení.

## Důvody a pořadí kontrol

| Kód | Význam | Chování |
| --- | --- | --- |
| `RATE_LIMIT` | Více než 20 callbacků v dosavadním sekundovém okně | Zastavení příjmu |
| `HISTORY_LIMIT` | Před vložením je v historii alespoň 300 000 řádků | Zastavení příjmu |
| `PAYLOAD_UNREADABLE` | Getter obsahu selhal nebo výsledek není text | Odmítnutí této zprávy |
| `SIZE_LIMIT` | Text má přes 65 536 znaků nebo UTF-8 bytů | Zastavení příjmu |
| `INVALID_JSON` | Text nelze rozebrat jako JSON | Odmítnutí této zprávy |
| `INVALID_OBJECT` | JSON je null, pole nebo primitivní hodnota | Odmítnutí této zprávy |
| `NO_MEASUREMENT` | Ani jedna ze sedmi veličin neprošla původním číselným převodem | Odmítnutí této zprávy |
| `PROCESSING_ERROR` | Neočekávaná chyba před uložením řádku | Odmítnutí a započtení chyby aplikace |

Tabulka sleduje pořadí kontrol; velikost lze ověřit až po přečtení textu.
Při souběhu limitů se zachová původní přednost četnosti před délkou historie.
Zpráva, která překročí bezpečnostní limit, se započte jednou a klient se
odpojí; pozdější callbacky se ignorují. Dosavadní ruční obnovení příjmu zůstává.
Neplatný JSON sám klienta neodpojí, ale vstupuje do existujícího limitu četnosti.

Číselné aliasy, `pf` včetně tolerovaného číselného prefixu, platná nula,
chybějící senzory, čas příjmu a ponechání duplicit jsou zachované. Vzniká
původní řádek měření, nikoli jeho diagnostická kopie. Deduplikace, příznaky
kvality a změna validačních pravidel jsou samostatné METEO-047/048/049.

## Panel, soukromí a cena

Při příchodu MQTT zůstává otevřená jen diagnostická nápověda; podklady původních
měření se při invalidaci nadále zavřou. Otevřená rozbalená sekce aktualizuje
jen text čítačů a posledního odmítnutí, zachová DOM, fokus i stav rozbalení.
Sbalený či zavřený panel se průběžně nepřekresluje. Znovuotevření ukáže aktuální
součty. Scroll mimo panel, odchod, skrytí stránky a Escape zachovávají původní
zavírání nápovědy. Přijetí nové CSV historie diagnostiku také nadále zavře.

Diagnostika ukládá pevné kódy, čítače a časy. Neobsahuje obsah zpráv, hodnoty
senzorů, topic, broker, přihlašovací údaje ani text výjimky. Čítače se nepersistují
a neposílají na server. Nejde o log/export METEO-064 ani ověření ACL brokeru.

Přírůstek metadat a práce je O(1) na callback bez průchodu historií; žádné nové
requesty, intervaly, závislosti ani Chart instance. Existující aktualizace
přehledu po přijatém měření zůstává. [Měření před/po](performance/MQTT_DIAGNOSTIKA.md).

## Ověření a další etapa

`tests/mqtt-diagnostics.test.js`: 12 regresí skutečného handleru; celá Node
sada **308/308**. Důvody a priorita limitů, ASCII/UTF-8, nuly/aliasy, duplicity,
oddělení chyb před/po uložení, reconnect, staré callbacky, reset A → B → A,
nezávislost CSV/UV, bezpečný omezený report a žádná práce DOM pro zavřený panel.

`scripts/check-data-status-browser.py`: skutečný Chromium 154/Chart.js/Paho
se SRI, původní tři konfigurace s řízenými CSV/UV a lokální MQTT Client
náhrada. Původních 24 rozložení diagnostiky a dalších 12 pro čisté MQTT
(tři stránky, obě témata, 320/1440 px), živé čítače se stejnými DOM uzly,
reconnect/limit/reset, chyba aplikace po uložení a zavření podkladů extrémů.
Bez pageerror, otevřených WebSocketů nebo dodatečných fetch/grafů diagnostiky.
Není to ověření skutečného brokeru, fyzického Safari/iOS nebo živých služeb.

METEO-050 je dokončené v rozsahu provozního panelu CSV/časování/MQTT; historie
událostí a anonymizovaný export zůstávají METEO-064. Další doporučená etapa:
METEO-008, nejprve rozdělení přípravy velkého analytického modelu podle již
naměřeného blokování; worker až po ověření ceny předávání dat a mezivýsledků.
