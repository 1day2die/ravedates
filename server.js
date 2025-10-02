import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

function safeReadJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function loadRegionFile(filename) {
  const full = path.join(DATA_DIR, filename);
  if (!fs.existsSync(full)) return null;
  try {
    const raw = fs.readFileSync(full, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Fehler beim Lesen', filename, e.message);
    return null;
  }
}

function listRegions() {
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'votes.json')
    .map(f => path.basename(f, '.json'));
}

function initVotes() {
  if (!fs.existsSync(VOTES_FILE)) {
    fs.writeFileSync(VOTES_FILE, JSON.stringify({}, null, 2));
  }
}

function readVotes() {
  initVotes();
  try {
    return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function writeVotes(v) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(v, null, 2));
}

function eventKey(evt) {
  return evt.eventUrl || `${evt.eventName}_${evt.date}`;
}

// Hilfsfunktion: Prüft, ob ein Event vollständig in der Vergangenheit liegt.
// Regel:
// - Wenn endTime vorhanden: Event ist vorbei, wenn endTime < jetzt.
// - Sonst: nutze startTime oder als Fallback date. Ohne parsebares Datum => nicht filtern.
function isPastEvent(evt, nowTs = Date.now()) {
  if (!evt) return false;
  const endRef = evt.endTime || evt.startTime || evt.date;
  const endTs = Date.parse(endRef || 0);
  if (isNaN(endTs)) return false;
  return endTs < nowTs;
}

function augmentEventsWithVotes(region, events, votes) {
  const regionVotes = votes[region] || {};
  return events.map(e => ({
    ...e,
    voteId: eventKey(e),
    votes: regionVotes[eventKey(e)] || 0
  }));
}

app.get('/api/regions', (req, res) => {
  const regions = listRegions();
  res.json({ regions });
});

app.get('/api/region/:name', (req, res) => {
  const region = req.params.name;
  const fileName = region + '.json';
  const data = loadRegionFile(fileName);
  if (!data) return res.status(404).json({ error: 'Region nicht gefunden' });
  const votes = readVotes();
  let events = augmentEventsWithVotes(region, data, votes);
  // Vergangene Events rausfiltern
  const nowTs = Date.now();
  events = events.filter(ev => !isPastEvent(ev, nowTs));
  // Sortierung: frühestes (Start- oder Datum) zuerst
  events = events.sort((a, b) => {
    const ta = Date.parse(a.startTime || a.date || 0);
    const tb = Date.parse(b.startTime || b.date || 0);
    return ta - tb;
  });
  res.json({ region, events });
});

app.get('/api/top', (req, res) => {
  const limit = parseInt(req.query.limit || '5', 10);
  const votes = readVotes();
  const regions = listRegions();
  let all = [];
  regions.forEach(r => {
    const file = loadRegionFile(r + '.json') || [];
    const events = augmentEventsWithVotes(r, file, votes);
    all = all.concat(events.map(ev => ({ ...ev, region: r })));
  });

  // Nur Events mit votes > 0
  all = all.filter(ev => (ev.votes || 0) > 0);
  // Vergangene Events entfernen
  const nowTs = Date.now();
  all = all.filter(ev => !isPastEvent(ev, nowTs));

  all.sort((a, b) => {
    if ((b.votes || 0) !== (a.votes || 0)) return (b.votes || 0) - (a.votes || 0);
    if ((b.attending || 0) !== (a.attending || 0)) return (b.attending || 0) - (a.attending || 0);
    const ta = Date.parse(a.startTime || a.date || 0);
    const tb = Date.parse(b.startTime || b.date || 0);
    return ta - tb;
  });
  res.json({ top: all.slice(0, limit) });
});

app.post('/api/vote', (req, res) => {
  const { region, voteId } = req.body || {};
  if (!region || !voteId) return res.status(400).json({ error: 'region und voteId erforderlich' });
  const regions = listRegions();
  if (!regions.includes(region)) return res.status(400).json({ error: 'Unbekannte Region' });
  const votes = readVotes();
  if (!votes[region]) votes[region] = {};
  votes[region][voteId] = (votes[region][voteId] || 0) + 1;
  writeVotes(votes);
  res.json({ ok: true, votes: votes[region][voteId] });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server läuft auf Port', PORT));
