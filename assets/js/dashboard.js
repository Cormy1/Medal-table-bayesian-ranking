/* ══════════════════════════════════════════════
   dashboard.js — All dashboard logic
   Only loaded on dashboard.html
   ══════════════════════════════════════════════ */

/* ── Data ──────────────────────────────────────
   Replace GAMES_DATA with a fetch() once app_data.json is ready:

   fetch('./assets/data/app_data.json')
     .then(r => r.json())
     .then(rows => {
       rows.forEach(r => {
         if (!GAMES_DATA[r.slug_game]) GAMES_DATA[r.slug_game] = [];
         GAMES_DATA[r.slug_game].push(r);
       });
       refresh();
     });
*/
const GAMES_DATA = {
  "tokyo-2020": [
    { iso:"USA", name:"United States",  rank_bayes_mean:1,  rank_percap:28, rank_uindex:3,  rank_total:1,  medals_total:113, medals_percap:0.34, post_permil:0.34, pop:331000,  gdp:63544, life_exp:78.9, lat:38,   lng:-97  },
    { iso:"CHN", name:"China",          rank_bayes_mean:2,  rank_percap:45, rank_uindex:2,  rank_total:2,  medals_total:88,  medals_percap:0.06, post_permil:0.06, pop:1411780, gdp:12556, life_exp:76.9, lat:35,   lng:105  },
    { iso:"GBR", name:"Great Britain",  rank_bayes_mean:3,  rank_percap:8,  rank_uindex:5,  rank_total:4,  medals_total:65,  medals_percap:0.96, post_permil:0.96, pop:67200,   gdp:40285, life_exp:81.2, lat:55,   lng:-3   },
    { iso:"AUS", name:"Australia",      rank_bayes_mean:4,  rank_percap:5,  rank_uindex:6,  rank_total:6,  medals_total:46,  medals_percap:1.79, post_permil:1.79, pop:25690,   gdp:51812, life_exp:83.0, lat:-27,  lng:133  },
    { iso:"NED", name:"Netherlands",    rank_bayes_mean:5,  rank_percap:3,  rank_uindex:9,  rank_total:9,  medals_total:36,  medals_percap:2.06, post_permil:2.06, pop:17440,   gdp:58061, life_exp:82.3, lat:52.3, lng:5.3  },
    { iso:"NZL", name:"New Zealand",    rank_bayes_mean:6,  rank_percap:1,  rank_uindex:15, rank_total:15, medals_total:20,  medals_percap:3.94, post_permil:3.94, pop:5085,    gdp:41791, life_exp:82.1, lat:-41,  lng:174  },
    { iso:"FRA", name:"France",         rank_bayes_mean:7,  rank_percap:15, rank_uindex:8,  rank_total:8,  medals_total:33,  medals_percap:0.49, post_permil:0.49, pop:67390,   gdp:43519, life_exp:82.5, lat:46,   lng:2    },
    { iso:"GER", name:"Germany",        rank_bayes_mean:8,  rank_percap:14, rank_uindex:10, rank_total:10, medals_total:37,  medals_percap:0.44, post_permil:0.44, pop:83240,   gdp:46468, life_exp:81.3, lat:51,   lng:10   },
    { iso:"ITA", name:"Italy",          rank_bayes_mean:9,  rank_percap:10, rank_uindex:5,  rank_total:5,  medals_total:40,  medals_percap:0.68, post_permil:0.68, pop:59550,   gdp:32192, life_exp:83.5, lat:42,   lng:12   },
    { iso:"JPN", name:"Japan",          rank_bayes_mean:10, rank_percap:22, rank_uindex:3,  rank_total:3,  medals_total:58,  medals_percap:0.46, post_permil:0.46, pop:125680,  gdp:39313, life_exp:84.3, lat:36,   lng:138  },
    { iso:"CAN", name:"Canada",         rank_bayes_mean:11, rank_percap:9,  rank_uindex:11, rank_total:11, medals_total:24,  medals_percap:0.63, post_permil:0.63, pop:38010,   gdp:43278, life_exp:82.7, lat:60,   lng:-96  },
    { iso:"KEN", name:"Kenya",          rank_bayes_mean:12, rank_percap:4,  rank_uindex:19, rank_total:19, medals_total:10,  medals_percap:0.19, post_permil:0.19, pop:54320,   gdp:1838,  life_exp:66.7, lat:0,    lng:38   },
    { iso:"NOR", name:"Norway",         rank_bayes_mean:13, rank_percap:2,  rank_uindex:18, rank_total:18, medals_total:8,   medals_percap:1.48, post_permil:1.48, pop:5400,    gdp:67392, life_exp:83.2, lat:62,   lng:10   },
    { iso:"JAM", name:"Jamaica",        rank_bayes_mean:14, rank_percap:6,  rank_uindex:20, rank_total:20, medals_total:9,   medals_percap:3.03, post_permil:3.03, pop:2961,    gdp:5422,  life_exp:74.5, lat:18,   lng:-77  },
    { iso:"BRA", name:"Brazil",         rank_bayes_mean:15, rank_percap:30, rank_uindex:12, rank_total:12, medals_total:21,  medals_percap:0.10, post_permil:0.10, pop:213990,  gdp:7507,  life_exp:75.9, lat:-10,  lng:-55  },
    { iso:"HUN", name:"Hungary",        rank_bayes_mean:16, rank_percap:11, rank_uindex:14, rank_total:14, medals_total:20,  medals_percap:2.04, post_permil:2.04, pop:9770,    gdp:18728, life_exp:76.7, lat:47,   lng:19   },
    { iso:"KOR", name:"South Korea",    rank_bayes_mean:17, rank_percap:20, rank_uindex:7,  rank_total:7,  medals_total:20,  medals_percap:0.39, post_permil:0.39, pop:51740,   gdp:31631, life_exp:83.5, lat:36,   lng:128  },
    { iso:"ETH", name:"Ethiopia",       rank_bayes_mean:18, rank_percap:16, rank_uindex:30, rank_total:30, medals_total:7,   medals_percap:0.06, post_permil:0.06, pop:117900,  gdp:936,   life_exp:65.5, lat:9,    lng:40   },
    { iso:"SWE", name:"Sweden",         rank_bayes_mean:19, rank_percap:12, rank_uindex:17, rank_total:17, medals_total:18,  medals_percap:1.74, post_permil:1.74, pop:10350,   gdp:55218, life_exp:82.8, lat:62,   lng:15   },
    { iso:"CUB", name:"Cuba",           rank_bayes_mean:20, rank_percap:7,  rank_uindex:16, rank_total:16, medals_total:15,  medals_percap:1.33, post_permil:1.33, pop:11320,   gdp:8822,  life_exp:78.8, lat:22,   lng:-80  }
  ]
};
["rio-2016","london-2012","beijing-2008"].forEach(k => {
  GAMES_DATA[k] = GAMES_DATA["tokyo-2020"].map(c => ({
    ...c,
    medals_total:  Math.max(1, c.medals_total + Math.round((Math.random()-0.5)*15)),
    medals_percap: +(c.medals_percap * (0.7 + Math.random()*0.6)).toFixed(2)
  }));
});

/* ── Key maps (matching Shiny variable names exactly) ── */
const RANKING_KEY = {
  "Rank.Bayes.cond":       "rank_bayes_mean",
  "Rank.Median.Bayes":     "rank_bayes_mean",
  "Rank.dp":               "rank_uindex",
  "Rank.percap":           "rank_percap",
  "Rank.Total":            "rank_total"
};
const VARIABLE_KEY = {
  "Rank.Bayes.cond":       "rank_bayes_mean",
  "Rank.Median.Bayes":     "rank_bayes_mean",
  "Rank.dp":               "rank_uindex",
  "Rank.percap":           "rank_percap",
  "Rank.Total":            "rank_total",
  "Post_permil":           "post_permil",
  "total_pop_july":        "pop",
  "NY.GDP.PCAP.KD":        "gdp",
  "life_expectancy_birth": "life_exp"
};
const VARIABLE_IS_RANK = new Set([
  "Rank.Bayes.cond","Rank.Median.Bayes","Rank.dp","Rank.percap","Rank.Total"
]);

/* ── State ── */
let currentGame     = "tokyo-2020";
let currentRanking  = "Rank.Bayes.cond";
let currentVariable = "Rank.Bayes.cond";
let selectedCountry = null;
let intervalLo      = 1;
let intervalHi      = 20;

/* ── Colour scale (RdYlGn proxy, green = best rank) ── */
const PALETTE = ['#1a6b3c','#3d9e5f','#74c476','#bae4b3','#ffffcc','#fed976','#fd8d3c','#e31a1c'];
function getColour(val, min, max, invert) {
  if (val == null) return '#cbd5e0';
  let t = (val - min) / (max - min || 1);
  if (invert) t = 1 - t;
  t = Math.max(0, Math.min(1, t));
  return PALETTE[Math.min(PALETTE.length - 1, Math.floor(t * PALETTE.length))];
}

/* ── Leaflet map ── */
const map = L.map('map', { worldCopyJump: false }).setView([20, 10], 2);
window._map = map;
let tileLayer;

function applyTiles() {
  if (tileLayer) map.removeLayer(tileLayer);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  tileLayer = L.tileLayer(
    dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    { attribution: '© <a href="https://carto.com/" target="_blank">CARTO</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>',
      subdomains: 'abcd', maxZoom: 19 }
  ).addTo(map);
}
applyTiles();
map.on('themechange', () => setTimeout(applyTiles, 50));
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTimeout(applyTiles, 80));

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
  if (varKey === "life_expectancy_birth") return val.toFixed(1) + " yrs";
  if (varKey === "Post_permil")           return val.toFixed(3);
  return val;
}

/* ── Slider ── */
function initSlider() {
  const vKey = VARIABLE_KEY[currentVariable];
  const vals = getAllData().map(c => c[vKey]).filter(v => v != null);
  if (!vals.length) return;
  const min = Math.min(...vals), max = Math.max(...vals);
  intervalLo = min; intervalHi = max;
  const isRank = VARIABLE_IS_RANK.has(currentVariable);
  const step   = isRank ? 1 : (max - min) / 100;
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

/* ── Map render ── */
let circleMarkers = [];
function renderMap() {
  circleMarkers.forEach(m => m.remove());
  circleMarkers = [];
  const all      = getAllData();
  const filtered = getFilteredData();
  const inSet    = new Set(filtered.map(c => c.iso));
  const vKey     = VARIABLE_KEY[currentVariable];
  const rKey     = RANKING_KEY[currentRanking];
  const isRank   = VARIABLE_IS_RANK.has(currentVariable);
  const vals     = all.map(c => c[vKey]).filter(v => v != null);
  const minV     = Math.min(...vals), maxV = Math.max(...vals);
  const selRank  = selectedCountry
    ? (GAMES_DATA[currentGame] || []).find(c => c.iso === selectedCountry)?.[rKey]
    : null;

  all.forEach(c => {
    const inFilter = inSet.has(c.iso);
    const fill     = inFilter ? getColour(c[vKey], minV, maxV, isRank) : '#c8c8c8';

    // Border: navy = higher ranked, red = lower ranked, maroon = selected
    let borderCol = 'rgba(0,0,0,0.3)', borderW = 1;
    if (selectedCountry && selRank != null && inFilter) {
      const cr = c[rKey];
      if      (c.iso === selectedCountry) { borderCol = '#7b1450'; borderW = 3; }
      else if (cr < selRank)              { borderCol = '#003082'; borderW = 2; }
      else if (cr > selRank)              { borderCol = '#c0181f'; borderW = 2; }
    }

    const radius = Math.max(7, Math.min(28, 14 + c.medals_total / 14));
    const m = L.circleMarker([c.lat, c.lng], {
      radius, fillColor: fill, color: borderCol,
      weight: borderW, fillOpacity: inFilter ? 0.82 : 0.35
    }).addTo(map);

    m.bindTooltip(
      `<strong>${c.name}</strong><br>` +
      `Rank: ${c[rKey]}<br>` +
      `Total medals: ${c.medals_total}<br>` +
      `Per million: ${c.medals_percap}<br>` +
      `${currentVariable}: ${formatVal(c[vKey], vKey)}`,
      { sticky: true }
    );
    m.on('click', () => selectCountry(c.iso));
    circleMarkers.push(m);
  });

  renderLegend(minV, maxV);
  renderBorderLegend();
}

function renderLegend(minV, maxV) {
  const el = document.getElementById('map-legend');
  if (!el) return;
  const vKey   = VARIABLE_KEY[currentVariable];
  const isRank = VARIABLE_IS_RANK.has(currentVariable);
  el.innerHTML = Array.from({length: 5}, (_, i) => {
    const v = minV + (maxV - minV) * (i / 4);
    return `<span class="legend-item">
      <span class="legend-swatch" style="background:${getColour(v, minV, maxV, isRank)}"></span>
      ${formatVal(Math.round(v * 10) / 10, vKey)}
    </span>`;
  }).join('');
}

function renderBorderLegend() {
  const el = document.getElementById('border-legend');
  if (!el) return;
  if (!selectedCountry) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `
    <span class="border-legend-item">
      <span style="background:#7b1450;display:inline-block;width:20px;height:3px;border-radius:2px;"></span> Selected
    </span>
    <span class="border-legend-item">
      <span style="background:#003082;display:inline-block;width:20px;height:3px;border-radius:2px;"></span> Higher ranked
    </span>
    <span class="border-legend-item">
      <span style="background:#c0181f;display:inline-block;width:20px;height:3px;border-radius:2px;"></span> Lower ranked
    </span>`;
}

/* ── Table render ── */
function renderTable(search = '') {
  const tbody = document.getElementById('ranking-tbody');
  const rKey  = RANKING_KEY[currentRanking];
  let data    = getFilteredData();
  if (search) data = data.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const countEl = document.getElementById('table-count');
  if (countEl) countEl.textContent = data.length + ' countries';

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No results</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr data-iso="${c.iso}" class="${selectedCountry === c.iso ? 'selected' : ''}">
      <td class="rank-num">${c[rKey]}</td>
      <td class="flag-cell">
        <img src="https://flagcdn.com/24x18/${c.iso.toLowerCase()}.png"
             alt="${c.name} flag" width="24" height="18" loading="lazy"
             onerror="this.style.display='none'">
      </td>
      <td class="country-name">${c.name}</td>
      <td class="medal-cell medal-gold">${c.medals_total}</td>
      <td class="medal-cell">${c.medals_percap}</td>
    </tr>`).join('');

  tbody.querySelectorAll('tr').forEach(row =>
    row.addEventListener('click', () => selectCountry(row.dataset.iso))
  );
}

/* ── Country selection ── */
function selectCountry(iso) {
  selectedCountry = (selectedCountry === iso) ? null : iso;
  renderTable(document.getElementById('table-search')?.value || '');
  renderMap();
  updateDetail();
}

function updateDetail() {
  const panel = document.getElementById('country-detail');
  const empty = document.getElementById('detail-empty');
  if (!selectedCountry) {
    panel?.classList.remove('visible');
    if (empty) empty.style.display = '';
    return;
  }
  const rKey = RANKING_KEY[currentRanking];
  const c    = (GAMES_DATA[currentGame] || []).find(x => x.iso === selectedCountry);
  if (!c) return;
  if (empty) empty.style.display = 'none';
  panel?.classList.add('visible');
  document.getElementById('detail-name').textContent     = c.name;
  document.getElementById('d-rank').textContent          = '#' + c[rKey];
  document.getElementById('d-medals').textContent        = c.medals_total;
  document.getElementById('d-percap').textContent        = c.medals_percap;
  document.getElementById('d-pop').textContent           = Number(c.pop).toLocaleString();
  document.getElementById('d-gdp').textContent           = '$' + Number(c.gdp).toLocaleString();
  document.getElementById('d-life').textContent          = c.life_exp.toFixed(1);
  document.getElementById('d-postpermil').textContent    = c.post_permil.toFixed(3);
}

/* ── Full refresh ── */
function refresh() {
  const gamesEl  = document.getElementById('sel-games');
  const subtitle = document.getElementById('map-subtitle');
  if (subtitle && gamesEl)
    subtitle.textContent = gamesEl.options[gamesEl.selectedIndex]?.text || '';
  initSlider();
  renderTable(document.getElementById('table-search')?.value || '');
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
  .addEventListener('click', () => { selectedCountry = null; map.setView([20, 10], 2); refresh(); });
document.getElementById('detail-close')
  ?.addEventListener('click', () => { selectedCountry = null; renderTable(); renderMap(); updateDetail(); });
document.getElementById('table-search')
  ?.addEventListener('input', e => renderTable(e.target.value));

document.getElementById('slider-lo')?.addEventListener('input', e => {
  intervalLo = Math.min(Number(e.target.value), intervalHi);
  e.target.value = intervalLo;
  updateSliderDisplay();
  renderTable(document.getElementById('table-search')?.value || '');
  renderMap();
});
document.getElementById('slider-hi')?.addEventListener('input', e => {
  intervalHi = Math.max(Number(e.target.value), intervalLo);
  e.target.value = intervalHi;
  updateSliderDisplay();
  renderTable(document.getElementById('table-search')?.value || '');
  renderMap();
});

// Boot
refresh();