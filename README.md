# 5 Pollar – Unternehmensanalyse in fünf Säulen

Umgesetzt mit dem KI-Werkzeug Claude Code (No-Code). Anforderungen, Fachinhalte und Prüfung: Farhad Javanmardi.

## Was die App macht

Unternehmen geben einmal ihre Grunddaten ein: Art des Geschäfts, Preis, heutiger Absatz, Ziel, Kosten, Kapital, Genehmigungen. Die App analysiert mit KI fünf Säulen:

1. **Machbarkeit**: Ist das Vorhaben umsetzbar, und unter welchen Bedingungen?
2. **Businessplan**: Gesamtbild für Inhaber, Partner oder Investoren
3. **Marketing**: Kunden gewinnen, mit tragbaren Kosten
4. **Betriebshandbuch**: Abläufe, Qualitätsstandards, Checklisten
5. **Finanzplan**: 36-Monats-Modell, Break-even, Amortisation, Szenarien

Am Ende stehen ein **Urteil** (umsetzen / mit Auflagen / Hindernis vor dem Start) und ein **Fortschrittsplan** für 30, 60 und 90 Tage sowie 12 Monate, mit Ampel-Kennzahlen.

## So funktioniert es

- **Für jede Branche:** Zehn Vorlagen (Café, Restaurant, Friseursalon, Laden, Schule, Unterkunft, Dienstleistung, Online-Abo, Produktion, Sonstiges) füllen das Formular mit typischen Startwerten. Die Werte sind ausdrücklich als Beispiele gekennzeichnet und werden durch die eigenen Zahlen ersetzt.
- **Zahlen rechnet der Code, nicht die KI.** Ein Finanzmodul berechnet alle Kennzahlen Monat für Monat. Bilanz und Monatssummen werden automatisch geprüft.
- **Die KI schreibt nur Texte, unter festen Regeln:** keine erfundenen Zahlen, keine erfundenen Studien, keine Werkzeuge, die im Land des Unternehmens nicht verfügbar sind. Jede Zahl im KI-Text, die nicht aus dem Finanzmodul stammt, wird automatisch markiert.
- **Selbstprüfung:** Nach jeder Säule bewertet die KI ihren eigenen Text (0–100) und listet Schwächen auf.
- **Mindestgrenzen statt Durchschnitt:** Fehlt eine Pflichtgenehmigung oder wird die Liquidität negativ, lautet das Urteil „Hindernis“, egal wie gut der Rest aussieht.

Die Oberfläche ist auf Persisch (von rechts nach links).

## Stand

- Prototyp, funktionsfähig.
- Komplett getestet mit einer simulierten KI-Schnittstelle (alle fünf Säulen, Urteil, Fortschrittsplan, Speichern, Smartphone-Ansicht), dazu 23 automatische Tests. Ein Durchlauf mit dem echten Claude-API-Schlüssel steht noch aus.
- Noch keine öffentliche Live-Version. Grund: Jede Analyse kostet API-Guthaben, und es gibt noch keine Benutzeranmeldung.

## Starten

Voraussetzungen: Node.js ab Version 22.9 und ein API-Schlüssel von [platform.claude.com](https://platform.claude.com).

```bash
npm install
cp .env.example .env      # API-Schlüssel in .env eintragen
npm start
```

Dann im Browser öffnen: http://127.0.0.1:3000

Projekte werden im Browser gespeichert. „Bericht herunterladen“ erzeugt eine HTML-Datei mit allen fünf Säulen.

## Tests

```bash
npm test
```

23 automatische Tests, ohne echten API-Schlüssel und ohne Kosten:

- **Finanzmodul:** Für alle zehn Vorlagen geht die Bilanz in jedem Monat auf, und die Monate ergeben die Jahressummen. Break-even, Kapazitätsgrenze, Amortisation, Liquiditätswarnung und Pflichtgenehmigungen werden mit festen Zahlen geprüft.
- **Server:** gegen eine simulierte Claude-API. Geprüft werden normale Antworten, unlesbare Antworten, Ablehnungen, ein fehlender Schlüssel und der Schutz vor Pfad-Tricks.

Die Tests laufen bei jeder Änderung automatisch auf GitHub (GitHub Actions).

## Aufbau

| Datei | Aufgabe |
|---|---|
| `app.html` | Die ganze App: Formular, Vorlagen, Finanzmodul, Säulen, KI-Anweisungen, Urteil, Fortschrittsplan |
| `server.js` | Liefert die Seite aus und leitet Anfragen an die Claude-API weiter. Der API-Schlüssel bleibt auf dem Server. |
| `public/claude-shim.js` | Verbindet die Seite mit dem eigenen Server und speichert im Browser |
| `build-page.js` | Erzeugt `public/index.html` aus `app.html` (`npm run build:page`) |

## Grenzen

- Keine Benutzeranmeldung: nur lokal betreiben (Standard: `127.0.0.1`).
- Eine vollständige Analyse sind etwa 15 Anfragen an die Claude-API; die Kosten laufen über den eigenen API-Schlüssel.
