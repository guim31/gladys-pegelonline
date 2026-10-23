# PEGELONLINE

Holt die **Wasserstände der Bundeswasserstraßen** (Rhein, Elbe, Donau, Mosel, Main, Weser,
Oder, die Kanäle und die Küste: rund 800 Pegel) nach Gladys, aus **PEGELONLINE**, dem
Open-Data-Dienst der Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV). Kein Konto,
kein Schlüssel.

> **Rohdaten, kein Hochwasserwarndienst.** Die Daten können verspätet, lückenhaft oder falsch
> sein, und die Integration hängt von deinem Gladys, deinem Internetzugang und einem
> öffentlichen Dienst ab. Bei Hochwasser gelten die amtlichen Warnungen (Hochwassernachrichtendienst
> deines Landes, deine Gemeinde, 112). Diese Integration ist nicht mit der WSV verbunden.

## Was du bekommst

- **Ein Gerät pro verfolgtem Pegel**: der **Wasserstand** (in cm, wie auf
  pegelonline.wsv.de), der **Abfluss** in m³/s, die **Wasser- und Lufttemperatur**, wenn der
  Pegel sie misst, die **Wasserstandslage** (niedrig, normal, hoch) und der
  **Schifffahrtswasserstand** (unter oder über dem höchsten Schifffahrtswasserstand HSW), wenn
  der Pegel diese Kennwerte hat, und das Datum der letzten Messung.
- Ein Pegel, der nichts mehr sendet, wird als solcher angezeigt („Keine neue Messung seit…“):
  Ein alter Wert wird nie wieder als frischer gesendet.
- Vier **Szenenauslöser**: Die Lage ändert sich (niedrig, normal, hoch), ein kennzeichnender
  Wasserstand wird überschritten (Mittelwasser, mittleres Hochwasser, Hochwassermarken I und
  II am Rhein…), der Wasserstand steigt über den höchsten Schifffahrtswasserstand und fällt
  wieder darunter.
- Ein **Dashboard-Widget**: deine Pegel, ihr Wasserstand, seine Tendenz (steigt,
  gleichbleibend, fällt) und ihre Lage.
- Ein Button **„Stationen suchen“**, der die Pegel rund um dein Haus, nach Name, nach Gewässer
  oder nach Nummer mit ihrem aktuellen Wasserstand auflistet.

## Voraussetzungen

- Gladys Assistant **5.1.0** oder neuer.
- Internetzugang von Gladys aus: Die Integration liest `www.pegelonline.wsv.de`.
- Für „Rund um mein Haus“: der Standort deines Hauses in Gladys (Einstellungen, Häuser). Die
  Integration fragt bei der Installation danach (Berechtigung „Standort“). Er wird nur im
  Container genutzt, um die nächsten Pegel zu finden: nie an PEGELONLINE gesendet (das nur sieht, welche nahen Pegel abgefragt werden), nie
  gespeichert und nie protokolliert.
- Nur Deutschland: PEGELONLINE deckt die Bundeswasserstraßen ab, nicht die kleineren Gewässer
  der Länder.

## Konfiguration

### Einstellungen

| Einstellung                | Wirkung                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Stationen                  | Pegelnummern oder Stationsnamen, durch Kommas getrennt: `2730010, Kaub, Passau Donau`. Die Adresse einer Pegelseite geht auch. |
| Rund um mein Haus          | Verfolgt zusätzlich die 3 nächsten Pegel, die Messwerte senden, im Umkreis von 10, 20 oder 50 km um dein Haus.                 |
| Aktualisierungsintervall   | 15, 20 oder 30 Minuten. Eine einzige Anfrage deckt alle Stationen ab.                                                          |
| Sprache der Funktionsnamen | Namen der Funktionen neuer Geräte (Wasserstand, Abfluss…) und Sprache des Textes „Letzte Messung“ und der Szenenvariablen.     |

Speichere, öffne dann den Tab **Entdecken** der Integration und lege die gewünschten Geräte an.
Eine verfolgte Station bleibt verfolgt, solange ihr Gerät existiert, auch wenn du sie aus der
Konfiguration entfernst.

### Deine Stationen finden

Klicke in der Konfiguration auf **„Stationen suchen“**. Lass das Feld leer, um die Pegel rund
um dein Haus aufzulisten (20 km oder die gewählte Entfernung), oder gib ein:

- einen Stationsnamen: `Köln`, `Koeln` oder `KÖLN` (Groß- und Kleinschreibung, Akzente und
  Umlaute werden ignoriert);
- ein Gewässer: `Rhein`, `Mosel`, `Elbe` (die 10 nächsten oder die ersten 10 in Flussrichtung);
- beides: `Rhein Bonn`;
- eine Pegelnummer: `2730010`.

Jede Zeile nennt Nummer, Name, Gewässer und Flusskilometer, die Entfernung zu deinem Haus und
den aktuellen Wasserstand oder „keine aktuelle Messung“. Kopiere die Nummern in „Stationen“ und
speichere.

## Geräte

| Funktion                      | Typ in Gladys            | Wert                                                                                                                    |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Wasserstand                   | Flüssigkeitstiefe (cm)   | Stand über dem Pegelnullpunkt in cm; in m bei den wenigen Pegeln mit Höhenbezug.                                        |
| Abfluss (m³/s)                | Wasserdurchfluss         | In m³/s (Gladys kennt keine Einheit m³/s: Der Name sagt es).                                                            |
| Wassertemperatur              | Temperatur (°C)          | Wenn der Pegel sie misst.                                                                                               |
| Lufttemperatur                | Temperatur (°C)          | Wenn der Pegel sie misst.                                                                                               |
| Wasserstandslage (MNW/MHW)    | Flüssigkeitsstand-Status | Niedrig unter dem mittleren Niedrigwasserstand (MNW), Hoch über dem mittleren Hochwasserstand (MHW), Normal dazwischen. |
| Schifffahrtswasserstand (HSW) | Flüssigkeitsstand-Status | Hoch über dem höchsten Schifffahrtswasserstand (HSW), Normal darunter.                                                  |
| Letzte Messung                | Text                     | Datum der letzten Messung oder „Keine neue Messung seit…“.                                                              |

Eine Funktion gibt es nur, wenn der Pegel sie liefert. Der **Wasserstand ist keine
Wassertiefe**: Er ist die Ablesung der Pegellatte über ihrem eigenen Nullpunkt. Vergleiche ihn
mit den Kennwerten desselben Pegels (auf seiner PEGELONLINE-Seite), nicht mit einem anderen
Pegel. Die Geräteparameter enthalten die UUID der Station, ihre Nummer, ihr Gewässer und ihren
Flusskilometer.

Wasserstand, Abfluss und Temperaturen sind numerische Funktionen: Gladys-Szenen können sie
schon mit einem eigenen Wert vergleichen („Wasserstand über 650 cm“).

## Dashboard-Widget

Füge das Widget **PEGELONLINE** zu einem Dashboard hinzu.

- **Ohne Einstellung**: eine Zeile pro verfolgtem Pegel (höchstens 10) mit Wasserstand und
  Tendenz, gefärbt nach seiner Lage: blau niedrig, grün normal, rot hoch oder über dem
  Schifffahrtswasserstand, grau ohne Lage oder ohne aktuelle Messung. Eine Überschrift nennt
  die Pegel mit Hochwasser.
- **Mit gewählter Station**: ihr Wasserstand, Abfluss und ihre Wassertemperatur live, dann
  Lage, Schifffahrtswasserstand, Tendenz und letzte Messung sowie ein Link zu ihrer
  PEGELONLINE-Seite.

## Szenenauslöser

| Auslöser                                          | Filter                                                   | Variablen                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Wasserstandslage ändert sich                      | Station, neue Lage (niedrig, normal, hoch)               | Name der Station, Gewässer, Wasserstand, Einheit, Lage, vorherige Lage (Kürzel und ausgeschrieben) |
| Kennzeichnender Wasserstand überschritten         | Station, Wert, Richtung (steigt darüber, fällt darunter) | Name der Station, Gewässer, Wasserstand, Einheit, Kürzel und Name des Werts, seine Höhe, Richtung  |
| Höchster Schifffahrtswasserstand überschritten    | Station                                                  | Name der Station, Gewässer, Wasserstand, Einheit, HSW                                              |
| Wieder unter dem höchsten Schifffahrtswasserstand | Station                                                  | Name der Station, Gewässer, Wasserstand, Einheit, HSW                                              |

Die angebotenen Werte: NNW (niedrigster bekannter), MNW (mittlerer Niedrigwasserstand), MW
(Mittelwasser), MHW (mittlerer Hochwasserstand), Hochwassermarken I und II (Rhein: Schifffahrt
eingeschränkt, dann eingestellt) und HHW (höchster bekannter). Ein Pegel löst nur die Werte aus,
die er hat. Das Fallen zählt, sobald der Wasserstand 2 cm unter dem Wert liegt, und erst danach kann ein neuer Anstieg zählen: Ein Wasserstand, der um einen Wert pendelt, löst nur einmal aus. Die Lagen kommen von
PEGELONLINE selbst.

Die Auslöser feuern nur für ein angelegtes Gerät, bei einer frischen Messung und nicht nach
einem Neustart von mehr als einem Tag.

## Szenenbeispiele

- **Rheinhochwasser**: „Kennzeichnender Wasserstand überschritten“, Station Köln, Wert
  „Hochwassermarke I“, steigt darüber → Nachricht senden: „{{station_name}}: {{height}}
  {{unit}}, über {{mark_name}}“.
- **Kellerwache**: „Wasserstandslage ändert sich“, dein Pegel, neue Lage Hoch → die
  Steckdose der Pumpe einschalten und die Familie benachrichtigen.
- **Bootsausflug**: „Höchster Schifffahrtswasserstand überschritten“, Station Kaub →
  Nachricht „Keine Schifffahrt: {{river}}“; „Wieder unter dem höchsten
  Schifffahrtswasserstand“ → „Schifffahrt wieder frei“.
- **Niedrigwasser**: „Wasserstandslage ändert sich“, neue Lage Niedrig → eine Erinnerung, die
  Festmacher zu prüfen.

## Datenquellen, Lizenz und Kontingente

- Daten: **PEGELONLINE**, Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), Lizenz
  **DL-DE->Zero-2.0** (freie Nutzung, keine Namensnennung nötig; das Widget nennt die Quelle
  trotzdem).
- Die Werte sind **Rohdaten**, veröffentlicht vor jeder Prüfung durch die WSV, die sie später
  noch korrigieren kann.
- Kein Konto, kein Schlüssel, kein dokumentiertes Kontingent. Die Integration bleibt sparsam:
  **eine Anfrage pro Aktualisierung** für alle verfolgten Pegel (standardmäßig 15 Minuten, das
  Messintervall) und die Stationsliste (etwa 300 kB) einmal pro Woche, nur wenn Namen, Nummern
  oder „Rund um mein Haus“ sie brauchen.

## Fehlerbehebung

- **„Unbekannte Station“**: Prüfe die Schreibweise oder nutze „Stationen suchen“ und kopiere
  die Nummer.
- **„PEGELONLINE antwortet nicht“**: Der Dienst oder dein Internetzugang ist ausgefallen; die
  Werte kommen von selbst zurück.
- **„Rund um mein Haus“ fügt nichts hinzu**: Gib deinem Haus einen Standort (Einstellungen,
  Häuser) oder wähle eine größere Entfernung: Deutsche Pegel können weit auseinander liegen.
- **Keine Wasserstandslage, kein Schifffahrtswasserstand**: Der Pegel hat keinen Kennwert
  MNW/MHW oder HSW (Seen, Talsperren, viele Tidepegel).
- **„Keine neue Messung seit…“**: Der Pegel sendet verspätet oder gar nicht; manche senden
  ihre Werte gebündelt, einige Stunden später.
- Protokolle: in Gladys die Protokolle der Integration; `LOG_LEVEL=debug` zeigt jeden Zyklus.

## Grenzen

- Keine Hardware nötig; getestet mit dem echten Dienst und mit aufgezeichneten Antworten, aber noch nicht in einer echten Gladys-Installation: Rückmeldungen willkommen.
- Nur Bundeswasserstraßen: keine Pegel der Landesdienste (zum Beispiel des Hochwassernachrichtendienstes
  Bayern oder der Hochwasservorhersagezentrale Baden-Württemberg).
- Keine Vorhersagen: PEGELONLINE veröffentlicht nur Messwerte.
- Höchstens 20 Stationen aus der Konfiguration (plus die, deren Gerät du angelegt hast).
- Die Funktionsnamen werden beim Anlegen des Geräts festgelegt: Eine spätere Änderung der
  Sprache ändert nur die danach gesendeten Texte.
