# Bezpečnostní roadmapa Meteo_webovky

Aktualizace: 2026-10-22 · kontrolní bod **SEC-STAGE-09** · větev `codex-dev`.
Výchozí revize: `ae40f950d5d86d2e99e30a270c09636e8b0d4aa8`. Stav odpovídá dostupnému kódu a výslovně uvedenému rozsahu.

Audit probíhá sekvenčně. Aktivní testy pouze lokálně, živé systémy bez pokusů o zápis či přihlášení. Produkční větev se nemění. Soukromé nálezy a podklady jsou mimo repozitář; nepatří do Pages artefaktu ani veřejných logů.

| Etapa | Oblast | Stav | Veřejně bezpečný výsledek |
| --- | --- | --- | --- |
| 1 | Architektura a bezpečnostní mapa | DONE | Inventář a hranice důvěry ověřeny proti kódu; externí firmware/backend dostupné jen jako dokumentační kontext. Bez oprav. |
| 2 | Hesla, tokeny a citlivé údaje | DONE | Prověřeno 302 dostupných historických blobů a konfigurace; bez potvrzeného živého tajemství. Klientský zámek není autentizace; vzdálené Secrets neověřeny. |
| 3 | Frontend, JavaScript a XSS | DONE | DOM výstupy a URL prověřeny; XSS v aktivním datovém toku nepotvrzeno. Kandidáti odolnosti evidováni soukromě k lokálnímu ověření; CSP omezuje současná struktura a Pages. |
| 4 | MQTT a komunikace s ESP32 | DONE | Ověřen lifecycle a subscribe-only kód volitelného MQTT. Žádný dodaný broker není aktivní; ACL, certifikáty a firmware vyžadují ověření vlastníkem. Bez živých připojení. |
| 5 | Google Sheets a externí API | DONE | Prověřeny čtecí Sheets/UV/proxy cesty a CSV. Aplikace neobsahuje zápisové API ani CSV export; vzdálená oprávnění neověřena. Odolnost odpovědí ověří etapa 8. |
| 6 | Server a backend | DONE | Lokální server: 6/6 regresí cest, metadat a symlinků prošlo. Není součástí Pages runtime; veřejný provoz jiného serveru nedoložen. Doporučeno omezit lokální expozici. |
| 7 | GitHub a externí závislosti | DONE | Workflow/Pages allowlist prověřeny. Známý nalezený Chart.js advisory se této verze netýká; omezené hledání není úplný CVE sken. Secrets a pravidla GitHubu vyžadují vlastníka. |
| 8 | Testy odolnosti dat | DONE | Lokální reprodukce dokončeny; 38 datových/Pages regresí prošlo. Syntetický parser zvládl až 250000 měření. Čtyři podmíněné nálezy odolnosti určeny k opravě; podrobnosti zatím soukromé. |
| 9 | Postupné opravy zranitelností | DONE | Tři malé dávky dokončeny: čtyři potvrzené podmíněné chyby opraveny, doplněna preventivní ochrana. Externí ověření vlastníka a CSP zůstávají oddělenými úkoly. |
| 10 | Závěrečný audit | TODO | Dosud neprovedeno. |

Stavy: TODO – nezahájeno; IN_PROGRESS – rozpracováno; DONE – dokončeno v uvedeném rozsahu; BLOCKED – nelze bezpečně pokračovat; NEEDS_REVIEW – potřebné rozhodnutí vlastníka. DONE analýzy neznamená opravené nálezy ani ověřenou živou infrastrukturu.

## Architektura a hranice důvěry

- Aktivní `index.html` obsahuje UI, parser, výpočty a grafy; tři konfigurace volí veřejné exporty Google Sheets. CSV a poznámky jsou nedůvěryhodné vstupy. CORS proxy je další příjemce URL/veřejných dat a může měnit odpověď.
- Open-Meteo poskytuje externí předpověď UV, nikoli měření vlastní stanice. Volitelný MQTT přijímá zprávy do aktivního store; dodané konfigurace používají Sheets a nemají broker.
- Předvolby a import/export JSON překračují hranici nedůvěryhodné lokální konfigurace. Prohlížeč není bezpečné úložiště serverových tajemství; jeho zámek nastavení není autentizace.
- Chart.js 4.4.0 a Paho 1.1.0 jsou načítané z CDN a běží s oprávněními stránky. Žádný npm manifest ani aplikační backend.
- `server.js` je lokální statický server. GitHub Pages jej nespouští. Lokální běh není doklad nasazení vlastního serveru na Internet.
- Publikační workflow sestavuje z main a codex-dev jeden artefakt s allowlistem HTML a čtyř JSON pro každou verzi. Repozitář a Pages mají rozdílný rozsah veřejných souborů.
- Apps Script, ThingSpeak a ESP32 jsou popsané ve starších auditech; jejich zdrojový kód a aktuální provozní konfigurace zde nejsou. Archivní HTML je další veřejný zdroj v Gitu, nikoli aktuální vstup Pages.

## Opravené problémy

- SEC-001/002: validace konfigurace před mutací a odolné předvolby, v0.11.2. 7 nových regresí + 34 souvisejících testů prošlo; nevalidní import zachová data, tři dodané konfigurace kompatibilní.
- SEC-003/005: omezený MQTT příjem, streamované odpovědi a složitost CSV v0.11.3; 8 nových regresí + 45 souvisejících testů. HTTPS vždy WSS (SEC-004). Lokální Chromium analytika/tři konfigurace/mobil prošly bez pageerror.
- Preventivní dávka C: SRI obou CDN knihoven ověřeno skutečným Chromiem včetně blokování pozměněného skriptu; Actions připnuté na SHA, checkout bez uložených credentials. Lokální server loopback, GET/HEAD, bez wildcard CORS a s bezpečnostními hlavičkami (11 server/Pages testů).

## Zbývající úkoly a omezení

- NEEDS_REVIEW (vlastník): skutečné MQTT ACL/certifikáty/limity a firmware ESP32; klientské testy je nenahrazují.
- NEEDS_REVIEW (vlastník): oprávnění Sheets a případných Apps Script/ThingSpeak nasazení; zdroje a admin přístup chybí. CORS proxy je nadále další důvěryhodná strana.
- NEEDS_REVIEW (vlastník): GitHub Secrets, environment protection a pravidla větví; Dependabot konfigurace v codex-dev nezačne automaticky fungovat, dokud ji GitHub nenačte z výchozí větve. Main nebyl změněn.
- TODO: striktní CSP vyžaduje úpravu inline JS/handlerů; frame-ancestors/X-Frame-Options na Pages nelze zajistit HTML meta tagem. Hlavičky server.js platí pouze pro lokální náhled.
- TODO: pravidelná kontrola CDN advisories (SRI není aktualizace knihoven), větší historie nad limity vyžaduje stránkování, fyzický Safari/iOS a dlouhodobý provoz neověřeny. Archivní/produkční HTML není automaticky opraveno.

## Pokračování

Při dalším spuštění začít etapou **10** a soukromým kontrolním bodem; dokončené oblasti znovu kontrolovat pouze při změně relevantních souborů.
Soukromý report: `/workspace/security-private/Meteo_webovky/REPORT.md`; kontrolní otisky souborů a stav jsou ve stejné soukromé složce. Tato složka nemusí přežít zrušení cloudového prostředí; při její nedostupnosti nelze tvrdit, že byly podrobné nálezy znovu ověřeny.

## Důkazy a historie

- [Projektová paměť](../PROJECT_AUDIT.md), [vývojová roadmapa](NAPADY_A_ROADMAP.md), [regresní testy](../tests/).
- [Historie bezpečnostní roadmapy a checkpointů](https://github.com/Michaltymm/Meteo_webovky/commits/codex-dev/docs/SECURITY_ROADMAP.md).
