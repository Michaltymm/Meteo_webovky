# Čas a kalendář v meteostanici

Stav v0.2.1, 21. 10. 2026. AUD-010 opraveno; METEO-048 je rozpracované.

## Platný současný model

Legacy export má české datum a čas bez UTC offsetu. `parseCSDateTime` je
interpretuje v **časové zóně prohlížeče**, stejně jako stávající popisky grafů
a hodinové skupiny. Tato etapa zachovává původní parser i původní měření.
Nezavádí domnělou zónu podle názvu stanice nebo zeměpisných souřadnic.

- `localDateKey` vytváří YYYY-MM-DD z místního roku, měsíce a dne. Datumový
  vstup není UTC okamžik; `toISOString().slice(0,10)` k tomu nepatří.
- `localCalendarDay` posouvá kalendářní datum, nikoli počet milisekund. Pro
  štítky používá poledne; „Včera“ i osm rychlých voleb zůstávají kalendářní
  dny i přes změnu letního času nebo přelom roku.
- `localDayBounds` ověřuje datum a vrací inkluzivní meze od začátku místního
  dne po milisekundu před začátkem dalšího. Mez dalšího dne je opět půlnoc,
  ne stejná hodina jako případný normalizovaný začátek dne. To je důležité i
  při historickém posunu hodin přímo o půlnoci (São Paulo).
- Jeden den a vlastní rozsah bez data „do“ používají totožné meze. Rozsah
  s oběma daty zahrnuje celý poslední den. Neplatný nebo obrácený rozsah má
  prázdný výsledek. Chybějící datum „od“ nadále čeká na volbu uživatele.
- Dnešní karty a denní přehled používají obě meze; záznam z následujícího
  dne nepatří do dneška. Chybějící dnešní hodnoty v kartách přepíší starý
  výsledek na „–“, platná nula zůstává nulou.
- Intervaly **24 h / 3 dny / 7 dní** v průzkumníku zůstávají klouzavé doby
  24/72/168 hodin. Nejsou zaměněny s výběrem kalendářního dne.
- UV cache porovnává místní datum; stávající hodinový polling se nemění.
  Změna dne se projeví při následujícím pravidelném nebo ručním načtení.

Žádné nové síťové volání, konfigurační pole nebo závislost. Statistiky stále
používají úplné původní řádky, nikoli redukované body grafu.

## Změna času a porovnání dnů

Kalendářní den může mít 23 nebo 25 hodin. Výběr zachová všechny jeho dostupné
okamžiky a vyloučí sousední den, včetně poslední milisekundy dne.
Porovnání má nadále 24 skupin podle místní hodiny a **vzorkový průměr**:
chybějící jarní hodina je `null`, dvě podzimní hodiny se stejným číslem jsou
společná skupina. UI to výslovně uvádí spolu s IANA zónou prohlížeče.
Nejde o časově vážený průměr ani rekonstrukci chybějících měření.

Samotný CSV údaj `25.10.2026 02:30` v Europe/Prague nerozlišuje dva různé
okamžiky. Parser zachovává dosavadní volbu JS Date. Pokud zdroj neposkytne
offset/UTC timestamp nebo jiný ověřený kontrakt, nelze druhý výskyt spolehlivě
odvodit. Test se dvěma explicitními offsety ověřuje již rozlišené okamžiky;
nedokazuje odstranění nejednoznačnosti CSV.

## Co zbývá v METEO-048

1. Potvrdit, v jaké zóně a s jakými pravidly firmware/Sheets skutečně exportují
   čas. Ověřit podzimní duplicity a chybějící jarní hodinu na zdroji.
2. Navrhnout volitelnou explicitní zónu stanice a migraci parseru, popisků,
   denních klíčů a nastavení se zachováním starých konfigurací. Prohlížeč
   uživatele v jiné zóně dnes interpretuje stejný text jinak.
3. UV API stále vrací `timezone=auto` dle polohy, zatímco zobrazení používá
   hodinový index prohlížeče. Při odlišné zóně a 23/25hodinové odpovědi není
   výběr hodiny spolehlivý. Samotná oprava data cache tento kontrakt neřeší;
   navázat výběr UV na časové značky odpovědi, ověřit její zónu i stale den.
4. Pro nové agregace METEO-038 klíč cache obsahuje revizi dat i místní den.
   Oprava historie, změna stanice a půlnoc musí invalidovat správné výsledky.

## Ověření a reprodukce

`tests/calendar-days.test.js` přidává 17 testů. Procesy s vlastní proměnnou
TZ se neovlivňují s ostatními testy. Zóny: Europe/Prague, America/New_York,
Pacific/Kiritimati (UTC+14), UTC a historický přechod America/Sao_Paulo.
Celá Node sada: **80/80**. Dva testy spuštěné na původním HTML `3e236bc`
prokazatelně selhaly: půlnoční hodnota `null` místo 10 a dva místo tří bodů
celého dne. Testy nejsou založené na časových limitech výkonu.

```bash
node --test tests/*.test.js
python scripts/check-interval-browser.py --chartjs /tmp/meteo-chart.js --at 2026-03-30T00:30:00+02:00 --output /tmp/calendar-spring.json
python scripts/check-interval-browser.py --chartjs /tmp/meteo-chart.js --at 2026-10-25T23:30:00+01:00 --output /tmp/calendar-autumn.json
```

Browser nástroj potřebuje Python Playwright, `/usr/bin/chromium` a lokální
Chart.js 4.4.0, stejně jako [dosavadní benchmark](performance/README.md).
Fixuje pouze Date, časovače běží. Fixture generuje pětiminutové okamžiky v UTC
a teprve pak formátuje místní CSV; nevytváří neexistující jarní hodiny prostým
odečítáním od místního času. Úplný startup se skutečnými konfiguracemi všech
tří stanic používá zpožděné fixture Sheets/UV, skutečný Chart.js a viewport390.
Síťové služby, živé měření, broker a časový kontrakt firmwaru tím ověřeny nejsou.

Výsledky: [jarní běh](testing/calendar-spring.json),
[podzimní běh](testing/calendar-autumn.json). Datumové vstupy odpovídají
místnímu „dnes“, osm rychlých dnů je správně, skutečné vstupy filtru zahrnou
23/25 hodin pro jeden den i prázdné datum „do“. Průběžně zůstává ověřené
sloučení full požadavků, změna stanice, metriky, témata a prázdný rozsah.
Nejde o výkonnostní úpravu; nový benchmark rychlosti nebyl prováděn.
