const regionsContainer = document.getElementById('regionsContainer');
const topEventsContainer = document.getElementById('topEvents');
const refreshTopBtn = document.getElementById('refreshTop');

const modal = document.getElementById('eventModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

const searchInput = document.getElementById('searchInput');
const genreSelect = document.getElementById('genreSelect');
const clearFiltersBtn = document.getElementById('clearFilters');
// Neue Date-Filter Inputs
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');
const dateQuickBtns = document.getElementById('dateQuickBtns');

// Neon-Farbpalette für Genres und Locations
const NEON_COLORS = [
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40', glow: 'shadow-cyan-500/25' },
  { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/40', glow: 'shadow-pink-500/25' },
  { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/40', glow: 'shadow-green-500/25' },
  { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40', glow: 'shadow-orange-500/25' },
  { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', glow: 'shadow-purple-500/25' },
  { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/40', glow: 'shadow-yellow-500/25' },
  { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/40', glow: 'shadow-red-500/25' },
  { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40', glow: 'shadow-blue-500/25' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40', glow: 'shadow-indigo-500/25' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/25' },
  { bg: 'bg-lime-500/20', text: 'text-lime-300', border: 'border-lime-500/40', glow: 'shadow-lime-500/25' },
  { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/40', glow: 'shadow-teal-500/25' }
];

// Cache für Genre/Location-Farben
const colorCache = new Map();

function getColorForText(text) {
  if (colorCache.has(text)) {
    return colorCache.get(text);
  }

  // Einfacher Hash-Algorithmus für konsistente Farbzuweisung
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const colorIndex = Math.abs(hash) % NEON_COLORS.length;
  const color = NEON_COLORS[colorIndex];
  colorCache.set(text, color);
  return color;
}

function createNeonTag(text, type = 'genre', keyForColor = null) {
  // keyForColor erlaubt es, einen stabilen Farb-Key zu nutzen (z.B. Venue ohne Datum)
  const color = getColorForText(keyForColor || text);

  if (type === 'venue') {
    return `<span class="inline-block text-xs px-3 py-1 border-l-2 ${color.bg} ${color.text} ${color.border} ${color.glow} shadow-md font-bold uppercase tracking-wide">${escapeHtml(text)}</span>`;
  } else {
    // Text mittig zentrieren via inline-flex, fixe Breite für einheitlichen Stack
    return `<span class="inline-flex items-center justify-center text-center text-xs px-2 py-1 rounded-full border ${color.bg} ${color.text} ${color.border} ${color.glow} shadow-sm font-medium w-[110px] whitespace-normal break-words leading-tight">${escapeHtml(text)}</span>`;
  }
}

function createVenueBadge(venueName, dateStr, opts = {}){
  const { fullWidth = false } = opts;
  const color = getColorForText(venueName);
  const safeVenue = escapeHtml(`Club: ${venueName}`);
  const safeDate = escapeHtml(dateStr || '-');
  // Breitere Badge (~40% Container) bei nicht-fullWidth
  const widthClass = fullWidth ? 'w-full' : 'w-[40%] min-w-[240px] venue-fade-badge';
  return `<span class="${widthClass} relative inline-flex flex-col justify-start text-xs px-3 py-1 border-l-2 ${color.bg} ${color.text} ${color.border} ${color.glow} shadow-md font-bold uppercase tracking-wide whitespace-normal break-words">`+
         `<span class="leading-snug">${safeVenue}</span>`+
         `<span class="mt-0.5 text-[12px] font-semibold normal-case tracking-normal opacity-95">${safeDate}</span>`+
         `</span>`;
}

const state = {
  regions: [],
  eventsByRegion: {},
  filters: {
    search: '',
    genres: [], // leeres Array => alle Genres erlaubt
    dateFrom: null, // Format YYYY-MM-DD
    dateTo: null
  },
  collectedGenres: new Set()
};

// Hilfsfunktion: Event ist vergangen, wenn endTime/sonst startTime/date < jetzt
function isPastEvent(ev, nowTs = Date.now()) {
  if (!ev) return false;
  const ref = ev.endTime || ev.startTime || ev.date;
  if (!ref) return false;
  const ts = Date.parse(ref);
  if (isNaN(ts)) return false;
  return ts < nowTs;
}

// LocalStorage Handling für bereits gevotete Events
const VOTED_KEY = 'votedEvents';
function loadVotedSet() {
  try {
    const raw = localStorage.getItem(VOTED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) { return new Set(); }
}
function persistVoted(set) {
  try { localStorage.setItem(VOTED_KEY, JSON.stringify([...set])); } catch (_) {}
}
let votedSet = loadVotedSet();

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadRegions() {
  const { regions } = await fetchJSON('/api/regions');
  state.regions = regions.sort();
  renderRegionsSkeleton();
  // Alle Regionen direkt (parallel) laden, damit Filter/Genres vollständig sind
  await Promise.all(state.regions.map(r => loadRegionEvents(r).catch(err => {
    console.error('Region Laden fehlgeschlagen', r, err);
  })));
  // Nach vollständigem Laden Genres/Filter aktualisieren
  rebuildGenreSelect();
  applyFiltersAndRenderAll();
  // Top Events unabhängig laden
  await loadTopEvents();
}

async function loadRegionEvents(region) {
  try {
    const data = await fetchJSON(`/api/region/${region}`);
    if (!data || !Array.isArray(data.events)) {
      console.warn('Keine events-Struktur empfangen für Region', region, data);
      state.eventsByRegion[region] = [];
    } else {
      state.eventsByRegion[region] = data.events;
      data.events.forEach(ev => (ev.genres || []).forEach(g => state.collectedGenres.add(g)));
    }
    renderRegion(region);
  } catch (e) {
    console.error('Fehler beim Laden Region', region, e);
    const container = document.querySelector(`[data-region-content="${region}"]`);
    if (container) container.innerHTML = '<div class="p-4 text-xs text-red-400">Fehler beim Laden.</div>';
    throw e;
  }
}

function renderTopEvents(events) {
  const nowTs = Date.now();
  events = (events || []).filter(ev => !isPastEvent(ev, nowTs));
  topEventsContainer.innerHTML = '';
  if (!events.length) {
    topEventsContainer.innerHTML = '<p class="text-neutral-400 text-sm">Noch keine Votes.</p>';
    return;
  }
  events.forEach(ev => {
    const card = document.createElement('div');
    // Extra pt-7 damit die absoluten Badges oben rechts Platz haben
    card.className = 'relative rounded-lg border border-fuchsia-600/40 bg-neutral-800/60 p-4 pt-7 flex flex-col gap-3 hover:border-fuchsia-400 transition shadow-neon-pink';

    const genreTags = (ev.genres || []).slice(0,3).map(g => createNeonTag(g, 'genre')).join(' ');
    const dateFormatted = formatDate(ev.date);
    const venueLabel = ev.venue ? `Club: ${ev.venue}` : 'Event';

    const colorKey = ev.venue || 'Event';
    const colorForVenue = getColorForText(colorKey);
    const combinedBadge = `<div class="w-full flex justify-between items-center text-xs pl-3 pr-1 py-1 border-l-2 ${colorForVenue.bg} ${colorForVenue.text} ${colorForVenue.border} ${colorForVenue.glow} shadow-md font-bold tracking-wide rounded-sm overflow-hidden">`+
      `<span class="uppercase flex-1 min-w-0 truncate" title="${escapeHtml(venueLabel)}">${escapeHtml(venueLabel)}</span>`+
      `<span class="shrink-0 font-semibold normal-case tracking-normal text-right whitespace-nowrap">${escapeHtml(dateFormatted)}</span>`+
    `</div>`;

    const regionBadge = `<span class="inline-block text-[10px] px-2 py-1 rounded bg-neutral-700/70 text-neutral-200 border border-neutral-600 tracking-wide font-semibold uppercase">${escapeHtml(ev.region)}</span>`;
    const votesBadge = `<span class="inline-block text-[10px] px-2 py-1 rounded bg-fuchsia-600/20 text-fuchsia-300 font-medium">${ev.votes || 0} Votes</span>`;
    const topRightBadges = `<div class="absolute top-2 right-2 flex items-center gap-2">${regionBadge}${votesBadge}</div>`;

    card.innerHTML = `
      ${topRightBadges}
      <div class="flex flex-col gap-2">
        <h3 class="font-semibold leading-snug pr-32">${escapeHtml(ev.eventName)}</h3>
        ${combinedBadge}
        <div class="flex flex-wrap gap-1">${genreTags}</div>
      </div>
      <div class="mt-auto flex justify-center pt-1">
        <button class="px-4 py-1.5 rounded-md bg-fuchsia-600/80 hover:bg-fuchsia-500 text-white text-[11px] font-semibold tracking-wide transition" data-open-modal>Details</button>
      </div>`;

    card.querySelector('[data-open-modal]').addEventListener('click', () => openModal(ev, ev.region));
    topEventsContainer.appendChild(card);
  });
}

async function loadTopEvents() {
  try {
    const { top } = await fetchJSON('/api/top?limit=6');
    renderTopEvents(top || []);
  } catch (e) {
    console.error('Top Events Fehler', e);
    topEventsContainer.innerHTML = '<p class="text-red-400 text-sm">Fehler beim Laden der Top Events.</p>';
  }
}

function regionTitle(name) {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}


function renderRegionsSkeleton() {
  regionsContainer.innerHTML = '';
  state.regions.forEach(r => {
    const wrapper = document.createElement('div');
    wrapper.id = `region-${r}`;
    wrapper.className = 'border border-neutral-700 rounded-lg overflow-hidden bg-neutral-800/50 backdrop-blur-sm';
    // Status zeigt nun direkt: Wird geladen (weil wir sofort alle Regionen laden)
    wrapper.innerHTML = `
      <button class="w-full flex justify-between items-center px-4 py-3 font-semibold bg-neutral-800/60 hover:bg-neutral-700/60 transition region-toggle" data-region-toggle="${r}">
        <span>${escapeHtml(regionTitle(r))}</span>
        <span class="chevron text-neutral-400">▼</span>
      </button>
      <div class="region-content hidden divide-y divide-neutral-800" data-region-content="${r}">
        <div class="p-4 text-sm text-neutral-400" data-region-status>Lade Events...</div>
      </div>`;
    regionsContainer.appendChild(wrapper);
  });
  attachRegionToggleHandlers();
}

function attachRegionToggleHandlers() {
  regionsContainer.querySelectorAll('[data-region-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = btn.getAttribute('data-region-toggle');
      const content = regionsContainer.querySelector(`[data-region-content="${r}"]`);
      const chev = btn.querySelector('.chevron');
      const hidden = content.classList.contains('hidden');
      if (hidden) {
        content.classList.remove('hidden');
        chev.textContent = '▲';
        // Lazy Load wenn noch nicht vorhanden
        if (!state.eventsByRegion[r]) {
          const statusEl = content.querySelector('[data-region-status]');
          if (statusEl) statusEl.textContent = 'Lade Events...';
          try {
            await loadRegionEvents(r);
            rebuildGenreSelect();
          } catch (e) {
            if (statusEl) statusEl.textContent = 'Fehler beim Laden.';
          }
        }
      } else {
        content.classList.add('hidden');
        chev.textContent = '▼';
      }
    });
  });
  // Entfernt: automatisches Öffnen der ersten Region
}

function rebuildGenreSelect() {
  if (!genreSelect) return;
  const selected = state.filters.genres;
  const genres = Array.from(state.collectedGenres.values()).sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
  genreSelect.innerHTML = genres.map(g => `<option value="${escapeHtml(g)}"${selected.includes(g) ? ' selected' : ''}>${escapeHtml(g)}</option>`).join('');
}

function renderRegion(region) {
  let events = state.eventsByRegion[region] || [];
  const nowTs = Date.now();
  events = events.filter(ev => !isPastEvent(ev, nowTs));
  const container = document.querySelector(`[data-region-content="${region}"]`);
  if (!container) return;
  if (!events.length) {
    container.innerHTML = '<div class="p-4 text-sm text-neutral-400">Keine Events gefunden.</div>';
    return;
  }
  const { search, genres: genreFilter, dateFrom, dateTo } = state.filters;
  const searchLC = search.trim().toLowerCase();
  const selectedGenres = (genreFilter || []).map(g=>g.toLowerCase());
  // Vorbereiten der Zeitgrenzen (Ganzer Tag Bereich)
  let fromTs = null, toTs = null;
  if (dateFrom) {
    fromTs = Date.parse(dateFrom + 'T00:00:00');
    if (isNaN(fromTs)) fromTs = null;
  }
  if (dateTo) {
    toTs = Date.parse(dateTo + 'T23:59:59.999');
    if (isNaN(toTs)) toTs = null;
  }
  const filtered = events.filter(ev => {
    if (selectedGenres.length) {
      const evGenres = (ev.genres || []).map(g=>g.toLowerCase());
      if (!evGenres.some(g => selectedGenres.includes(g))) return false;
    }
    if (fromTs !== null || toTs !== null) {
      const eventStartTs = Date.parse(ev.startTime || ev.date || 0);
      let eventEndTs = Date.parse(ev.endTime || ev.startTime || ev.date || 0);
      if (isNaN(eventStartTs)) return false;
      if (isNaN(eventEndTs)) eventEndTs = eventStartTs;
      if (fromTs !== null && eventEndTs < fromTs) return false;
      if (toTs !== null && eventStartTs > toTs) return false;
    }
    if (!searchLC) return true;
    const hay = [ev.eventName, ev.venue, ...(ev.genres||[]), ...(ev.artists||[]), ...(ev.lineupParsed||[])].join(' \n ').toLowerCase();
    return hay.includes(searchLC);
  });
  const list = document.createElement('div');
  list.className = 'flex flex-col';
  if (!filtered.length) {
    list.innerHTML = '<div class="p-4 text-sm text-neutral-500 italic">Keine passenden Events für Filter.</div>';
    container.innerHTML = '';
    container.appendChild(list);
    return;
  }
  filtered.forEach(ev => {
    const already = votedSet.has(ev.voteId);
    const item = document.createElement('div');
    item.className = 'event-item group px-4 py-3 mb-2 last:mb-0 flex flex-col gap-2 hover:bg-neutral-700/40 transition border border-neutral-800/80 rounded-md shadow-[0_0_0_1px_rgba(255,255,255,0.04)]';
    const sortedGenres = (ev.genres || []).slice().sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
    const genreTags = sortedGenres.map(g => createNeonTag(g, 'genre')).join('');

    let venueBadge = '';
    if (ev.venue) {
      venueBadge = createVenueBadge(ev.venue, formatDate(ev.date));
    } else {
      venueBadge = createVenueBadge('Event', formatDate(ev.date));
    }

    item.innerHTML = `
      <div class="flex items-start justify-between gap-4 ${already ? 'opacity-90' : ''}">
        <div class="min-w-0 cursor-pointer flex-1" data-open-full>
          <p class="font-medium truncate">${escapeHtml(ev.eventName)}</p>
          <div class="flex flex-col mt-1 mb-2 gap-1">${venueBadge}</div>
        </div>
        <div class="flex items-start gap-3 shrink-0">
          <div class="flex flex-col gap-1 items-stretch genre-stack w-[110px]">${genreTags || ''}</div>
          <div class="flex flex-col items-end gap-1 w-20">
            <span class="text-[11px] px-2 py-0.5 rounded bg-neutral-700/60 text-neutral-200 leading-none">${ev.votes || 0}❤</span>
            <button class="vote-btn-anim text-[11px] px-2 py-1 rounded ${already ? 'bg-neutral-600 cursor-not-allowed text-neutral-300' : 'bg-fuchsia-600/70 hover:bg-fuchsia-500 text-white font-semibold'} vote-btn" data-vote ${already ? 'disabled' : ''}>${already ? 'Voted' : 'Vote'}</button>
          </div>
        </div>
      </div>`;
    item.querySelector('[data-open-full]').addEventListener('click', () => openModal(ev, region));
    if (!already) {
      item.querySelector('[data-vote]').addEventListener('click', (e) => { e.stopPropagation(); vote(region, ev); });
    }
    list.appendChild(item);
  });
  container.innerHTML = '';
  container.appendChild(list);
}

function openModal(ev, region) {
  modalTitle.textContent = ev.eventName;
  const lines = [];
  lines.push(`<div class='grid grid-cols-2 gap-2 text-xs'>
    <div><span class='text-neutral-400'>Region:</span><br>${escapeHtml(regionTitle(region))}</div>
    <div><span class='text-neutral-400'>Venue:</span><br>${escapeHtml(ev.venue || '-')}</div>
    <div><span class='text-neutral-400'>Datum:</span><br>${formatDateTime(ev.date)}</div>
    <div><span class='text-neutral-400'>Start:</span><br>${formatDateTime(ev.startTime)}</div>
    <div><span class='text-neutral-400'>Ende:</span><br>${formatDateTime(ev.endTime)}</div>
    <div><span class='text-neutral-400'>Votes:</span><br>${ev.votes || 0}</div>
  </div>`);
  if (ev.artists && ev.artists.length) {
    lines.push(`<div><h4 class='font-semibold mb-1 text-sm'>Artists</h4><ul class='list-disc list-inside space-y-0.5 text-xs'>${ev.artists.map(a=>`<li>${escapeHtml(a)}</li>`).join('')}</ul></div>`);
  }
  if (ev.genres && ev.genres.length) {
    lines.push(`<div><h4 class='font-semibold mb-1 text-sm'>Genres</h4><p class='text-xs'>${ev.genres.map(g=>escapeHtml(g)).join(', ')}</p></div>`);
  }
  if (ev.lineupParsed && ev.lineupParsed.length) {
    lines.push(`<div><h4 class='font-semibold mb-1 text-sm'>Lineup</h4><ul class='list-disc list-inside space-y-0.5 text-xs'>${ev.lineupParsed.map(l=>`<li>${escapeHtml(stripTags(l))}</li>`).join('')}</ul></div>`);
  } else if (ev.lineupRaw) {
    lines.push(`<div><h4 class='font-semibold mb-1 text-sm'>Lineup</h4><pre class='text-[11px] whitespace-pre-wrap bg-neutral-800/60 p-2 rounded'>${escapeHtml(ev.lineupRaw)}</pre></div>`);
  }
  if (ev.eventUrl) {
    lines.push(`<div class='text-xs'><span class='bg-purple-500/20 border-purple-500/40 shadow-purple-500/25 text-purple-300'><a href='https://de.ra.co${escapeHtml(ev.eventUrl)}'>Mehr Infos zum Event (hier klicken)</a></div>`);

  }
  modalBody.innerHTML = lines.join('');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  window.addEventListener('keydown', escHandler, { once: true });
}

function closeModal() {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

modal.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', closeModal));
modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.hasAttribute('data-modal-close')) closeModal();
});

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(str) { return str.replace(/<[^>]+>/g, ''); }

async function vote(region, ev) {
  try {
    const body = { region, voteId: ev.voteId };
    const res = await fetchJSON('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const list = state.eventsByRegion[region] || [];
    const found = list.find(x => x.voteId === ev.voteId);
    if (found) found.votes = res.votes;
    votedSet.add(ev.voteId);
    persistVoted(votedSet);
    renderRegion(region);
    loadTopEvents();
  } catch (e) {
    console.error('Vote Fehler', e);
    alert('Fehler beim Voten');
  }
}

function applyFiltersAndRenderAll() { state.regions.forEach(r => renderRegion(r)); }
refreshTopBtn?.addEventListener('click', loadTopEvents);

// Genre Dropdown (Custom UI)
const genreDropdownBtn = document.getElementById('genreDropdownBtn');
const genreDropdownPanel = document.getElementById('genreDropdownPanel');
const genreOptionsContainer = document.getElementById('genreOptions');
const genreSelectedChips = document.getElementById('genreSelectedChips');

function toggleGenrePanel(force) {
  if (!genreDropdownPanel) return;
  const willOpen = typeof force === 'boolean' ? force : genreDropdownPanel.classList.contains('hidden');
  if (willOpen) genreDropdownPanel.classList.remove('hidden'); else genreDropdownPanel.classList.add('hidden');
}
function closeGenrePanel() { toggleGenrePanel(false); }

function buildGenreOptions() {
  if (!genreOptionsContainer) return;
  const allGenres = Array.from(state.collectedGenres.values()).sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
  if (!allGenres.length) { genreOptionsContainer.innerHTML = '<p class="text-[11px] text-neutral-500 px-1 py-2">Keine Genres gefunden.</p>'; return; }
  const selectedSet = new Set(state.filters.genres);
  genreOptionsContainer.innerHTML = allGenres.map(g => {
    const checked = selectedSet.has(g) ? 'checked' : '';
    return `<label class=\"flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-800 cursor-pointer\">\n      <input type=\"checkbox\" data-genre-opt value=\"${escapeHtml(g)}\" class=\"accent-neon-pink\" ${checked} />\n      <span class=\"text-[11px]\">${escapeHtml(g)}</span>\n    </label>`;
  }).join('');
  genreOptionsContainer.querySelectorAll('[data-genre-opt]').forEach(inp => {
    inp.addEventListener('change', () => {
      const values = Array.from(genreOptionsContainer.querySelectorAll('[data-genre-opt]:checked')).map(i=>i.value);
      state.filters.genres = values;
      updateGenreSelectedChips();
      applyFiltersAndRenderAll();
    });
  });
  updateGenreSelectedChips();
}

function updateGenreSelectedChips() {
  if (!genreSelectedChips) return;
  const sel = state.filters.genres;
  if (!sel.length) { genreSelectedChips.innerHTML = 'Alle Genres'; return; }
  const maxShow = 6; const extra = sel.length - maxShow; const shown = sel.slice(0,maxShow);
  genreSelectedChips.innerHTML = shown.map(g => `<span class=\"px-2 py-0.5 rounded-full bg-neutral-700/70 border border-neutral-600 text-[10px] tracking-wide\">${escapeHtml(g)}</span>`).join(' ') + (extra>0 ? `<span class=\"px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-[10px]\">+${extra}</span>` : '');
}

const _origRebuild = rebuildGenreSelect;
rebuildGenreSelect = function() { _origRebuild.call(this); buildGenreOptions(); };

if (genreDropdownBtn) genreDropdownBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleGenrePanel(); });
if (genreDropdownPanel) {
  genreDropdownPanel.querySelector('[data-genre-select-all]')?.addEventListener('click', ()=>{ state.filters.genres = []; buildGenreOptions(); applyFiltersAndRenderAll(); });
  genreDropdownPanel.querySelector('[data-genre-clear]')?.addEventListener('click', ()=>{ state.filters.genres = []; buildGenreOptions(); applyFiltersAndRenderAll(); });
  genreDropdownPanel.querySelector('[data-genre-close]')?.addEventListener('click', ()=> closeGenrePanel());
}
window.addEventListener('click', (e)=>{ if (!genreDropdownPanel || genreDropdownPanel.classList.contains('hidden')) return; if (genreDropdownPanel.contains(e.target) || genreDropdownBtn.contains(e.target)) return; closeGenrePanel(); });
window.addEventListener('keydown', (e)=>{ if (e.key==='Escape') closeGenrePanel(); });
if (clearFiltersBtn) {
  const prevReset = clearFiltersBtn.onclick;
  clearFiltersBtn.addEventListener('click', ()=>{ updateGenreSelectedChips(); closeGenrePanel(); if (prevReset) prevReset(); });
}
buildGenreOptions(); updateGenreSelectedChips();

// Init & Listeners
loadRegions().catch(err => { console.error(err); regionsContainer.innerHTML = '<p class="text-red-400">Fehler beim Laden der Regionen.</p>'; });
searchInput?.addEventListener('input', (e)=>{ state.filters.search = e.target.value; applyFiltersAndRenderAll(); });
genreSelect?.addEventListener('change', (e)=>{ const sel = Array.from(e.target.selectedOptions).map(o=>o.value); state.filters.genres = sel; applyFiltersAndRenderAll(); });
clearFiltersBtn?.addEventListener('click', ()=>{ state.filters.search=''; state.filters.genres=[]; state.filters.dateFrom=null; state.filters.dateTo=null; if (searchInput) searchInput.value=''; if (genreSelect) Array.from(genreSelect.options).forEach(o=>o.selected=false); if(dateFromInput) dateFromInput.value=''; if(dateToInput) dateToInput.value=''; applyFiltersAndRenderAll(); });

// Intro Modal
const introModal = document.getElementById('introModal');
const introDontShow = document.getElementById('introDontShow');
const introStartBtn = document.getElementById('introStartBtn');
const INTRO_KEY = 'rave_intro_dismissed_v1';
function openIntro(){ if(!introModal) return; introModal.classList.remove('hidden'); introModal.classList.add('flex'); const esc=(e)=>{ if(e.key==='Escape') closeIntro(); }; window.addEventListener('keydown', esc,{ once:true}); }
function closeIntro(permanent=false){ if(!introModal) return; introModal.classList.add('hidden'); introModal.classList.remove('flex'); if(permanent || (introDontShow && introDontShow.checked)) { try{ localStorage.setItem(INTRO_KEY,'1'); }catch(_){} } }
function showIntroIfNeeded(){ try{ if(localStorage.getItem(INTRO_KEY)) return; }catch(_){} openIntro(); }
if (introModal){ introModal.querySelectorAll('[data-intro-close]').forEach(el=> el.addEventListener('click', ()=> closeIntro())); if(introStartBtn){ introStartBtn.addEventListener('click', ()=> closeIntro(introDontShow?.checked)); } introModal.addEventListener('click', (e)=>{ if(e.target===introModal || e.target.hasAttribute('data-intro-close')) closeIntro(); }); }
showIntroIfNeeded();

// Date Filter Listener & Quick Ranges
function formatYMD(d){ return d.toISOString().slice(0,10); }
function setDateRange(fromDate, toDate){
  if (dateFromInput && fromDate){ dateFromInput.value = formatYMD(fromDate); state.filters.dateFrom = dateFromInput.value; }
  if (dateToInput && toDate){ dateToInput.value = formatYMD(toDate); state.filters.dateTo = dateToInput.value; }
  applyFiltersAndRenderAll();
}
if (dateFromInput) dateFromInput.addEventListener('change', ()=>{ state.filters.dateFrom = dateFromInput.value || null; applyFiltersAndRenderAll(); });
if (dateToInput) dateToInput.addEventListener('change', ()=>{ state.filters.dateTo = dateToInput.value || null; applyFiltersAndRenderAll(); });
if (dateQuickBtns) {
  dateQuickBtns.querySelectorAll('button[data-range]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const val = btn.getAttribute('data-range');
      const today = new Date(); today.setHours(0,0,0,0);
      function getThisFriday(base){
        const day = base.getDay(); // 0 So, 1 Mo, ... 6 Sa
        let friday = new Date(base);
        if (day === 5) { // Freitag
          // already friday
        } else if (day === 6) { // Samstag -> gestern
          friday.setDate(friday.getDate() - 1);
        } else if (day === 0) { // Sonntag -> zwei Tage zurück
          friday.setDate(friday.getDate() - 2);
        } else { // Montag-Donnerstag -> nach vorne bis Freitag
          friday.setDate(friday.getDate() + (5 - day));
        }
        friday.setHours(0,0,0,0);
        return friday;
      }
      if (val === 'today') {
        setDateRange(today, today);
      } else if (val === 'weekend') {
        const day = today.getDay();
        const friday = new Date(today);
        const offsetToFriday = (5 - day + 7) % 7; // nächster Freitag (auch wenn heute Sa/So => nächstes Wochenende)
        friday.setDate(friday.getDate() + offsetToFriday);
        const sunday = new Date(friday); sunday.setDate(friday.getDate() + 2);
        setDateRange(friday, sunday);
      } else if (val === 'thisWeekend') {
        const friday = getThisFriday(today);
        const sunday = new Date(friday); sunday.setDate(friday.getDate() + 2);
        setDateRange(friday, sunday);
      } else if (val === 'nextWeekend') {
        const thisFriday = getThisFriday(today);
        const nextFriday = new Date(thisFriday); nextFriday.setDate(thisFriday.getDate() + 7);
        const nextSunday = new Date(nextFriday); nextSunday.setDate(nextFriday.getDate() + 2);
        setDateRange(nextFriday, nextSunday);
      } else if (/^\d+$/.test(val)) {
        const days = parseInt(val,10);
        const to = new Date(today); to.setDate(today.getDate() + (days-1));
        setDateRange(today, to);
      }
    });
  });
}
