# Načítání knihovny Paho MQTT při prvním připojení

METEO-055, v0.21.15. Výchozí revize `b2e7ba0`.

Knihovna Paho se načítá pouze při požadavku na živé připojení. Prohlížeč
vezme stejnou adresu, verzi a SRI z deklarace v HTML a otevře jeden
asynchronní požadavek. Režim Google Sheets může začít stahovat a zobrazit
měření ihned. Ani živé připojení na dostupnost Chart.js nečeká.

Při čekání eviduje stránka pouze aktuální generační kontext stanice. Změna
stanice nebo zastavení MQTT tento kontext zruší. Dokončení knihovny připojí
jen platnou čekající stanici. Při chybě CDN se zobrazí stav MQTT, ostatní
zdroje pokračují a automatické opakování připojení k brokeru se nespustí.
Nový pokus o stažení knihovny nabídne obnovení stránky.

## Měření

Offline Chromium s výchozími konfiguracemi Google Sheets, 390 px, stejné
soubory knihoven a CSV, přímý vstup do Moderního přehledu 2. Měří se
čas navigace do prvního zápisu teploty do DOM. Po zahřátí šest párových
opakování při střídání verzí. Řízená prodleva je přidána k odpovědi Paho.
Měření popisuje lokální simulaci a nezahrnuje skutečnou síť stanic.

| Řízená prodleva Paho | Zobrazení teploty před → po (ms) | Požadavky na Paho před → po |
| ---: | ---: | ---: |
| 0 ms | 275,9 → 281,5 | 1 → 0 |
| 300 ms | 501,2 → 233,5 | 1 → 0 |

Časy jsou mediány. Obě verze zobrazily stejnou naměřenou hodnotu. Bez
přidané prodlevy se zrychlení neprojevilo.

## Ověření

Prošlo 493/493 testů Node a čtyři kontroly v Chromium. Cílený prohlížečový
test používá skutečnou knihovnu Paho a simulovaný WebSocket. Ověřil jediný
požadavek na Paho, připojení pouze pro nově vybranou stanici, odběr jejího
tématu a přijetí vzorku včetně nuly ještě před dostupností Chart.js. Při
chybě knihovny se spojení k brokeru nevytvořilo a hodnota ze Sheets zůstala
viditelná. Kontrolovalo se také ověření integrity CDN a fungování odložené
Chart.js. Zkouška neprobíhala na živém brokeru.
