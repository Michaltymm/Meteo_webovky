# Bezpečnostní audit — 22. 10. 2026

Audit proběhl postupně v deseti etapách; průběh a další kroky jsou v
[SECURITY_ROADMAP.md](SECURITY_ROADMAP.md). Výchozí revize `ae40f95`,
aktivní web po opravách **0.11.4**, výhradně větev `codex-dev`.

## Výsledek a rozsah

**5 potvrzených bezpečnostních/odolnostních nálezů, 5 opravených, 0 otevřených
z těchto pěti.** Jeden nízké a čtyři střední podmíněné závažnosti; žádný
potvrzený kritický ani vysoce závažný nález v ověřeném rozsahu. Nejde o
certifikaci celého systému. Závažnost je kvalitativní posouzení konkrétního
způsobu použití, nikoli vypočtené CVSS.

| ID | Závažnost a podmínka | Ověřená oprava |
| --- | --- | --- |
| SEC-001 | Nízká; poškozené či nepřístupné lokální předvolby | Obnovení tří výchozích stanic, kontrola indexu, paměťové předvolby při chybě storage |
| SEC-002 | Střední, podmíněná importem nedůvěryhodné konfigurace | Kontrola typů, rozsahů, stanice a velikosti před změnou dat; allowlist podporovaných polí, bez logování celé konfigurace |
| SEC-003 | Střední, při aktivovaném MQTT a nevhodném provozu v odebíraném topicu | Odmítnutí neplatných zpráv; omezení velikosti, frekvence a historie bez tichého ořezu měření |
| SEC-005 | Střední, při nadměrné odpovědi zdroje/proxy | Průběžný limit skutečných bytů a limity složitosti CSV; neúspěch nepřepíše platný store |
| SEC-007 | Střední, při samostatném spuštění historické kopie s nedůvěryhodnými daty | Bezpečné vykreslení původních textových polí v obou historických tabulkách; archiv není v Pages artefaktu |

Preventivní opatření se nezapočítávají jako další potvrzené zranitelnosti:
HTTPS používá WSS na všech MQTT portech (SEC-004), lokální server má omezenější
expozici (SEC-006), obě CDN knihovny mají SRI a přímé Actions jsou připnuté na SHA.
Všechny checkouty používají `persist-credentials: false`.

Kontrola tajemství zahrnula 302 dostupných historických blobů, bez potvrzeného
živého tokenu, privátního klíče nebo hesla. Vlastní signaturní scanner není
náhradou úplného secret-scanning produktu. Závěrečná kontrola změněných souborů
rozlišila syntetické testovací hodnoty od skutečných tajemství. Veřejné Sheet ID
není přístupový token. Klientský zámek nastavení není autentizace.

## Testy a výkon

- `node --test tests/*.test.js`: **246/246 prošlo**, z toho 16 nových Node regresí.
- `tests/security-config.test.js`: neplatný import zachová data i relaci,
  poškozené/blokované storage a všechny tři skutečné konfigurace.
- `tests/security-ingress.test.js`: stream bez délky i s nepravdivou délkou,
  UTF-8 přes hranice chunků, zrušení čtení, CSV limity, vadné JSON/API a MQTT.
- Server a Pages: traversal, metadata, symlinky, metody/hlavičky a publikační
  allowlist. Reálná sestava obsahuje 11 veřejných souborů; všech pět produkčních
  souborů je bajtově shodných s `main` v revizi `2405c5d`.
- Skutečný Chromium 154: tři konfigurace s řízenými CSV/UV odpověďmi, přepínání
  stanic a stránek, devět grafů, období, zoom/pan, legendy, PNG, prázdná data,
  chyby/pozdní odpovědi a mobilní dotykové ovládání. Rozměry
  1440/800/390/320 px v obou tématech; **0 pageerror**. Chybové scénáře záměrně
  vracejí neúspěšné HTTP odpovědi, nejde o tvrzení o bezchybném živém transportu.
- `scripts/check-security-browser.py`: originální CDN knihovny se načtou,
  změněné byty obou knihoven prohlížeč odmítne (dvě očekávané SRI chyby).
  Původní parser a oba renderery historické kopie v izolovaném dokumentu
  zobrazí testovací HTML jako text; handler se nespustí. Síť testu je blokovaná.
- Parser 1k/10k/100k/250k řádků změřen před/po. U250k medián
  **1720 → 1781 ms**, konečný heap **181 → 181 MiB**; všechny řádky zachovány.
  Podmínky, omezení a reprodukce v [performance/SECURITY.md](performance/SECURITY.md).
  Nejde o špičku paměti, Web Vitals ani fyzický telefon.

Browser testy potřebují lokální původní Chart.js4.4.0 a Paho1.1.0 z URL uvedených
v `index.html`; používají skutečné byty a CORS odpovědi pro SRI:

```sh
python scripts/check-analytics-grid-browser.py --chartjs /tmp/chart.js --paho /tmp/paho.js --output /tmp/analytics-security.json
python scripts/check-security-browser.py --chartjs /tmp/chart.js --paho /tmp/paho.js --output /tmp/security-browser.json
```

## Co zůstává otevřené

1. **NEEDS_REVIEW — MQTT/ESP32:** skutečné ACL, publisher identity, TLS certifikáty,
   limity brokeru a firmware. V konfiguracích není aktivní broker; nebyly prováděny
   pokusy o přihlášení ani zápis. Klientský limit nastává až po doručení do Paho,
   nenahrazuje ochranu brokeru.
2. **NEEDS_REVIEW — služby:** oprávnění Sheets a případné Apps Script/ThingSpeak
   nasazení. Zdrojový kód ani administrace nejsou k dispozici. HTTPS proxy zůstává
   další stranou, která vidí URL a může ovlivnit odpověď; ověřený původ měření tím
   není zaručen.
3. **NEEDS_REVIEW — GitHub:** vzdálené Secrets a ochrany větví/prostředí nebyly
   administrátorsky ověřeny. `.github/dependabot.yml` je připraven pro Actions
   a PR do `codex-dev`, ale aktivace vyžaduje konfiguraci na výchozí větvi.
   Do `main` se nezasahovalo, automatický běh Dependabotu není potvrzen.
   CI upozorňuje na deklarace Node20 u některých Actions (runner je spouští
   na Node24) a vnořený `upload-artifact@v4`. SHA pinning přímých kroků
   nepřipíná automaticky všechny tranzitivní závislosti; upgrade tohoto
   řetězce je další preventivní úkol.
4. **TODO — CSP:** striktní CSP potřebuje úpravu inline kódu a handlerů.
   GitHub Pages neumožňuje vlastní response `frame-ancestors`/X-Frame-Options;
   HTML meta takovou ochranu nenahradí. Bezpečnostní hlavičky `server.js` platí
   jen pro lokální náhled.
5. **TODO — průběžná údržba:** pravidelné CDN advisories, větší historie řešená
   stránkováním, dlouhodobý provoz a fyzické Safari/iOS. SRI není aktualizace
   knihovny. Nalezený [Chart.js advisory](https://github.com/advisories/GHSA-h68q-55jf-x68w)
   se týká verzí před2.9.4, nikoli používané4.4.0; omezené hledání neprokazuje
   absenci dalších chyb. Historická kopie má pouze cílenou opravu tabulek,
   nikoli modernizaci všech úložišť, transportů a integrací; bez dalšího auditu
   ji nenasazovat. Produkční HTML zůstává samostatnou nezměněnou verzí.

Žádná živá tajemství nebyla rotována, historie Gitu přepisována ani produkční
měření upravena. Podrobné soukromé reprodukce jsou mimo veřejný repozitář v
`/workspace/security-private/Meteo_webovky/REPORT.md`.

## Commity a publikování

- [Konfigurace a storage — 3df9a02](https://github.com/Michaltymm/Meteo_webovky/commit/3df9a02)
- [Omezení příjmu dat — 38b643f](https://github.com/Michaltymm/Meteo_webovky/commit/38b643f)
- [CDN, workflow a server — 0d8cdc1](https://github.com/Michaltymm/Meteo_webovky/commit/0d8cdc1)
- [Cílená oprava historické kopie — d920f8b](https://github.com/Michaltymm/Meteo_webovky/commit/d920f8b)

Implementováno, lokálně otestováno a odesláno na `codex-dev`.
[Actions #25](https://github.com/Michaltymm/Meteo_webovky/actions/runs/39824209785)
pro `c19e246` potvrzují **Success**: build17s, deploy11s, celkem38s. Nasazení
vývojového HTML v0.11.4 potvrzuje workflow; závěrečný pozdější commit mění pouze
dokumentaci. `main` zůstává `2405c5d7326909a24c41e7066bfdc4a9d1622208`.
Přímá kontrola živého Pages hostu není v síťové politice tohoto prostředí povolena.
