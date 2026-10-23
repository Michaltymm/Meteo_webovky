# Režie časování obnovy — v0.17.0

Srovnání `d1d42a4` a v0.17.0. Node 24.19.0, skutečný inline JS v projektové VM,
řízené fetch/text odpovědi a testovací DOM/refreshUI. Stejná syntetická CSV pro
1k/10k/100k/250k původních měření: všechna platná data, stejné časy/duplicity,
T podle indexu a třetina bez napětí. Měří se celý skutečný fetchSheets(true)
pipeline, parser/čítače/řazení a commit, nikoli jen helper časovače.

Každý objem má zahřátí jedním načtením. Pět vzorků, reset a GC před každým,
uveden medián. Baseline/po sekvenčně bez souběžných browser nebo jiných profilů.
Testovací desetimilisekundový yield se vypořádá ručně bez reálného čekání.
Síť i refreshUI jsou náhrady; výsledky nejsou Web Vitals, reálný I/O, grafické
vykreslení ani měření telefonu. `performance.now` v VM dostává stejný hostitelský
monotónní čas v obou bězích. Žádné nové produkční závislosti.

| Řádků | Celý pipeline před / po (ms) | Heap po před / po (MiB) | Nový snapshot JSON (B) |
| --- | --- | --- | --- |
| 1 000 | 8,88 / 9,64 | 6,41 / 6,32 | 235 |
| 10 000 | 66,39 / 68,55 | 17,29 / 17,45 | 227 |
| 100 000 | 669,34 / 662,86 | 71,36 / 66,86 | 234 |
| 250 000 | 1697,20 / 1755,45 | 169,82 / 157,52 | 236 |

Rozdíly obou směrů nejsou důkaz zrychlení ani nulové režie. Při 250k je tento
medián o58ms (~3,4 %) vyšší; zahrnuje variabilitu celého parseru i běhového
prostředí. Nové měření je pouze na hranicích bloků, bez práce pro každý řádek.
Původní velký parser stále zabírá řádově1,7s synchronního JS (METEO-008).

Zachovány stejné počty, součet teplot i počty chybějících napětí pro všechny
objemy. Nový report má zde 227–236 bytů v kompaktním JSON; nejde o velikost
objektů v RAM. Heap je stav po běhu, ne peak/RSS ani trvale držená paměť.
Jeho snížení v některých řádcích není důkaz paměťové optimalizace. Report
nahrazuje předchozí snapshot a nemá odkazy na původní měření nebo kopie historie.

Skutečný Chromium browser ověřuje zvlášť 60ms řízený přenos, oddělené fáze,
retry/cache/obnovu a panel 320–1440px v obou tématech a všech třech pohledech.
Otevření panelu nevytváří request ani Chart. Dvanáct Node regresí ověřuje přesné
hranice fází s deterministickým časem, včetně těla odpovědi a full-load callbacků.

Reprodukce:

```bash
git show d1d42a4:index.html > /tmp/meteo-load-before.html
METEO_TEST_HTML=/tmp/meteo-load-before.html node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/load-before.json
node --expose-gc scripts/benchmark-sheets-timing.cjs > /tmp/load-after.json
```

Surové výsledky: [před](load-timing-before.json), [po](load-timing-after.json).
Starší analýza samotného parseru a jeho limitů se neopakovala; jde o jinou,
navazující hranici měření celého načítání. Živé zdroje, fyzický Safari/iOS,
CPU throttling, rendering hotového snímku a dlouhodobý heap tím změřeny nejsou.
