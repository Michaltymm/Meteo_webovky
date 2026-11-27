# Rychlejší sestavení řad napětí Průzkumníku

METEO-008 a METEO-046, v0.21.21. Základ měření je v0.21.20 z `440823c`.

Průzkumník pro chronologický výřez Sheets najde binárně začátek
regresního okna. Zůstávají v něm všechny platné hodnoty od hranice tří
dnů před časem prohlížeče, včetně shod na hranici a záznamů s pozdějším
časem, pokud spadají do výřezu. MQTT a kombinovaný režim používají celý
výřez a běžnou kontrolu času.

Sdílená funkce pro Průzkumník i Srážky & Baterie počítá průměry a sklon
ve dvou průchodech bez dočasného pole filtrovaných měření. Pořadí všech
součtů, podmínky pro dostupnost regrese, výběr zobrazených bodů a
zaokrouhlení extrapolace se zachovávají.

## Měření

Offline Chromium 154 s Chart.js 4.4.0, 390 × 844 px, CPU ×4, Europe/Prague,
snížený pohyb. V Průzkumníku s metrikou Napětí se přepíná z 24 h na Vše.
Měření běží po načtení syntetické historie, bez síťových prodlev.
Čtyři střídavé páry běhů, z toho tři po zahřátí. Tabulka uvádí mediány
devíti otevření na variantu. Čas řad měří `voltageSeries`. Binární výběr
se započítává do obsluhy výsledku, která zahrnuje také Chart.js.
Celkové dokončení zahrnuje čekání mezi dávkami, měření končí po aktualizaci
grafu.

| Historie | Interval | Sestavení řad napětí (ms) | Nejdelší obsluha (ms) | Celkem (ms) |
| ---: | --- | ---: | ---: | ---: |
| 1 000 | 5 minut | 2 → 2 | 32 → 32 | 32 → 32 |
| 10 000 | 5 minut | 2 → 1 | 33 → 28 | 33 → 28 |
| 100 000 | 5 minut | 7 → 2 | 33 → 30 | 73 → 72 |
| 250 000 | 5 minut | 16 → 1 | 45 → 34 | 113 → 93 |
| 250 000 | 1 sekunda | 80 → 37 | 112 → 67 | 161 → 108 |

Ve všech pěti scénářích se přesně shodovaly popisky, naměřené body,
predikce a statistiky. Při sekundových intervalech spadá všech 250 000
měření do regresního okna. Finální obsluha u nich stále přesáhla 50 ms.
Další etapa může změřit dávkovanou regresi při vykreslení hustých výřezů,
včetně jejího vlivu na celkový čas.

## Ověření

Prošlo 501/501 testů Node.js. Regrese kontrolují přesnou shodu sklonu
s původními součty, duplicitní časy, skutečnou nulu, neplatné a chybějící
hodnoty a neuspořádané MQTT vstupy. Chromium porovnal celé údaje obou grafů
napětí před a po změně se třemi původními konfiguracemi a řízeným CSV.
Řady se shodovaly, při přechodu mezi grafy nevznikly další požadavky.
Prošly také kontroly chodu na pozadí a Moderního přehledu 2.

## Pilot další etapy

Prototyp použil stejný plánovač ke dvěma průchodům regrese u velkého
třídenního okna. V samostatném srovnání s 250 000 sekundovými záznamy
klesla nejdelší obsluha ze 75 na 32 ms a celé dokončení vzrostlo ze
120 na 150 ms. Graf a predikce se shodovaly při pevném čase prohlížeče.
Pro nasazení zbývá určit, kdy zachytit třídenní mez u živého času,
a ověřit zrušení při změně dat nebo výběru.

## Publikace

Sestavení a nasazení `22cc6f0` z `codex-dev` proběhly úspěšně.
Produkční `main` je na `2405c5d`.
[GitHub Actions #82](https://github.com/Michaltymm/Meteo_webovky/actions/runs/46044662608)
