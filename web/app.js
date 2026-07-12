// app.js — UI logic for the local movie/series tracker.
// Source of truth is the `entries` array, loaded once from IndexedDB (Store).

const TYPES = ['Movie', 'Series', '44 min'];
let entries = [];

// --- Small DOM / formatting helpers ---------------------------------------
const $ = id => document.getElementById(id);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatDate(value) {
    if (!value) return 'Unknown';
    const d = new Date(String(value).replace(' ', 'T'));
    if (isNaN(d)) return 'Unknown';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Tags are stored as an array; tolerate legacy comma strings on import.
const tagList = tags =>
    (Array.isArray(tags) ? tags : String(tags || '').split(','))
        .map(t => t.trim()).filter(Boolean);

// --- Row rendering ---------------------------------------------------------
// Inline SVG heart so no image files are needed. `half` fills only the left
// side (a 50/50 gradient) to represent the lowest love level.
const HEART_PATH = 'M480-147q-14 0-28.5-5T426-168l-52-48q-101-92-165-158t-102-119.5q-38-53.5-53-99T39-681q0-91 61-152t150-61q52 0 99 22t81 62q34-40 81-62t99-22q89 0 150 61t61 152q0 44-15 89.5T816-493q-38 53-102 119T549-216l-52 48q-11 11-25.5 16t-28.5 5Z';

function heartSvg(half) {
    const defs = half
        ? '<defs><linearGradient id="heart-half"><stop offset="50%" stop-color="#ff4d6d"/><stop offset="50%" stop-color="#3a4356"/></linearGradient></defs>'
        : '';
    const fill = half ? 'url(#heart-half)' : '#ff4d6d';
    return `<svg class="heart-icon" viewBox="0 -960 960 960" width="18" height="18" aria-hidden="true">${defs}<path d="${HEART_PATH}" fill="${fill}"/></svg>`;
}

function heartHtml(h) {
    if (h === 1) return heartSvg(true);
    if (h === 2) return heartSvg(false);
    if (h === 3) return heartSvg(false) + heartSvg(false);
    return '';
}

const SEQUEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed" class="add-sequel"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q65 0 123 19t107 53l-58 59q-38-24-81-37.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q32 0 62-6t58-17l60 61q-41 20-86 31t-94 11Zm280-80v-120H640v-80h120v-120h80v120h120v80H840v120h-80ZM424-296 254-466l56-56 114 114 400-401 56 56-456 457Z"/></svg>`;

function sequelHtml(s) {
    const label = s === 1 ? 'Yes' : (s === 2 ? 'Maybe' : 'No');
    return label + (s === 1 || s === 2 ? ' ' + SEQUEL_SVG : '');
}

function rowHtml(e) {
    const season = e.season && String(e.season) !== '0' ? e.season : '';
    const tags = tagList(e.tags).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    return `<tr data-id="${e.id}">
        <td>${e.id}</td>
        <td>${esc(e.rating)} &starf;</td>
        <td>${heartHtml(e.heart)}</td>
        <td>${esc(e.name)}</td>
        <td>${esc(season)}</td>
        <td>${esc(e.type)}</td>
        <td class="date-cell">${esc(formatDate(e.date))}</td>
        <td>${esc(e.saga)}</td>
        <td>${tags}</td>
        <td>${e.rewatched ? 'Yes' : 'No'}</td>
        <td>${sequelHtml(e.sequel)}</td>
    </tr>`;
}

function render(list) {
    const tbody = $('entries');
    tbody.innerHTML = list.length
        ? list.map(rowHtml).join('')
        : '<tr class="empty-row"><td colspan="11">No entries yet — click “+ Add new”.</td></tr>';
}

// --- Stats -----------------------------------------------------------------
function detailText(subset) {
    if (!subset.length) return 'No entries';
    const avg = (subset.reduce((s, e) => s + (Number(e.rating) || 0), 0) / subset.length).toFixed(1);
    const hearts = subset.filter(e => e.heart > 0).length;
    const rewatched = subset.filter(e => e.rewatched).length;
    return `Avg ★ ${avg} · ❤ ${hearts} · ↻ ${rewatched}`;
}

function renderStats(list) {
    const boxes = [
        ['total-movies', 'movies-detail', list.filter(e => e.type === 'Movie')],
        ['total-series', 'series-detail', list.filter(e => e.type === 'Series')],
        ['total-44m', '44m-detail', list.filter(e => e.type === '44 min')],
        ['total-combined', 'combined-detail', list],
    ];
    for (const [countId, detailId, subset] of boxes) {
        $(countId).textContent = subset.length;
        $(detailId).textContent = detailText(subset);
    }
}

// --- Search / filtering ----------------------------------------------------
const FILTERS = {
    type:      (e, v) => e.type.toLowerCase() === v.toLowerCase(),
    rating:    (e, v) => String(e.rating) === v,
    heart:     (e, v) => String(e.heart) === v,
    season:    (e, v) => String(e.season) === v,
    saga:      (e, v) => (e.saga || '').toLowerCase().includes(v.toLowerCase()),
    tag:       (e, v) => tagList(e.tags).some(t => t.toLowerCase() === v.toLowerCase()),
    rewatched: (e, v) => (e.rewatched ? 'yes' : 'no') === v.toLowerCase(),
    sequel:    (e, v) => ['no', 'yes', 'maybe'][e.sequel] === v.toLowerCase(),
    date:      (e, v) => matchDate(e.date, v),
};

function matchDate(dateStr, v) {
    if (!dateStr) return false;
    const day = String(dateStr).slice(0, 10);           // YYYY-MM-DD
    if (v.includes('..')) {
        const [from, to] = v.split('..');
        return day >= from && day <= to;
    }
    return day === v;
}

function applySearch(list, query) {
    const q = query.trim();
    if (!q) return list;

    const active = [];
    const re = /#(\w+):([^#]+)/g;
    let m;
    while ((m = re.exec(q)) !== null) active.push([m[1].toLowerCase(), m[2].trim()]);
    const text = q.replace(re, '').trim().toLowerCase();

    return list.filter(e => {
        for (const [key, value] of active) {
            const fn = FILTERS[key];
            if (fn && !fn(e, value)) return false;
        }
        return !text || e.name.toLowerCase().includes(text);
    });
}

function refresh() {
    render(applySearch(entries, $('search').value));
}

// --- Modal + form ----------------------------------------------------------
const modal = () => $('myModal');

function openModal() {
    const form = $('add-entry-form');
    form.reset();
    $('selected-tags').innerHTML = '';
    $('season-group').hidden = true;
    populateSelect('saga', uniqueValues(e => e.saga));
    populateSelect('tags', uniqueTags());
    modal().style.display = 'block';
}

function closeModal() {
    modal().style.display = 'none';
}

function uniqueValues(pick) {
    const set = new Set();
    for (const e of entries) {
        const v = (pick(e) || '').trim();
        if (v && v.toLowerCase() !== 'no') set.add(v);
    }
    return [...set];
}

function uniqueTags() {
    const set = new Set();
    for (const e of entries) tagList(e.tags).forEach(t => set.add(t));
    return [...set];
}

function populateSelect(id, values) {
    const select = $(id);
    const placeholder = select.options[0]?.text || 'Select';
    select.innerHTML = `<option value="">${placeholder}</option>`;
    for (const v of values) {
        const opt = document.createElement('option');
        opt.value = opt.text = v;
        select.add(opt);
    }
}

function addTagToSelected(name) {
    name = name.trim();
    if (!name) return;
    const container = $('selected-tags');
    const existing = [...container.children].map(c => c.dataset.tag);
    if (existing.includes(name)) return;
    const span = document.createElement('span');
    span.className = 'tag';
    span.dataset.tag = name;
    span.innerHTML = `${esc(name)} <span class="remove-tag">x</span>`;
    container.appendChild(span);
}

const selectedTags = () => [...$('selected-tags').children].map(c => c.dataset.tag);

function setTodayDate() {
    $('date').value = new Date().toISOString().slice(0, 10);
}
function setNowTime() {
    $('time').value = new Date().toTimeString().slice(0, 5);
}

function readForm() {
    const type = $('type').value;
    const rating = Number(document.querySelector('input[name="rating"]:checked')?.value || 0);
    const heart = Number(document.querySelector('input[name="heart"]:checked')?.value || 0);
    const sequelVal = $('sequel').value;
    const date = $('date').value;
    const time = $('time').value || '00:00';
    return {
        name: $('name').value.trim(),
        type,
        rating,
        heart,
        saga: $('saga').value.trim(),
        rewatched: $('rewatched').value === 'Yes' ? 1 : 0,
        sequel: sequelVal === 'Yes' ? 1 : (sequelVal === 'Maybe' ? 2 : 0),
        date: date ? `${date}T${time}:00` : '',
        season: type === 'Series' ? ($('season').value.trim() || '0') : '0',
        tags: selectedTags(),
    };
}

function openModalWithPrefill(entry) {
    openModal();
    $('name').value = entry.name || '';
    const typeSelect = $('type');
    typeSelect.value = entry.type;
    typeSelect.dispatchEvent(new Event('change'));
    $('season').value = entry.season ? (parseInt(entry.season, 10) || 0) + 1 : 1;
    setTodayDate();
    setNowTime();
    $('saga').value = entry.saga || '';
    $('rewatched').value = 'No';
    $('sequel').value = 'No';
    tagList(entry.tags).forEach(addTagToSelected);
}

// --- Import / export -------------------------------------------------------
async function exportData() {
    const data = await Store.all();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viewed-tv-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function importData(file) {
    try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed)) throw new Error('file must contain a JSON array');
        for (const { id, ...rest } of parsed) await Store.add(rest); // fresh ids
        await reload();
        alert(`Imported ${parsed.length} entries.`);
    } catch (err) {
        alert('Import failed: ' + err.message);
    }
}

// --- Boot ------------------------------------------------------------------
async function reload() {
    entries = (await Store.all()).sort((a, b) => b.id - a.id);
    refresh();
    renderStats(entries);
}

function wireEvents() {
    $('search').addEventListener('input', refresh);
    $('add-new').addEventListener('click', openModal);
    $('modal-close').addEventListener('click', closeModal);
    $('export-btn').addEventListener('click', exportData);
    $('import-btn').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', e => {
        if (e.target.files[0]) importData(e.target.files[0]);
        e.target.value = '';
    });
    $('set-today-date').addEventListener('click', setTodayDate);
    $('set-today-time').addEventListener('click', setNowTime);
    $('add-saga').addEventListener('click', () => {
        const name = prompt('Enter new saga name:');
        if (name) { populateSelect('saga', [...uniqueValues(e => e.saga), name]); $('saga').value = name; }
    });
    $('add-tag').addEventListener('click', () => {
        const name = prompt('Enter new tag name:');
        if (name) addTagToSelected(name);
    });

    $('type').addEventListener('change', function () {
        $('season-group').hidden = this.value !== 'Series';
    });

    $('tags').addEventListener('change', function () {
        if (this.value) { addTagToSelected(this.value); this.value = ''; }
    });

    // Close modal when clicking the backdrop.
    window.addEventListener('click', e => { if (e.target === modal()) closeModal(); });

    // Expand/collapse stat boxes.
    document.querySelector('.stats').addEventListener('click', e => {
        const svg = e.target.closest('svg');
        if (!svg) return;
        const box = svg.closest('.stat-box');
        svg.classList.toggle('rotated');
        box.classList.toggle('open');
        const content = box.querySelector('.hidden-content');
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
    });

    // Delegated clicks inside the table (add-sequel) and tag chips (remove).
    $('entries').addEventListener('click', e => {
        if (!e.target.closest('.add-sequel')) return;
        const id = Number(e.target.closest('tr').dataset.id);
        const entry = entries.find(x => x.id === id);
        if (entry) openModalWithPrefill(entry);
    });
    $('selected-tags').addEventListener('click', e => {
        if (e.target.classList.contains('remove-tag')) e.target.closest('.tag').remove();
    });

    $('add-entry-form').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            const entry = readForm();
            const id = await Store.add(entry);
            entries.unshift({ ...entry, id });
            refresh();
            renderStats(entries);
            closeModal();
        } catch (err) {
            console.error(err);
            alert('Could not save entry.');
        }
    });
}

// --- Service worker (offline + self-update) --------------------------------
function showUpdateToast(onReload) {
    if (document.getElementById('update-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.innerHTML = '<span>A new version is available.</span><button type="button">Update</button>';
    toast.querySelector('button').addEventListener('click', onReload);
    document.body.appendChild(toast);
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js').then(reg => {
        const promptFor = worker => {
            if (!worker) return;
            const offer = () => showUpdateToast(() => worker.postMessage({ type: 'SKIP_WAITING' }));
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offer();
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) offer();
            });
        };

        promptFor(reg.waiting);
        reg.addEventListener('updatefound', () => promptFor(reg.installing));

        // Check for a newer version on launch and whenever the app is refocused.
        reg.update();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') reg.update();
        });
    }).catch(err => console.error('Service worker registration failed:', err));

    // Reload once the fresh worker takes control.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
    });
}

wireEvents();
reload();
registerServiceWorker();
