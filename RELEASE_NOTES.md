# Přehled změn

## v0.9.0

- Nejvyšší a nejnižší teplota v kartě Statistika mají podklady s původním měřením, přesnou hodnotou a časem s UTC offsetem. Zobrazují počty platných a vynechaných teplot i přesných shod extrému.
- Panel rozlišuje částečnou a celou načtenou historii, vysvětluje výběr při shodě a ukazuje původní doprovodná měření. Po změně dat či stanice se staré podklady zavřou.
- Otevření funguje klávesnicí i na mobilu, využívá stávající souhrny a nepřidává stahování ani grafy.

## v0.8.0

- U hodinových průměrů v Porovnání dnů lze otevřít původní teplotu, vlhkost či tlak kliknutím na bod grafu nebo výběrem dne a hodiny. Výpis uvádí součet, počet, nezaokrouhlený průměr a důvody vynechání hodnot.
- Tabulka zachovává nuly, duplicity a časy s UTC offsetem včetně opakované hodiny při změně času. Zobrazuje nejvýše 50 záznamů na stránce, bez dalšího stahování.
- Ovládání funguje klávesnicí i na mobilu. Při změně dat, stanice nebo porovnání se neplatný výpis zavře; dosavadní grafy a statistiky používají stejná úplná měření.

## v0.7.0

- Analýza teploty a napětí nabízí původní záznamy vlivného dne po 50 řádcích. Zobrazuje časy s UTC offsetem, hodnoty bez zaokrouhlení a důvody vynechání neplatných párů.
- Výpis odpovídá vybranému rozsahu analýzy, zachovává nuly i duplicitní časy a uvádí podklady a vzorce výpočtu. Po změně dat, stanice či rozsahu se starý výpis zavře.
- Tabulka se načítá až po rozbalení, funguje na mobilu i s klávesnicí a nepřidává síťové požadavky ani grafy.

## v0.6.0

- Analýza „Teplota × napětí“ nově ukazuje, jak se korelace a sklon změní po vynechání jednotlivých dnů. Uvádí rozsah výsledků, vlivné dny, počty párů a výslovně nedostupné výpočty.
- Vlivný den lze otevřít v průzkumníku bez nového stahování. Výpočet zachovává všechna měření; vysvětluje minimální podklady, použitou zónu a omezení interpretace.

## v0.5.0

- Průzkumník má rozbalovací „Rozklad změny relativní vlhkosti“ pro krajní měření vybraného úseku. Ukazuje vstupní T/RH a časy, teplotní faktor, faktor parního tlaku a kontrolní RH při nezměněném parním tlaku.
- Rozklad reaguje na posuvník, používá původní měření a rozlišuje chybějící vstupy, RH=0, shodné časy a formální překročení nasycení. Vysvětluje omezení výpočtu a neověřenou platnost kalibrace či umístění mezi body.

## v0.4.0

- Nová záložka „Teplota × napětí“ porovnává původní páry ve společném časovém a XY grafu. Ukazuje počty párů, různých časů a dnů, popisnou korelaci a lineární sklon; bez odhadů kapacity či stavu nabití baterie.
- Absolutní vlhkost a VPD vzduchu jsou dostupné v přehledu i průzkumníku. Vzorce, jednotky, platný obor a původ vypočtených hodnot jsou popsané na stránce.
- Nastavení systému pro omezení pohybu nyní vypíná animace grafů, CSS a plynulé posouvání, včetně změny preference za běhu.
- Dokončení načítání historie obnoví pouze právě otevřenou záložku; analytika správně rozlišuje částečnou a celou načtenou historii.

## v0.3.1

- Roční statistiky sdílejí měsíční souhrny a uchovávají výpočty pro právě načtenou historii. Opakované otevření i přepínání roků je rychlejší, průměry a rekordy stále vycházejí ze všech původních měření.
- Volba roku se po změně stanice nebo odstranění dat vrací na dostupné roky; prázdná historie nezachovává starý filtr.
- Srážkové popisky rozlišují maximum čítače, přírůstek jednoho záznamu a rozdíl čítače v okně do 24 hodin. Bez potvrzeného intervalu a resetů je nevydávají za hodinové či 24hodinové úhrny; číselné výsledky se nemění.

## v0.3.0

- Porovnání dnů má rychlejší hodinové výpočty z úplných původních měření a omezenou cache posledních osmi použitých dnů.
- Nový rozbalovací přehled „Podklady hodinových průměrů“ ukazuje počty záznamů, různých časů, číselných hodnot a hodin s daty, časový rozsah i nejdelší rozestup mezi záznamy.
- Tooltipy hodinových průměrů uvádějí počet hodnot a různých časů. Chybějící hodiny se nepřemosťují čarou.
- Přehled rozlišuje 23/25hodinové dny i půlhodinový posun času; počty hodin nejsou vydávány za procento dostupnosti senzoru.

## v0.2.2

- Přehled, denní karty a denní i měsíční grafy sdílejí vypočtené souhrny. Opakované vykreslení rozsáhlé historie je rychlejší; statistiky stále používají všechna původní měření.
- Souhrny se přepočítají po změně dat, opravě historie, MQTT zprávě, změně stanice i místního dne.
- Skrytá karta neprovádí periodické dotazy na Sheets, UV a přehled ostatních stanic. Po návratu doplní jen potřebné zdroje bez duplicit a bez nového MQTT spojení; ruční obnova zůstává dostupná.

## v0.2.1

- Porovnání dnů a tlačítka „Dnes“ používají stejné místní datum jako zobrazené časy; měření kolem půlnoci se nezařazují do sousedního UTC dne.
- Výběr jednoho dne i vlastního rozsahu zahrnuje celý kalendářní den při přechodu na letní a zimní čas. Rychlá nabídka dnů se při změně času neopakuje ani nepřeskakuje.
- Dnešní statistiky nezahrnují záznamy ze sousedního dne; chybějící hodnoty nezůstávají z předchozího dne. UV cache se řídí místním datem.
- Porovnání vysvětluje použitou zónu prohlížeče a průměrování opakované hodiny.

## v0.2.0

- Průzkumník nově porovnává původní krajní měření zvoleného úseku: počáteční a koncovou hodnotu, rozdíl a uplynulý čas pro teplotu, vlhkost, tlak a napětí. Úsek se vybírá posuvníkem.
- Chybějící krajní hodnoty zůstávají označené jako nedostupné; rozdíl vlhkosti je uveden v procentních bodech a časy včetně UTC offsetu.
- Rychlejší hledání hodnot v panelu „Dříve touto dobou“ i při rozsáhlé historii, se zachováním původní tolerance a výběru měření.
- Opakovaná obnova nepřepisuje nezměněné texty společných ukazatelů a historických protějšků.

## v0.1.0

- Viditelné číslo verze v hlavičce webu s odkazem na tento přehled změn.
- Rychlejší historické grafy: aktualizace pouze otevřené záložky, cache rozsahu a méně vykreslovaných bodů při zachování extrémů.
- Statistiky, posuvník historie a regrese napětí používají úplná měření.
- Stejný rychlý CSV export se znovu nezpracovává; obnova celé historie zachytí i opravy starších měření.
- Spolehlivější přepínání stanic, rušení zastaralých požadavků a správa MQTT připojení.
- Opravy CSV, víceřádkových poznámek, validace data a času a bezpečného zobrazení externího textu.
- Opravy grafů bez napětí, velkých historií, prázdných rozsahů, volby „Vše“ a denních statistik napříč roky.
