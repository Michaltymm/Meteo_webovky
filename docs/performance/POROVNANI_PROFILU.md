# Porovnání výstupů výkonnostních profilů

`compare-browser-profiles.cjs` ověří, že dvě verze aplikace nad stejnými
scénáři zpracovaly stejná data a vytvořily stejné výsledky. Používá existující
JSON z `benchmark-refresh-browser.py` nebo `benchmark-overview-render-browser.py`.
Běží v Node bez dalších závislostí.

```sh
node scripts/compare-browser-profiles.cjs /tmp/pred.json /tmp/po.json
```

Oba profily pořiď postupně, stejným benchmarkem, na stejném stroji a se
stejnými parametry a verzemi knihoven. Pro už uložené výsledky s vnořenými
poli `before` a `after` předej jejich samostatné objekty jako dva JSON soubory.
Nástroj páruje scénáře podle velikosti a rozsahu přehledu nebo podle velikosti
a typu CSV historie. Ověřuje množinu scénářů, počet vzorků i dostupná nastavení
profilu. U přehledu kontroluje režim a nově uloženou verzi Chromium. Dva starší
profily přehledu bez verze Chromium lze porovnat za stejných podmínek ručně
ověřených při měření. U obnovy se porovnává i viditelnost a zpomalení procesoru.

Přehled kontroluje podpis grafu a kompletní tabulky. Obnova kontroluje podpis
všech řádků, statistik, grafu a původních měření pro graf. Podpisy zachycují
serializovaný obsah a jeho pořadí. Záměrná změna vykreslení se ve výpisu projeví
jako rozdíl, který je potřeba posoudit podle cíle úpravy.

| Návratový kód | Význam |
|---:|---|
| 0 | Všechny vyžadované podpisy se shodují |
| 1 | Alespoň jeden scénář má jiný výstup |
| 2 | Profil nelze přečíst nebo výsledky nejsou srovnatelné |

Výpis přidává mediány vybraných fází. Čas bez úplných a platných vzorků zobrazí
jako nedostupný. Časy slouží k posouzení změny a nemění návratový kód. Přesnost
porovnání závisí na obsahu, který měřicí skript zahrnul do podpisu.

Ověřeno na osmi archivních scénářích přehledu a osmi obnovy CSV. Záměrně změněný
podpis tabulky v archivním profilu správně označil jediný odlišný scénář a
vrátil kód 1. Pět automatických regresí pokrývá shodu i při rozdílných časech,
změnu podpisů, neúplné nebo duplicitní scénáře a odlišná nastavení.

Dva čerstvé běhy Chromium 154 na stejném HTML prošly ve všech osmi scénářích
včetně nového pole verze prohlížeče. Například změna veličiny v rozsahu Vše
pro 250 000 měření měla při stejném výstupu mediány 12,3 a 13,8 ms.
