# Cena MQTT diagnostiky — v0.18.0

Srovnání `068db56` a v0.18.0, Node 24.19.0. Skutečný inline JS a MQTT handler
v projektové VM, lokální Paho Client náhrada. Žádný broker nebo síť; DOM,
status a `refreshUI` jsou testovací náhrady. Benchmark izoluje cenu zpracování
zpráv a metadat při zavřeném panelu, nikoli úplnou cenu přehledu/grafů.

Čtyři historie: 1k/10k/100k/250k originálních řádků. Pro každou dávku reset
a kopie pole odkazů před časováním, nikoli kopie původních měření. Dva scénáře:
1 000 neplatných JSON a 100 platných zpráv s T=0 °C a V=4,2 V. Testovací čas
se posouvá o sekundu na callback, takže dávka nenaráží na limit četnosti;
nejde o simulaci skutečné rychlosti sítě. Jedno zahřátí, pět vzorků, GC před
každým, medián. Před/po měřeno sekvenčně po ukončení browseru.

| Původních řádků | 1 000 odmítnutí před / po (ms) | 100 přijetí před / po (ms) | Nová metadata JSON (B) |
| --- | --- | --- | --- |
| 1 000 | 6,66 / 7,04 | 1,94 / 1,84 | 310 |
| 10 000 | 7,91 / 6,98 | 1,74 / 1,81 | 310 |
| 100 000 | 8,66 / 7,78 | 3,81 / 3,62 | 310 |
| 250 000 | 8,86 / 7,83 | 8,47 / 8,52 | 310 |

Rozdíly obou směrů nejsou důkaz zrychlení nebo nulové režie. Při 250k je
rozdíl přijaté dávky +0,05 ms, odmítnuté −1,03 ms; hodnoty obsahují variabilitu
VM, výjimek a běhového prostředí. Nová práce diagnostiky nečte historii.
Přijatá dávka stále používá původní `unshift`, jehož přesuny rostou s délkou
pole; tato etapa jej neoptimalizuje. Plné vykreslení po přijatém měření může
být výrazně dražší a z těchto výsledků jeho cenu nelze odvodit.

Po každém vzorku ověřeny všechny původní reference a pořadí, počty a hodnoty
nových měření, u nového handleru také čítače. Report má ve všech objemech
310 B v kompaktním JSON; to není velikost objektů v RAM. Neuchovává zprávy
ani odkazy na řádky, počet polí/počítadel je pevný. Peak heap/RSS a dlouhodobý
provoz otevřené karty se v této etapě neměřily; nelze tvrdit nulový únik paměti.

Browser ověřuje samostatně skutečné DOM/Chart/Paho s lokální MQTT náhradou:
čítače se aktualizují bez přestavby panelu, fetch a dalších Chart; sbalení a
skrytí brání průběžným DOM aktualizacím (ověřeno také deterministicky v Node).
To není profil reálného mobilu, iOS, zátěžový test brokeru ani měření Web Vitals.

Reprodukce:

```bash
git show 068db56:index.html > /tmp/meteo-mqtt-before.html
METEO_TEST_HTML=/tmp/meteo-mqtt-before.html node --expose-gc scripts/benchmark-mqtt-diagnostics.cjs > /tmp/mqtt-before.json
node --expose-gc scripts/benchmark-mqtt-diagnostics.cjs > /tmp/mqtt-after.json
```

Surové výsledky: [před](mqtt-diagnostics-before.json), [po](mqtt-diagnostics-after.json).
Výsledky velkého CSV parseru z předchozí etapy se neopakovaly: jeho ~1,7 s
synchronního JS pro 250k záznamů a první příprava analytiky z etapy13 jsou
podkladem pro samostatný METEO-008. [Sémantika čítačů](../MQTT_DIAGNOSTIKA.md).
