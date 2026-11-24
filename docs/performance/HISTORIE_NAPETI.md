# Výběr historie napětí

METEO-008 a METEO-046, v0.21.7. Výchozí revize `3ae01f8`.

Záložka Srážky & Baterie nyní počítá regresní přímku ze všech platných hodnot od
hranice tří dnů před časem prohlížeče včetně hraničního času. Zobrazuje
stejných nejvýše 500 naměřených bodů. Dosavadní dolní časová hranice se
zachovává včetně chování u záznamů s časem v budoucnosti. Jde o lineární
extrapolaci bez ověřené spolehlivosti na skutečné baterii.

Pro sestupně seřazené Sheets se pro graf vybírá začátek historie do času
500. platného měření včetně všech záznamů se shodným časem. Stabilní řazení
a konečný výběr proto zachovávají původní shody. Pro regresi se hranice
vyhledá binárně. Zobrazený výřez může obsahovat i starší platné body.
MQTT a kombinovaný režim dál procházejí celou historii kvůli možnému
odlišnému pořadí. Průzkumník už měl plný vstup regrese. Jeho větev používá
stejný výpočet jako dosud s jedním zachycením časové hranice.

Chybějící senzor dá prázdné řady, nula je platná hodnota. Ukončení výběru
pro Sheets závisí na hustotě platných měření a délce shody na hranici.
Při dlouhé shodě může dosavadní stabilní řazení zpracovat celý vstup.

## Měření

Offline Chromium se skutečným Chart.js 4.4.0, šířka 390 px a zpomalení
procesoru ×4. V obou verzích historie obsahuje minutové záznamy a některá
napětí chybí. Stejný pevný čas prohlížeče, osm opakování po zahřátí,
střídání verzí. První vykreslení používá hotovou cache denních agregací.
Samostatný model měří výběr, regresi a formátování řad bez Chart.js.

| Řádky | Model napětí před → po (ms) | První vykreslení záložky před → po (ms) |
| ---: | ---: | ---: |
| 400 | 1 → 1 | 81 → 73 |
| 100 000 | 63 → 3 | 147 → 107,5 |
| 250 000 | 144 → 4 | 251 → 138 |

Tabulka uvádí mediány. Obě verze zobrazily stejné naměřené body i hodnoty
srážek. Výstup nové predikce se přesně shodoval se společným výpočtem nad
celou historií. Rozdíl vůči původní predikci je při více než 500 platných
nedávných měřeních očekávaný. Profil měří práci v prohlížeči se syntetickými
daty. Přenos a Web Vitals se neměřily.

## Ověření

Prošlo 483/483 testů Node. Regrese kontrolují běžný vstup přes záložku, stabilní výběr při
shodných časech, včetně vzorků přesně na třídenní hranici, a neuspořádaný
vstup MQTT a kombinovaného režimu. Chromium s konfiguracemi Sheets ověřil
vliv dřívějších měření na predikci, shodu 500 vykreslených bodů, přepínání
záložek, první otevření na 320 px a nulový přírůstek požadavků po načtení
historie. Samostatná kontrola Moderního přehledu 2 ověřila navigaci a údaje
všech tří stanic.
