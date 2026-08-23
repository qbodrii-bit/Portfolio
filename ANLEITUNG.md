# Anleitung — Website selbst bearbeiten

Die Website wird über **Pages CMS** bearbeitet. Kein Programm installieren, alles im Browser.

## Einmalig einrichten

1. [pagescms.org](https://pagescms.org) öffnen und **Sign in with GitHub** wählen.
2. Den Zugriff auf das Repository `qbodrii-bit/Portfolio` erlauben.
3. Danach erscheint das Projekt in der Übersicht. Ab jetzt reicht der Login.

## Was sich bearbeiten lässt

| Bereich | Was darin steht |
|---|---|
| **Arbeiten** | Alle Werke: Titel, Jahr, Material, Technik, Werktext, Bilder |
| **Künstlerin / CV** | Kurztext, Ausbildung, Ausstellungen, E-Mail |
| **Startseite** | Bild auf der Startseite und die Zeile unter dem Namen |

Jedes Feld gibt es zweimal: deutsch und englisch. Das englische Feld füllt die
EN-Ansicht der Website. Bleibt es leer, steht dort nichts.

## Eine neue Arbeit anlegen

1. **Arbeiten → Add entry**.
2. Dateiname vergeben — klein, ohne Umlaute, mit Bindestrichen: `haeutung-reispapier`.
   Er wird zur Adresse der Werkseite und lässt sich später nicht mehr ändern.
3. **Reihenfolge**: kleinere Zahl steht auf der Work-Seite weiter oben.
4. Felder ausfüllen, Bilder über **Bilder → +** hochladen.
   Die Reihenfolge der Bilder ist die Reihenfolge auf der Werkseite.
   Fotos dürfen direkt aus der Kamera kommen — sie werden automatisch verkleinert.
5. **Save**.

Eine Bildunterschrift ist nur bei Serien nötig (wie bei *Street Food*, wo jedes
Foto einen eigenen Titel hat). Sonst leer lassen.

## Nach dem Speichern

Die Seiten werden automatisch neu gebaut, das dauert ein bis zwei Minuten.
Danach ist die Änderung auf der Website zu sehen. Es ist nichts weiter zu tun.

## Besser nicht anfassen

- Alle `.html`-Dateien — die werden automatisch erzeugt und beim nächsten
  Speichern überschrieben.
- Die Ordner `scripts/` und `content/source/`.

`content/source/` ist das Archiv: das Original-PDF des Portfolios und die
hochauflösenden Fotos. Nichts davon steht auf der Website, es liegt nur sicher
an einem Ort.

## Noch offen

- Die **englischen Texte** sind maschinell übersetzt und nicht geprüft.
- **Ausstellung 2026**: `Momentaufhanme / Atelieraltesthonet` — vermutlich
  *Momentaufnahme, Atelier Altes Thonet*. Bitte korrigieren.
- Die drei **Videoarbeiten** zeigen bisher nur Standbilder. Für echte Videos
  wäre ein Vimeo- oder YouTube-Link nötig.
- Der Kurztext auf der Biografie-Seite ist aus dem Lebenslauf zusammengestellt.
  Wenn es einen eigenen Text gibt, gehört er dorthin.
