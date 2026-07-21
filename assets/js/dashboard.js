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

/* ── Key maps ── */
const RANKING_KEY = {
  "Rank.Bayes.cond": "rank_mean_beta",
  "Rank.Median.Bayes": "rank_median_beta",
  "Rank.dp": "rank_dp",
  "Rank.percap": "rank_pc",
  "Rank.Total": "rank_total"
};

const VARIABLE_KEY = {
  "Rank.Bayes.cond": "rank_mean_beta",
  "Rank.Median.Bayes": "rank_median_beta",
  "Rank.dp": "rank_dp",
  "Rank.percap": "rank_pc",
  "Rank.Total": "rank_total",
  "Post_permil": "median_estimate_mpm",
  "total_pop_july": "population",
  "NY.GDP.PCAP.KD": "NY.GDP.PCAP.KD",
  "life_expectancy_birth": "SP.DYN.LE00.IN"
};

const VARIABLE_LABEL = {
  "Rank.Bayes.cond": "Bayes Mean Rank",
  "Rank.Median.Bayes": "Bayes Median Rank",
  "Rank.dp": "DP Rank",
  "Rank.percap": "Per-Capita Rank",
  "Rank.Total": "Total Rank",
  "Post_permil": "Posterior Per-Mil",
  "total_pop_july": "Population",
  "NY.GDP.PCAP.KD": "GDP per Capita",
  "life_expectancy_birth": "Life Expectancy"
};

const VARIABLE_IS_RANK = new Set([
  "Rank.Bayes.cond","Rank.Median.Bayes","Rank.dp","Rank.percap","Rank.Total"
]);

/* ── Variable transform config ── */
const VARIABLE_TRANSFORM = {
  "population": "log",
  "NY.GDP.PCAP.KD": "log",
  "rank_mean": "linear",
  "rank_median": "linear",
  "rank_dp": "linear",
  "rank_pc": "linear",
  "rank_total": "linear",
  "median_estimate_mpm": "linear",
  "observed_mpm": "linear",
  "SP.DYN.LE00.IN": "linear"
};

/* ── ISO patch for Natural Earth -99 codes ── */
const NAME_TO_ISO = {
  'France': 'FRA', 'Norway': 'NOR', 'Kosovo': 'XKX', 'N. Cyprus': 'CYP', 'Somaliland': null,
};
function resolveIso(feature) {
  const iso = feature.properties.ISO_A3 || feature.properties.iso_a3 || '';
  if (iso !== '-99') return iso;
  const name = feature.properties.NAME || feature.properties.name || '';
  return NAME_TO_ISO[name] ?? null;
}

/* ── State ── */
let currentGame = "paris-2024";
let currentRanking = "Rank.Bayes.cond";
let currentVariable = "Rank.Bayes.cond";
let selectedCountry = null;
let intervalLo = 1;
let intervalHi = 200;
let mapOpen = false;

/* ── Sort state ── */
let sortKey = null;
let sortDir = 'asc';

/* ── Map colours ── */
const COL_SELECTED = '#f59e0b';
const COL_SELECTED_BDR = '#7b1450';
const COL_NOT_SIG_FILL = '#f59e0b';
const COL_NOT_SIG_BDR = '#d97706';
const COL_HIGHER_FILL = '#2563eb';
const COL_HIGHER_BDR = '#1d4ed8';
const COL_LOWER_FILL = '#be185d';
const COL_LOWER_BDR = '#9d174d';
const COL_NO_SEL_FILL = '#94a3b8';
const COL_OUT_FILL = '#cbd5e1';

/* ── Inject scrollable-table styling once ── */
(function injectTableScrollStyles() {
  if (document.getElementById('table-scroll-styles')) return;
  const style = document.createElement('style');
  style.id = 'table-scroll-styles';
  style.textContent = `
    .rank-table-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .rank-table {
      min-width: 760px;
    }
  `;
  document.head.appendChild(style);
})();

/* ── Population formatter (shared, used everywhere) ── */
function formatPopulationM(pop) {
  if (pop == null) return '—';
  return (pop / 1e6).toFixed(2) + ' M';
}

/* ── Map open/close ── */
function setMapOpen(open) {
  mapOpen = open;
  document.getElementById('dash-layout')?.classList.toggle('map-open', open);
  document.getElementById('map-panel')?.classList.toggle('visible', open);
  const btn = document.getElementById('btn-map-toggle');
  if (btn) btn.innerHTML = open
    ? '<i data-lucide="x" width="14" height="14"></i> Hide Map'
    : '<i data-lucide="map" width="14" height="14"></i> Show Map';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (open) setTimeout(() => window._map?.resize(), 350);
  renderTable(document.getElementById('table-search')?.value || '');
}

/* ── MapLibre map ── */
function currentTileUrl() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark
    ? 'https://s.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'
    : 'https://s.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png';
}

function formatSigFig(val, minDecimals = 3) {
  if (val == null || !Number.isFinite(val)) return '—';
  const num = Number(val);
  if (num === 0) return (0).toFixed(minDecimals);

  const magnitude = Math.floor(Math.log10(Math.abs(num)));
  const neededDecimals = magnitude >= 0 ? minDecimals : Math.max(minDecimals, -magnitude + 1);

  return num.toFixed(neededDecimals);
}

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [currentTileUrl()],
        tileSize: 256,
        attribution: '© CARTO © OpenStreetMap contributors'
      }
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }]
  },
  center: [10, 20],
  zoom: 1.4,
  minZoom: 0,
  maxZoom: 10,
  renderWorldCopies: false,
  attributionControl: true
});
window._map = map;
map.setMinZoom(-0.5);
function applyTiles() {
  const url = currentTileUrl();
  const source = map.getSource('basemap');
  if (!source) return;
  source.tiles = [url];
  const cache = map.style?.sourceCaches?.['basemap'];
  if (cache) {
    cache.clearTiles();
    cache.update(map.transform);
  }
  map.triggerRepaint();
}
map.on('themechange', () => setTimeout(applyTiles, 50));
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTimeout(applyTiles, 80));

/* ── Selected-country pin marker ── */
let selectedMarker = null;

/* Inject pin styling once, so the file stays self-contained without editing CSS files */
(function injectPinStyles() {
  if (document.getElementById('country-pin-styles')) return;
  const style = document.createElement('style');
  style.id = 'country-pin-styles';
  style.textContent = `
    .country-pin {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${COL_SELECTED};
      border: 2.5px solid ${COL_SELECTED_BDR};
      box-shadow: 0 1px 4px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.85);
      cursor: pointer;
    }
    .country-pin::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 6px;
      height: 6px;
      margin: -3px 0 0 -3px;
      border-radius: 50%;
      background: #fff;
    }
  `;
  document.head.appendChild(style);
})();

/* Fallback centroid: averages the largest ring of a (multi)polygon.
   Used only if Turf.js isn't loaded on the page. */
function fallbackCentroid(geometry) {
  const rings = geometry.type === 'Polygon'
    ? [geometry.coordinates[0]]
    : geometry.coordinates.map(poly => poly[0]);
  let largest = rings[0];
  let largestArea = 0;
  rings.forEach(ring => {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    area = Math.abs(area / 2);
    if (area > largestArea) { largestArea = area; largest = ring; }
  });
  let x = 0, y = 0;
  largest.forEach(pt => { x += pt[0]; y += pt[1]; });
  return [x / largest.length, y / largest.length];
}

function getCountryCentroid(geometry) {
  if (typeof turf !== 'undefined') {
    try {
      const feature = { type: 'Feature', geometry, properties: {} };
      const centerFeature = turf.centerOfMass(feature);
      return centerFeature.geometry.coordinates;
    } catch (e) {
      return fallbackCentroid(geometry);
    }
  }
  return fallbackCentroid(geometry);
}

function getCountryFeature(iso) {
  if (!worldGeoJSON || !iso) return null;
  return worldGeoJSON.features.find(f => f.properties.ISO_A3 === iso) || null;
}

function showCountryPin(iso) {
  clearCountryPin();
  const feature = getCountryFeature(iso);
  if (!feature) return;

  const center = getCountryCentroid(feature.geometry);
  if (!center || center.some(v => !Number.isFinite(v))) return;

  const el = document.createElement('div');
  el.className = 'country-pin';
  el.title = feature.properties.NAME || feature.properties.name || '';

  selectedMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat(center)
    .addTo(map);
}

function clearCountryPin() {
  if (selectedMarker) {
    selectedMarker.remove();
    selectedMarker = null;
  }
}

/* ── GeoJSON world polygons + country layers ── */
let worldGeoJSON = null;
let tooltipPopup = null;

map.on('load', () => {
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson')
    .then(r => r.json())
    .then(data => {
      // Normalize ISO_A3 for every feature (patches -99 codes) so promoteId works cleanly
      let unkCounter = 0;
      data.features.forEach(f => {
        const iso = resolveIso(f);
        f.properties.ISO_A3 = iso ?? `UNK_${unkCounter++}`;
      });
      worldGeoJSON = data;

      map.addSource('countries', {
        type: 'geojson',
        data: worldGeoJSON,
        promoteId: 'ISO_A3'
      });

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], COL_SELECTED,
            ['boolean', ['feature-state', 'notSig'], false], COL_NOT_SIG_FILL,
            ['==', ['feature-state', 'cmp'], 'higher'], COL_HIGHER_FILL,
            ['==', ['feature-state', 'cmp'], 'lower'], COL_LOWER_FILL,
            ['boolean', ['feature-state', 'inFilter'], false], COL_NO_SEL_FILL,
            ['boolean', ['feature-state', 'outOfFilter'], false], COL_OUT_FILL,
            ['boolean', ['feature-state', 'hasData'], false], '#d1d5db',
            '#e2e8f0'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 0.95,
            ['boolean', ['feature-state', 'notSig'], false], 0.22,
            ['==', ['feature-state', 'cmp'], 'higher'], 0.55,
            ['==', ['feature-state', 'cmp'], 'lower'], 0.55,
            ['boolean', ['feature-state', 'inFilter'], false], 0.75,
            ['boolean', ['feature-state', 'outOfFilter'], false], 0.3,
            ['boolean', ['feature-state', 'hasData'], false], 0.35,
            0.3
          ]
        }
      });

      map.addLayer({
        id: 'countries-border',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], COL_SELECTED_BDR,
            ['boolean', ['feature-state', 'notSig'], false], COL_NOT_SIG_BDR,
            ['==', ['feature-state', 'cmp'], 'higher'], COL_HIGHER_BDR,
            ['==', ['feature-state', 'cmp'], 'lower'], COL_LOWER_BDR,
            ['boolean', ['feature-state', 'hasData'], false], '#64748b',
            '#cbd5e1'
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 3,
            ['boolean', ['feature-state', 'notSig'], false], 1.5,
            ['==', ['feature-state', 'cmp'], 'higher'], 1.2,
            ['==', ['feature-state', 'cmp'], 'lower'], 1.2,
            ['boolean', ['feature-state', 'hasData'], false], 0.8,
            0.5
          ]
        }
      });

      // Click → select country
      map.on('click', 'countries-fill', (e) => {
        const iso = e.features[0]?.properties?.ISO_A3;
        if (!iso) return;
        const all = GAMES_DATA[currentGame] || [];
        const c = all.find(r => r.iso_a3 === iso);
        if (c) selectCountry(iso);
      });

      // Hover → tooltip + cursor + border highlight
      let hoveredIso = null;
      map.on('mousemove', 'countries-fill', (e) => {
        const iso = e.features[0]?.properties?.ISO_A3;
        const all = GAMES_DATA[currentGame] || [];
        const c = all.find(r => r.iso_a3 === iso);
        if (!c) {
          map.getCanvas().style.cursor = '';
          tooltipPopup?.remove();
          return;
        }
        map.getCanvas().style.cursor = 'pointer';

        if (hoveredIso && hoveredIso !== iso) {
          map.setFeatureState({ source: 'countries', id: hoveredIso }, { hover: false });
        }
        if (iso !== selectedCountry) {
          map.setFeatureState({ source: 'countries', id: iso }, { hover: true });
        }
        hoveredIso = iso;

        const rKey = RANKING_KEY[currentRanking];
        if (!tooltipPopup) tooltipPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
        tooltipPopup
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${c.country}</strong><br>Rank (${currentRanking}): ${c[rKey] ?? '—'}<br>Total medals: ${c.medal_total ?? '—'}<br>Per million: ${c.observed_mpm != null ? formatSigFig(c.observed_mpm) : '—'}`)
          .addTo(map);
      });

      map.on('mouseleave', 'countries-fill', () => {
        map.getCanvas().style.cursor = '';
        tooltipPopup?.remove();
        if (hoveredIso) {
          map.setFeatureState({ source: 'countries', id: hoveredIso }, { hover: false });
          hoveredIso = null;
        }
      });

      if (Object.keys(GAMES_DATA).length) renderMap();

      // If a country was already selected before the geojson finished loading, drop the pin now
      if (selectedCountry) showCountryPin(selectedCountry);
    })
    .catch(err => console.warn('GeoJSON failed to load:', err));
});

/* ── Helpers ── */
function getAllData() {
  return (GAMES_DATA[currentGame] || []).filter(c =>
    c[RANKING_KEY[currentRanking]] != null && (c['medal_total'] ?? 0) > 0
  );
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
  if (varKey === "population") return Number(val).toLocaleString();
  if (varKey === "NY.GDP.PCAP.KD") return "$" + Number(val).toLocaleString();
  if (varKey === "SP.DYN.LE00.IN") return Number(val).toFixed(1) + " yrs";
  if (varKey === "median_estimate_mpm") return Number(val).toFixed(3);
  return val;
}

/* ── Credible interval helper ── */
function fmtCI(c) {
  if (c.rank_credlow == null || c.rank_credhigh == null) return '—';
  return `${Math.round(c.rank_credlow)}\u2013${Math.round(c.rank_credhigh)}`;
}

/* ── Detail stat grid (shared) ── */
function buildDetailStatGrid(c) {
  const gdp = c['NY.GDP.PCAP.KD'] != null ? '$' + Number(c['NY.GDP.PCAP.KD']).toLocaleString() : '—';
  const life = c['SP.DYN.LE00.IN'] != null ? Number(c['SP.DYN.LE00.IN']).toFixed(1) + ' yrs' : '—';
  const post = c['median_estimate_mpm'] != null ? formatSigFig(c['median_estimate_mpm']) : '—';
  const ci = fmtCI(c);
  const dpRank = c['rank_dp'] ?? '—';
  const pcRank = c['rank_pc'] ?? '—';
  const totalRank = c['rank_total'] ?? '—';
  const medianBetaRank = c['rank_median_beta'] ?? '—';

  return `<div class="detail-stat-grid">
    <div class="detail-stat-item"><span class="detail-stat-val">${ci}</span><span class="detail-stat-lbl">95% credible interval</span></div>
    <div class="detail-stat-item"><span class="detail-stat-val">${gdp}</span><span class="detail-stat-lbl">GDP per capita</span></div>
    <div class="detail-stat-item"><span class="detail-stat-val">${life}</span><span class="detail-stat-lbl">Life expectancy</span></div>
    <div class="detail-stat-item"><span class="detail-stat-val">${post}</span><span class="detail-stat-lbl">Posterior median rate</span></div>
    <div class="detail-stat-item"><span class="detail-stat-val">${dpRank}</span><span class="detail-stat-lbl">DP rank</span></div>
    <div class="detail-stat-item"><span class="detail-stat-val">${pcRank}</span><span class="detail-stat-lbl">Per-capita rank</span></div>
    <div class="detail-stat-item"><span class="detail-stat-val">${totalRank}</span><span class="detail-stat-lbl">Total-medals rank</span></div>
    <div class="detail-stat-item"><span class="detail-stat-val">${medianBetaRank}</span><span class="detail-stat-lbl">Bayes median rank</span></div>
  </div>`;
}

/* ── Detail row HTML (full table mode, inline in table) ── */
function buildDetailHTML(c, colspan) {
  return `<tr class="detail-row" data-detail-iso="${c.iso_a3}">
    <td colspan="${colspan}" style="padding:0">
      <div class="detail-expand">
        <div class="detail-panel-header">
          <img src="https://flagcdn.com/24x18/${c.iso_a2?.toLowerCase()}.png" alt="${c.country} flag" width="24" height="18" loading="lazy" onerror="this.style.display='none'">
          <span class="detail-panel-title">${c.country}</span>
        </div>
        ${buildDetailStatGrid(c)}
      </div>
    </td>
  </tr>`;
}

/* ── Detail panel HTML (map-expanded mode, below map) ── */
function buildDetailPanelHTML(c) {
  return `<div class="detail-expand-panel">
    <div class="detail-panel-header">
      <img src="https://flagcdn.com/24x18/${c.iso_a2?.toLowerCase()}.png" alt="${c.country} flag" width="24" height="18" loading="lazy" onerror="this.style.display='none'">
      <span class="detail-panel-title">${c.country}</span>
    </div>
    ${buildDetailStatGrid(c)}
  </div>`;
}

/* ── Render detail panel below map ── */
function renderMapDetailPanel() {
  const panel = document.getElementById('map-detail-panel');
  if (!panel) return;
  if (!selectedCountry) {
    panel.innerHTML = '';
    panel.classList.remove('visible');
    return;
  }
  const all = GAMES_DATA[currentGame] || [];
  const c = all.find(r => r.iso_a3 === selectedCountry);
  if (!c) {
    panel.innerHTML = '';
    panel.classList.remove('visible');
    return;
  }
  panel.innerHTML = buildDetailPanelHTML(c);
  panel.classList.add('visible');
}

/* ── Animate detail row open ── */
function animateDetailOpen(detailRow) {
  const inner = detailRow.querySelector('.detail-expand');
  if (!inner) return;
  inner.style.maxHeight = '0';
  inner.style.overflow = 'hidden';
  inner.style.transition = 'max-height 0.32s cubic-bezier(0.16,1,0.3,1)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    inner.style.maxHeight = inner.scrollHeight + 'px';
  }));
}

/* ── Slider ── */
function initSlider() {
  const vKey = VARIABLE_KEY[currentVariable];
  const transform = VARIABLE_TRANSFORM[vKey] || 'linear';
  const vals = (GAMES_DATA[currentGame] || []).map(c => c[vKey]).filter(v => v != null && v > 0);
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
  const el = document.getElementById('slider-display');
  const vKey = VARIABLE_KEY[currentVariable];
  if (el) el.textContent = `${formatVal(Math.round(intervalLo), vKey)} – ${formatVal(Math.round(intervalHi), vKey)}`;
  updateSliderFill();
}

function updateSliderFill() {
  const lo = document.getElementById('slider-lo');
  const hi = document.getElementById('slider-hi');
  const fill = document.getElementById('track-fill');
  if (!lo || !hi || !fill) return;
  const min = parseFloat(lo.min), max = parseFloat(lo.max);
  const range = (max - min) || 1;
  const left = ((parseFloat(lo.value) - min) / range) * 100;
  const right = ((parseFloat(hi.value) - min) / range) * 100;
  fill.style.left = left + '%';
  fill.style.width = (right - left) + '%';
}

/* ── Map render (MapLibre feature-state driven, no layer teardown) ── */
function renderMap() {
  if (!worldGeoJSON || !map.getSource('countries')) return;

  const all = GAMES_DATA[currentGame] || [];
  const filtered = getFilteredData();
  const inSet = new Set(filtered.map(c => c.iso_a3));
  const rKey = RANKING_KEY[currentRanking];
  const dataByIso = {};
  all.forEach(c => dataByIso[c.iso_a3] = c);
  const selectedData = selectedCountry ? dataByIso[selectedCountry] : null;
  const selRank = selectedData ? (selectedData[rKey] ?? null) : null;

  worldGeoJSON.features.forEach(feature => {
    const iso = feature.properties.ISO_A3;
    if (!iso || iso.startsWith('UNK_')) return;

    const c = dataByIso[iso];
    const hasData = !!c;
    const inFilter = inSet.has(iso);
    const isSelected = iso === selectedCountry;
    const isNotSig = selectedData ? (selectedData[iso] === true) : false;
    const countryRank = c ? c[rKey] : null;

    let cmp = null;
    if (selectedCountry && !isSelected && hasData && inFilter && !isNotSig && selRank != null && countryRank != null) {
      cmp = countryRank < selRank ? 'higher' : 'lower';
    }

    map.setFeatureState(
      { source: 'countries', id: iso },
      {
        hasData,
        inFilter: !selectedCountry ? inFilter : false,
        outOfFilter: !selectedCountry ? !inFilter : (selectedCountry && !isSelected && !inFilter),
        selected: isSelected,
        notSig: selectedCountry ? (isNotSig && inFilter) : false,
        cmp
      }
    );
  });

  // Keep the pin in sync with whatever is currently selected
  if (selectedCountry) {
    showCountryPin(selectedCountry);
  } else {
    clearCountryPin();
  }

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
      <span style="width:14px;height:14px;border-radius:3px;background:rgba(245,158,11,0.22);display:inline-block;border:1.5px solid ${COL_NOT_SIG_BDR}"></span> Not significantly different
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px">
      <span style="width:14px;height:14px;border-radius:3px;background:${COL_HIGHER_FILL};display:inline-block"></span> Significantly ranked higher
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px">
      <span style="width:14px;height:14px;border-radius:3px;background:${COL_LOWER_FILL};display:inline-block"></span> Significantly ranked lower
    </span>
  `;
}

/* ── Table render ── */
/* ── Table render ── */
function renderTable(search) {
  const thead = document.getElementById('ranking-thead');
  const tbody = document.getElementById('ranking-tbody');
  const rKey = RANKING_KEY[currentRanking];
  const isBayesRank = currentRanking === 'Rank.Bayes.cond' || currentRanking === 'Rank.Median.Bayes';

  const vKey = VARIABLE_KEY[currentVariable];
  const baseKeys = new Set([rKey, 'medal_total', 'population', 'observed_mpm', 'medals.multi.winners', 'rank_mean_beta']);
  const showVariableCol = vKey && !baseKeys.has(vKey);

  const colCount = 7 + (!isBayesRank ? 1 : 0) + (showVariableCol ? 1 : 0);

  const tableEl = thead?.closest('table');
  if (tableEl) {
    tableEl.classList.add('rank-table');
    let wrapper = tableEl.parentElement;
    if (!wrapper || !wrapper.classList.contains('rank-table-scroll')) {
      wrapper = document.createElement('div');
      wrapper.className = 'rank-table-scroll';
      tableEl.parentElement.insertBefore(wrapper, tableEl);
      wrapper.appendChild(tableEl);
    }
  }

  if (thead) {
thead.innerHTML = `<tr>
  <th class="rank-num"><sub>#</sub></th>
  <th class="rank-num" data-sort="${rKey}">Rank<span class="sort-arrow"></span></th>
  <th data-sort="country">Country<span class="sort-arrow"></span></th>
  <th style="text-align:right" data-sort="medal_total">Total<span class="sort-arrow"></span></th>
  <th style="text-align:right" data-sort="population">Population<span class="sort-arrow"></span></th>
  <th style="text-align:right" data-sort="observed_mpm">Per-mill<span class="sort-arrow"></span></th>
  <th style="text-align:right" data-sort="medals.multi.winners">Multi<span class="sort-arrow"></span></th>
  ${!isBayesRank ? `<th style="text-align:right" data-sort="rank_mean_beta">Bayes Mean Rank<span class="sort-arrow"></span></th>` : ``}
  ${showVariableCol ? `<th style="text-align:right" data-sort="${vKey}">${VARIABLE_LABEL[currentVariable] || currentVariable}<span class="sort-arrow"></span></th>` : ``}
</tr>`;

    thead.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }
        renderTable(document.getElementById('table-search')?.value);
      });
    });
    thead.querySelectorAll('th[data-sort]').forEach(th => {
      const key = th.dataset.sort;
      const active = sortKey ? sortKey === key : key === rKey;
      th.classList.toggle('sort-active', active);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = active ? (sortDir === 'asc' ? '▲' : '▼') : '';
    });
  }

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
  if (countEl) countEl.textContent = `${data.length} countries`;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:2rem;color:var(--color-text-muted)">No results</td></tr>`;
    return;
  }

  const all = GAMES_DATA[currentGame] || [];
  const selectedData = selectedCountry ? (all.find(r => r.iso_a3 === selectedCountry) ?? null) : null;

  const rows = data.map((c, idx) => {
    const subRank = idx + 1;
    let rowStyle = '';
    if (selectedCountry === c.iso_a3) {
      rowStyle = `background-color:${COL_SELECTED};color:#1c1917`;
    } else if (selectedData) {
      rowStyle = (selectedData[c.iso_a3] === true) ? 'background-color:rgba(245,158,11,0.12)' : 'opacity:0.4';
    }

    const popM = formatPopulationM(c.population);
    const mpm = formatSigFig(c.observed_mpm);
    const multi = c['medals.multi.winners'] ?? '—';
    const flagCell = `<td class="flag-cell"><img src="https://flagcdn.com/24x18/${c.iso_a2?.toLowerCase()}.png" alt="${c.country} flag" width="24" height="18" loading="lazy" onerror="this.style.display='none'"></td>`;

    const rankCellContent = isBayesRank
      ? `${c[rKey] ?? '—'}<br><span style="font-size:0.8em;opacity:0.7">${fmtCI(c)}</span>`
      : `${c[rKey] ?? '—'}`;
    const bayesMeanCell = !isBayesRank
      ? `<td style="text-align:right">${c.rank_mean_beta ?? '—'}<br><span style="font-size:0.8em;opacity:0.7">${fmtCI(c)}</span></td>`
      : '';
    const variableCell = showVariableCol
      ? `<td style="text-align:right">${formatVal(c[vKey], vKey)}</td>`
      : '';

const rowHtml = `<tr data-iso="${c.iso_a3}" style="${rowStyle}" class="country-row">
  <td class="rank-num sub-rank-cell">${subRank}</td>
  <td class="rank-num">${rankCellContent}</td>
  <td class="country-name">${c.country}</td>
  <td class="medal-cell">${c.medal_total ?? '—'}</td>
  <td style="text-align:right">${popM}</td>
  <td style="text-align:right">${mpm}</td>
  <td style="text-align:right">${multi}</td>
  ${bayesMeanCell}
  ${variableCell}
</tr>`;

    const mapIsOpen = document.getElementById('dash-layout')?.classList.contains('map-open');
    if (selectedCountry && c.iso_a3 === selectedCountry && !mapIsOpen) {
      return rowHtml + buildDetailHTML(c, colCount);
    }
    return rowHtml;
  });

  tbody.innerHTML = rows.join('');

  const detailRow = tbody.querySelector('.detail-row');
  if (detailRow) animateDetailOpen(detailRow);

  const selRow = tbody.querySelector(`tr.country-row[data-iso="${selectedCountry}"]`);
  if (selRow) selRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  tbody.querySelectorAll('tr.country-row').forEach(row => {
    row.addEventListener('click', () => selectCountry(row.dataset.iso));
  });

  const sigLegend = document.getElementById('sig-legend');
  if (sigLegend) sigLegend.classList.toggle('visible', !!selectedCountry);

  renderMapDetailPanel();
}

/* ── Select country ── */
function selectCountry(iso) {
  selectedCountry = selectedCountry === iso ? null : iso;
  if (selectedCountry) {
    showCountryPin(selectedCountry);
    centerMapOnCountry(selectedCountry);
  } else {
    clearCountryPin();
  }
  renderMap();
  renderTable(document.getElementById('table-search')?.value);
}

function centerMapOnCountry(iso) {
  const feature = getCountryFeature(iso);
  if (!feature) return;

  const center = getCountryCentroid(feature.geometry);
  if (!center || center.some(v => !Number.isFinite(v))) return;

  map.easeTo({
    center,
    zoom: map.getZoom(),
    duration: 600
  });
}

/* ── Refresh ── */
function refresh() {
  initSlider();
  renderMap();
  renderTable(document.getElementById('table-search')?.value);
}

/* ── Controls ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sel-games')?.addEventListener('change', e => {
    currentGame = e.target.value;
    selectedCountry = null;
    clearCountryPin();
    refresh();
  });

  document.getElementById('sel-ranking')?.addEventListener('change', e => {
    currentRanking = e.target.value;
    renderMap();
    renderTable(document.getElementById('table-search')?.value);
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
    clearCountryPin();
    refresh();
  });

  document.getElementById('btn-map-toggle')?.addEventListener('click', () => setMapOpen(!mapOpen));

  const lo = document.getElementById('slider-lo');
  const hi = document.getElementById('slider-hi');

  function onSliderChange() {
    const loVal = parseFloat(lo.value);
    const hiVal = parseFloat(hi.value);
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
    renderTable(document.getElementById('table-search')?.value);
  }

  lo?.addEventListener('input', onSliderChange);
  hi?.addEventListener('input', onSliderChange);

  document.querySelectorAll('.rank-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortKey = key; sortDir = 'asc'; }
      renderTable(document.getElementById('table-search')?.value);
    });
  });
});