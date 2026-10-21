# Přehled změn

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
