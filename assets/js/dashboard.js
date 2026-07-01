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

/* ── ISO patch for Natural Earth -99 codes ── */
const NAME_TO_ISO = {
  'France':    'FRA',
  'Norway':    'NOR',
  'Kosovo':    'XKX',
  'N. Cyprus': 'CYP',
  'Somaliland': null,
};

function resolveIso(feature) {
  const iso = feature.properties.ISO_A3 || feature.properties.iso_a3 || '';
  if (iso !== '-99') return iso;
  const name = feature.properties.NAME || feature.properties.name || '';
  return NAME_TO_ISO[name] ?? null;
}

/* ── State ── */
let currentGame     = "paris-2024";
let currentRanking  = "Rank.Bayes.cond";
let currentVariable = "Rank.Bayes.cond";
let selectedCountry = null;
let intervalLo = 1;
let intervalHi = 200;

/* ── Sort state ── */
let sortKey = null;
let sortDir = 'asc';

/* ── Leaflet map ── */
const map = L.map('map', {
  worldCopyJump: false,
  maxBounds: [[-90, -180], [90, 180]],
  maxBoundsViscosity: 0.85,
  minZoom: 2,
  maxZoom: 10,
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
    { attribution: '© CARTO © OSM', subdomains: 'abcd', maxZoom: 19 }
  ).addTo(map);
}

applyTiles();
map.on('themechange', () => setTimeout(applyTiles, 50));
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTimeout(applyTiles, 80));

function getAllData() {
  return (GAMES_DATA[currentGame] || []).filter(c => c[RANKING_KEY[currentRanking]] != null);
}

function getFilteredData() {
  const rKey = RANKING_KEY[currentRanking];
  const vKey = VARIABLE_KEY[currentVariable];
  return getAllData()
    .filter(c => {
      const v = c[vKey];
      return v == null || (v >= intervalLo && v <= intervalHi);
    })
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
  const vKey      = VARIABLE_KEY[currentVariable];
  const transform = VARIABLE_TRANSFORM[vKey] || 'linear';
  const vals      = (GAMES_DATA[currentGame] || [])
    .map(c => c[vKey])
    .filter(v => v != null);
  if (!vals.length) return;
  const min = Math.min(...vals), max = Math.max(...vals);
  intervalLo = min; intervalHi = max;

  const lo = document.getElementById('slider-lo');
  const hi = document.getElementById('slider-hi');

  if (transform === 'log' && min > 0) {
    const logMin = Math.log10(min), logMax = Math.log10(max);
    const step   = (logMax - logMin) / 100;
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
  fill.style.left  = left + '%';
  fill.style.width = (right - left) + '%';
}

/* ── Map render ── */
let choroplethLayer = null;

function getMapStyle(feature, dataByIso, inSet) {
  const iso = resolveIso(feature);
  if (!iso) return { fillColor: '#e2e8f0', fillOpacity: 0.3, color: '#cbd5e1', weight: 0.5 };

  const c = dataByIso[iso];

  if (!c) return { fillColor: '#d1d5db', fillOpacity: 0.4, color: '#9ca3af', weight: 1 };

  const inFilter = inSet.has(iso);

  // No country selected — all neutral grey
  if (!selectedCountry) {
    return {
      fillColor:   inFilter ? '#94a3b8' : '#cbd5e1',
      fillOpacity: inFilter ? 0.75 : 0.35,
      color:       '#64748b',
      weight:      1
    };
  }

  // Country selected
  const selectedData = dataByIso[selectedCountry];
  const isSelected   = iso === selectedCountry;
  const isNotSig     = selectedData ? selectedData[iso] === true : false;

  if (isSelected) {
    return { fillColor: '#f59e0b', fillOpacity: 0.95, color: '#7b1450', weight: 3 };
  }

  if (!inFilter) {
    return { fillColor: '#cbd5e1', fillOpacity: 0.3, color: '#9ca3af', weight: 0.8 };
  }

  if (isNotSig) {
    return { fillColor: '#f59e0b', fillOpacity: 0.22, color: '#d97706', weight: 1.5 };
  }

  return { fillColor: '#94a3b8', fillOpacity: 0.55, color: '#64748b', weight: 1 };
}

function renderMap() {
  if (choroplethLayer) { map.removeLayer(choroplethLayer); choroplethLayer = null; }
  if (!worldGeoJSON) return;

  const all      = GAMES_DATA[currentGame] || [];
  const filtered = getFilteredData();
  const inSet    = new Set(filtered.map(c => c.iso_a3));
  const rKey     = RANKING_KEY[currentRanking];

  const dataByIso = {};
  all.forEach(c => { dataByIso[c.iso_a3] = c; });

  choroplethLayer = L.geoJSON(worldGeoJSON, {
    style: feature => getMapStyle(feature, dataByIso, inSet),

    onEachFeature: (feature, layer) => {
      const iso = resolveIso(feature);
      if (!iso) return;
      const c = dataByIso[iso];
      if (!c) return;

      layer.bindTooltip(
        `<strong>${c.country}</strong><br>` +
        `Rank (${currentRanking}): ${c[rKey] ?? '—'}<br>` +
        `Total medals: ${c['medal_total'] ?? '—'}<br>` +
        `Per million: ${c['observed_mpm'] != null ? Number(c['observed_mpm']).toFixed(2) : '—'}`,
        { sticky: true }
      );
      layer.on({
        click:     () => selectCountry(iso),
        mouseover: e => { if (iso !== selectedCountry) e.target.setStyle({ weight: 2.5, color: '#111827' }); },
        mouseout:  e => { choroplethLayer.resetStyle(e.target); }
      });
    }
  }).addTo(map);

  renderMapLegend();
}

/* ── Map legend ── */
function renderMapLegend() {
  const el = document.getElementById('map-legend');
  if (el) el.innerHTML = '';

  const borderEl = document.getElementById('border-legend');
  if (!borderEl) return;

  if (!selectedCountry) { borderEl.style.display = 'none'; return; }

  borderEl.style.display = 'flex';
  borderEl.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:5px">
      <span style="width:14px;height:14px;border-radius:3px;background:#f59e0b;display:inline-block;border:2px solid #7b1450"></span> Selected
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px">
      <span style="width:14px;height:14px;border-radius:3px;background:rgba(245,158,11,0.22);display:inline-block;border:1.5px solid #d97706"></span> Not significantly different
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px">
      <span style="width:14px;height:14px;border-radius:3px;background:#94a3b8;display:inline-block"></span> Significantly different
    </span>
  `;
}

/* ── Table render ── */
function renderTable(search = '') {
  const tbody = document.getElementById('ranking-tbody');
  const rKey  = RANKING_KEY[currentRanking];

  const rankTh = document.querySelector('.rank-table th[data-sort^="rank"]');
  if (rankTh) rankTh.dataset.sort = rKey;

  let data = getFilteredData();
  if (search) data = data.filter(c => c.country.toLowerCase().includes(search.toLowerCase()));

  if (sortKey) {
    data = [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }

  const countEl = document.getElementById('table-count');
  if (countEl) countEl.textContent = data.length + ' countries';

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

  const all          = GAMES_DATA[currentGame] || [];
  const selectedData = selectedCountry
    ? (all.find(r => r.iso_a3 === selectedCountry) || null)
    : null;

  const sigLegend = document.getElementById('sig-legend');
  if (sigLegend) sigLegend.classList.toggle('visible', !!selectedCountry);

  tbody.innerHTML = data.map(c => {
    let rowStyle = '';

    if (selectedCountry === c.iso_a3) {
      rowStyle = 'background-color:#f59e0b;color:#1c1917;';
    } else if (selectedData) {
      if (selectedData[c.iso_a3] === true) {
        rowStyle = 'background-color:rgba(245,158,11,0.12);';
      } else {
        rowStyle = 'opacity:0.4;';
      }
    }

    return `
    <tr data-iso="${c.iso_a3}" style="${rowStyle}">
      <td class="rank-num">${c[rKey] ?? '—'}</td>
      <td class="flag-cell"><img src="https://flagcdn.com/24x18/${c.iso_a2?.toLowerCase()}.png" alt="${c.country} flag" width="24" height="18" loading="lazy" onerror="this.style.display='none'"></td>
      <td class="country-name">${c.country}</td>
      <td class="medal-cell medal-gold">${c['medal_total'] ?? '—'}</td>
      <td class="medal-cell">${c['observed_mpm'] != null ? Number(c['observed_mpm']).toFixed(2) : '—'}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr').forEach(row =>
    row.addEventListener('click', () => selectCountry(row.dataset.iso))
  );
}

/* ── Select country ── */
function selectCountry(iso) {
  selectedCountry = selectedCountry === iso ? null : iso;
  renderMap();
  renderTable(document.getElementById('table-search')?.value || '');
}

/* ── Refresh ── */
function refresh() {
  initSlider();
  renderMap();
  renderTable(document.getElementById('table-search')?.value || '');
}

/* ── Controls ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sel-games')?.addEventListener('change', e => {
    currentGame = e.target.value;
    selectedCountry = null;
    refresh();
  });

  document.getElementById('sel-ranking')?.addEventListener('change', e => {
    currentRanking = e.target.value;
    renderMap();
    renderTable(document.getElementById('table-search')?.value || '');
  });

  document.getElementById('sel-variable')?.addEventListener('change', e => {
    currentVariable = e.target.value;
    refresh();
  });

  document.getElementById('table-search')?.addEventListener('input', e => {
    renderTable(e.target.value);
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    selectedCountry = null;
    refresh();
  });

  const lo = document.getElementById('slider-lo');
  const hi = document.getElementById('slider-hi');

  function onSliderChange() {
    const loVal     = parseFloat(lo.value);
    const hiVal     = parseFloat(hi.value);
    const transform = lo.dataset.transform || 'linear';
    if (transform === 'log') {
      intervalLo = Math.pow(10, loVal);
      intervalHi = Math.pow(10, hiVal);
    } else {
      intervalLo = loVal;
      intervalHi = hiVal;
    }
    if (intervalLo > intervalHi) [intervalLo, intervalHi] = [intervalHi, intervalLo];
    updateSliderDisplay();
    renderMap();
    renderTable(document.getElementById('table-search')?.value || '');
  }

  lo?.addEventListener('input', onSliderChange);
  hi?.addEventListener('input', onSliderChange);

  document.querySelectorAll('.rank-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDir = 'asc';
      }
      renderTable(document.getElementById('table-search')?.value || '');
    });
  });
});