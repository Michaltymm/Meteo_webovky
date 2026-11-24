# Rychlý návrat na stanici v0.21.3

Při návratu na stanici se zdrojem Google Sheets může aplikace zobrazit poslední
ověřený rychlý export, jakmile potvrdí konfiguraci stanice. Stav „Uložená data“
se zobrazuje do úspěšné kontroly zdroje. Při chybě obnovy zůstane vidět chyba
spolu s údajem o stáří posledního měření. Podrobnosti uvádějí čas předchozí
úspěšné kontroly. Analytika označuje uložená data ve vlastním stavovém řádku.

Aplikace ukládá nejvýše jeden rychlý export pro každou ze tří stanic, vždy
v paměti na dvě minuty od ověření. Na stanici připadá nejvýše 400 řádků a
65 536 znaků UTF-16 původního CSV, plus souhrn validace. Používají se reference
na už zpracovaná data. Rozpočet omezuje velikost vstupů, skutečnou velikost haldy
v prohlížeči jsme neměřili. Nové načtení stránky mezipaměť odstraní.

Obnova vyžaduje úspěšné načtení konfigurace a shodu stanice, zdroje Sheets,
tabulky, listu a časové zóny. Exporty s odmítnutými řádky nebo odvozeným rokem
se při návratu znovu načítají a parsují běžnou cestou. Při změně zdroje či při
ručním uložení konfigurace se záznam odstraní. Po potvrzení celého exportu se
záznam rychlé historie odstraní, aby při příštím návratu nenabídl starší kopii.

Kontrola Sheets po návratu proběhne i při obnově z mezipaměti. Stejný CSV text
potvrdí čerstvý čas kontroly a použije už ověřený rozbor. Upravený export se
zpracuje běžnou cestou a nahradí uložené hodnoty. Ruční obnova a otevření
pohledu vyžadujícího celou historii dál vyžadují úplný export. Generační
kontroly chrání aktivní stanici před pozdní odpovědí předchozí relace.

Výchozí revize `f5b733f`. Prohlížečový test
`scripts/check-quick-station-cache-browser.py` prošel třemi původními
konfiguracemi a vrátil se na první stanici se stejným exportem o 400 řádcích.
Odpověď při návratu v obou verzích čekala dalších 300 ms. První zobrazení
teploty od změny výběru nastalo v jednom srovnání za 333 ms před a 11 ms po.
V obou případech proběhl jeden rychlý požadavek s 18 757 bajty dat. Rozbor se
spustil jednou před změnou a ani jednou po ní. Po ověření se shodovaly všechny
řádky. Test ověřil také šířky 320 a 390 px. Výsledek popisuje načítání s
řízenou prodlevou v Chromium na místním testu.
[Záznam měření](rychly-navrat-na-stanici.json)

Šest regresí pokrývá správnou stanici a starý čas kontroly, shodnou i upravenou
odpověď, opožděnou relaci, časovou zónu, velikost vstupu, vypršení platnosti,
chybějící rok, chybu zdroje, ruční obnovu i kombinovaný zdroj.

Prošlo 478 testů Node a stávající prohlížečový scénář Moderního přehledu 2
s třemi konfiguracemi, mobilními šířkami, stavem přenosu a přepínáním pohledů.
