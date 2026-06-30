/* ── Data ── */
const GAMES_DATA = {};

fetch('./assets/data/app_data.json')
  .then(r => r.json())
  .then(rows => {
    rows.forEach(r => {
      const key = r.games;
      if (!GAMES_DATA[key]) GAMES_DATA[key] = [];
      GAMES_DATA[key].push(r);
    });
    refresh();
  })
  .catch(err => console.error('Failed to load app_data.json:', err));

/* ── GeoJSON world polygons ── */
let worldGeoJSON = null;
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson')
  .then(r => r.json())
  .then(data => {
    worldGeoJSON = data;
    if (Object.keys(GAMES_DATA).length) renderMap();
  })
  .catch(err => console.warn('GeoJSON failed to load:', err));

/* ── Key maps ── */
const RANKING_KEY = {
  "Rank.Bayes.cond":   "rank_mean_beta",
  "Rank.Median.Bayes": "rank_median_beta",
  "Rank.dp":           "rank_dp",
  "Rank.percap":       "rank_pc",
  "Rank.Total":        "rank_total"
};

const VARIABLE_KEY = {
  "Rank.Bayes.cond":       "rank_mean",
  "Rank.Median.Bayes":     "rank_median",
  "Rank.dp":               "rank_dp",
  "Rank.percap":           "rank_pc",
  "Rank.Total":            "rank_total",
  "Post_permil":           "median_estimate_mpm",
  "total_pop_july":        "population",
  "NY.GDP.PCAP.KD":        "NY.GDP.PCAP.KD",
  "life_expectancy_birth": "SP.DYN.LE00.IN"
};

const VARIABLE_IS_RANK = new Set([
  "Rank.Bayes.cond","Rank.Median.Bayes","Rank.dp","Rank.percap","Rank.Total"
]);

/* ── Variable transform config ── */
const VARIABLE_TRANSFORM = {
  "population":          "log",
  "NY.GDP.PCAP.KD":      "log",
  "rank_mean":           "linear",
  "rank_median":         "linear",
  "rank_dp":             "linear",
  "rank_pc":             "linear",
  "rank_total":          "linear",
  "median_estimate_mpm": "linear",
  "observed_mpm":        "linear",
  "SP.DYN.LE00.IN":      "linear"
};

/* ── State ── */
let currentGame     = "paris-2024";
let currentRanking  = "Rank.Bayes.cond";
let currentVariable = "Rank.Bayes.cond";
let selectedCountry = null;
let intervalLo      = 1;
let intervalHi      = 200;

/* ── Sort state ── */
let sortKey = null;
let sortDir = 'asc';

// colour scale for map
const PALETTE = [
  '#f59e0b', // amber — best rank
  '#fbbf24',
  '#fcd34d',
  '#fef3c7',
  '#e2e8f0', // neutral mid
  '#94a3b8',
  '#475569',
  '#1e3a5f'  // deep navy — worst rank
];

function getColour(val, min, max, invert, transform = 'linear') {
  if (val == null) return '#cbd5e0';
  let v = val, lo = min, hi = max;
  if (transform === 'log' && val > 0 && min > 0) {
    v  = Math.log(val);
    lo = Math.log(min);
    hi = Math.log(max);
  }
  let t = (v - lo) / (hi - lo || 1);
  if (invert) t = 1 - t;
  t = Math.max(0, Math.min(1, t));
  return PALETTE[Math.min(PALETTE.length - 1, Math.floor(t * PALETTE.length))];
}

/* ── Leaflet map ── */
const map = L.map('map', {
  worldCopyJump:      false,
  maxBounds:          [[-90, -180], [90, 180]],
  maxBoundsViscosity: 0.85,
  minZoom:            2,
  maxZoom:            10,
  bounceAtZoomLimits: true,
}).setView([20, 10], 2);
window._map = map;
let tileLayer;

function applyTiles() {
  if (tileLayer) map.removeLayer(tileLayer);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  tileLayer = L.tileLayer(
    dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    { attribution: '© <a href="https://carto.com" target="_blank">CARTO</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>',
      subdomains: 'abcd', maxZoom: 19 }
  ).addTo(map);
}
applyTiles();
map.on('themechange', () => setTimeout(applyTiles, 50));
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTimeout(applyTiles, 80));

/* ── Helpers ── */
function getAllData() {
  return (GAMES_DATA[currentGame] || []);
}

function getMapData() {
  const rKey = RANKING_KEY[currentRanking];
  const vKey = VARIABLE_KEY[currentVariable];
  return getAllData()
    .filter(c => c[vKey] != null && c[vKey] >= intervalLo && c[vKey] <= intervalHi)
    .sort((a, b) => a[rKey] - b[rKey]);
}

function getFilteredData() {
  const rKey = RANKING_KEY[currentRanking];
  return getAllData()
    .filter(c => c[rKey] != null)
    .sort((a, b) => a[rKey] - b[rKey]);
}

function formatVal(val, varKey) {
  if (val == null) return '—';
  if (varKey === "population")          return Number(val).toLocaleString();
  if (varKey === "NY.GDP.PCAP.KD")      return "$" + Number(val).toLocaleString();
  if (varKey === "SP.DYN.LE00.IN")      return Number(val).toFixed(1) + " yrs";
  if (varKey === "median_estimate_mpm") return Number(val).toFixed(3);
  return val;
}

/* ── Slider ── */
function initSlider() {
  const vKey = VARIABLE_KEY[currentVariable];
  const transform = VARIABLE_TRANSFORM[vKey] || 'linear';
  const vals = getAllData().map(c => c[vKey]).filter(v => v != null);
  if (!vals.length) return;
  const min = Math.min(...vals), max = Math.max(...vals);
  intervalLo = min; intervalHi = max;

  const lo = document.getElementById('slider-lo');
  const hi = document.getElementById('slider-hi');

  if (transform === 'log' && min > 0) {
    const logMin = Math.log10(min), logMax = Math.log10(max);
    const step = (logMax - logMin) / 100;
    if (lo) { lo.min = logMin; lo.max = logMax; lo.value = logMin; lo.step = step; lo.dataset.transform = 'log'; }
    if (hi) { hi.min = logMin; hi.max = logMax; hi.value = logMax; hi.step = step; hi.dataset.transform = 'log'; }
  } else {
    const step = VARIABLE_IS_RANK.has(currentVariable) ? 1 : (max - min) / 100;
    if (lo) { lo.min = min; lo.max = max; lo.value = min; lo.step = step; lo.dataset.transform = 'linear'; }
    if (hi) { hi.min = min; hi.max = max; hi.value = max; hi.step = step; hi.dataset.transform = 'linear'; }
  }
  updateSliderDisplay();
  updateSliderFill();
}

function updateSliderDisplay() {
  const el   = document.getElementById('slider-display');
  const vKey = VARIABLE_KEY[currentVariable];
  if (el) el.textContent = formatVal(Math.round(intervalLo), vKey) + ' – ' + formatVal(Math.round(intervalHi), vKey);
  updateSliderFill();
}

function updateSliderFill() {
  const lo   = document.getElementById('slider-lo');
  const hi   = document.getElementById('slider-hi');
  const fill = document.getElementById('track-fill');
  if (!lo || !hi || !fill) return;
  const min   = parseFloat(lo.min);
  const max   = parseFloat(lo.max);
  const range = max - min || 1;
  const left  = ((parseFloat(lo.value) - min) / range) * 100;
  const right = ((parseFloat(hi.value) - min) / range) * 100;
  fill.style.left  = left  + '%';
  fill.style.width = (right - left) + '%';
}

/* ── Map render (GeoJSON choropleth) ── */
let choroplethLayer = null;

function renderMap() {
  if (choroplethLayer) { map.removeLayer(choroplethLayer); choroplethLayer = null; }
  if (!worldGeoJSON) return;

  const all       = GAMES_DATA[currentGame] || [];
  const filtered = getMapData();
  const inSet     = new Set(filtered.map(c => c.iso_a3));
  const vKey      = VARIABLE_KEY[currentVariable];
  const rKey      = RANKING_KEY[currentRanking];
  const isRank    = VARIABLE_IS_RANK.has(currentVariable);
  const transform = VARIABLE_TRANSFORM[vKey] || 'linear';

//update colour scale for between values being filtered
const vals = filtered.filter(c => c[vKey] != null).map(c => c[vKey]);
if (!vals.length) return;
const minV = Math.min(...vals), maxV = Math.max(...vals);

  const dataByIso = {};
  all.forEach(c => { dataByIso[c.iso_a3] = c; });

  const selRank = selectedCountry
    ? (dataByIso[selectedCountry]?.[rKey] ?? null)
    : null;

  choroplethLayer = L.geoJSON(worldGeoJSON, {
    style: feature => {
      const iso = feature.properties.ISO_A3 || feature.properties.iso_a3 || '';
      const c   = dataByIso[iso];

      if (!c) return { fillColor: '#d1d5db', fillOpacity: 0.4, color: '#6b7280', weight: 1.2 };

      const inFilter = inSet.has(iso);
      const fill     = inFilter ? getColour(c[vKey], minV, maxV, isRank, transform) : '#c8c8c8';

      let borderCol = '#4b5563', borderW = 1.5;
      if (selectedCountry && selRank != null && inFilter) {
        const cr = c[rKey];
        if (iso === selectedCountry) { borderCol = '#7b1450'; borderW = 3; }
        else if (cr < selRank)       { borderCol = '#003082'; borderW = 2; }
        else if (cr > selRank)       { borderCol = '#c0181f'; borderW = 2; }
      } else if (iso === selectedCountry) {
        borderCol = '#7b1450'; borderW = 3;
      }

      return { fillColor: fill, fillOpacity: inFilter ? 0.82 : 0.35, color: borderCol, weight: borderW };
    },

    onEachFeature: (feature, layer) => {
      const iso  = feature.properties.ISO_A3 || feature.properties.iso_a3 || '';
      const c    = dataByIso[iso];
      if (!c) return;

      const rKey = RANKING_KEY[currentRanking];
      const vKey = VARIABLE_KEY[currentVariable];

      layer.bindTooltip(
        `<strong>${c.country}</strong><br>` +
        `Rank (${currentRanking}): ${c[rKey] ?? '—'}<br>` +
        `Total medals: ${c['medal_total'] ?? '—'}<br>` +
        `Per million: ${c['observed_mpm'] != null ? Number(c['observed_mpm']).toFixed(2) : '—'}<br>` +
        `${currentVariable}: ${formatVal(c[vKey], vKey)}`,
        { sticky: true }
      );

      layer.on({
        click:     ()  => selectCountry(iso),
        mouseover: e   => { if (iso !== selectedCountry) e.target.setStyle({ weight: 2.5, color: '#111827' }); },
        mouseout:  e   => { choroplethLayer.resetStyle(e.target); }
      });
    }
  }).addTo(map);

  renderLegend(minV, maxV, vKey, isRank, transform);
  renderBorderLegend();
}

/* ── Legend ── */
function renderLegend(minV, maxV, vKey, isRank, transform) {
  const el = document.getElementById('map-legend');
  if (!el) return;
  el.innerHTML = Array.from({length: 5}, (_, i) => {
    let v;
    if (transform === 'log' && minV > 0) {
      const loLog = Math.log(minV), hiLog = Math.log(maxV);
      v = Math.exp(loLog + (hiLog - loLog) * (i / 4));
    } else {
      v = minV + (maxV - minV) * (i / 4);
    }
    const colour = getColour(v, minV, maxV, isRank, transform);
    const label  = formatVal(
      transform === 'log' ? Math.round(v) : Math.round(v * 10) / 10,
      vKey
    );
    return `<span class="legend-item"><span class="legend-swatch" style="background:${colour}"></span>${label}</span>`;
  }).join('');
}

function renderBorderLegend() {
  const el = document.getElementById('border-legend');
  if (!el) return;
  if (!selectedCountry) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `
    <span class="border-legend-item"><span style="background:#7b1450;display:inline-block;width:20px;height:3px;border-radius:2px"></span> Selected</span>
    <span class="border-legend-item"><span style="background:#003082;display:inline-block;width:20px;height:3px;border-radius:2px"></span> Higher ranked</span>
    <span class="border-legend-item"><span style="background:#c0181f;display:inline-block;width:20px;height:3px;border-radius:2px"></span> Lower ranked</span>
  `;
}

/* ── Table render ── */
function renderTable(search = '') {
  const tbody = document.getElementById('ranking-tbody');
  const rKey  = RANKING_KEY[currentRanking];

  // Keep rank th data-sort in sync with current ranking key
  const rankTh = document.querySelector('.rank-table th[data-sort^="rank"]');
  if (rankTh) rankTh.dataset.sort = rKey;

  let data = getFilteredData();
  if (search) data = data.filter(c => c.country.toLowerCase().includes(search.toLowerCase()));

  // Apply column sort
  if (sortKey) {
    data = [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc'
        ? av.localeCompare(bv)
        : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }

  const countEl = document.getElementById('table-count');
  if (countEl) countEl.textContent = data.length + ' countries';

  // Update header sort indicators
  document.querySelectorAll('.rank-table th[data-sort]').forEach(th => {
    const key    = th.dataset.sort;
    const active = (sortKey === key) || (!sortKey && key === rKey);
    th.classList.toggle('sort-active', active);
    const arrow  = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';
  });

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-text-muted)">No results</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr data-iso="${c.iso_a3}" class="${selectedCountry === c.iso_a3 ? 'selected' : ''}">
      <td class="rank-num">${c[rKey] ?? '—'}</td>
      <td class="flag-cell"><img src="https://flagcdn.com/24x18/${c.iso_a2?.toLowerCase()}.png" alt="${c.country} flag" width="24" height="18" loading="lazy" onerror="this.style.display='none'"></td>
      <td class="country-name">${c.country}</td>
      <td class="medal-cell medal-gold">${c['medal_total'] ?? '—'}</td>
      <td class="medal-cell">${c['observed_mpm'] != null ? Number(c['observed_mpm']).toFixed(2) : '—'}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach(row =>
    row.addEventListener('click', () => selectCountry(row.dataset.iso))
  );
}

/* ── Sortable column headers ── */
function initSortHeaders() {
  document.querySelectorAll('.rank-table th[data-sort]').forEach(th => {
    th.style.cursor     = 'pointer';
    th.style.userSelect = 'none';
    th.addEventListener('click', () => {
      const key  = th.dataset.sort;
      const rKey = RANKING_KEY[currentRanking];
      if (sortKey === key || (!sortKey && key === rKey)) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDir = 'asc';
      }
      renderTable(document.getElementById('table-search')?.value);
    });
  });
}

/* ── Country selection ── */
function selectCountry(iso) {
  selectedCountry = (selectedCountry === iso) ? null : iso;
  renderTable(document.getElementById('table-search')?.value);
  renderMap();
  updateDetail();
}

/* ── Detail panel ── */
function updateDetail() {
  const panel = document.getElementById('country-detail');
  const empty = document.getElementById('detail-empty');
  if (!selectedCountry) {
    panel?.classList.remove('visible');
    if (empty) empty.style.display = '';
    return;
  }
  const rKey = RANKING_KEY[currentRanking];
  const c = (GAMES_DATA[currentGame] || []).find(x => x.iso_a3 === selectedCountry);
  if (!c) return;
  if (empty) empty.style.display = 'none';
  panel?.classList.add('visible');
  document.getElementById('detail-name').textContent   = c.country;
  document.getElementById('d-rank').textContent        = c[rKey] ?? '—';
  document.getElementById('d-medals').textContent      = c['medal_total'] ?? '—';
  document.getElementById('d-percap').textContent      = c['observed_mpm']       != null ? Number(c['observed_mpm']).toFixed(2)               : '—';
  document.getElementById('d-pop').textContent         = c['population']          != null ? Number(c['population']).toLocaleString()           : '—';
  document.getElementById('d-gdp').textContent         = c['NY.GDP.PCAP.KD']      != null ? '$' + Number(c['NY.GDP.PCAP.KD']).toLocaleString() : '—';
  document.getElementById('d-life').textContent        = c['SP.DYN.LE00.IN']      != null ? Number(c['SP.DYN.LE00.IN']).toFixed(1)             : '—';
  document.getElementById('d-postpermil').textContent  = c['median_estimate_mpm'] != null ? Number(c['median_estimate_mpm']).toFixed(3)         : '—';
}

/* ── Full refresh ── */
function refresh() {
  const gamesEl  = document.getElementById('sel-games');
  const subtitle = document.getElementById('map-subtitle');
  if (subtitle && gamesEl) subtitle.textContent = gamesEl.options[gamesEl.selectedIndex]?.text;
  initSlider();
  renderTable(document.getElementById('table-search')?.value);
  renderMap();
  updateDetail();
}

/* ── Control listeners ── */
document.getElementById('sel-games')
  .addEventListener('change', e => { currentGame = e.target.value; selectedCountry = null; sortKey = null; refresh(); });
document.getElementById('sel-ranking')
  .addEventListener('change', e => { currentRanking = e.target.value; sortKey = null; refresh(); });
document.getElementById('sel-variable')
  .addEventListener('change', e => { currentVariable = e.target.value; selectedCountry = null; refresh(); });
document.getElementById('btn-reset')
  .addEventListener('click', () => { selectedCountry = null; sortKey = null; map.setView([20, 10], 2); refresh(); });
document.getElementById('detail-close')
  ?.addEventListener('click', () => { selectedCountry = null; renderTable(); renderMap(); updateDetail(); });
document.getElementById('table-search')
  ?.addEventListener('input', e => renderTable(e.target.value));
document.getElementById('slider-lo')?.addEventListener('input', e => {
  const isLog = e.target.dataset.transform === 'log';
  const raw = Number(e.target.value);
  const hiRaw = Number(document.getElementById('slider-hi').value);
  if (raw > hiRaw) { e.target.value = hiRaw; return; }
  intervalLo = isLog ? Math.pow(10, raw) : raw;
  updateSliderDisplay();
  renderTable(document.getElementById('table-search')?.value);
  renderMap();
});

document.getElementById('slider-hi')?.addEventListener('input', e => {
  const isLog = e.target.dataset.transform === 'log';
  const raw = Number(e.target.value);
  const loRaw = Number(document.getElementById('slider-lo').value);
  if (raw < loRaw) { e.target.value = loRaw; return; }
  intervalHi = isLog ? Math.pow(10, raw) : raw;
  updateSliderDisplay();
  renderTable(document.getElementById('table-search')?.value);
  renderMap();
});

/* ── Boot ── */
initSortHeaders();