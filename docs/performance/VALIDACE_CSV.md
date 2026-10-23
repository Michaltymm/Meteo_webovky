# Čítače validace CSV — v0.16.0, před/po

Baseline `33557f2`, Node 24.19.0 a původní JS v projektové VM, bez DOM/Chart
nebo živé sítě. Shodná syntetická CSV o 1k/10k/100k/250k záznamech; každý 41.
má neplatný den, třetina nemá napětí, ostatní původní čísla/duplicity zachovány.
Předchozí parser bez diagnostiky proti novému s aktivním collectorem.

Zahřátí jedním parse pro každý objem, pět měřených běhů, GC před každým,
baseline i nová implementace sekvenčně bez dalších profilů. Po každém běhu
kontrola počtu, hodnot a pořadí; souhrn zachovaných hodnot uveden v surových
JSON. Není započten desetimilisekundový yield v parseAndStore ani browser render.

| CSV záznamů | Před / po, medián (ms) | Heap po parsování před / po, medián (MiB) | Report po jako JSON (B) |
| --- | --- | --- | --- |
| 1 000 | 8,28 / 10,29 | 5,91 / 6,01 | 790 |
| 10 000 | 65,41 / 73,33 | 16,61 / 16,76 | 802 |
| 100 000 | 635,54 / 686,31 | 62,37 / 68,60 | 814 |
| 250 000 | 1681,74 / 1703,01 | 151,13 / 160,20 | 822 |

Přidané čítače mají měřitelnou cenu, zde ~2–51 ms. Rozdíl není důkaz zrychlení
ani záruka pro mobil. Při 250k stále jde o přibližně 1,7 s synchronního parseru;
METEO-008 proto zůstává výkonnostní návazností. Statistiky i původní pole jsou
shodné, nepočítají se z vizuální redukce.

Heap je stav ihned po parsování, nikoli peak/RSS ani trvale udržená RAM. Během
rozboru vzniká dočasné pole pořadí logických záznamů; po návratu není v reportu
ani store. Větší rozdíl heapu při 250k proto nelze vydávat za cenu malého
trvalého reportu. Uvedené bajty jsou přesná délka serializovaného reportu,
nikoli měření velikosti objektů v RAM. Report má vždy jen sedm senzorových
souhrnů a nejvýše osm pozic; nepřebírá měření ani poznámky.

Otevření ⓘ čte pouze hotový omezený report; Node regrese mu zakazuje čtení
store.rows přes Proxy. Browser ověřuje nulový přírůstek fetch/Chart instancí
při otevření a použitelnost panelu 320–1440 px ve všech třech pohledech.
Nedoplňuje se další minutový výpočet, timer ani síťový přenos.

Reprodukce:

```bash
git show 33557f2:index.html > /tmp/meteo-validation-before.html
METEO_TEST_HTML=/tmp/meteo-validation-before.html node --expose-gc scripts/benchmark-csv-validation.cjs > /tmp/validation-before.json
node --expose-gc scripts/benchmark-csv-validation.cjs > /tmp/validation-after.json
```

Surové výsledky: [před](csv-validation-before.json), [po](csv-validation-after.json).
Browser/CPU×4/Safari/Web Vitals a skutečná síť v tomto mikroměření obsaženy nejsou.
