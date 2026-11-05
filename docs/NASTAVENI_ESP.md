# Nastavení jednotlivých ESP — METEO-084

2026-11-05, v0.19.0, pouze codex-dev.

## Hotová první etapa

⚙ → **Nastavení meteostanice** otevře samostatný dialog pro aktuální stanici.
Přepínač používá existující tři stanice. Zobrazuje jejich stabilní klíč webu
(z názvu konfiguračního souboru) a čas posledního měření. Tento klíč není
ověřenou identitou konkrétního ESP. Firmware, deska, poslední kontakt a použitý
interval jsou označeny jako nedostupné/nepotvrzené; žádná diagnostika se nevymýšlí.

Interval měření lze zatím uložit **jen jako lokální koncept**, oddělený podle
stanice a dev/produkčního prostředí, nebo stáhnout návrh JSON. Není předvyplněn
z CFG.interval: to je interval obnovy webu, nikoli měření ESP. Návrhový rozsah
60–86400 celých sekund musí být potvrzen firmwarem. Chybné/poškozené koncepty
se nepoužijí. Nedostupné trvalé úložiště je přiznáno. Koncept neobsahuje hesla,
API klíče, broker, autorizační token ani serverovou verzi.

**Žádný požadavek na změnu ESP se nyní neodesílá.** Web neposkytuje zápisové
API a firmware z ESP32_Code v tomto checkoutu není. Statický GitHub Pages sám
nemůže bezpečně přijímat a trvale zapisovat změny. Stávající čtecí Sheets,
MQTT, konfigurace stanic i měření zůstávají zachované.

## Dohodnout s firmwarem a službou — navržený kontrakt

Backend udržuje pro každé autentizované zařízení:

- `desiredVersion`: monotónní verze poslední požadované konfigurace.
- `appliedVersion`: poslední verze, kterou ESP ověřeně uložilo a použilo.
- `changed`: odvozeně 1, pokud desiredVersion > appliedVersion, jinak 0.
- Požadované hodnoty, skutečně potvrzené hodnoty, poslední autentizovaný kontakt,
  případná chyba aplikace. Chyba nepotvrzuje úspěšné použití konfigurace.

Postup:

1. Oprávněný správce uloží nastavení. Backend atomicky přidělí novou verzi,
   změna = 1. Ochrana proti souběžnému přepsání přes expectedVersion/If-Match.
2. ESP při svém běžném připojení přečte malý stav svého zařízení přes HTTPS;
   nic navíc neprobouzí. Beze změny nestahuje celé nastavení a nepřepisuje NVS.
   Samotná kontrola samozřejmě vyžaduje malý síťový přenos; lze použít ETag/304.
3. Při nové verzi stáhne příslušnou konfiguraci, ověří schéma, limity,
   identitu zařízení a verzi. Uloží ji odolně proti výpadku a teprve potom
   použije/potvrdí přesně tuto verzi. Při chybě zachová funkční konfiguraci.
4. Potvrzení aktualizuje appliedVersion pouze platnou vydanou verzí pro toto
   zařízení; starší ACK nikdy nesníží appliedVersion. ACK vyšší než vydaná
   verze nebo jiného zařízení se odmítne. Opakované ACK je idempotentní.
5. Pokud mezi stažením v18 a potvrzením vznikla v19, ACK v18 **nesmí** vynulovat
   změnu: desired=19/applied=18 → změna stále 1. GET/download nic nepotvrzuje.

Návrh exportu z webu (není automaticky kompatibilní s existujícím firmwarem):

```json
{"schemaVersion":1,"stationKey":"config_praha_baterie","settings":{"measurementIntervalSeconds":300}}
```

Mapování stationKey → deviceId provádí server; samotný veřejný klíč není
oprávnění. Ovládací API musí mít skutečné přihlášení správce a oddělenou
identitu/oprávnění každého ESP (čtení vlastního configu + vlastní ACK).
Žádné sdílené zapisovací tajemství v HTML, veřejných konfiguracích nebo
localStorage. Lokální heslo stávajícího nastavení webu není autentizace API.
Zápisové řízení nesmí jít přes veřejné čtecí CORS proxy.

## Zbývá / pokračování

Potřeba repozitáře/aktuálního zdroje ESP32_Code a konkrétního zápisového
backendu (např. vlastní služba nebo Apps Script včetně autentizačního modelu).
Pro diagnostiku dohodnout volitelné deviceId, firmwareVersion, hardwareModel,
uptimeSeconds, bootReason, rssiDbm, freeHeapBytes, lastContact, lastError,
reportedSettings a capabilities. Neznámé hodnoty zůstávají nedostupné;
jednotlivé ovladače zpřístupnit jen podle skutečných capabilities firmwaru.

Potvrdit identifikaci tří zařízení, podporované hodnoty/jednotky intervalu,
napájení/deep sleep a okamžik aplikace. Začít jedinou testovací stanicí.

Potom implementovat API/firmware a teprve následně nahradit lokální koncept
skutečným odesláním + stavem „čeká na ESP / potvrzeno / chyba“. Na lokálním
backendu ověřit souběžné zápisy, opakované/opožděné ACK, ztrátu spojení,
přerušení napájení, chybnou verzi/limity a oddělení zařízení. Nelze je
prohlašovat za otestované nad současným statickým webem.

Ověření první etapy: tests/device-settings.test.js a
scripts/check-device-settings-browser.py. Živé ESP/API ani fyzický iOS se
netestují; browser používá řízené CSV a skutečný Chart.js.
