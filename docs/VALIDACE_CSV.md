# Kontrola CSV historie — METEO-050, v0.16.0–0.16.1

První dokončená část METEO-050 navazuje na stav dat METEO-009. Ikona ⓘ u
„Načtená historie“ ve všech třech pohledech otevře přehled posledního rozboru
CSV aktivní stanice. Panel vzniká až při otevření, používá společnou nápovědu
s hoverem 1500 ms, okamžitým kliknutím/dotykem a ovládáním klávesnicí.
Neprovádí další požadavky ani nezakládá grafy.

## Co se počítá

- Celkový počet logických CSV záznamů, prázdné záznamy a úvodní přeskočené
  záznamy. Stávající heuristika hledá první datum v nejvýše čtyřech neprázdných
  úvodních záznamech; přeskočené úvody nejsou automaticky potvrzenou hlavičkou.
- Přijaté řádky s použitelným datem/časem a vyřazené řádky. Platí
  `celkem = prázdné + úvodní přeskočené + přijaté + vyřazené`.
- Dva dosavadní důvody vyřazení: `DATE_MISSING` (chybějící/nečitelné datum)
  a `DATETIME_INVALID` (neplatné datum nebo čas). Nezavádějí se nová pravidla.
- U každé ze sedmi veličin: číselné výsledky původního parseru, prázdné buňky
  a nečíselné/nefinite výsledky. Součet tří kategorií odpovídá počtu přijatých
  řádků. Nula je číslo; null se nenahrazuje nulou. Chybějící senzor nelze
  rozlišit od chybějícího vstupu a není sám o sobě potvrzenou poruchou.
- Nejvýše osm vyřazení: jen logické pořadí před řazením a kód důvodu.
  Pořadí zahrnuje hlavičky i prázdné záznamy; nový řádek uvnitř uvozované
  poznámky nezahajuje nový záznam. Poslední ukončující newline nepřidává další
  prázdný záznam. Obsah vyřazeného záznamu, poznámka ani URL se do reportu nekopíruje.

Přijetí není novým potvrzením fyzikální správnosti. Zachován je původní pf
(včetně tolerovaného číselného prefixu), implicitní půlnoc při prázdném čase,
odvození roku, řazení i všechny duplicity. Řádek s platným časem může mít
všech sedm veličin null; tato etapa ho nově nevyřazuje. Úprava těchto pravidel
vyžaduje samostatné rozhodnutí a regresní ověření METEO-047/048/049.

## Rozsah, chyby a životní cyklus

Report výslovně rozlišuje částečný/celý export a čas jeho rozboru. Neplatí pro
aktuální filtr grafu ani pro MQTT zprávy přijaté později. Nezměněný ověřený CSV
export se znovu neparsuje: původní report/čas rozboru zůstane, zatímco čas
úspěšné kontroly transportu v METEO-009 se aktualizuje. Po neúspěšném pokusu
se při ověření dříve přijatého nezměněného exportu obnoví jeho původní přijatý
report včetně času rozboru. Chyba tak po obnově nezůstává v aktuálním přehledu;
v RAM se během chyby drží navíc jen odkaz na poslední přijatý malý report.

Při nule přijatých řádků je dostupný kompletní rozbor odmítnutého exportu;
starý store se nenahrazuje. U poškozené syntaxe nebo bezpečnostního limitu
report uvede jen obecný kód `CSV_SYNTAX`/`DATA_LIMIT`, bez součtů z nedokončeného
rozboru a bez obsahu vstupu či zprávy výjimky. Síťová chyba před parsováním
nevymýšlí nový rozbor: poslední dostupný report zůstává pod svým původním časem.

Report je pouze v RAM relace, oddělený od původních měření. Při přepnutí
stanice se resetuje. Starou generaci chrání stationContext; čistý parser cizí
historie, overview, UV a MQTT aktivní CSV report nepřepisují. Pokud je panel
otevřen během neúspěšného rozboru, obsah se aktualizuje. Přijetí nové historie
jej zavře stejně jako ostatní nápovědy při invalidaci dat.

## Ověření a pokračování

`tests/csv-validation.test.js`: 11 nových regresí; celá sada **284/284**.
Ověřeny původní řádky/pořadí/duplicity, nuly/null, multiline/blank/BOM, omezené
vzorky bez vstupního obsahu, poškozené CSV/limity, odmítnutí bez změny store,
nezměněné exporty, generace a oddělení MQTT/cizích dat. Renderer používá pevné
popisky a číselné čítače; testuje i poškozená lokální metadata.

Rozšířený `scripts/check-data-status-browser.py` ověřuje přehled v původních
třech konfiguracích, chybu/obnovu, nulové a chybějící napětí a hranice panelu
v 24 kombinacích pohledu/tématu/šířky (320/390/800/1440 px), bez pageerror.
Původní info harness ověřuje hover, klávesnici, dotyk a ostatní nápovědy.
Řízené CSV/UV a skutečné knihovny se SRI nejsou kontrolou živých zdrojů nebo
fyzického Safari/iOS. [Měření parseru před/po](performance/VALIDACE_CSV.md).

Ve v0.17.0 navazuje dokončené [časování obnovy](CASOVANI_OBNOVY.md), které
odděluje přenos, parser a synchronní práci přehledu od celkového čekání.
METEO-050 zůstává rozpracované: dále počty/důvody odmítnutých MQTT zpráv.
Širší provozní diagnostika je další část; anomálie/duplikace a fyzikální kvalita
patří METEO-047.
