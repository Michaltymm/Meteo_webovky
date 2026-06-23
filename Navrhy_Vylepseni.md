# Návrhy vylepšení projektu Meteo web

Tento dokument slouží jako seznam plánovaných či navrhovaných úprav pro budoucí vývoj aplikace Meteo webovky. Tyto nápady **nejsou** v současném stabilním buildu naimplementovány, slouží jako doporučení a odrazový můstek pro pozdější optimalizace a rozšiřování.

---

## 1. Výkon a rychlost

### Ukládání stažených dat do lokální Cache (Memory/localStorage)
**Popis:** Při stažení plných dat ze stanice se JSON/CSV data dočasně uloží do paměti prohlížeče (nebo proměnné), aby se při překlikávání mezi stanicí A a stanicí B nemusely stahovat znova.
**Řešený problém:** Nyní se při každém přepnutí stanice a vrácení zpět dotazuje server Google Sheets, což při 1.5 MB trvá dlouho a plýtvá daty.
**Přínos:** Vysoký
**Náročnost:** Střední
**Riziko:** Střední
**Priorita:** Vysoká
**Doporučení:** Řešit později. (Nyní se daří plná data tahat díky línému načítání rychle).

### Omezení počtu bodů (Downsampling) u dlouhých rozsahů
**Popis:** Pokud se vykresluje graf za "Vše" (např. 20 000 bodů), vybere se jen každá 10. hodnota (nebo se agreguje max/min za daný den). 
**Řešený problém:** Extrémní objemy bodů zpomalují renderování Chart.js a jsou pro lidské oko nerozeznatelné v hustotě 1 px.
**Přínos:** Střední
**Náročnost:** Střední
**Riziko:** Střední
**Priorita:** Střední
**Doporučení:** Zvážit při nasazení delších historií (např. v řádu let).

---

## 2. Grafy

### Plovoucí přepínač jednotek nebo schování datové řady
**Popis:** Možnost kliknutím na legendu nebo tlačítko (např. °C vs °F) přepočítat hodnoty nebo skrýt vlhkost/rosný bod, aniž by k tomu sloužily pevně dané tabulky.
**Řešený problém:** Zvýšení flexibility při zobrazení a zamezení nepřehlednosti v malých grafech.
**Přínos:** Malý
**Náročnost:** Nízká
**Riziko:** Nízké
**Priorita:** Nízká
**Doporučení:** Zvážit v budoucnu.

### Analytické porovnávání grafů (Overlap dnů)
**Popis:** Možnost položit na sebe křivku teploty z "Dnes" a "Včera" s jinou opacitou přes sebe do jednoho 24h grafu.
**Řešený problém:** Získáme okamžitou analytickou představu o vývoji počasí.
**Přínos:** Střední
**Náročnost:** Vysoká
**Riziko:** Nízké
**Priorita:** Střední
**Doporučení:** Řešit později, jedná se spíše o novou komplexní funkci.

---

## 3. Mobilní zobrazení

### Optimalizace Portrait/Landscape režimu pro telefony
**Popis:** Při přetočení telefonu na šířku graf zmizí z okrajů nebo se špatně updatuje a musí se provést window resize event, který překreslí celou instanci Chart.js.
**Řešený problém:** Rozložení prvků na šířku může být u menších obrazovek přeplácané.
**Přínos:** Vysoký
**Náročnost:** Nízká
**Riziko:** Nízké
**Priorita:** Střední
**Doporučení:** Zvážit. Současný stav ale používá Chart.js automatiku, která obvykle zvládá viewport přechody korektně.

### Větší touch-targety (tlačítka) na filtrech
**Popis:** Zvýšení paddingu na tlačítkách `[24 h] [3 dny] [Vše]` pro tlustší palce na displejích.
**Řešený problém:** Překliky na telefonech.
**Přínos:** Vysoký
**Náročnost:** Nízká
**Riziko:** Nízké
**Priorita:** Vysoká
**Doporučení:** Řešit hned jako banální CSS optimalizaci (např. `padding: 10px 14px;`).

---

## 4. Uživatelský komfort

### Ukládání poslední vybrané stanice do localStorage
**Popis:** Pomocí okna `localStorage.setItem('lastStation', activeIdx)` prohlížeč uloží váš výběr stanice, abyste ji měli otevřenou hned při dalším startu webu.
**Řešený problém:** Nutnost vždy přepínat z defaultní první stanice (Mšené lázně / Praha-baterie) na oblíbenou.
**Přínos:** Vysoký
**Náročnost:** Nízká
**Riziko:** Nízké
**Priorita:** Vysoká
**Doporučení:** Řešit hned / později. Velmi snadné a ohromně to přidá na komfortu.

### Skeleton loading stav (Zástupné obdélníky)
**Popis:** Při načítání dlouhých dat nezobrazovat jen text "Čekám na data", ale animované stínované rámečky ("skeleton") pro lepší vizuální zážitek, než naskočí čísla.
**Řešený problém:** Vizuálně se minimalizuje pocit, že "aplikace se sekla".
**Přínos:** Střední
**Náročnost:** Střední
**Riziko:** Nízké
**Priorita:** Nízká
**Doporučení:** Zvážit pro budoucí redesignování.

---

## 5. Stabilita

### Detekce chybějících sloupců a AbortControler requestů
**Popis:** Zajištění, aby web automaticky varoval přes Toast / Console warning, že z Google Sheets nevrátil sloupec č. 6 (Nádrž) a nahradil ho "null" řadou, aniž by shodil celou funkci zobrazení. Plus zastavení starého stahování při rychlém překliknutí na jinou stanici.
**Řešený problém:** Skrytá zranitelnost, pokud se v budoucnu změní rozvržení Google Sheets tabulky pro konkrétní IoT modul, tak grafy zamrznou.
**Přínos:** Vysoký
**Náročnost:** Střední
**Riziko:** Střední
**Priorita:** Vysoká
**Doporučení:** Řešit později při dalším zásahu do parseru GVIZ dat.

---

## 6. Struktura kódu

### Rozdělení monolitického JS do modulů
**Popis:** Rozbít současný obří `index.html` soubor. Funkce jako parser.js, charts.js, a ui.js importovat přes moduly `<script type="module">`.
**Řešený problém:** Špatná orientace a údržba kódu s narůstajícím objemem 5000 řádků.
**Přínos:** Vysoký
**Náročnost:** Vysoká
**Riziko:** Vysoké
**Priorita:** Nízká
**Doporučení:** Zvážit pouze pokud plánujete s projektem nadále mohutně růst.

---

## 7. Budoucí funkce

### Režim instalace na plochu (Progressive Web App - PWA)
**Popis:** Přidání hlavičky `manifest.json` a jednoduchého Service Workeru zajistí, že si na iPhonu budete moct aplikaci přidat na domovskou obrazovku jako plnohodnotnou "ikonečku aplikace" (PWA), s vlastním full-screen zobrazením.
**Řešený problém:** Snadnější dostupnost aplikace (na jeden dotyk), pocit nativní mobilní aplikace.
**Přínos:** Vysoký
**Náročnost:** Střední
**Riziko:** Nízké
**Priorita:** Vysoká
**Doporučení:** Rozhodně řešit. Učiní to z vaší stránky skutečnou "appku".

### Tmavý režim (Dark/Light mode switch)
**Popis:** Web je již koncipován tmavě, ale možnost přepnout jej na světlou (Light) variantu pro denní sledování.
**Řešený problém:** Umožňuje uživatelům preferující světlé motivy pohodlné používání za denního svitu venku.
**Přínos:** Malý
**Náročnost:** Střední (nutnost propisovat spoustu CSS variabiles)
**Riziko:** Střední (vizuální nepřehlednosti v grafech Chart.js)
**Priorita:** Nízká
**Doporučení:** Pouze zvážit.
