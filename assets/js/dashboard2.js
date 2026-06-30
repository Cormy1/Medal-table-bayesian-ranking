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
  "Rank.Bayes.cond":  "Rank.Bayes.cond",
  "Rank.Median.Bayes":"Rank.Median.Bayes",
  "Rank.dp":          "Rank.dp",
  "Rank.percap":      "Rank.percap",
  "Rank.Total":       "Rank.Total"
};

const VARIABLE_KEY = {
  "Rank.Bayes.cond":       "Rank.Bayes.cond",
  "Rank.Median.Bayes":     "Rank.Median.Bayes",
  "Rank.dp":               "Rank.dp",
  "Rank.percap":           "Rank.percap",
  "Rank.Total":            "Rank.Total",
  "Post_permil":           "Post_permil",
  "total_pop_july":        "total_pop_july",
  "NY.GDP.PCAP.KD":        "NY.GDP.PCAP.KD",
  "life_expectancy_birth": "life_expectancy_birth"
};

const VARIABLE_IS_RANK = new Set([
  "Rank.Bayes.cond","Rank.Median.Bayes","Rank.dp","Rank.percap","Rank.Total"
]);

/* ── State ── */
let currentGame     = "paris-2024";
let currentRanking  = "Rank.Bayes.cond";
let currentVariable = "Rank.Bayes.cond";
let selectedCountry = null;
let intervalLo      = 1;
let intervalHi      = 200;

/* ── Colour scale (RdYlGn, green = best rank) ── */
const PALETTE = ['#1a6b3c','#3d9e5f','#74c476','#bae4b3','#ffffcc','#fed976','#fd8d3c','#e31a1c'];
function getColour(val, min, max, invert) {
  if (val == null) return '#cbd5e0';
  let t = (val - min) / (max - min || 1);
  if (invert) t = 1 - t;
  t = Math.max(0, Math.min(1, t));
  return PALETTE[Math.min(PALETTE.length - 1, Math.floor(t * PALETTE.length))];
}

/* ── Helpers ── */
function getAllData() {
  return (GAMES_DATA[currentGame] || []).filter(c => c[VARIABLE_KEY[currentVariable]] != null);
}

function getFilteredData() {
  const rKey = RANKING_KEY[currentRanking];
  const vKey = VARIABLE_KEY[currentVariable];
  return getAllData()
    .filter(c => c[vKey] >= intervalLo && c[vKey] <= intervalHi)
    .sort((a, b) => a[rKey] - b[rKey]);
}

function formatVal(val, varKey) {
  if (val == null) return '—';
  if (varKey === "total_pop_july")        return Number(val).toLocaleString();
  if (varKey === "NY.GDP.PCAP.KD")        return "$" + Number(val).toLocaleString();
  if (varKey === "life_expectancy_birth") return Number(val).toFixed(1) + " yrs";
  if (varKey === "Post_permil")           return Number(val).toFixed(3);
  return val;
}

/* ── Slider ── */
function initSlider() {
  const vKey = VARIABLE_KEY[currentVariable];
  const vals = getAllData().map(c => c[vKey]).filter(v => v != null);
  if (!vals.length) return;
  const min = Math.min(...vals), max = Math.max(...vals);
  intervalLo = min; intervalHi = max;
  const step = VARIABLE_IS_RANK.has(currentVariable) ? 1 : (max - min) / 100;
  const lo = document.getElementById('slider-lo');
  const hi = document.getElementById('slider-hi');
  if (lo) { lo.min = min; lo.max = max; lo.value = min; lo.step = step; }
  if (hi) { hi.min = min; hi.max = max; hi.value = max; hi.step = step; }
  updateSliderDisplay();
}

function updateSliderDisplay() {
  const el = document.getElementById('slider-display');
  const vKey = VARIABLE_KEY[currentVariable];
  if (el) el.textContent = formatVal(intervalLo, vKey) + ' – ' + formatVal(intervalHi, vKey);
}

/* ── Globe (Globe.gl) ── */
let globeInstance = null;

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function buildGlobeColours() {
  const all      = GAMES_DATA[currentGame] || [];
  const filtered = getFilteredData();
  const inSet    = new Set(filtered.map(c => c.iso_a3));
  const vKey     = VARIABLE_KEY[currentVariable];
  const rKey     = RANKING_KEY[currentRanking];
  const isRank   = VARIABLE_IS_RANK.has(currentVariable);

  const vals = all.filter(c => c[vKey] != null).map(c => c[vKey]);
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals) : 1;

  const dataByIso = {};
  all.forEach(c => { dataByIso[c.iso_a3] = c; });

  const selRank = selectedCountry
    ? (dataByIso[selectedCountry]?.[rKey] ?? null)
    : null;

  return { inSet, vKey, rKey, isRank, minV, maxV, dataByIso, selRank };
}

function getPolygonCapColour(feature, ctx) {
  const { inSet, vKey, isRank, minV, maxV, dataByIso } = ctx;
  const iso = feature.properties.ISO_A3 || '';
  const c   = dataByIso[iso];
  if (!c) return isDark() ? 'rgba(60,60,70,0.7)' : 'rgba(200,200,210,0.7)';
  const inFilter = inSet.has(iso);
  if (!inFilter) return isDark() ? 'rgba(70,70,80,0.5)' : 'rgba(180,180,190,0.5)';
  return getColour(c[vKey], minV, maxV, isRank);
}

function getPolygonStrokeColour(feature, ctx) {
  const { inSet, rKey, dataByIso, selRank } = ctx;
  const iso = feature.properties.ISO_A3 || '';
  const c   = dataByIso[iso];
  if (!c || !inSet.has(iso)) return isDark() ? '#555' : '#aaa';
  if (selectedCountry && selRank != null) {
    const cr = c[rKey];
    if (iso === selectedCountry) return '#7b1450';
    if (cr < selRank)            return '#003082';
    if (cr > selRank)            return '#c0181f';
  }
  if (iso === selectedCountry)   return '#7b1450';
  return isDark() ? '#666' : '#999';
}

function buildTooltip(feature, ctx) {
  const { vKey, rKey, dataByIso } = ctx;
  const iso = feature.properties.ISO_A3 || '';
  const c   = dataByIso[iso];
  if (!c) return null;
  return `
    <div style="background:var(--color-surface);border:1px solid var(--color-border);
                border-radius:6px;padding:8px 12px;font-size:13px;line-height:1.6;
                box-shadow:0 4px 12px rgba(0,0,0,0.15)">
      <strong style="font-size:14px">${c.country}</strong><br>
      Rank: ${c[rKey] ?? '—'}<br>
      Total medals: ${c['Medals.total'] ?? '—'}<br>
      Per million: ${c['Medals.permil'] != null ? Number(c['Medals.permil']).toFixed(2) : '—'}<br>
      ${currentVariable}: ${formatVal(c[vKey], vKey)}
    </div>`;
}

function renderMap() {
  if (!worldGeoJSON) return;

  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  const ctx = buildGlobeColours();

  if (!globeInstance) {
    /* ── First render: initialise Globe.gl ── */
    globeInstance = Globe({ animateIn: true })(mapEl);

    globeInstance
      .globeImageUrl(null)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor(isDark() ? '#1a3a5c' : '#a8c8f0')
      .atmosphereAltitude(0.15)
      .polygonsData(worldGeoJSON.features)
      .polygonAltitude(f => {
        const iso = f.properties.ISO_A3 || '';
        return iso === selectedCountry ? 0.025 : 0.008;
      })
      .polygonCapColor(f  => getPolygonCapColour(f, buildGlobeColours()))
      .polygonSideColor(() => isDark() ? 'rgba(30,30,40,0.6)' : 'rgba(150,150,160,0.4)')
      .polygonStrokeColor(f => getPolygonStrokeColour(f, buildGlobeColours()))
      .polygonLabel(f    => buildTooltip(f, buildGlobeColours()))
      .onPolygonClick(f  => {
        const iso = f.properties.ISO_A3 || '';
        if (iso) selectCountry(iso);
      })
      .onPolygonHover(f  => {
        mapEl.style.cursor = f ? 'pointer' : 'grab';
      });

    /* Auto-rotate slowly */
    globeInstance.controls().autoRotate      = true;
    globeInstance.controls().autoRotateSpeed = 0.4;
    globeInstance.controls().enableDamping   = true;
    globeInstance.controls().dampingFactor   = 0.1;

    /* Stop rotating on user interaction */
    mapEl.addEventListener('mousedown', () => {
      globeInstance.controls().autoRotate = false;
    });
    /* Resume after 4s idle */
    let rotateTimer;
    mapEl.addEventListener('mouseup', () => {
      clearTimeout(rotateTimer);
      rotateTimer = setTimeout(() => {
        if (globeInstance) globeInstance.controls().autoRotate = true;
      }, 4000);
    });

    /* Theme change — update atmosphere + side colours */
    document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
      setTimeout(() => {
        globeInstance
          .atmosphereColor(isDark() ? '#1a3a5c' : '#a8c8f0')
          .polygonSideColor(() => isDark() ? 'rgba(30,30,40,0.6)' : 'rgba(150,150,160,0.4)');
        updateGlobeColours();
      }, 80);
    });

  } else {
    /* ── Subsequent renders: just update colours ── */
    updateGlobeColours();
  }

  renderLegend(ctx.minV, ctx.maxV);
  renderBorderLegend();
}

function updateGlobeColours() {
  if (!globeInstance) return;
  globeInstance
    .polygonAltitude(f => {
      const iso = f.properties.ISO_A3 || '';
      return iso === selectedCountry ? 0.025 : 0.008;
    })
    .polygonCapColor(f    => getPolygonCapColour(f, buildGlobeColours()))
    .polygonStrokeColor(f => getPolygonStrokeColour(f, buildGlobeColours()))
    .polygonLabel(f       => buildTooltip(f, buildGlobeColours()));

  /* Fly to selected country */
  if (selectedCountry) {
    const all = GAMES_DATA[currentGame] || [];
    const c   = all.find(x => x.iso_a3 === selectedCountry);
    if (c?.latitude != null && c?.longitude != null) {
      globeInstance.pointOfView({ lat: c.latitude, lng: c.longitude, altitude: 1.8 }, 800);
    }
  }
}

/* ── Legend ── */
function renderLegend(minV, maxV) {
  const el = document.getElementById('map-legend');
  if (!el) return;
  const vKey   = VARIABLE_KEY[currentVariable];
  const isRank = VARIABLE_IS_RANK.has(currentVariable);
  el.innerHTML = Array.from({length: 5}, (_, i) => {
    const v = minV + (maxV - minV) * (i / 4);
    return `<span class="legend-item"><span class="legend-swatch" style="background:${getColour(v, minV, maxV, isRank)}"></span>${formatVal(Math.round(v * 10) / 10, vKey)}</span>`;
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
  const tbody   = document.getElementById('ranking-tbody');
  const rKey    = RANKING_KEY[currentRanking];
  let data      = getFilteredData();
  if (search) data = data.filter(c => c.country.toLowerCase().includes(search.toLowerCase()));
  const countEl = document.getElementById('table-count');
  if (countEl) countEl.textContent = data.length + ' countries';
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-text-muted)">No results</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr data-iso="${c.iso_a3}" class="${selectedCountry === c.iso_a3 ? 'selected' : ''}">
      <td class="rank-num">${c[rKey]}</td>
      <td class="flag-cell"><img src="https://flagcdn.com/24x18/${c.iso_a2?.toLowerCase()}.png" alt="${c.country} flag" width="24" height="18" loading="lazy" onerror="this.style.display='none'"></td>
      <td class="country-name">${c.country}</td>
      <td class="medal-cell medal-gold">${c['Medals.total']}</td>
      <td class="medal-cell">${c['Medals.permil'] != null ? Number(c['Medals.permil']).toFixed(2) : '—'}</td>
    </tr>
  `).join('');
  tbody.querySelectorAll('tr').forEach(row =>
    row.addEventListener('click', () => selectCountry(row.dataset.iso))
  );
}

/* ── Country selection ── */
function selectCountry(iso) {
  selectedCountry = (selectedCountry === iso) ? null : iso;
  renderTable(document.getElementById('table-search')?.value);
  updateGlobeColours();
  renderLegend(...(() => {
    const ctx = buildGlobeColours(); return [ctx.minV, ctx.maxV];
  })());
  renderBorderLegend();
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
  const c    = (GAMES_DATA[currentGame] || []).find(x => x.iso_a3 === selectedCountry);
  if (!c) return;
  if (empty) empty.style.display = 'none';
  panel?.classList.add('visible');
  document.getElementById('detail-name').textContent     = c.country;
  document.getElementById('d-rank').textContent          = c[rKey];
  document.getElementById('d-medals').textContent        = c['Medals.total'];
  document.getElementById('d-percap').textContent        = c['Medals.permil']         != null ? Number(c['Medals.permil']).toFixed(2)           : '—';
  document.getElementById('d-pop').textContent           = c['total_pop_july']         != null ? Number(c['total_pop_july']).toLocaleString()     : '—';
  document.getElementById('d-gdp').textContent           = c['NY.GDP.PCAP.KD']         != null ? "$" + Number(c['NY.GDP.PCAP.KD']).toLocaleString() : '—';
  document.getElementById('d-life').textContent          = c['life_expectancy_birth']  != null ? Number(c['life_expectancy_birth']).toFixed(1)    : '—';
  document.getElementById('d-postpermil').textContent    = c['Post_permil']            != null ? Number(c['Post_permil']).toFixed(3)              : '—';
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
  .addEventListener('change', e => { currentGame = e.target.value; selectedCountry = null; refresh(); });
document.getElementById('sel-ranking')
  .addEventListener('change', e => { currentRanking = e.target.value; refresh(); });
document.getElementById('sel-variable')
  .addEventListener('change', e => { currentVariable = e.target.value; selectedCountry = null; refresh(); });
document.getElementById('btn-reset')
  .addEventListener('click', () => {
    selectedCountry = null;
    if (globeInstance) globeInstance.pointOfView({ lat: 20, lng: 10, altitude: 2.5 }, 800);
    refresh();
  });
document.getElementById('detail-close')
  ?.addEventListener('click', () => { selectedCountry = null; renderTable(); updateGlobeColours(); renderBorderLegend(); updateDetail(); });
document.getElementById('table-search')
  ?.addEventListener('input', e => renderTable(e.target.value));
document.getElementById('slider-lo')?.addEventListener('input', e => {
  intervalLo = Math.min(Number(e.target.value), intervalHi);
  e.target.value = intervalLo;
  updateSliderDisplay();
  renderTable(document.getElementById('table-search')?.value);
  updateGlobeColours();
});
document.getElementById('slider-hi')?.addEventListener('input', e => {
  intervalHi = Math.max(Number(e.target.value), intervalLo);
  e.target.value = intervalHi;
  updateSliderDisplay();
  renderTable(document.getElementById('table-search')?.value);
  updateGlobeColours();
});