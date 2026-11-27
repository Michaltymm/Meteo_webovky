# Otevření Analytiky s uloženou plnou historií

METEO-004, v0.21.26. Výchozí verze v0.21.25 z `a47cc5f`.

Pokud se uživatel vrátí na stanici v běžném přehledu, web nejdřív
ověří obvyklý rychlý export. Uložený plný export může zůstat k dispozici,
pokud se všechny ověřené rychlé řádky shodují s jeho začátkem. Porovnává
se přesný čas, text data a času, poznámka a všech sedm měřených veličin.
Pokud je rychlých řádků méně než 400, musí odpovídat i celkový počet.
Kratší odpověď může znamenat odstranění záznamů. Při neshodě se uložená
plná kopie vyřadí.

Přechod do Analytiky využije plnou kopii po dokončené úspěšné kontrole
rychlé historie a po ověření platnosti mezipaměti. Uvede „Uložená data“
s časem poslední plné kontroly a odešle jeden plný požadavek. Shodný
výsledek potvrdí čerstvost bez opakovaného parsování. Při změně nebo
rozběhnuté rychlé obnově se data dokončí běžnou cestou. Chyba plného
požadavku ponechá u uložené plné kopie její původní čas.

## Měření

Offline Chromium 154, 390 × 844 px, CPU ×4, pětiminutových 12 000
záznamů a původní konfigurace Sheets. Po načtení Analytiky se uživatel
v Moderním přehledu 2 přepne na jinou stanici, vrátí se a počká na
ověření rychlé historie. Následuje otevření Analytiky s 300ms prodlevou
plné odpovědi. Tři střídavé měřené páry po zahřátí.

| Od otevření Analytiky | v0.21.25 | v0.21.26 |
| --- | ---: | ---: |
| Informace o dostupné plné historii | 730 ms | 42 ms |
| Požadavky na plnou historii | 1 | 1 |
| Přenesená data plné historie | 600 957 B | 600 957 B |
| Rozbory plného exportu | 1 | 0 |

Porovnání 400 řádků trvalo v mediánu 1 ms při uložení rychlého exportu
a 1 ms při otevření Analytiky. Čas dostupnosti je medián do aktualizace
stavového řádku. Nezahrnuje čekání na vykreslení všech karet. Po dokončení
kontroly se shodovala všechna měření z plného exportu.

## Ověření

Prošlo 514/514 testů Node.js. Regrese pokrývají shodu 400 řádků, změnu
hodnoty nebo poznámky mimo nejnovější řádek, kratší export a otevření
Analytiky při rychlé obnově. Chromium ověřil otevření Analytiky po
ověření rychlé historie, její mřížku a Moderní přehled 2. Prohlížeč
použil původní konfigurace stanic a simulovaná data.

## Publikace

[GitHub Actions #87](https://github.com/Michaltymm/Meteo_webovky/actions/runs/46079444340)
úspěšně sestavily a nasadily změnu z commitu `fc3f415` z větve
`codex-dev`. Produkční větev byla ověřena na `2405c5d`.
