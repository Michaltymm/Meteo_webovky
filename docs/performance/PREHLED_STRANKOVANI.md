# Stránkování denních souhrnů v0.21.0

Přehled teploty, vlhkosti a tlaku zobrazuje nejvýše 50 souhrnů najednou.
U delšího období tlačítka Novější a Starší zpřístupní všechny dny a indikátor
ukazuje viditelný rozsah. Tlačítka mají výšku alespoň 44 px. Kratší tabulky
ovládání nepotřebují. Vyhledávání stránky v prohlížeči najde řádky právě
zobrazené stránky tabulky.

Tabulka čte jediný model denních souhrnů aktuálního přehledu. Listování z něj
vybere nejvýše 50 dní, takže znovu nečte měření, nepřepočítává graf ani nestahuje
data. Graf nadále zahrnuje všechny dny a souhrny vycházejí ze všech platných
měření ve vybraném rozsahu. Změna rozsahu, veličiny nebo stanice otevře nejnovější
stránku. Obnova dat ve stejném výběru ponechá číslo stránky, případně jej omezí
na poslední dostupnou stránku. Invalidace zahodí předchozí model.

Výchozí revize `8dd116f`. Stejný prohlížečový benchmark jako u v0.20.8 měří
přehled při šířce 390 px v Chromium se syntetickou historií a pevným časem.
Pro každou kombinaci rozsahu a velikosti historie následují po zahřátí tři
běhy. Rychlost změny veličiny měří přepínání teploty a vlhkosti. Úplný výstup
všech stránek se porovnává mimo časovaný úsek. Všech 16 párů mělo shodná data
celého grafu a shodné HTML všech řádků tabulky ve správném pořadí.
[Nezpracované vzorky](prehled-strankovani.json)

| Rozsah Vše | Řádků tabulky před → po | Celý přehled před → po | Vložení HTML před → po |
|---|---:|---:|---:|
| Opakování, 100 000 měření | 348 → 50 | 4,4 → 3,1 ms | 0 → 0 ms |
| Opakování, 250 000 měření | 869 → 50 | 9,6 → 7,0 ms | 0 → 0 ms |
| Změna veličiny, 100 000 měření | 348 → 50 | 23,8 → 12,9 ms | 7,6 → 0,7 ms |
| Změna veličiny, 250 000 měření | 869 → 50 | 47,7 → 17,7 ms | 10,8 → 0,8 ms |

Mediány zachycují synchronní sestavení přehledu. Graf používá stejný renderer,
ale menší tabulka může ovlivnit práci prohlížeče s rozvržením. Zrychlení fáze
Chart.js proto nepřipisujeme samostatné optimalizaci grafu. Krátké scénáře mají
smíšené výsledky, například změna veličiny v rozsahu 30 dní u 250 000 měření
trvala 6,1 ms před a 7,1 ms po změně. Odezva na fyzickém telefonu nebyla měřena.

Prošlo 465 testů Node. Dvě přidané regrese ověřují pořadí a úplnost 121 dní,
změny počtů stránek, reset filtrů a stanice i listování bez dalšího výpočtu.
Chromium ověřil klávesnici, kliknutí, změnu veličiny a rozsahu a šířky 320,
390 a 1440 px. Prošel také scénář načítání a přehledu pro všechny tři původní
konfigurace s řízenými CSV daty.

Nasazení v0.21.0 z commitu `86b684c` potvrdil běh GitHub Actions na `codex-dev`.
Celý běh trval 53 sekund. Produkční větev zůstala na `2405c5d`.
[GitHub Actions #60](https://github.com/Michaltymm/Meteo_webovky/actions/runs/45342265903)
