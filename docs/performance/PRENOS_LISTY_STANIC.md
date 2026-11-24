# Přenos horní lišty stanic

METEO-006, v0.21.4. Výchozí revize `02f9289`.

## Rozsah změny

Vedlejší stanice dříve stahovaly celý CSV export při startu a při obnově lišty.
Lišta přitom hledala měření jen v prvních šesti neprázdných logických záznamech.
Nový první požadavek používá `SELECT * LIMIT 6` bez `ORDER BY`. Parser zachovává
stejný limit a vybírá první platný čas v původním pořadí CSV. Přenos má limit
64 KiB. Při HTTP nebo CSV chybě, překročení limitu či chybějícím měření se
použije původní dvojice cest. To může přidat jeden požadavek při nedostupné
omezené odpovědi. Změna stanice ruší celý pokus přes původní kontext.

Aktivní stanice nadále načítá rychlou a úplnou historii podle dosavadních
pravidel. Úplné exporty pro historii zůstávají potřeba kvůli opravám a smazáním
starších záznamů. Inkrementální historie čeká na zdroj změn a revizní kontrakt.

## Před a po

Dne 24. 11. 2026 proběhlo čtecí srovnání přes HTTPS se všemi třemi zdroji z
repozitářových konfigurací. Pro každou stanici se použila stejná záložka Google
Sheets a parametry `tqx=out:csv` a `sheet`; druhý požadavek přidal `tq` s
omezením. Obě odpovědi měly HTTP 200. Prvních šest záznamů se porovnalo po
rozboru CSV, včetně hlaviček, hodnot a poznámek.

| Stanice | Původní tělo (B) | Omezené tělo (B) | Prvních šest záznamů |
| --- | ---: | ---: | --- |
| Praha-baterie PCB | 3 639 679 | 546 | shodné |
| Praha za oknem | 5 213 630 | 481 | shodné |
| Mšené lázně | 1 500 253 | 544 | shodné |

Čerstvý prohlížeč může před první návštěvou pražské stanice použít výchozí
list `Hlavni_datovna`. I tam se prvních šest záznamů shodovalo. Původní
exporty přesáhly dílčí hranici měření 8 MiB na každý zdroj. Omezené odpovědi
měly 4 467 B pro Praha-baterie PCB a 4 358 B pro Praha za oknem.

Velikosti označují tělo odpovědi bez hlaviček. Jde o vzorek obsahu v době
kontroly. Měření neudává dobu vykreslení, přenos po kompresi ani paměť procesu.
Po změně typu hodnot nebo struktury listu je vhodné shodu zopakovat.

## Regrese

- `node --test tests/*.test.js` prošlo 480/480 testů. Sada ověřuje omezený dotaz, výběr prvního použitelného
  měření, zachování nul a chybějícího napětí, návrat na původní cesty a ignorování
  opožděné odpovědi po přepnutí stanice.
- `scripts/check-background-browser.py` ověřuje lištu v Chromium na 390 px,
  dva omezené požadavky při startu, režim skryté karty a promítnutí opravy
  starého záznamu z úplného exportu do statistiky. Používá řízené síťové odpovědi.
- `scripts/check-simple-overview-browser.py` ověřil Moderní přehled 2 a přepínání
  všech čtyř pohledů se třemi konfiguracemi. Obě prohlížečové kontroly prošly
  bez chyb stránky.

## Publikace

[GitHub Actions #65](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45345747406)
potvrdily build a publikaci `9ac7a7a` z `codex-dev` za 60 s. Větev `main` měla
při kontrole revizi `2405c5d`. Přímý požadavek na Pages zastavila síťová brána
tohoto prostředí (HTTP 403 při CONNECT).

## Další etapa METEO-007

V izolovaném startu Chromium bez síťové inicializace aplikace se měřil čas
přímo v konstruktorech Chart.js (sedm opakování, omezené animace). Osm grafů
zabralo celkem v mediánu 38,9 ms při 1440 px a 121,3 ms při 390 px a CPU ×4.
Graf 24 h byl nejdražší (16,3 a 52,3 ms). Měření zahrnuje konstrukci a její
synchronní vedlejší efekty. Dává výchozí stav pro odložení konstrukce do
prvního zobrazení grafu. Skutečná doba startu stránky se měří samostatně.
