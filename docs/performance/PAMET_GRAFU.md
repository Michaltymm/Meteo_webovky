# Paměť grafů po opuštění přehledu

METEO-007, 27. 11. 2026, web v0.21.15 (`8ce330d`). Ověřili jsme plošné
uvolnění grafů po odchodu z hlavního přehledu. Zkušební uvolnění potvrdilo
úsporu paměti a zvýšilo cenu rychlého návratu. Současné chování webu zachováváme.

| Měření | Profil | JS heap před → po uvolnění (MiB) | Návrat na hlavní přehled s aktivní Baterií (ms) | Otevření Průzkumníku (ms) |
| ---: | --- | ---: | ---: | ---: |
| 1 000 | 1440 px | 4,58 → 2,78 | 6 → 27,5 | 0 → 19,5 |
| 10 000 | 390 px, CPU ×4 | 6,29 → 4,27 | 29 → 98 | 1 → 74,5 |
| 100 000 | 390 px, CPU ×4 | 20,80 → 18,44 | 29 → 127 | 1,5 → 123 |
| 250 000 | 390 px, CPU ×4 | 44,68 → 42,03 | 29 → 123,5 | 1 → 231,5 |

Medián úspory v párových měřeních je přibližně 1,8–2,7 MiB. V každém
scénáři se po opětovném sestavení shodovaly popisky a datové řady všech deseti
grafů, statistiky Průzkumníku, souhrny porovnání a baterie i zobrazená tabulka
Přehledu. Původní pole měření zůstalo stejné. Zkušební uvolnění zároveň
vyžadovalo vynulování příznaků vytvořených řad Přehledu a srážek. Případná
selektivní politika musí zachovat nastavení legendy a výběr uživatele.

## Reprodukce

Z kořene projektu s Playwrightem, Chromium v `/usr/bin/chromium` a lokální
kopií Chart.js 4.4.0 z `index.html`.

```sh
python scripts/profile-chart-retention-browser.py --chartjs "$chartjs" --output /tmp/meteo-chart-retention.json
```

Chromium 154, jeden zahřívací běh a čtyři měřené běhy pro každý profil. Syntetická
pětiminutová historie používá pevný čas Europe/Prague. Skript vynechá síťový
start, obnovovací časovač a pozorovatele viditelnosti grafu 24 h. Použije
skutečné přepínání pohledů, produkční renderery a snížený pohyb. Otevře osm
záložek hlavního přehledu, přepne na Moderní přehled 2 a změří zachovanou
paměť. Po dalším průchodu testovací kód uvolní deset instancí a označí záložky
k překreslení. Měření paměti používá CDP po ustálení a vynuceném GC.

Časy zahrnují synchronní obsluhu přepnutí a případnou tvorbu grafu. Vykreslení
dalšího snímku, nativní paměť plátna a zařízení iOS zůstávají mimo rozsah.
Pro dlouhodobé uvolňování by bylo potřeba změřit také běžné obnovy na slabším
zařízení. V METEO-008 má přednost zjištění, kolik času a paměti zabírají velké
dočasné řady pro statistiky Průzkumníku.
