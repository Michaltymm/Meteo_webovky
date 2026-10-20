# Technický audit a návrhy vylepšení – Meteo_webovky

**Datum auditu:** 20. 10. 2026  
**Soubor:** `index.html` (4 909 řádků, ~192 KB)  
**Větev:** `codex-dev`  
**Charakter:** statická analýza kódu, bez spuštění v prohlížeči.

## Aktuální stav realizace

Původní audit níže zachycuje stav před opravami; čísla řádků jsou historická. Stav ověřených implementací na `codex-dev`:

| Nález | Stav | Implementace a ověření |
| --- | --- | --- |
| W01 | DONE | Generace relace + AbortController, ochrana konfigu/CSV/parseru/UV/overview/FileReader; A → B → A i změna zdroje. Staré panely se při přepnutí skryjí. |
| W02 / D06 | DONE | Chybný preflight odstraněn; porovnává se celý poslední validní CSV export, otisk se mění až po úspěšném parseru. Detekuje i opravy starých řádků a poznámek. Výměnou za správnost se periodicky přenáší celé CSV; optimalizace vyžaduje spolehlivou revizi/ověřený kontrakt zdroje. |
| W03 | DONE | Parser vrací Promise a validovaný výsledek; fullLoaded/OK/callbacky až po commitu řádků. Chybná HTML/CSV nemůže potvrdit úspěch, čekající callbacky se při selhání uvolní. |
| W05 | DONE | Parser podporuje escapované uvozovky, BOM/CRLF i víceřádkové buňky a odmítá neuzavřené/nesprávné uvozovky. Poznámky zachovávají doslovné apostrofy/uvozovky a řádky. |
| W12 | DONE | Úplná validace kalendáře a času, podpora sekund/přestupných roků/krátkého roku; žádný tichý rollover ani změna yearState při chybě. |
| W13 | DONE | Neplatná vlhkost/teplota nebo nekonečný výsledek dává null; pf nepřijímá Infinity, platná nula zachována. |
| W15 | DONE | Denní agregace klíčuje včetně roku a neslučuje stejný den různých let. |
| W09 | DONE | Plná historie má 30s timeout kombinovaný se zrušením relace. |
| W08 | ČÁSTEČNĚ | Starý klient se odpojuje; jeho zprávy, callbacky a reconnect se ignorují. Limit počtu zpráv a slučování se Sheets zůstává TODO. |
| W10 | ČÁSTEČNĚ | Reconnect timer je rušitelný a vázaný na klienta i relaci; exponenciální backoff zůstává TODO. |
| D02 | DONE | Start načítání konfigurace sjednocen do `loadStationConfig`, bez duplicitních větví `.then`. |
| AUD-003 / AUD-005 / AUD-011 / AUD-012 | DONE | Další potvrzené chyby z PROJECT_AUDIT.md: HTML z CSV se vykreslí jako text, grafy bez napětí nepadají a nevymýšlejí predikci, Vše skutečně zobrazí celou historii, prázdný explorer nezachová stará data. |

Ověření: `node --test tests/*.test.js` — **44/44 prošlo** (14 načítání, 20 kvalita dat, 10 server/Pages). Testy spouštějí skutečný inline JS; původní záměna konfigu i RangeError bez napětí byly reprodukovány před opravou. Chromium s reálným Chart.js a řízenými Sheets/UV odpověďmi ověřilo také všechny záložky nad 61 řádky bez napětí, víceřádkové poznámky, bezpečný HTML výstup, chyby/retry, změnu starého řádku při stejných hlavičkách, prázdný rozsah a mobilní viewport. Reálné služby ani MQTT broker tím ověřeny nejsou. CI před publikováním spouští všechny testy; workflow prošlo actionlint. Podrobnosti: `PROJECT_AUDIT.md`.

---

## 0. Shrnutí

Webová aplikace je funkční, vizuálně zdařilý dashboard pro tři meteorologické stanice, postavený čistě v HTML/CSS/JS bez frameworku. Obsahuje grafy (Chart.js), astronomické výpočty, porovnání dnů, roční statistiky, poznámky a volitelný MQTT příjem.

Audit identifikoval **5 kritických chyb (P1)**, **12 důležitých problémů (P2)**, **10 středních vylepšení (P3)** a **6 drobných úprav (P4)**.

Nejzávažnější nalezené problémy:
1. Přepnutí stanice nezruší probíhající síťové požadavky – starý výsledek může přepsat data nové stanice.
2. Inkrementální kontrola dat skládá nesprávnou URL (dvojitý `?`).
3. `parseAndStore()` odkládá zpracování přes `setTimeout`, ale volající ihned nastaví `fullLoaded = true`.
4. CSV parser nesprávně zpracovává escapované uvozovky a nemá ochranu proti chybným datům.
5. Funkce `buildCompare()` používá `toISOString().slice(0,10)` – UTC datum se liší od českého dne kolem půlnoci.

---

## 1. Přehledová tabulka zjištění

| ID | Priorita | Oblast | Zjištění / návrh | Řádky | Doporučené řešení | Očekávaný přínos | Náročnost |
|---|---|---|---|---|---|---|---|
| **W01** | P1 | Správnost | Přepnutí stanice nezruší probíhající fetch – odpověď staré stanice přepíše data nové | 2717–2732, 3462–3544 | `AbortController` per stanice; ověření `activeIdx` před zápisem do `store` | Eliminace záměny dat mezi stanicemi | Střední |
| **W02** | P1 | Správnost | Inkrementální kontrola skládá nesprávnou URL – dvojitý `?tqx=` | 3503 | Sestavit URL přes objekt `URL` + `searchParams`; kontrolovat skutečný poslední timestamp | Správná detekce nových dat | Nízká |
| **W03** | P1 | Správnost | `parseAndStore()` odkládá parsing přes `setTimeout` a nevrací Promise – `fullLoaded` se nastaví ihned | 3569–3617, 3532–3534 | Vrátit Promise z parseru; `fullLoaded` nastavit až po úspěšném zpracování | Spolehlivá indikace hotového načtení | Střední |
| **W04** | P1 | Kompatibilita | Frontend očekává poznámku v sloupci J (index 9), ale nové Raw_Data má v J rosný bod | 3596 | Adaptér s detekcí schématu podle počtu a názvů sloupců | Bezpečný přechod na nové tabulkové schéma | Střední |
| **W05** | P1 | Správnost | CSV parser nezvládá escapované uvozovky `""` a víceřádkové buňky | 3621–3629 | Stavový automat respektující RFC 4180 nebo osvědčený parser | Odolnost proti reálným CSV výstupům Google Sheets | Střední |
| **W06** | P2 | Správnost | `toISOString().slice(0,10)` vrací UTC datum – kolem půlnoci se liší od českého dne | 3375, 3986, 3996, 4270, 4278, 4316 | Použít helper `localDateStr(d)` vracející `YYYY-MM-DD` v místní zóně | Správné přiřazení dat k dnům | Nízká |
| **W07** | P2 | Výkon | `Math.max(...temps)` / `Math.min(...)` s celým polem – při >100 000 záznamech přetečení zásobníku | 3689, 3709–3711, 3914–3922 | Průběžné `reduce()` výpočty (viz roční statistiky, kde je to již správně ř. 4589) | Stabilita při velké historii | Nízká |
| **W08** | P2 | Stabilita | MQTT klient nemá životní cyklus – při přepnutí stanice se starý neodpojí; neomezená historie zpráv | 4761–4787 | Odpojení starého klienta při přepnutí; limit na počet MQTT záznamů v `store` | Prevence memory leaku | Střední |
| **W09** | P2 | Spolehlivost | Plné načtení (`fetchSheets(true)`) nemá timeout – při pomalé odpovědi může viset neomezeně | 3526–3541 | Přidat `AbortSignal.timeout(30000)` i pro plné načtení | Uživatel dostane chybovou zprávu namísto nekonečného čekání | Nízká |
| **W10** | P2 | Spolehlivost | `connectMQTT` reconnect přes `setTimeout(connectMQTT, 5000)` – bez exponenciálního backoffu, bez limitu pokusů | 4766, 4785 | Exponenciální backoff s maximem (např. 5 min); max. počet pokusů nebo reset po manuální akci | Šetření zdrojů při nedostupném brokeru | Nízká |
| **W11** | P2 | Výkon | Všechny grafy se vytváří při startu (`mkChart()`), i když je většina tabů skrytá – 8 instancí Chart.js naráz | 3776–3804, 3952, 4238, 4253 | Lazy inicializace grafů při prvním zobrazení tabu | Rychlejší start aplikace, nižší spotřeba paměti | Střední |
| **W12** | P2 | Správnost | `parseCSDateTime` akceptuje neplatné dny (31. 2.) a hodiny (25:99) bez chyby | 3420–3450 | Ověřit platnost pomocí zpětné kontroly `dt.getDate() === day && dt.getMonth() === mon` | Zamezení tichého vkládání chybných záznamů | Nízká |
| **W13** | P2 | Správnost | `dewPoint()` s `RH = 0` vrátí NaN (logaritmus nuly) – nezachyceno | 3409–3413 | Přidat guard: `if (RH <= 0) return null;` | Zamezení NaN v grafech a zobrazení | Nízká |
| **W14** | P2 | Výkon | `buildHistoryRows()` prochází celé pole `store.rows` 4× s `forEach` pro každý offset | 3884–3899 | Jeden průchod s binárním hledáním v seřazeném poli | Zrychlení při velké historii | Nízká |
| **W15** | P2 | Správnost | `buildAgg()` pro "monthly" agreguje všechna měření daného měsíce všech let do jednoho klíče `M/YYYY`, ale denní klíč je `D.M.` (bez roku) – různé roky se slévají | 3864–3879 | Denní klíč rozšířit o rok, nebo agregovat vždy v rámci vybraného období | Správné denní průměry | Nízká |
| **W16** | P2 | UX | Konfigurační panel je chráněn klientským SHA-256 heslem – hash je přímo v HTML | 2787 | Dokumentovat, že jde o lokální UI bariéru, ne o bezpečnostní ochranu; zvážit přesun do `localStorage` | Jasné očekávání bezpečnosti | Nízká |
| **W17** | P2 | Stabilita | `fetchAllOv()` stahuje celou historii všech neaktivních stanic, ale potřebuje jen poslední řádek | 4812–4843 | Přidat GViz query `LIMIT 1 ORDER BY A DESC, B DESC` pro overview | Výrazně menší přenosy a rychlejší overview bar | Nízká |
| **P01** | P3 | Výkon | Cache dat per stanice v paměti – při přepínání se celá historie zahazuje a stahuje znovu | 2723 | Objekt `stationCaches[idx]` s daty a timestampem; invalidovat po timeoutu | Okamžité přepínání bez čekání na síť | Střední |
| **P02** | P3 | UX | Skeleton loading místo textu „Čekám na data…" | 2258, 2383 | CSS animované placeholder boxy | Vizuálně plynulejší dojem načítání | Nízká |
| **P03** | P3 | UX | Větší touch-targety na mobilních tlačítkách filtrů | 2422–2429, 831–834 | `padding: .45rem 1rem;` a `min-height: 44px` | Méně překliků na mobilech | Nízká |
| **P04** | P3 | UX | Indikátor stáří dat na hlavní kartě – vizuální varovný stav při datech starších 1 hodiny | 2227–2231 | Podmíněná CSS třída + textový badge „Data stará X minut" | Okamžitá informace o aktuálnosti | Nízká |
| **P05** | P3 | Funkce | Denní shrnutí – tepelný komfort (Heat Index / Wind Chill odhad z teploty a vlhkosti) | – | Doplnit výpočet vedle rosného bodu | Užitečná meteorologická informace | Nízká |
| **P06** | P3 | Funkce | Export dat do CSV/JSON z tabu Historie | 2583–2617 | Tlačítko „Stáhnout CSV" generující Blob | Snadnější offline práce s daty | Nízká |
| **P07** | P3 | Výkon | Downsampling pro rozsah „Vše" v Explorer – aktuální limit 800 bodů zahazuje extrémy | 4068–4073 | LTTB (Largest-Triangle-Three-Buckets) algoritmus zachovávající vizuální tvar | Přesnější vizualizace dlouhých rozsahů | Střední |
| **P08** | P3 | UX | Klávesová navigace mezi taby (← →) a přístupnost (role, aria-labels) | 4534–4551 | `role="tablist"`, `aria-selected`, handler `keydown` | Lepší přístupnost | Nízká |
| **P09** | P3 | Struktura | Duplicitní CSS pro popup (moon, sun, rise, uv) – 4× téměř identický blok | 932–1206 | Sdílená CSS třída `.info-popup` s variantami | Menší CSS, snazší údržba | Nízká |
| **P10** | P3 | Struktura | Duplicitní kód pro `drawSunArc()` a `drawRiseArc()` – téměř identické funkce | 3143–3301 | Jeden `drawSolarArc(canvasId, options)` | Méně kódu, snazší opravy | Nízká |
| **D01** | P4 | Struktura | HTML inline styly na desítkách elementů (`style="..."`) | Celý soubor | Přesunout do pojmenovaných CSS tříd | Čistší HTML, konzistence | Nízká |
| **D02** | P4 | Kód | `tryLoadConfigJson().then(loaded => { if (!loaded) startAll(); else startAll(); })` – obě větve dělají totéž | 4902–4905 | Zjednodušit na `.then(() => startAll())` | Čitelnost | Nízká |
| **D03** | P4 | Kód | Globální funkce registrované přes `onclick="..."` atributy | Celý soubor | Postupně nahrazovat `addEventListener` | Lepší izolace a testovatelnost | Střední |
| **D04** | P4 | UX | Chybí meta description a Open Graph tagy pro sdílení | 4–8 | Přidat `<meta name="description">` a OG tagy | Lepší SEO a zobrazení při sdílení odkazu | Nízká |
| **D05** | P4 | Kód | Komentář seriálu chart pluginů – prázdný blok `/* PLUGIN – jednotky nad osou Y */` bez implementace | 3753–3757 | Odstranit prázdný komentář nebo implementovat | Čistota kódu | Nízká |
| **D06** | P4 | Kód | `store._lastRawLine` porovnává celý řádek textu; shoda hlaviček může falešně indikovat „beze změn" | 3513 | Porovnávat parsovaný timestamp posledního záznamu | Spolehlivější detekce nových dat | Nízká |

---

## 2. Detailní popis kritických problémů (P1)

### W01 – Záměna dat při přepínání stanic

**Řádky:** [switchStation](file:///c:/Users/micha/OneDrive%20-%20CZU%20v%20Praze/7_Projects_3D/VS_code/index.html#L2717-L2732), [fetchSheets](file:///c:/Users/micha/OneDrive%20-%20CZU%20v%20Praze/7_Projects_3D/VS_code/index.html#L3462-L3544)

**Problém:** Funkce `switchStation()` vynuluje `store.rows` a spustí nový `fetchSheets()`, ale nezruší probíhající starý požadavek. Pokud starý fetch dorazí po přepnutí, zavolá `parseAndStore()`, který zapíše výsledek do aktuálního (ale jiného) `store.rows`. Navíc `_applyCfgObject()` (ř. 2872) zapisuje do `stations[activeIdx]`, kde `activeIdx` už může ukazovat na novou stanici.

**Reprodukční scénář:** Pomalá síť na stanici A → uživatel přepne na B → odpověď A dorazí → data A se zobrazí jako data B.

**Řešení:**
```javascript
let fetchAbort = null; // globální
function switchStation(idx) {
  if (fetchAbort) fetchAbort.abort();
  fetchAbort = new AbortController();
  const generation = ++fetchGeneration;
  // ...
  // v parseAndStore: if (generation !== fetchGeneration) return;
}
```

### W02 – Nesprávná URL inkrementální kontroly

**Řádek:** [3503](file:///c:/Users/micha/OneDrive%20-%20CZU%20v%20Praze/7_Projects_3D/VS_code/index.html#L3503)

**Problém:** `sheetsURL()` (ř. 3458) vrací URL obsahující `?tqx=out:csv&sheet=...`. Řádek 3503 přidává další `?tqx=out:csv&range=1:2`, čímž vzniká URL s dvěma `?` – parametr `range` se stane součástí hodnoty `sheet`.

**Řešení:** Sestavovat URL přes `new URL()` a `.searchParams`, nebo přidat `range` přes `&range=`.

### W03 – Falešně pozitivní `fullLoaded`

**Řádky:** [parseAndStore](file:///c:/Users/micha/OneDrive%20-%20CZU%20v%20Praze/7_Projects_3D/VS_code/index.html#L3569-L3617), [fetchSheets](file:///c:/Users/micha/OneDrive%20-%20CZU%20v%20Praze/7_Projects_3D/VS_code/index.html#L3532-L3534)

**Problém:** `parseAndStore()` odkládá zpracování přes `setTimeout(() => {...}, 10)` a nevrací Promise. Volající `fetchSheets()` ihned (ř. 3533) nastaví `store.fullLoaded = true` a spouští callbacky `_onFullLoad`. Pokud parser selže (např. špatný formát), aplikace se chová, jako by měla plnou historii.

**Řešení:** `parseAndStore()` musí vrátit Promise. `fullLoaded` nastavovat až po úspěšném `store.rows = parsed`.

### W04 – Nekompatibilita s novým tabulkovým schématem

**Řádek:** [3596](file:///c:/Users/micha/OneDrive%20-%20CZU%20v%20Praze/7_Projects_3D/VS_code/index.html#L3596)

**Problém:** Parser bere poznámku z `c[9]` (sloupec J). V novém Raw_Data schématu je v J rosný bod a poznámka až v R (index 17). Pouhé přepnutí názvu listu v konfiguraci by způsobilo zobrazení rosného bodu jako poznámky.

**Řešení:** Detekce schématu podle hlaviček nebo počtu sloupců; adaptér pro oba formáty.

### W05 – CSV parser nezvládá RFC 4180

**Řádky:** [splitCSV](file:///c:/Users/micha/OneDrive%20-%20CZU%20v%20Praze/7_Projects_3D/VS_code/index.html#L3621-L3629)

**Problém:** `splitCSV()` překlápí `inQ` na každé uvozovce. CSV hodnota `"a""b"` se zparsuje jako `ab` místo `a"b"`. Dělení po `\n` neumí víceřádkové buňky. Pro typická meteorologická data to nemusí vadit, ale poznámky mohou obsahovat uvozovky nebo nové řádky.

---

## 3. Detailní popis důležitých problémů (P2)

### W06 – UTC vs. lokální den

Funkce `toISOString().slice(0,10)` vrací UTC datum. Pro 20. 10. 2026 00:30 CEST vychází UTC datum 19. 10. – záznamy kolem půlnoci se přiřadí k nesprávnému dni.

**Výskyt:** `fetchUVData` (ř. 3375), `expSetToday` (ř. 3986), `expOneSetToday` (ř. 3996), `initCmpDays` (ř. 4270), `renderCmpDayBtns` (ř. 4278), `buildCompare` (ř. 4316).

**Řešení:**
```javascript
function localDateStr(d) {
  return d.getFullYear() + '-' + _pad2(d.getMonth()+1) + '-' + _pad2(d.getDate());
}
```

### W07 – Přetečení zásobníku při velkém poli

`Math.max(...temps)` rozbalí celé pole jako argumenty funkce. V8 má limit ~65 536 argumentů; u stanic s dlouhou historií (>65 000 záznamů) dojde k `RangeError`. V ročních statistikách (ř. 4589) je to již správně vyřešeno přes `reduce()`.

### W08 – MQTT memory leak

Každé volání `connectMQTT()` vytvoří nový `Paho.Client`. Při přepnutí stanice se starý klient neodpojí – zůstává aktivní, spotřebovává paměť a může přijímat zprávy pro nesprávnou stanici. MQTT zprávy se přidávají do `store.rows` bez limitu.

### W11 – Eager inicializace 8 grafů

Všech 8 instancí Chart.js se vytváří při startu (ř. 3776–4265), i když uživatel vidí pouze tab „Aktuálně". Každý graf alokuje canvas kontext a interní datové struktury.

**Řešení:** Vytvořit graf až při prvním zobrazení příslušného tabu.

### W17 – Overview bar stahuje celou historii

`fetchOvStation()` (ř. 4812) stahuje celý CSV soubor stanice (může být >1 MB) jen aby přečetl jeden řádek. U tří stanic to znamená zbytečný přenos ~3 MB při každém refresh cyklu (každých 5 min).

**Řešení:** Přidat GViz query `SELECT * ORDER BY A DESC, B DESC LIMIT 1`.

---

## 4. Návrhy nových funkcí (P3)

### P01 – Cache dat per stanice

Při přepínání stanic se nyní celá historie zahazuje a stahuje znovu. Cache v paměti (`stationCaches[idx]`) by umožnila okamžité přepnutí se zobrazením posledních známých dat a tichý refresh na pozadí.

### P04 – Indikátor stáří dat

Na hlavní teplotní kartě chybí vizuální upozornění, pokud jsou data stará. Navrhuju podmíněný badge/barvu:
- < 15 min: zelená tečka
- 15–60 min: žlutá tečka + text „Data stará X min"
- > 60 min: červená tečka + varování

### P06 – Export dat

V tabu Historie přidat tlačítko „Stáhnout CSV" generující soubor z `store.rows`. Jednoduchá implementace přes `Blob` + `URL.createObjectURL`.

### P07 – Downsampling LTTB

Aktuální downsampling (ř. 4068–4073) zahazuje každý n-tý bod, čímž může ztratit extrémy. Algoritmus LTTB (Largest-Triangle-Three-Buckets) zachovává vizuální tvar křivky.

---

## 5. Doporučený plán realizace

### Fáze 1: Kritické opravy (P1) — odhadovaná náročnost: 1–2 dny

1. **W01** – `AbortController` + generace požadavků při přepínání stanic
2. **W02** – Oprava sestavování URL inkrementální kontroly
3. **W03** – `parseAndStore()` vracející Promise; odložení `fullLoaded`
4. **W05** – Robustnější CSV parser (escapované uvozovky)
5. **W13** – Guard v `dewPoint()` pro `RH <= 0`

**Podmínky:**
- Žádná z oprav nesmí změnit formát dat ani konfiguraci stanic
- Testovatelné nezávisle na sobě
- Kompatibilní se stávajícím Google Sheets schématem

### Fáze 2: Důležité opravy (P2) — odhadovaná náročnost: 1–2 dny

1. **W06** – Helper `localDateStr()` nahrazující `toISOString().slice(0,10)`
2. **W07** – Nahrazení `Math.max/min(…spread)` za `reduce()` ve všech výskytech
3. **W12** – Validace data v `parseCSDateTime()`
4. **W09** – Timeout pro plné načtení
5. **W17** – GViz LIMIT pro overview bar
6. **W15** – Oprava denního klíče v `buildAgg()`
7. **D02** – Zjednodušení `tryLoadConfigJson().then()`

### Fáze 3: Optimalizace výkonu — odhadovaná náročnost: 2–3 dny

1. **W11** – Lazy inicializace Chart.js instancí
2. **P01** – Cache dat per stanice
3. **P07** – LTTB downsampling
4. **W14** – Optimalizace `buildHistoryRows()`

### Fáze 4: UX vylepšení — odhadovaná náročnost: 1–2 dny

1. **P03** – Větší touch-targety na mobilech
2. **P04** – Indikátor stáří dat
3. **P02** – Skeleton loading
4. **P06** – Export dat do CSV
5. **P08** – Klávesová navigace a přístupnost

### Fáze 5: MQTT a struktura — odhadovaná náročnost: 2–3 dny

1. **W08** – MQTT lifecycle management
2. **W10** – Exponenciální backoff pro MQTT reconnect
3. **P09** – Sdílené CSS pro popupy
4. **P10** – Sdílená funkce pro solar arc
5. **D01** – Refaktoring inline stylů

### Fáze 6: Nové schéma a budoucí funkce — po dohodě

1. **W04** – Adaptér pro nové Raw_Data schéma (závisí na finalizaci serverové strany)
2. **P05** – Tepelný komfort (Heat Index)
3. **D04** – SEO meta tagy
4. Případná PWA (service worker + manifest)

---

## 6. Poznámky ke stávajícímu dokumentu Navrhy_Vylepseni.md

Některé návrhy z původního dokumentu jsou již implementovány v aktuální verzi kódu:

| Původní návrh | Stav v kódu |
|---|---|
| Ukládání poslední stanice do localStorage | ✅ Implementováno (ř. 2709, `meteoActiveIdx`) |
| Tmavý/světlý režim | ✅ Implementováno (ř. 1208–1231, `setTheme()`) |
| Porovnání dnů (Overlap) | ✅ Implementováno (tab „Porovnání", ř. 2484–2519) |
| Cache dat – poznámka | ⚠️ Částečně – lazy loading existuje, ale cache per stanice ne |
| AbortController | ⚠️ Částečně – timeout je u quick load, ale ne abort při přepnutí |
| Rozdělení JS do modulů | ❌ Nezměněno – stále monolitický soubor |
| PWA | ❌ Nezměněno – chybí manifest a service worker |

---

## 7. Důležitá pravidla dodržená při auditu

- ✅ Žádné soubory nebyly upraveny
- ✅ Žádné commity nebyly vytvořeny
- ✅ Všechna zjištění jsou podložena konkrétními řádky kódu
- ✅ Tam, kde nelze ověřit statickou analýzou (např. skutečný přenos >65K záznamů), je to výslovně uvedeno
- ✅ Stávající funkční řešení nejsou zbytečně zpochybňována
- ✅ Zohledněno, že aplikace běží jako statický web na GitHub Pages
