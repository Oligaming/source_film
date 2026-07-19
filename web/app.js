// app.js — UI logic for the local movie/series tracker.
// Source of truth is the `entries` array, loaded once from IndexedDB (Store).

const APP_VERSION = 'v1.1.0';
const TYPES = ['Movie', 'Series', '44 min'];
const SEQUEL_LABELS = ['No', 'Yes', 'Maybe'];
let entries = [];
let editingId = null; // id being edited, or null when adding

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

function safeGetISOString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString();
    const cleaned = dateStr.trim().replace(' ', 'T');
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Tags are stored as an array; tolerate legacy comma strings on import.
const tagList = tags =>
    (Array.isArray(tags) ? tags : String(tags || '').split(','))
        .map(t => t.trim()).filter(Boolean);

// --- Row rendering ---------------------------------------------------------
// Inline SVG icons (Material Symbols paths) so no image files are needed.
// The half heart references the gradient defined once in index.html.
const HEART_PATH = 'M480-147q-14 0-28.5-5T426-168l-52-48q-101-92-165-158t-102-119.5q-38-53.5-53-99T39-681q0-91 61-152t150-61q52 0 99 22t81 62q34-40 81-62t99-22q89 0 150 61t61 152q0 44-15 89.5T816-493q-38 53-102 119T549-216l-52 48q-11 11-25.5 16t-28.5 5Z';
const SEQUEL_PATH = 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q65 0 123 19t107 53l-58 59q-38-24-81-37.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q32 0 62-6t58-17l60 61q-41 20-86 31t-94 11Zm280-80v-120H640v-80h120v-120h80v120h120v80H840v120h-80ZM424-296 254-466l56-56 114 114 400-401 56 56-456 457Z';
const EDIT_PATH = 'M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z';
const DELETE_PATH = 'M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Zm-240-320v520-520Z';

const icon = path => `<svg viewBox="0 -960 960 960" width="18" height="18" fill="#e8eaed" aria-hidden="true"><path d="${path}"/></svg>`;

function heartSvg(half) {
    const fill = half ? 'url(#heart-half-gradient)' : '#ff4d6d';
    return `<svg class="heart-icon" viewBox="0 -960 960 960" width="18" height="18" aria-hidden="true"><path d="${HEART_PATH}" fill="${fill}"/></svg>`;
}

function heartHtml(h) {
    if (h === 1) return heartSvg(true);
    if (h === 2) return heartSvg(false);
    if (h === 3) return heartSvg(false) + heartSvg(false);
    return '';
}

function actionsHtml(e) {
    const sequelBtn = (e.sequel === 1 || e.sequel === 2)
        ? `<button type="button" class="icon-btn" data-action="sequel" title="Log the sequel / next season">${icon(SEQUEL_PATH)}</button>`
        : '';
    return `<span class="row-actions">${sequelBtn}<button type="button" class="icon-btn" data-action="edit" title="Edit">${icon(EDIT_PATH)}</button><button type="button" class="icon-btn" data-action="delete" title="Delete">${icon(DELETE_PATH)}</button></span>`;
}

function rowHtml(e) {
    const season = e.season && String(e.season) !== '0' ? e.season : '';
    const tags = tagList(e.tags).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const rating = e.rating ? `${esc(e.rating)} &starf;` : '';
    return `<tr data-id="${e.id}">
        <td class="id-cell">${e.id}</td>
        <td data-label="Rating">${rating}</td>
        <td data-label="Heart">${heartHtml(e.heart)}</td>
        <td class="name-cell">${esc(e.name)}</td>
        <td data-label="Season">${esc(season)}</td>
        <td data-label="Type">${esc(e.type)}</td>
        <td class="date-cell" data-label="Date">${esc(formatDate(e.date))}</td>
        <td data-label="Saga">${esc(e.saga)}</td>
        <td data-label="Tags">${tags}</td>
        <td data-label="Rewatched">${e.rewatched ? 'Yes' : 'No'}</td>
        <td class="sequel-cell" data-label="Sequel">${SEQUEL_LABELS[e.sequel] || 'No'}${actionsHtml(e)}</td>
    </tr>`;
}

let visibleCount = 100;

function render(list) {
    const visibleList = list.slice(0, visibleCount);
    $('entries').innerHTML = visibleList.length
        ? visibleList.map(rowHtml).join('')
        : '<tr class="empty-row"><td colspan="11">No entries yet — click “+ Add new”.</td></tr>';
        
    const loadMoreBtn = $('load-more-btn');
    if (loadMoreBtn) {
        if (list.length > visibleCount) {
            loadMoreBtn.style.display = 'inline-block';
            loadMoreBtn.textContent = `Show 100 More (${list.length - visibleCount} remaining)`;
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
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

// Stat boxes expand/collapse; clickable and keyboard-operable.
function initStats() {
    for (const box of document.querySelectorAll('.stat-box')) {
        const content = box.querySelector('.stat-box-content');
        content.setAttribute('role', 'button');
        content.setAttribute('tabindex', '0');
        content.setAttribute('aria-expanded', 'false');
        const toggle = () => {
            const open = box.classList.toggle('open');
            content.setAttribute('aria-expanded', String(open));
        };
        content.addEventListener('click', toggle);
        content.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
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
    sequel:    (e, v) => (SEQUEL_LABELS[e.sequel] || 'No').toLowerCase() === v.toLowerCase(),
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

// --- Sorting (click a column header to toggle) -----------------------------
let sortKey = 'id';
let sortDir = -1; // 1 = ascending, -1 = descending

const SORTERS = {
    id:        e => e.id,
    rating:    e => Number(e.rating) || 0,
    heart:     e => e.heart || 0,
    name:      e => e.name.toLowerCase(),
    season:    e => Number(String(e.season).split('-')[0]) || 0,
    type:      e => e.type,
    date:      e => String(e.date || '').replace(' ', 'T'),
    saga:      e => (e.saga || '').toLowerCase(),
    rewatched: e => e.rewatched ? 1 : 0,
    sequel:    e => e.sequel || 0,
};

function sortList(list) {
    const pick = SORTERS[sortKey] || SORTERS.id;
    return [...list].sort((a, b) => {
        const x = pick(a), y = pick(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
}

function updateSortIndicators() {
    for (const th of document.querySelectorAll('th[data-sort]')) {
        const active = th.dataset.sort === sortKey;
        th.classList.toggle('sorted-asc', active && sortDir === 1);
        th.classList.toggle('sorted-desc', active && sortDir === -1);
    }
}

function refresh() {
    visibleCount = 100;
    refreshShow();
}

function refreshShow() {
    render(sortList(applySearch(entries, $('search').value)));
}

// --- Modal + form ----------------------------------------------------------
const modal = () => $('myModal');

function openModal() {
    const form = $('add-entry-form');
    form.reset();
    editingId = null;
    $('modal-title').textContent = 'Add New Entry';
    $('entry-submit').textContent = 'Add Entry';
    $('selected-tags').innerHTML = '';
    $('season-group').hidden = true;
    populateSelect('saga', uniqueValues(e => e.saga));
    populateSelect('tags', uniqueTags());
    modal().style.display = 'block';
    $('name').focus();
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
    span.innerHTML = `${esc(name)} <span class="remove-tag" role="button" aria-label="Remove tag">x</span>`;
    container.appendChild(span);
}

const selectedTags = () => [...$('selected-tags').children].map(c => c.dataset.tag);

function setTodayDate() {
    $('date').value = new Date().toISOString().slice(0, 10);
}
function setNowTime() {
    $('time').value = new Date().toTimeString().slice(0, 5);
}

function setType(value) {
    const typeSelect = $('type');
    typeSelect.value = TYPES.includes(value) ? value : 'Movie';
    typeSelect.dispatchEvent(new Event('change'));
}

function checkRadio(name, value) {
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
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

// Prefill for "log the sequel / next season": same name/saga/tags, today.
function openModalWithPrefill(entry) {
    openModal();
    $('name').value = entry.name || '';
    setType(entry.type);
    $('season').value = entry.season ? (parseInt(entry.season, 10) || 0) + 1 : 1;
    setTodayDate();
    setNowTime();
    $('saga').value = entry.saga || '';
    tagList(entry.tags).forEach(addTagToSelected);
}

// Edit an existing entry in place.
function openModalForEdit(entry) {
    openModal();
    editingId = entry.id;
    $('modal-title').textContent = 'Edit Entry';
    $('entry-submit').textContent = 'Save Changes';
    $('name').value = entry.name || '';
    setType(entry.type);
    if (entry.type === 'Series' && String(entry.season) !== '0') $('season').value = entry.season;
    const [d, t] = String(entry.date || '').replace(' ', 'T').split('T');
    $('date').value = d || '';
    $('time').value = (t || '').slice(0, 5);
    checkRadio('rating', entry.rating);
    checkRadio('heart', entry.heart);
    $('saga').value = entry.saga || '';
    $('rewatched').value = entry.rewatched ? 'Yes' : 'No';
    $('sequel').value = SEQUEL_LABELS[entry.sequel] || 'No';
    tagList(entry.tags).forEach(addTagToSelected);
}

async function deleteEntry(entry) {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    try {
        await Store.remove(entry.id);
        entries = entries.filter(x => x.id !== entry.id);
        refresh();
        renderStats(entries);
    } catch (err) {
        console.error(err);
        alert('Could not delete entry.');
    }
}

// --- Settings / sync -------------------------------------------------------
const LAST_SYNC_KEY = 'viewedtv-last-sync';

function renderLastSync() {
    let info = null;
    try { info = JSON.parse(localStorage.getItem(LAST_SYNC_KEY)); } catch { /* corrupt value -> "never" */ }
    const n = c => `${c} entr${c === 1 ? 'y' : 'ies'}`;
    $('last-sync').textContent = info
        ? `Last sync: ${formatDate(info.date)} — ${info.action === 'import' ? `imported ${n(info.count)}` : `exported ${n(info.count)}`}`
        : 'Last sync: never';
}

function setLastSync(action, count) {
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify({ date: new Date().toISOString(), action, count }));
    renderLastSync();
}

const SB_URL_KEY = 'viewedtv-sb-url';
const SB_KEY_KEY = 'viewedtv-sb-key';

let supabaseClient = null;

function getSupabaseCredentials() {
    return {
        url: localStorage.getItem(SB_URL_KEY) || '',
        key: localStorage.getItem(SB_KEY_KEY) || ''
    };
}

function initSupabase() {
    const { url, key } = getSupabaseCredentials();
    if (url && key && typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(url, key);
        return true;
    }
    supabaseClient = null;
    return false;
}

function renderSupabaseStatus(msg = '', isError = false) {
    const statusEl = $('sb-status');
    if (!statusEl) return;
    const { url } = getSupabaseCredentials();
    if (!url) {
        statusEl.textContent = 'Status: Not configured';
        statusEl.style.color = '#9aa0a6';
    } else if (msg) {
        statusEl.textContent = `Status: ${msg}`;
        statusEl.style.color = isError ? '#ff4d6d' : '#4caf50';
    } else {
        statusEl.textContent = 'Status: Configured (ready)';
        statusEl.style.color = '#4caf50';
    }
}

function getServiceWorkerVersion() {
    return new Promise((resolve) => {
        if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
            resolve('inactive');
            return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = event => {
            resolve(event.data.version);
        };
        navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        setTimeout(() => resolve('timeout'), 1000);
    });
}

async function openSettings() {
    renderLastSync();
    const { url, key } = getSupabaseCredentials();
    const urlEl = $('sb-url');
    const keyEl = $('sb-key');
    if (urlEl) urlEl.value = url;
    if (keyEl) keyEl.value = key;
    renderSupabaseStatus();
    const verEl = $('settings-version');
    if (verEl) {
        try {
            const swVer = await getServiceWorkerVersion();
            verEl.textContent = `${APP_VERSION} (SW: ${swVer})`;
        } catch (e) {
            verEl.textContent = APP_VERSION;
        }
    }
    $('settings-modal').style.display = 'block';
}

function resolveSync(local, remote, cutoff) {
    const keyFn = e => [
        e.name.trim().toLowerCase(),
        e.type,
        String(e.season),
        String(e.date || '').replace(' ', 'T'),
    ].join('|');

    const cleanRemote = remote.map(r => ({
        ...r,
        id: Number(r.id),
        tags: Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',') : [])
    }));

    const remoteByKey = new Map();
    for (const r of cleanRemote) remoteByKey.set(keyFn(r), r);

    const mergedList = [];
    const localProcessed = new Set();

    for (const l of local) {
        const key = keyFn(l);
        const r = remoteByKey.get(key);
        if (r) {
            const lTime = new Date(l.updated_at || 0).getTime();
            const rTime = new Date(r.updated_at || 0).getTime();
            const olderCreated = new Date(l.created_at || 0) < new Date(r.created_at || 0)
                ? (l.created_at || r.created_at)
                : (r.created_at || l.created_at);

            const stableId = (l.id <= cutoff) ? l.id : (r.id <= cutoff ? r.id : (r.id || l.id));

            const merged = lTime >= rTime
                ? { ...l, id: stableId, created_at: olderCreated }
                : { ...r, id: stableId, created_at: olderCreated };

            mergedList.push(merged);
            remoteByKey.delete(key);
            localProcessed.add(l.id);
        }
    }

    const unmatched = [];
    for (const [key, r] of remoteByKey) unmatched.push(r);
    for (const l of local) {
        if (!localProcessed.has(l.id)) {
            unmatched.push(l);
        }
    }

    const legacyMap = new Map();
    const newUnresolved = [];

    for (const entry of unmatched) {
        if (entry.id <= cutoff) {
            const existing = legacyMap.get(entry.id);
            if (existing) {
                const eTime = new Date(entry.updated_at || 0).getTime();
                const exTime = new Date(existing.updated_at || 0).getTime();
                const olderCreated = new Date(entry.created_at || 0) < new Date(existing.created_at || 0)
                    ? (entry.created_at || existing.created_at)
                    : (existing.created_at || entry.created_at);
                
                const merged = eTime >= exTime ? entry : existing;
                legacyMap.set(entry.id, { ...merged, created_at: olderCreated });
            } else {
                legacyMap.set(entry.id, entry);
            }
        } else {
            newUnresolved.push(entry);
        }
    }

    for (const [id, entry] of legacyMap) {
        mergedList.push(entry);
    }

    const newGroupedById = new Map();
    for (const entry of newUnresolved) {
        if (!newGroupedById.has(entry.id)) {
            newGroupedById.set(entry.id, []);
        }
        newGroupedById.get(entry.id).push(entry);
    }

    const stableNew = [];
    const collidingNew = [];

    for (const [id, list] of newGroupedById) {
        if (list.length === 1) {
            stableNew.push(list[0]);
        } else {
            list.sort((a, b) => {
                const aTime = new Date(a.created_at || 0).getTime();
                const bTime = new Date(b.created_at || 0).getTime();
                return aTime - bTime;
            });
            stableNew.push(list[0]);
            for (let i = 1; i < list.length; i++) {
                collidingNew.push(list[i]);
            }
        }
    }

    for (const entry of stableNew) {
        mergedList.push(entry);
    }

    const usedIds = new Set(mergedList.map(e => e.id));
    let nextId = cutoff + 1;

    let shiftsCount = 0;
    let addedCount = unmatched.length;

    collidingNew.sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return aTime - bTime;
    });

    for (const entry of collidingNew) {
        while (usedIds.has(nextId)) {
            nextId++;
        }
        
        const oldId = entry.id;
        const newId = nextId;
        usedIds.add(newId);
        
        if (oldId !== newId) {
            shiftsCount++;
        }
        
        mergedList.push({
            ...entry,
            id: newId
        });
    }

    mergedList.sort((a, b) => a.id - b.id);

    return { mergedList, shiftsCount, addedCount };
}

async function syncWithSupabase() {
    if (!initSupabase()) {
        alert('Please configure Supabase URL and Anon Key first.');
        return;
    }
    
    renderSupabaseStatus('Syncing...', false);
    $('sb-sync-btn').disabled = true;
    
    try {
        const { data: remoteEntries, error } = await supabaseClient
            .from('entries')
            .select('*');
            
        if (error) throw error;
        
        const localEntries = await Store.all();
        
        // Dynamically compute/load baseline cutoff ID
        const SYNC_CUTOFF_KEY = 'viewedtv-sync-cutoff';
        let cutoff = parseInt(localStorage.getItem(SYNC_CUTOFF_KEY), 10);
        if (isNaN(cutoff)) {
            // Set the cutoff to the maximum ID of local entries right now
            cutoff = localEntries.length > 0 ? Math.max(...localEntries.map(e => e.id)) : 0;
            localStorage.setItem(SYNC_CUTOFF_KEY, cutoff);
        }
        
        const { mergedList, shiftsCount, addedCount } = resolveSync(localEntries, remoteEntries, cutoff);
        
        await Store.clear();
        if (mergedList.length > 0) {
            await Store.bulkAdd(mergedList);
        }
        
        const { error: deleteError } = await supabaseClient
            .from('entries')
            .delete()
            .gte('id', 0);
        if (deleteError) throw deleteError;
        
        if (mergedList.length > 0) {
            const { error: insertError } = await supabaseClient
                .from('entries')
                .insert(mergedList);
            if (insertError) throw insertError;
        }
        
        await reload();
        
        setLastSync('supabase', mergedList.length);
        renderSupabaseStatus(`Synced successfully! (${addedCount} new, ${shiftsCount} shifted)`, false);
        alert(`Sync complete!\nTotal entries: ${mergedList.length}\nNew entries: ${addedCount}\nIDs shifted: ${shiftsCount}`);
    } catch (err) {
        console.error('Supabase Sync error:', err);
        renderSupabaseStatus(`Error: ${err.message || err}`, true);
        alert('Sync failed: ' + (err.message || err));
    } finally {
        $('sb-sync-btn').disabled = false;
    }
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
    setLastSync('export', data.length);
}

// Coerce an imported object into a well-formed entry (ids are regenerated).
function sanitizeEntry(raw) {
    if (typeof raw !== 'object' || raw === null) return { name: '' };
    const sequel = Number(raw.sequel);
    const created_at = raw.created_at || safeGetISOString(raw.date);
    const updated_at = raw.updated_at || created_at;
    return {
        name: String(raw.name || '').trim(),
        type: TYPES.includes(raw.type) ? raw.type : 'Movie',
        rating: Math.min(5, Math.max(0, Number(raw.rating) || 0)),
        heart: Math.min(3, Math.max(0, Number(raw.heart) || 0)),
        saga: String(raw.saga || '').trim(),
        rewatched: raw.rewatched ? 1 : 0,
        sequel: sequel === 1 || sequel === 2 ? sequel : 0,
        date: String(raw.date || ''),
        season: String(raw.season ?? '0').trim() || '0',
        tags: tagList(raw.tags),
        created_at,
        updated_at,
    };
}

// Identity of an entry for merging: same name + type + season + watch date.
const syncKey = e => [
    e.name.trim().toLowerCase(),
    e.type,
    String(e.season),
    String(e.date || '').replace(' ', 'T'),
].join('|');

// Merge-import: adds entries not present yet, skips the rest (no duplicates),
// so exporting on one device and importing on the other acts as a sync.
async function importData(file) {
    try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed)) throw new Error('file must contain a JSON array');
        const clean = parsed.map(sanitizeEntry).filter(e => e.name);
        if (!clean.length) throw new Error('no valid entries found');
        const seen = new Set(entries.map(syncKey));
        const fresh = [];
        for (const e of clean) {
            const k = syncKey(e);
            if (!seen.has(k)) { seen.add(k); fresh.push(e); }
        }
        if (fresh.length) await Store.bulkAdd(fresh);
        await reload();
        setLastSync('import', fresh.length);
        alert(`Sync complete: ${fresh.length} new, ${clean.length - fresh.length} already present.`);
    } catch (err) {
        alert('Import failed: ' + err.message);
    }
}

// --- Boot ------------------------------------------------------------------
async function reload() {
    entries = await Store.all();
    let migrated = false;
    for (const e of entries) {
        if (!e.created_at) {
            e.created_at = safeGetISOString(e.date);
            migrated = true;
        }
        if (!e.updated_at) {
            e.updated_at = e.created_at;
            migrated = true;
        }
    }
    if (migrated) {
        for (const e of entries) {
            await Store.put(e);
        }
    }
    refresh();
    renderStats(entries);
}

function wireEvents() {
    $('search').addEventListener('input', refresh);
    $('add-new').addEventListener('click', openModal);
    $('settings-btn').addEventListener('click', openSettings);
    $('export-btn').addEventListener('click', exportData);
    $('import-btn').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', e => {
        if (e.target.files[0]) importData(e.target.files[0]);
        e.target.value = '';
    });
    $('load-more-btn')?.addEventListener('click', () => {
        visibleCount += 100;
        refreshShow();
    });
    $('sb-save-btn')?.addEventListener('click', () => {
        const url = $('sb-url').value.trim();
        const key = $('sb-key').value.trim();
        localStorage.setItem(SB_URL_KEY, url);
        localStorage.setItem(SB_KEY_KEY, key);
        initSupabase();
        renderSupabaseStatus();
        alert('Supabase configuration saved.');
    });
    $('sb-sync-btn')?.addEventListener('click', syncWithSupabase);
    $('set-today-date').addEventListener('click', setTodayDate);
    $('set-today-time').addEventListener('click', setNowTime);
    $('add-saga').addEventListener('click', () => {
        const name = prompt('Enter new saga name:');
        if (name) {
            populateSelect('saga', [...new Set([...uniqueValues(e => e.saga), name.trim()])]);
            $('saga').value = name.trim();
        }
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

    // Close any modal via its ✕ (mouse or keyboard), the backdrop, or Escape.
    for (const [closeId, modalId] of [['modal-close', 'myModal'], ['settings-close', 'settings-modal']]) {
        const close = () => { $(modalId).style.display = 'none'; };
        $(closeId).addEventListener('click', close);
        $(closeId).addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); }
        });
    }
    window.addEventListener('click', e => {
        if (e.target.classList?.contains('modal')) e.target.style.display = 'none';
    });
    window.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        for (const m of document.querySelectorAll('.modal')) {
            if (m.style.display === 'block') m.style.display = 'none';
        }
    });

    // Sort on header click.
    document.querySelector('thead').addEventListener('click', e => {
        const th = e.target.closest('th[data-sort]');
        if (!th) return;
        const key = th.dataset.sort;
        if (sortKey === key) {
            sortDir = -sortDir;
        } else {
            sortKey = key;
            // Text columns start ascending, numeric/date ones descending.
            sortDir = ['name', 'type', 'saga'].includes(key) ? 1 : -1;
        }
        updateSortIndicators();
        refresh();
    });

    // Delegated clicks on row action buttons (sequel / edit / delete).
    $('entries').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = Number(btn.closest('tr').dataset.id);
        const entry = entries.find(x => x.id === id);
        if (!entry) return;
        if (btn.dataset.action === 'sequel') openModalWithPrefill(entry);
        else if (btn.dataset.action === 'edit') openModalForEdit(entry);
        else if (btn.dataset.action === 'delete') deleteEntry(entry);
    });
    $('selected-tags').addEventListener('click', e => {
        if (e.target.classList.contains('remove-tag')) e.target.closest('.tag').remove();
    });

    $('add-entry-form').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            const entry = readForm();
            if (editingId != null) {
                const existing = entries.find(x => x.id === editingId);
                const created_at = existing?.created_at || new Date().toISOString();
                const updated = { 
                    ...entry, 
                    id: editingId, 
                    created_at, 
                    updated_at: new Date().toISOString() 
                };
                await Store.put(updated);
                const i = entries.findIndex(x => x.id === editingId);
                if (i !== -1) entries[i] = updated;
            } else {
                const created_at = new Date().toISOString();
                const updated = {
                    ...entry,
                    created_at,
                    updated_at: created_at
                };
                const id = await Store.add(updated);
                entries.push({ ...updated, id });
            }
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
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        if (!hadController) {
            hadController = true;
            return;
        }
        reloaded = true;
        location.reload();
    });
}

wireEvents();
initStats();
updateSortIndicators();
initSupabase();
reload();
registerServiceWorker();
