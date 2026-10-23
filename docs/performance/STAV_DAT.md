# Stav dat: měření před/po — v0.15.0

Srovnání výchozí revize `5dca29d` s v0.15.0, Chromium 154.0.8037.57,
skutečný DOM a Chart.js 4.4.0 se SRI. Syntetické původní záznamy vytvořené
pouze v testovací stránce, potlačený startup a blokované externí služby.
Každý objem má novou stránku, zahřátí 100 minutovými aktualizacemi a první
`refreshUI`, potom sedm vzorků. Tabulka uvádí mediány; oba běhy sekvenčně.

„Minutová aktualizace“ znamená existující `updateSunBar` s podmínkou
viditelnosti, po změně navíc nový panel `renderDataStatus`. Tisíc volání
je zátěžový mikroscénář, v aplikaci jde o jedno volání za minutu. `refreshUI`
zahrnuje synchronní JS a aktualizaci existujících grafů moderního přehledu,
s již připravenými agregacemi. Nevynucuje nové parsování/invalidation.

| Řádků | 1000 minutových aktualizací před / po (ms) | Opakovaný refreshUI před / po (ms) |
| --- | --- | --- |
| 1 000 | 765,2 / 727,1 | 6,4 / 7,3 |
| 10 000 | 705,7 / 714,5 | 6,6 / 6,0 |
| 100 000 | 703,8 / 734,3 | 7,2 / 7,7 |
| 250 000 | 741,3 / 752,3 | 9,6 / 9,5 |

Rozdíly obou směrů neprokazují zrychlení. Nový stavový panel nemá v tomto
scénáři podstatný dopad vůči původní aktualizaci Slunce. Jeho čtení prvního
řádku/délky je O(1), nezávislé na objemu historie (ověřeno také Proxy regresí
v Node). Samostatných 100 opakování s nezměněnými údaji způsobilo **0 mutací
DOM panelu** ve všech objemech. Reference řádků zůstaly shodné a počet
Chart instancí při opakovaném refresh byl **8 → 8**. Žádné datové požadavky.

Surová data: [před](data-status-before.json), [po](data-status-after.json).
Reprodukce z kořene projektu, Chart.js dodat lokálně v používané verzi:

```bash
git show 5dca29d:index.html > /tmp/meteo-status-before.html
python scripts/benchmark-data-status-browser.py --html /tmp/meteo-status-before.html --chartjs /tmp/chart.js --output /tmp/status-before.json
python scripts/benchmark-data-status-browser.py --html index.html --chartjs /tmp/chart.js --output /tmp/status-after.json
```

Nejde o měření skutečné sítě, studeného parsování, paměťové špičky, renderu
celého snímku, Web Vitals, CPU×4 nebo fyzického mobilu/Safari. Pro změnu,
která nepřidává kopii historie ani nové výpočty nad ní, se tyto starší rozsáhlé
profily neopakovaly. Responzivitu a dotyk ověřují oddělené browser harnessy.
