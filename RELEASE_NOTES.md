# Přehled změn

## v0.18.6

- Čtení polí velkých CSV exportů aktivní stanice z Google Sheets probíhá po krátkých dávkách. Mezi nimi lze dál ovládat stránku; validace a řazení zatím zůstávají souvislé.
- Přepnutí stanice rozpracované čtení zruší. Původní historie zůstává dostupná až do úplného ověření nového exportu; hodnoty, limity i diagnostické počty se nemění.

## v0.18.5

- Hodinová heatmapa připravuje teplotu a vlhkost po jednotlivých zobrazených dnech, takže hustá historie vyžaduje méně opakovaných výpočtů data a hodiny.
- Hodinové průměry, počty a extrémy zůstávají stejné, včetně duplicit, částečných dnů a přechodů mezi letním a zimním časem. Další stahování dat není potřeba.

## v0.18.4

- Vyhlazování teploty a tlaku v analytických grafech připravuje body v jednom průchodu a uchovává jen omezený výběr pro graf. U dlouhé historie odpadá velké dočasné pole.
- Pětiměřicí průměry, vybrané extrémy, mezery i původní statistiky zůstávají stejné; nevznikají další síťové požadavky.

## v0.18.3

- Noční změna napětí v analytických grafech se počítá jen z příslušného časového úseku. Dlouhá historie tak zbytečně nezdržuje otevření bateriového grafu.
- Původní hodnoty, duplicity, pravidla pro mezery a chybějící napětí i označení neúplného nočního pozorování zůstávají zachované.

## v0.18.2

- Velké porovnání stanic z Google Sheets se společným výřezem se připravuje po dávkách. Během párování zůstávají ostatní grafy použitelné.
- Změna historie, cache jiné stanice nebo odchod z analytiky zruší zastaralý výpočet. Výsledek a export PNG jsou dostupné až po úplném dokončení; pravidla párování a hodnoty zůstávají zachované.

## v0.18.1

- Příprava velkých analytických grafů z Google Sheets se společným časovým výřezem probíhá po krátkých dávkách, aby během výpočtu šlo dál ovládat stránku.
- Změna období, stanice nebo odchod z analytiky zruší rozpracovanou přípravu. Během čekání se starý graf nevydává za nový a export je dostupný až po dokončení.

## v0.18.0

- Diagnostika pod ⓘ nově ukazuje obsloužené MQTT zprávy, uložená měření a počty odmítnutí podle důvodu, bez ukládání obsahu zpráv.
- Přehled MQTT se průběžně aktualizuje a zůstává otevřený při příchodu měření. Opětovné připojení zachová čítače, přepnutí stanice je vyčistí; chyby aplikace jsou oddělené od neplatného vstupu.

## v0.17.0

- Pod ⓘ u načtené historie je nyní doba poslední obnovy rozdělená na přenos CSV, rozbor dat a přípravu přehledu, včetně počtu pokusů a celkového času.
- U nezměněného exportu je vidět, které kroky nebyly potřeba. Neúspěšné pokusy mají vlastní časování; dosavadní měření a poslední úspěšná kontrola zůstávají zachovány.

## v0.16.1

- Po obnovení dříve přijatého nezměněného exportu přehled znovu ukáže jeho správný rozbor. Předchozí neúspěšný pokus tak nezůstane zobrazen jako aktuální stav; další parsování není potřeba.

## v0.16.0

- U načtené historie je pod ikonou ⓘ přehled kontroly CSV: přijaté a vyřazené záznamy, důvody vyřazení a dostupnost hodnot jednotlivých senzorů.
- Odmítnutí ukazují jen pořadí záznamu a bezpečný kód důvodu. Neplatný export nepřepíše dosavadní měření; pravidla načítání a statistiky zůstávají zachovány.

## v0.15.0

- Nový přehled stavu dat odděluje čas posledního záznamu, úspěšnou kontrolu Sheets a přijetí zprávy MQTT. Při chybě obnovy zůstává viditelný poslední úspěch i načtená historie.
- Je zřetelné, zda se zobrazuje částečná historie, celý export nebo živé zprávy. Stáří se obnovuje bez dalších síťových požadavků; budoucí čas je označený.

## v0.14.0

- V moderním přehledu lze přes „Upravit karty“ vybrat senzorové karty zvlášť pro každou stanici. Volba se uloží v prohlížeči; všechny karty lze jedním tlačítkem obnovit.
- Původní přehled nadále ukazuje všechny karty. Skrytí karty nemění měření, statistiky ani dostupnost grafů a nápovědy.

## v0.13.1

- Nápověda ⓘ se myší otevře až po 1,5 sekundy nad ikonou. Krátké přejetí ji nespustí a po odjetí se čekání zruší. Klepnutí, kliknutí a klávesnice otevírají nápovědu okamžitě.

## v0.13.0

- Vysvětlení a podklady jsou dostupné pod nenápadnou ikonou ⓘ místo samostatných tlačítek a rozbalovacích polí. Sjednoceno v obou přehledech, analytických grafech, vlhkostních metrikách, porovnání, analýze baterie, ročních statistikách i nastavení zdroje.
- Nápověda se zobrazí při najetí myší a po odjetí zmizí. Na telefonu ji lze otevřít klepnutím a zavřít dalším klepnutím nebo klepnutím mimo. Funguje také klávesnice a Escape; dlouhé podklady lze posouvat.

## v0.12.0

- Nová stránka „Moderní přehled“ nabízí vzdušnější design s výraznou teplotou, novými kartami a responzivním rozložením ve světlém i tmavém režimu.
- Nahoře lze přepínat mezi původním přehledem, moderním přehledem a analytickými grafy. Oba přehledy sdílejí stanici, data i všechny původní funkce bez opakovaného načítání.

## v0.11.4

- Prohlížeč ověřuje integritu externích grafových a MQTT knihoven. Jejich verze ani vzhled grafů se nemění.
- Lokální náhled má omezenější přístup; publikování používá pevné revize GitHub Actions.

## v0.11.3

- Načítání má průběžné velikostní limity a ochranu před neúměrně složitým CSV. Odmítnutá odpověď nepřepíše platnou historii.
- MQTT odmítá prázdné/neplatné zprávy a při nadměrném provozu bezpečně zastaví příjem. Na HTTPS používá šifrované WebSocket spojení na každém portu.

## v0.11.2

- Poškozené nebo blokované úložiště prohlížeče už nezastaví aplikaci. Předvolby lze používat i jen pro aktuální relaci.
- Import konfigurace ověřuje stanici, typy a rozsahy před změnou dat; nepodporované položky se neukládají ani nelogují.

## v0.11.1

- Vysvětlující popisky a podrobné statistiky všech devíti analytických grafů jsou schované pod rozbalovací šipkou „Podrobnosti grafu“. Text lze otevřít kliknutím, dotykem i klávesnicí.

## v0.11.0

- Nahoře lze přepínat mezi „Hlavním přehledem“ a samostatnou stránkou „Analytické grafy“ s devíti grafy. Karty přehledu a jeho původní záložky zůstávají na hlavní stránce.
- Analytiku lze otevřít přímo odkazem s `#analytika`; funguje také Zpět/Vpřed v prohlížeči. Návrat zachová vybranou záložku přehledu a již načtenou historii.
- Horní přepínač funguje na mobilu i klávesnicí. Při změně stanice se staré analytické grafy skryjí, po odchodu z analytiky se uvolní.

## v0.10.0

- Nová záložka „Analytické grafy“ nabízí devět karet: teplotu s denními extrémy, RH/rosný bod, tlak, srážkový čítač, společný graf T/V, změnu napětí, XY závislost T/V, porovnání tří stanic a hodinovou heatmapu T/RH.
- Společný výběr období 24 h až celá historie, vlastní datum, synchronizovaný časový výřez a kurzor, zoom/posun, interaktivní legendy, rozšíření na celou šířku a PNG export. Rozložení má tři sloupce na desktopu, dva na tabletu a jeden na telefonu.
- Statistiky a korelace vycházejí ze všech původních dat; grafické body mají zachované extrémy. Heatmapa má detail buňky a stránkování. Rychlost změny napětí uvádí mV/h bez odhadů proudu či kapacity; srážky přiznávají neověřený význam čítače.
- Grafy se vytvářejí až při zobrazení a po odchodu se uvolní. Historie ostatních stanic se načítá samostatně až pro porovnání, sdílí omezenou cache a při chybě obnovy zřetelně označí poslední dostupná data.

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
