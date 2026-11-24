# Odložená konstrukce grafů srážek a napětí

METEO-007, v0.21.6. Výchozí revize `f4e067b`.

Grafy záložky Srážky & Baterie se vytvářejí při prvním vykreslení s připravenými
řadami. Další obnovy používají stejné instance. Plátna mají na mobilu prostor
i před dokončením načítání historie. Výpočet denních hodnot srážek, výběr bodů
napětí i pravidla predikce se touto etapou nemění. Načítání historie používá
dosavadní požadavek záložky.

## Měření

Offline Chromium 154 s Chart.js 4.4.0 a omezenými animacemi, předchozí a
upravená verze se střídaly. Čas startu je součet synchronní práce kolem volání
`new Chart` bez síťové inicializace. První otevření měří synchronní
`refreshTab('rain')` s připravenou historií a cache denních agregací. Každá
řádka uvádí medián osmi vzorků pro každou variantu po zahřátí.

| Profil | Řádky | Konstrukce při startu před → po (ms) | První vykreslení záložky před → po (ms) |
| --- | ---: | ---: | ---: |
| 1440 px, bez zpomalení | 400 | 25,5 → 20,5 | 7,5 → 17,0 |
| 390 px, CPU ×4 | 400 | 107,5 → 95,0 | 39,0 → 91,5 |
| 390 px, CPU ×4 | 100 000 | 108,5 → 78,0 | 134,0 → 155,0 |

Při izolovaném startu vzniklo pět instancí místo sedmi. Strukturované popisky
a hodnoty obou grafů včetně predikce se shodovaly v každém porovnání. První
vykreslení je dražší. Profil neudává dobu načtení stránky ani Web Vitals.

## Ověření a další krok

- 480 testů Node. Cílená kontrola změny ověřuje konstrukci s připravenými
  daty, jednu aktualizaci po změně historie, opětovné využití instancí a nuly.
- Chromium ověřil otevření záložky při 320 px bez vodorovného přetékání,
  opětovný vstup bez dalšího požadavku při načtené historii a render obou
  grafů. Prošly také kontroly obou moderních přehledů a devíti analytických
  karet se 100 000 řádky.
- Při prvním otevření se dosud filtruje a řadí celá historie napětí kvůli
  výběru nejvýše 500 zobrazených vzorků. Záložka navíc počítá trend jen z
  těchto bodů, zatímco Průzkumník předává plnou historii a používá třídenní
  podmínku. Navazující etapa má oddělit úplné regresní okno od limitu grafu,
  vyhodnotit využití sestupného řazení Sheets a ověřit duplicitní časy i
  odlišné pořadí u MQTT. Patří k METEO-008 a METEO-046.

Rozdíl predikce se projevil i na kontrolním příkladu s 2 000 platnými
minutovými záznamy v třídenním okně. Posledních 500 mělo 4 V a dřívější
vzorky 3,5 V. Desetiminutová extrapolace dává 4,000 V při použití jen
vykreslených bodů a 4,003 V při použití všech vstupů. Zobrazená výchozí řada
se shodovala. Jde o cílený příklad vlivu výběru dat, bez hodnocení přesnosti
predikce na skutečném zařízení.

## Publikace

[GitHub Actions #67](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45389604376)
potvrdily build a publikaci `3e4442c` z `codex-dev` za 52 s. `main` při kontrole
zůstala na revizi `2405c5d`.
