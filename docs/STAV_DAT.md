# Stav a stáří dat — METEO-009, v0.15.0

Společný panel nad hlavním, moderním i analytickým pohledem odděluje tři
informace, které dříve splývaly v čase aktualizace:

| Údaj | Co potvrzuje | Co nepotvrzuje |
| --- | --- | --- |
| Poslední záznam | Čas prvního, nejnovějšího řádku v sestupně řazené historii | Dobu přenosu ani dostupnost stanice právě teď |
| Úspěšná kontrola Sheets | Dokončený přenos a přijetí platného exportu pro aktuální stanici | Nové měření; i nezměněný platný export aktualizuje tento čas |
| Poslední příjem MQTT | Místní čas přijetí zprávy s alespoň jednou platnou veličinou | Čas měření čidla; současný payload takový kontrakt nemá |
| Načtená historie | Částečný export, celý export zdroje nebo živé zprávy této relace a počet přijatých řádků | Souvislé pokrytí celého období, úplnost čidel ani aktuální filtr grafu |

Časy obsahují sekundy a UTC offset prohlížeče. Legacy CSV nadále interpretuje
datum/čas v zóně prohlížeče; v této etapě se význam původních časových značek
nemění. Explicitní zóna stanice a jednoznačnost opakované hodiny při přechodu
letního času patří do METEO-048. Budoucí čas záznamu je žlutě označen bez
přepisování originálu. Bez známého měřicího plánu nelze ze stáří samotného
prohlásit výpadek čidla; to zůstává METEO-027/045.

## Načítání a chyby

- Úspěch se eviduje ve všech čtyřech větvích načtení Sheets: nový/nezměněný
  rychlý export a nový/nezměněný plný export. Samotné HTTP 200 nestačí.
- Neúspěch ukáže „chyba obnovy“ a ponechá poslední úspěšnou kontrolu i historii.
  Obnovení dat stav opět přepne na ověřený. Požadavky na konfiguraci, UV a cizí
  stanice v overview nejsou úspěšnou kontrolou dat aktivní stanice.
- Připojení MQTT samo neznamená příjem měření. Neplatné zprávy čas příjmu
  neposouvají. Ztráta spojení ponechá poslední platný příjem viditelný.
- U kombinovaného zdroje se oba časy uchovávají samostatně. Načtení nového CSV
  označí nejnovější řádek znovu jako CSV; předchozí čas příjmu MQTT zůstane uveden.
- Přepnutí stanice odstraní její předchozí evidenci; pozdní výsledek původní
  generace nemůže označit novou stanici za ověřenou. Evidence je pouze v paměti
  relace, po reloadu se vyžaduje nové ověření.
- Rychlá větev vrací nejvýše 400 řádků, ne pevné tři dny. Proto tlačítko nyní
  uvádí „Částečná historie · Načíst vše“.

## Výkon a ověření

Panel čte jen `store.rows[0]` a délku pole, drží jeden odkaz na řádek a několik
časů/stavů. Neprochází historii, neinvaliduje statistiky, nevytváří grafy ani
síťové požadavky. Relativní stáří používá stávající minutový interval; ve skryté
kartě se neaktualizuje a po návratu se přepočítá. Nezměněný text se do DOM
nezapisuje. Podrobnosti měření jsou v [STAV_DAT.md](performance/STAV_DAT.md).

`tests/data-status.test.js` přidává 10 regresí včetně nezměněného exportu,
chyby a obnovení, HTTP 200 s neplatným obsahem, staré generace, MQTT, kombinace
zdrojů, nuly/budoucího času a O(1) čtení historie. Celá sada: **273/273**.

`scripts/check-data-status-browser.py` používá původní tři konfigurace,
skutečný Chart.js/Paho se SRI a řízené CSV/UV. Ověřuje časy, chybu bez ztráty
dat, obnovení, zpožděnou novou stanici, nulové/chybějící napětí, nápovědu a
24 kombinací pohledu/tématu/šířky (320/390/800/1440 px), bez pageerror.
Moderní integrační harness a nápověda zůstávají samostatnými regresními kontrolami.
Po resize čeká browser test na asynchronní přizpůsobení canvasu; raw CDP dotyk
čeká na stabilní cíl před odečtením souřadnic.

Testy nepotvrzují živé oprávnění brokeru, aktuálnost skutečných zdrojů ani
fyzický Safari/iPhone. Další vhodná etapa: METEO-050, počty odmítnutých řádků
a důvody validace, získané během parseru bez nových síťových požadavků.
