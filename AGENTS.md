# Pokyny pro práci v projektu

- Před změnou přečti `PROJECT_AUDIT.md`, nejprve QUICK CONTEXT a poté relevantní ID a rizika. Audit ověř proti aktuálnímu kódu.
- Aktivní aplikace je kořenový `index.html`; `Git/MQTT_webovky/index.html` je odlišná starší stránka. Bez zadání do ní změny nekopíruj ani ji nemaž.
- Projekt je statický, bez npm instalace a buildu. Start: `node server.js`. Regresní testy: `node --test tests/*.test.js` (server, Pages, načítání a kvalita dat). Sdílená VM v `tests/helpers/app.js` spouští skutečný inline JS.
- Zachovej sestupné řazení `store.rows` (nejnovější první), podporu chybějících senzorů jako `null`, konfigurace tří stanic a líné vykreslování.
- Pracuj v existujícím izolovaném checkoutu; Git worktree vytvářej jen na výslovnou žádost. Zachovej rozpracované cizí změny.
- Měň jen rozsah úkolu, přidej smysluplné regresní ověření a aktualizuj dotčená ID v auditu. DONE označ až po ověření.
- Nové nálezy zapisuj se stabilními ID; odlišuj potvrzenou chybu od hypotézy, chybu sítě od chyby aplikace a provedený test od plánu.
- Nevkládej tajné údaje do zdrojů, konfigurací ani logů. Klientský zámek nastavení není autentizace.
