# Rychlý návrat k plné historii v Analytice

METEO-004, v0.21.25. Výchozí verze 0.21.24 z `c0c98d2`.

Po kontrole konfigurace může Analytika při návratu na stanici Sheets načíst
ověřenou plnou historii z paměti. Stav uvádí „Uložená data“ a čas předchozí
úspěšné kontroly. Uloženou historii zároveň ověří jediným plným požadavkem.
Identický text potvrdí čerstvost se stejnými řádky a reportem. Změna nebo
smazání staré hodnoty v exportu proběhne běžnou cestou. Při chybě zůstane
viditelný čas poslední kontroly a údaj o selhání obnovy.

Jeden export smí mít nejvýše 12 000 měření a 768 Ki znaků UTF-16. Dvě
položky se řadí podle posledního použití. Platnost pro obnovu je dvě
minuty od ověření, úklid probíhá při kontrole a ukládání. Limit omezuje
velikost vstupu. Skutečná velikost haldy závisí na obsahu a prohlížeči.
Ukládají se původní měření a text bez kopií grafů a odvozených statistik.

Obnova vyžaduje potvrzené Sheets, stejnou stanici, ID tabulky, list a
časovou zónu. Přijatý export musí být úplný, bez odmítnutých řádků a s
výslovně uvedenými roky. Nový přijatý rychlý export vyřadí starší plnou
kopii. Ruční obnova dál žádá celý export. Ostatní pohledy používají
dosavadní rychlý návrat z částečné historie.

## Paměť a čas návratu

Izolovaný Chromium profil měřil jednu historii po vynuceném GC. U 12 000
syntetických řádků (550 909 znaků CSV) přibylo 2,91 MiB JS haldy,
u 100 000 přibylo 23,36 MiB a u 250 000 přibylo 58,19 MiB. Uvolnění
jediné reference snížilo přírůstek pod 0,2 MiB ve všech měřených případech.
Měření nezahrnuje celou RAM procesu.

Návrat A → B → A proběhl offline v Chromium při 390 px a CPU ×4
s původními konfiguracemi, 12 000 pětiminutovými měřeními a prodlevou
300 ms na každou odpověď historie. Tři střídavé měřené páry po zahřátí.
Medián od volby stanice do zobrazení plné historie ve stavovém řádku
klesl z 1 017 na 52 ms. Čas do vykreslení všech karet se neměřil.
Počet požadavků na historii aktivní stanice klesl ze dvou na jeden.
Plný požadavek přenesl shodných 600 957 B a ubylo 19 557 B rychlého
exportu. Shodný plný text v mezipaměti ušetřil jeden plný rozbor.
Výsledná kompletní historie se ve všech bězích shodovala.

## Ověření

Prošlo 511/511 testů Node.js. Regrese ověřily HIT s jedinou kontrolou,
opravu i smazání staršího řádku, selhání přenosu, vypršení platnosti,
změnu listu, zdroje či časové zóny, rozpočet a původní chování přehledů.
Offline Chromium ověřil návrat v Analytice, její mřížku a Moderní
přehled 2. Scénáře použily původní konfigurace a simulované CSV.
