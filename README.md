# Rave Dates (Friends Edition)

Kleine Node/Express App + Vanilla Frontend (Tailwind via CDN) zum Anzeigen von Rave-Events (aus JSON-Dateien in `data/`) mit einfachem Voting-System.

## Features
- Automatische Region-Erkennung (alle `*.json` in `data/` außer `votes.json`)
- Collapsible Cards je Region
- Event-Liste (Name, Datum, Venue, Genres, Votes)
- Vote-Button (Votes in `data/votes.json` persistent, no auth)
- Top Events Übersicht (kombiniert über alle Regionen, Sortierung: Votes > attending > Datum)
- Modal mit vollständigen Event-Infos (Artists, Lineup, Zeiten, Genres, URL)
- LocalStorage Markierung: Bereits gevotete Events (Button deaktiviert)
- Dark Neon Branding (dynamische Glow-Effekte, Gradient Hintergrund)
- Live Filter Bar:
  - Volltext-Suche (Name, Venue, Genres, Artists, Lineup)
  - Genre-Dropdown (automatisch aus allen Events gesammelt)
  - Reset-Button

## Filter / Suche
Die Suche arbeitet case-insensitive über Eventname, Venue, Genres, Artists sowie `lineupParsed`.
Der Genre-Filter wirkt additiv zur Suche ("UND" Logik). Mit Reset werden beide zurückgesetzt.

## Ordnerstruktur
```
/data
  darmstadt.json
  ffm.json
  votes.json        # wird automatisch aktualisiert
/public
  index.html        # UI mit Tailwind (CDN)
  app.js            # Frontend Logik (Suche, Filter, Modal, Votes)
server.js            # Express Backend
package.json
Dockerfile
```

## Start (lokal)
Voraussetzung: Node.js >= 18

```bash
npm install
npm start
# Browser: http://localhost:3000
```

## Docker
Build & Run:
```bash
docker build -t ravedates .
docker run --rm -p 3000:3000 --name ravedates ravedates
```
Nach Codeänderungen neu bauen (Layer Cache berücksichtigt package.json separat).

## API Endpoints
- `GET /api/regions` -> `{ regions: ["ffm", "darmstadt", ...] }`
- `GET /api/region/:name` -> `{ region, events: [...] }` (Events bereits inkl. `voteId` & `votes`, nach Startzeit sortiert)
- `GET /api/top?limit=6` -> `{ top: [...] }`
- `POST /api/vote` Body: `{ "region": "ffm", "voteId": "<eventKey>" }`

`voteId` Server-Strategie: `eventUrl` oder Fallback `eventName_date`.

## Neue Region hinzufügen
1. Datei `data/<region>.json` anlegen (Array von Event-Objekten wie bestehende Dateien)
2. Seite neu laden – Region erscheint automatisch

## Datenmodell Event (Beispiel Felder)
```
{
  "eventName": string,
  "date": ISO-DateTime (nur Datum relevant),
  "startTime": ISO,
  "endTime": ISO,
  "artists": string[],
  "genres": string[],
  "lineupRaw": string,
  "lineupParsed": string[],
  "venue": string,
  "eventUrl": string,
  "attending": number
}
```

## Erweiterungsideen
- Markierung & Undo von Votes (mit Timestamp / Double-Click Undo)
- Sortier-Optionen (Datum, Votes, Venue)
- Tag/Datum-Range Filter
- Export/Share Deep-Link (URL Hash für Event Modal)
- Server-seitiges Rate-Limiting / Fake-Vote Schutz
- Persistenz via SQLite, danach REST/GraphQL API
- Deploy (Render / Fly.io / Railway / Docker Compose)
- PWA (Offline-Cache der JSON & Votes in IndexedDB Sync)

## Bekannte Limitierungen
- Mehrfaches Voten durch Reload möglich (Konzept: bewusst low friction)
- Keine Validierung fehlerhafter JSON-Dateien -> Region lädt einfach nicht
- `voteId` kann theoretisch kollidieren bei identischer `eventUrl`/Name+Datum in einer Region

## Changelog (Kurz)
- v1.0 Grundgerüst
- v1.1 LocalStorage Vote-Status + Sortierung
- v1.2 Dark Neon Branding + Such- & Genre-Filter

Viel Spaß & good vibes! ⚡🎶
