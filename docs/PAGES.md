# Hlavní a vývojový web

| Větev | Publikovaná adresa |
| --- | --- |
| `main` | https://michaltymm.github.io/Meteo_webovky/ |
| `codex-dev` | https://michaltymm.github.io/Meteo_webovky/dev/ |

`codex-dev` je vývojová větev. Do `main` se schválené změny přenášejí pull requestem.
Vývojový web zobrazuje označení a používá vlastní klíče localStorage s prefixem `meteoDev:`.
Oba weby sdílejí GitHub Pages doménu; oddělení nastavení není bezpečnostní izolace původu
ani oddělení datových služeb. Vývojová konfigurace může stále číst stejné veřejné tabulky.

## Jednorázová aktivace

1. V GitHubu musí existovat `codex-dev` s tímto workflow a vývojovou aplikací.
2. Sloučit změnu pro publikování obou verzí do `main`.
3. V **Settings → Pages → Build and deployment → Source** vybrat **GitHub Actions**.
   Nepřepínat zdrojovou větev na `codex-dev` v režimu „Deploy from a branch“.
4. V **Actions → Publish main and development website → Run workflow** vybrat `main`
   a spustit první nasazení. Vyčkat na úspěšný job `deploy`.
5. Pokud prostředí **Settings → Environments → github-pages** omezuje povolené větve,
   musí povolovat `main` i `codex-dev`. Případná ochranná schválení zůstávají v platnosti.

Dokud neproběhne úspěšné nasazení, samotná existence workflow nepotvrzuje dostupnost `/dev/`.
První automatický běh po merge může před změnou Source selhat; po přepnutí použít Run workflow.

## Každodenní práce

- Push změny webu do `codex-dev` publikuje vývojovou verzi.
- Po kontrole vývojové verze otevřít PR `codex-dev` → `main` a zkontrolovat celý diff.
- Push/merge do `main` publikuje stabilní verzi. Obě verze se vždy sestaví společně:
  novým nasazením se tak neztratí obsah druhé adresy.
- Workflow se spouští při změně HTML, JSON konfigurací nebo publikačních nástrojů.
  Pro jiné potřebné nasazení použít Run workflow.
- Pull requesty pouze ověřují sestavení; nenasazují.
- Chybějící větev, soubor nebo neúspěšný test zablokuje nové nasazení.
  Poslední úspěšně publikovaný web zůstává k dispozici.
- Změny workflow/build nástrojů udržovat v obou větvích; do `codex-dev` průběžně slučovat `main`.

## Co se publikuje a jak testovat

`scripts/build-pages.js` kopíruje výhradně `index.html` a čtyři explicitně vyjmenované JSON
konfigurace z každé větve. Zdrojové nástroje, audity, testy a Git metadata se nepublikují.
Při přidání externích CSS/JS nebo obrázků aktualizovat seznam veřejných souborů i testy.
Každá stránka načítá své JSON soubory relativně; zachovat tento způsob adresování.

Bez npm instalace:

```sh
node --test tests/pages.test.js
node scripts/build-pages.js /cesta/k/main /cesta/k/codex-dev /nova/cesta/k/vystupu
```

Vstupní adresáře musí obsahovat odpovídající veřejné soubory. Výstupní adresář musí být nový.
Workflow potřebuje oprávnění `contents: read`, a pouze pro nasazovací job také
`pages: write` a `id-token: write`. Používá automatický GitHub token, žádný vlastní klíč.
