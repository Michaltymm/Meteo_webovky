# Meteo_webovky

Dashboard tří meteostanic, statický web bez npm instalace.

[Přehled verzí a změn](RELEASE_NOTES.md) — číslo aktuálně načtené verze je také v hlavičce webu.

- [Centrální nápady a roadmapa](docs/NAPADY_A_ROADMAP.md) — priority, stav a návrhy analytiky.
- [Analytické grafy](docs/ANALYTICKE_GRAFY.md) — devět grafů, ovládání, výpočty a technická omezení.
- [Projektová paměť](PROJECT_AUDIT.md) a [pokyny pro vývoj](AGENTS.md).
- [Publikování hlavní a vývojové verze](docs/PAGES.md).
- [Měření výkonu](docs/performance/README.md).

Lokální spuštění: `node server.js` → http://localhost:8080/.
Testy: `node --test tests/*.test.js`.

Vývoj probíhá na `codex-dev`; sloučení do `main` až po schválení.

Lokální server naslouchá pouze na `127.0.0.1`. Pro záměrně sdílený/cloudový náhled lze nastavit `METEO_PREVIEW_HOST=0.0.0.0`; tím zpřístupníte soubory kořene okolní síti, proto jej nepoužívejte jako produkční server. GitHub Pages používá vlastní statický hosting. Bezpečnostní postup a omezení: [docs/SECURITY_ROADMAP.md](docs/SECURITY_ROADMAP.md).
