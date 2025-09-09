const el = (s, d = document) => d.querySelector(s); const ce = (t, p = {}) => Object.assign(document.createElement(t), p);
function softGradient(seed) { const rnd = mulberry32(Math.floor(seed * 1e9)); const h = rnd() * 360; const s = 35 + rnd() * 15; const l1 = 88 + rnd() * 6; const l2 = 72 + rnd() * 8; return { c1: `hsl(${h} ${s}% ${l1}%)`, c2: `hsl(${h + 20} ${s + 5}% ${l2}%)` } }; function mulberry32(a) { return function () { var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

const LISTS_KEY = 'tasks-lists-v1';
const OLD_KEY = 'tasks-v2';
const NOTES_KEY = 'notes-lists-v1';
const MODE_KEY = 'mode-v1'; // 'tasks' | 'notes'

function loadLists() {
    const raw = localStorage.getItem(LISTS_KEY);
    if (raw) return JSON.parse(raw);
    // migrate from old single-list storage if present
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    const defaultTasks = Array.isArray(old) ? old : [{ title: 'Daily Water', desc: '', tags: ['health', 'wellness'], done: false, id: null, grad: softGradient(Math.random()) }];
    const lists = { activeList: 'Default', lists: { 'Default': defaultTasks } };
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
    if (old) localStorage.removeItem(OLD_KEY);
    return lists;
}

function loadNotes() {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) return JSON.parse(raw);
    const notes = { activeList: 'Default', lists: { 'Default': [] } };
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return notes;
}

function saveLists(lists) {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

function saveNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}


import { loadLists as loadStorageLists, saveLists as saveStorageLists, loadNotes as loadStorageNotes, saveNotes as saveStorageNotes, isLoggedIn } from './storage.js';

let listsState = await loadStorageLists();
let notesState = await loadStorageNotes();
let appMode = localStorage.getItem(MODE_KEY) || 'tasks';

function getActiveListName() { return appMode === 'tasks' ? listsState.activeList : notesState.activeList; }
function getActiveTasks() { return appMode === 'tasks' ? (listsState.lists[getActiveListName()] || []) : []; }
function getActiveNotes() { return appMode === 'notes' ? (notesState.lists[getActiveListName()] || []) : []; }
function setActiveList(name) {
    if (appMode === 'tasks') { listsState.activeList = name; saveLists(listsState); }
    else { notesState.activeList = name; saveNotes(notesState); }
    render(); renderListSelector();
}
function ensureList(name) {
    if (appMode === 'tasks') { if (!listsState.lists[name]) { listsState.lists[name] = []; saveLists(listsState); } }
    else { if (!notesState.lists[name]) { notesState.lists[name] = []; saveNotes(notesState); } }
}

function renderListSelector() {
    const select = document.getElementById('listSelect');
    const addBtn = document.getElementById('listAdd');
    if (!select || !addBtn) return;
    // populate options
    select.innerHTML = '';
    const src = appMode === 'tasks' ? listsState.lists : notesState.lists;
    Object.keys(src).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        const active = appMode === 'tasks' ? listsState.activeList : notesState.activeList;
        if (name === active) opt.selected = true;
        select.appendChild(opt);
    });
    select.onchange = () => setActiveList(select.value);
    addBtn.onclick = () => {
        const name = prompt('New list name:');
        if (!name) return;
        const src = appMode === 'tasks' ? listsState.lists : notesState.lists;
        if (src[name]) { setActiveList(name); return; }
        src[name] = [];
        setActiveList(name);
        if (appMode === 'tasks') saveLists(listsState); else saveNotes(notesState);
        renderListSelector();
    };
}

async function save() {
    const { saveLists } = await import('./storage.js');
    await saveLists(listsState);
}

window.filter = null;

const list = el('#list');
function updateURLForList(name) {
    const url = new URL(window.location.href);
    if (name && name !== 'Default') { url.searchParams.set('cat', name); }
    else { url.searchParams.delete('cat'); }
    history.replaceState(null, '', url);
    // toggle share button visibility
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.style.display = (name && name !== 'Default' && appMode == 'tasks') ? '' : 'none';
}
function render() {
    // build category chips (lists)
    const catsRow = document.getElementById('catsRow');
    const tagsRow = document.getElementById('tagsRow');
    if (catsRow) {
        catsRow.innerHTML = '';
        const src = appMode === 'tasks' ? listsState.lists : notesState.lists;
        Object.keys(src).filter(n => n !== 'Default').sort().forEach(name => {
            const isActive = name === getActiveListName();
            const chip = chipEl('@', name, isActive, () => { if (isActive) setActiveList('Default'); else setActiveList(name); });
            const del = createChipDelete(() => tryDeleteCategory(name));
            chip.appendChild(del);
            catsRow.append(chip);
        });
    }
    if (tagsRow) {
        tagsRow.innerHTML = '';
        if (window.filter && appMode === 'tasks') {
            const activeChip = chipEl('#', window.filter[1], true, () => { window.filter = null; render(); });
            tagsRow.append(activeChip);
        } else if (appMode === 'tasks') {
            const tags = [...new Set(getActiveTasks().flatMap(t => t.tags || []))].sort();
            tags.forEach(tg => {
                const chip = chipEl('#', tg, false, () => { window.filter = ['tag', tg]; render(); });
                const del = createChipDelete(() => tryDeleteTag(tg));
                chip.appendChild(del);
                tagsRow.append(chip);
            });
        } else if (appMode === 'notes') {
            if (window.filter) {
                const activeChip = chipEl('#', window.filter[1], true, () => { window.filter = null; render(); });
                tagsRow.append(activeChip);
            } else {
                const tags = [...new Set(getActiveNotes().flatMap(n => n.tags || []))].sort();
                tags.forEach(tg => {
                    const chip = chipEl('#', tg, false, () => { window.filter = ['tag', tg]; render(); });
                    const del = createChipDelete(() => tryDeleteTag(tg));
                    chip.appendChild(del);
                    tagsRow.append(chip);
                });
            }
        }
    }

    list.innerHTML = '';
    const titleEl = document.querySelector('header h1');
    if (titleEl) titleEl.textContent = appMode === 'tasks' ? 'Tasks' : 'Notes';

    if (appMode === 'tasks') {
        // inline add card at top
        list.classList.remove('notes-grid');
        list.appendChild(newTaskCard());
        const tasks = getActiveTasks();
        let shown = tasks;
        if (window.filter) { const [type, val] = window.filter; shown = tasks.filter(t => (t.tags || []).includes(val)); }
        shown = [...shown.filter(t => !t.done), ...shown.filter(t => t.done)];
        shown.forEach((t, i) => list.appendChild(taskCard(t, i)));
    } else {
        // Notes
        list.classList.add('notes-grid');
        list.appendChild(newNoteCard());
        let notes = getActiveNotes();
        if (window.filter) { const [type, val] = window.filter; notes = notes.filter(n => (n.tags || []).includes(val)); }
        notes.forEach((n, i) => list.appendChild(noteCard(n, i)));
    }
    updateURLForList(getActiveListName());

    // Toggle visibility of actions button
    const actionsBtn = document.getElementById('actionsBtn');
    if (actionsBtn) {
        actionsBtn.style.display = (appMode === 'tasks') ? '' : 'none';
    }

    // Update action buttons state
    const itemComplete = document.getElementById('actCompleteAll');
    const itemDelete = document.getElementById('actDeleteCompleted');
    const tasks = getActiveTasks();
    const hasAny = tasks.length > 0;
    const hasCompleted = tasks.some(t => t.done);
    if (itemComplete) {
        const allDone = hasAny && tasks.every(t => t.done);
        itemComplete.classList.toggle('disabled', appMode !== 'tasks' || !hasAny || allDone);
    }
    if (itemDelete) itemDelete.classList.toggle('disabled', appMode !== 'tasks' || !hasCompleted);
}

function chipEl(prefix, text, active, onX) {
    const c = ce('span', { className: 'chip' + (active ? ' active' : ''), title: (active ? 'Clear ' : 'Filter by ') + prefix + text });
    const label = ce('span', { textContent: prefix + text });
    c.append(label);
    if (active) { const x = ce('span', { className: 'x', textContent: '×' }); x.onclick = onX; c.append(x); } else { c.onclick = onX; }
    return c;
}

function parseInput(text) {
    const tags = [...text.matchAll(/#(\w+)/g)].map(m => m[1]);
    const catMatch = text.match(/@(\w+)/);
    const category = catMatch ? catMatch[1] : '';
    const title = text.replace(/#\w+/g, '').replace(/@\w+/, '').trim();
    return { title, tags, category };
};

function taskCard(task, index) {
    const card = ce('article', { className: 'card enter' + (task.done ? ' done' : '') });
    card.style.zIndex = String(index + 1);
    card.style.zIndex = String(1000 - index);
    card.style.animationDelay = (index * 40) + 'ms';
    if (!task.grad) task.grad = softGradient(Math.random());
    card.style.setProperty('--c1', task.grad.c1);
    card.style.setProperty('--c2', task.grad.c2);
    card.style.background = `linear-gradient(135deg, ${task.grad.c1}, ${task.grad.c2})`;

    card.ondblclick = () => { card.classList.add('solving'); setTimeout(() => { task.done = !task.done; save(); render(); }, 180) };

    // Touch events for mobile
    card.addEventListener('touchstart', () => card.classList.add('touch-active'));
    card.addEventListener('touchend', () => setTimeout(() => card.classList.remove('touch-active'), 300));
    card.addEventListener('touchcancel', () => card.classList.remove('touch-active'));

    // Swipe left to delete
    let touchStartX = 0;
    card.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });
    card.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 80) { // swipe left threshold
            if (confirm('Delete this task?')) {
                const name = getActiveListName();
                const tasks = listsState.lists[name] || [];
                listsState.lists[name] = tasks.filter(t => t.id !== task.id);
                save();
                render();
            }
        }
    });

    const rowx = ce('div', { className: 'rowx' });
    const title = ce('h2', { className: 'title', textContent: task.title });
    const check = ce('div', { className: 'check' + (task.done ? ' done' : ''), innerHTML: task.done ? '✓' : '' });
    check.onclick = e => { e.stopPropagation(); check.classList.add('pulse'); card.classList.add('solving'); setTimeout(() => { task.done = !task.done; save(); render(); }, 180) };

    rowx.append(title, check); card.append(rowx);
    if (task.desc) { card.append(ce('p', { className: 'desc', textContent: task.desc })) }

    // Enable inline editing on click
    card.onclick = () => {
        const editCard = ce('article', { className: 'card enter' });
        editCard.style.setProperty('--c1', task.grad.c1);
        editCard.style.setProperty('--c2', task.grad.c2);
        editCard.style.background = `linear-gradient(135deg, ${task.grad.c1}, ${task.grad.c2})`;

        const rowx = ce('div', { className: 'rowx' });
        const titleInput = ce('input', {
            className: 'title-input',
            value: task.title,
            autocomplete: 'off'
        });
        const check = ce('div', { className: 'check', innerHTML: '✓' });

        function submitEdit() {
            const v = (titleInput.value || '').trim();
            if (!v) { render(); return; }
            task.title = v;
            task.desc = (descInput.value || '').trim();
            save();
            render();
        }

        check.onclick = (e) => { e.stopPropagation(); submitEdit(); };
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); submitEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); render(); }
        });

        rowx.append(titleInput, check);
        editCard.append(rowx);

        const descInput = ce('textarea', { className: 'desc-input', value: task.desc || '', placeholder: 'Optional description' });
        editCard.append(descInput);

        card.replaceWith(editCard);
        titleInput.focus();
    };

    if ((task.tags && task.tags.length) || (task.category && task.category !== 'Default')) {
        const tagsDiv = ce('div', { className: 'tags' });
        if (task.category && task.category !== 'Default') {
            const span = ce('span', { textContent: '@' + task.category });
            span.onclick = (e) => { e.stopPropagation(); setActiveList(task.category); };
            tagsDiv.append(span);
        }
        (task.tags || []).forEach(tag => { const span = ce('span', { textContent: '#' + tag }); span.onclick = (e) => { e.stopPropagation(); window.filter = ['tag', tag]; render(); }; tagsDiv.append(span); });
        card.append(tagsDiv);
    }
    return card;
}

function newNoteCard() {
    const card = ce('article', { className: 'note-card note-new' });
    const input = ce('textarea', { className: 'note-input', autofocus: true, placeholder: 'Add a note (supports #tags and @category, or use /task or /note)', rows: 3 });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const v = (input.value || '').trim();
            if (!v) return;

            if (v.startsWith('/task')) {
                const taskText = v.replace('/task', '').trim();
                if (!taskText) return;
                const { title, tags, category } = parseInput(taskText);
                const descVal = '';
                const finalTags = Array.from(new Set([
                    ...tags,
                    ...(window.filter && window.filter[0] === 'tag' ? [window.filter[1]] : [])
                ]));
                const targetList = category || getActiveListName();
                ensureList(targetList);
                const tasksArr = listsState.lists[targetList];
                const newTask = { title, desc: descVal, tags: finalTags, done: false, id: null, grad: softGradient(Math.random()) };
                if (targetList !== 'Default') newTask.category = targetList;
                tasksArr.unshift(newTask);
                listsState.lists[targetList] = tasksArr;
                save();
                setActiveList(targetList);
                input.value = '';
                render();
                return;
            }

            if (v.startsWith('/note')) {
                const noteText = v.replace('/note', '').trim();
                if (!noteText) return;
                const { title, tags, category } = parseInput(noteText);
                const text = title;
                const finalTags = Array.from(new Set([
                    ...tags,
                    ...(window.filter && window.filter[0] === 'tag' ? [window.filter[1]] : [])
                ]));
                const targetList = category || getActiveListName();
                if (!notesState.lists[targetList]) notesState.lists[targetList] = [];
                const color = genNoteColor();
                const newNote = { text, tags: finalTags, id: null, color };
                notesState.lists[targetList].unshift(newNote);

                saveStorageNotes(notesState);
                setActiveList(targetList);
                input.value = '';
                render();
                return;
            }

            const { title, tags, category } = parseInput(v);
            const text = title;
            const finalTags = Array.from(new Set([
                ...tags,
                ...(window.filter && window.filter[0] === 'tag' ? [window.filter[1]] : [])
            ]));
            const targetList = category || getActiveListName();
            if (!notesState.lists[targetList]) notesState.lists[targetList] = [];
            const color = genNoteColor();
            const newNote = { text, tags: finalTags, id: null, color, category: targetList };
            notesState.lists[targetList].unshift(newNote);

            saveStorageNotes(notesState);
            setActiveList(targetList);
            input.value = '';
        }
    });
    card.append(input);
    return card;
}

function noteCard(note, index) {
    const card = ce('article', { className: 'note-card' });
    card.style.background = note.color || '#fffad1';
    const p = ce('p', { className: 'text', textContent: note.text || '' });
    const tagsDiv = ce('div', { className: 'tags' });
    (note.tags || []).forEach(tag => { const span = ce('span', { textContent: '#' + tag }); span.onclick = (e) => { e.stopPropagation(); window.filter = ['tag', tag]; render(); }; tagsDiv.append(span); });
    const del = ce('span', { className: 'del', innerHTML: '×', title: 'Delete' });
    del.onclick = (e) => {
        e.stopPropagation();
        if (!confirm('Delete this note?')) return;
        const name = getActiveListName();
        const listArr = notesState.lists[name] || [];
        notesState.lists[name] = listArr.filter(n => n.id !== note.id);
        import('./storage.js').then(({ deleteNote }) => deleteNote(note.id));
        saveStorageNotes(notesState);
        render();
    };
    const pin = ce('span', { className: 'pin', innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l6 6-6 6-6-6z"/></svg>', title: 'Pin/Unpin' });
    pin.onclick = (e) => {
        e.stopPropagation();
        note.pinned = !note.pinned;
        saveStorageNotes(notesState);
        render();
    };
    card.append(p, pin, del);
    if ((note.tags || []).length) card.append(tagsDiv);
    card.onclick = () => {
        // Inline editor like add form
        const input = ce('textarea', { className: 'note-input', value: note.text || '' });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const v = (input.value || '').trim();
                const parsed = parseInput(v);
                note.text = parsed.title;
                // merge tags from edit
                const newTags = Array.from(new Set([...(note.tags || []), ...parsed.tags]));
                note.tags = newTags;
                // ensure id is preserved for PocketBase update
                if (!note.id && parsed.id) note.id = parsed.id;
                saveStorageNotes(notesState);
                render();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                render();
            }
        });
        // Replace content with editor
        card.innerHTML = '';
        card.append(input);
        input.focus();
    };
    card.oncontextmenu = (e) => {
        e.preventDefault();
        del.click();
    };
    return card;
}

function genNoteColor() {
    const colors = ['#fffad1', '#ffdfe0', '#e7ffdf', '#dff3ff', '#f2e6ff', '#ffe9d6'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function newTaskCard() {
    const card = ce('article', { className: 'card enter' });
    const grad = softGradient(Math.random());
    card.style.setProperty('--c1', grad.c1);
    card.style.setProperty('--c2', grad.c2);
    card.style.background = `linear-gradient(135deg, ${grad.c1}, ${grad.c2})`;

    const rowx = ce('div', { className: 'rowx' });
    const titleInput = ce('input', {
        className: 'title-input',
        placeholder: 'Add a new task with #tags and @category',
        autocomplete: 'off'
    });
    const check = ce('div', { className: 'check', innerHTML: '+' });

    function submit() {
        if (submit.submitting) return;
        submit.submitting = true;
        const v = (titleInput.value || '').trim();
        if (!v) return;

        if (v.startsWith('/task')) {
            const taskText = v.replace('/task', '').trim();
            if (!taskText) return;
            const { title, tags, category } = parseInput(taskText);
            const descVal = (descInput.value || '').trim();
            const finalTags = Array.from(new Set([
                ...tags,
                ...(window.filter && window.filter[0] === 'tag' ? [window.filter[1]] : [])
            ]));
            const targetList = category || getActiveListName();
            ensureList(targetList);
            const tasksArr = listsState.lists[targetList];
            const newTask = { title, desc: descVal, tags: finalTags, done: false, id: null, grad: softGradient(Math.random()) };
            if (targetList !== 'Default') newTask.category = targetList;
            tasksArr.unshift(newTask);
            listsState.lists[targetList] = tasksArr;
            save();
            setActiveList(targetList);
            titleInput.value = '';
            render();
            setTimeout(() => { submit.submitting = false; }, 0);
            return;
        }

        if (v.startsWith('/note')) {
            const noteText = v.replace('/note', '').trim();
            if (!noteText) return;
            const { title, tags, category } = parseInput(noteText);
            const text = title;
            const finalTags = Array.from(new Set([
                ...tags,
                ...(window.filter && window.filter[0] === 'tag' ? [window.filter[1]] : [])
            ]));
            const targetList = category || getActiveListName();
            if (!notesState.lists[targetList]) notesState.lists[targetList] = [];
            const color = genNoteColor();
            const newNote = { text, tags: finalTags, id: null, color };
            notesState.lists[targetList].unshift(newNote);
            saveNotes(notesState);
            setActiveList(targetList);
            titleInput.value = '';
            render();
            setTimeout(() => { submit.submitting = false; }, 0);
            return;
        }

        const { title, tags, category } = parseInput(v);
        const descVal = (descInput.value || '').trim();
        // Auto-apply active tag filter to new task
        const finalTags = Array.from(new Set([
            ...tags,
            ...(window.filter && window.filter[0] === 'tag' ? [window.filter[1]] : [])
        ]));
        const targetList = category || getActiveListName();
        ensureList(targetList);
        const tasksArr = listsState.lists[targetList];
        const newTask = { title, desc: descVal, tags: finalTags, done: false, id: null, grad: softGradient(Math.random()) };
        if (targetList !== 'Default') newTask.category = targetList;
        tasksArr.unshift(newTask);
        listsState.lists[targetList] = tasksArr;
        save();
        setActiveList(targetList);
        titleInput.value = '';
        // reset guard after render in a microtask
        setTimeout(() => { submit.submitting = false; }, 0);
    }

    check.onclick = (e) => { e.stopPropagation(); submit(); };
    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit();
        }
    });

    // Handle paste of multiline text
    titleInput.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const original = (e.clipboardData || window.clipboardData).getData('text')?.toString();
        if (text && text.includes('\n')) {
            e.preventDefault();
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length > 1) {
                if (confirm('Split pasted text into ' + lines.length + ' tasks?')) {
                    const targetList = getActiveListName();
                    ensureList(targetList);
                    const tasksArr = listsState.lists[targetList];
                    lines.forEach(line => {
                        const { title, tags, category } = parseInput(line);
                        const finalTags = Array.from(new Set([
                            ...tags,
                            ...(window.filter && window.filter[0] === 'tag' ? [window.filter[1]] : [])
                        ]));
                        const newTask = { title, desc: '', tags: finalTags, done: false, id: null, grad: softGradient(Math.random()) };
                        if (targetList !== 'Default') newTask.category = targetList;
                        tasksArr.unshift(newTask);
                    });
                    listsState.lists[targetList] = tasksArr;
                    save();
                    render();
                    return;
                } else {
                    titleInput.value = original;
                }
            }
        }
    });

    rowx.append(titleInput, check);
    card.append(rowx);

    const descInput = ce('textarea', { className: 'desc-input', placeholder: 'Optional description' });
    card.append(descInput);

    // Suggestions dropdown
    const suggest = ce('div', { className: 'suggest hidden' });
    card.append(suggest);

    function getAllTags() { return [...new Set(getActiveTasks().flatMap(t => t.tags || []))].sort(); }
    function getAllCats() { return Object.keys(listsState.lists).filter(n => n !== 'Default').sort(); }

    function findTokenAtCursor(value, cursor) {
        // Find the last @ or # before cursor that is part of a word token
        let start = -1, type = null;
        for (let i = cursor - 1; i >= 0; i--) {
            const ch = value[i];
            if (ch === '#' || ch === '@') { start = i; type = ch; break; }
            if (!/\w/.test(ch)) break;
        }
        if (start === -1) return null;
        const prefix = value.slice(start + 1, cursor);
        if (!/^\w*$/.test(prefix)) return null;
        return { start, prefix, type };
    }

    function renderSuggestions() {
        const value = titleInput.value;
        const cursor = titleInput.selectionStart || value.length;
        const tok = findTokenAtCursor(value, cursor);
        if (!tok) { suggest.classList.add('hidden'); suggest.innerHTML = ''; return; }
        const pool = tok.type === '#' ? getAllTags() : getAllCats();
        let list = pool.filter(x => x.toLowerCase().startsWith(tok.prefix.toLowerCase()));
        if (list.length === 0) { suggest.classList.add('hidden'); suggest.innerHTML = ''; return; }
        list = list.slice(0, 8);
        suggest.innerHTML = '';
        list.forEach((item, idx) => {
            const it = ce('div', { className: 'item' + (idx === 0 ? ' active' : ''), textContent: (tok.type === '#' ? '#' : '@') + item });
            it.onclick = () => applySuggestion(item, tok.type);
            suggest.append(it);
        });
        suggest.classList.remove('hidden');
    }

    function applySuggestion(text, type) {
        const value = titleInput.value;
        const cursor = titleInput.selectionStart || value.length;
        const tok = findTokenAtCursor(value, cursor);
        if (!tok) return;
        const before = value.slice(0, tok.start + 1); // include trigger
        const afterIdx = tok.start + 1 + tok.prefix.length;
        const after = value.slice(afterIdx);
        const inserted = text;
        const newVal = before + inserted + after + ' ';
        titleInput.value = newVal;
        const newPos = (before + inserted + ' ').length;
        titleInput.setSelectionRange(newPos, newPos);
        suggest.classList.add('hidden');
        suggest.innerHTML = '';
        titleInput.focus();
    }

    function moveActive(delta) {
        if (suggest.classList.contains('hidden')) return;
        const items = [...suggest.querySelectorAll('.item')];
        if (!items.length) return;
        let idx = items.findIndex(i => i.classList.contains('active'));
        idx = (idx + delta + items.length) % items.length;
        items.forEach(i => i.classList.remove('active'));
        items[idx].classList.add('active');
    }

    function selectActive() {
        if (suggest.classList.contains('hidden')) return false;
        const elActive = suggest.querySelector('.item.active');
        if (!elActive) return false;
        const text = elActive.textContent || '';
        const type = text.startsWith('@') ? '@' : '#';
        applySuggestion(text.slice(1), type);
        return true;
    }

    titleInput.addEventListener('input', renderSuggestions);
    titleInput.addEventListener('click', renderSuggestions);
    titleInput.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) return; // handled in keydown
        renderSuggestions();
    });
    titleInput.addEventListener('keydown', (e) => {
        if (!suggest.classList.contains('hidden')) {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); return; }
            if (e.key === 'Enter' || e.key === 'Tab') {
                if (selectActive()) { e.preventDefault(); return; }
            }
            if (e.key === 'Escape') { suggest.classList.add('hidden'); suggest.innerHTML = ''; return; }
        }
        if (e.key === 'Enter' && suggest.classList.contains('hidden')) {
            e.preventDefault(); submit();
        }
    });

    // focus title when rendered
    setTimeout(() => titleInput.focus(), 0);
    return card;
}

// Theme init
(function initTheme() {
    const KEY = 'theme-v1';
    const stored = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    function apply(t) {
        document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.innerHTML = t === 'dark'
            ? '<circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/>'
            : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
    apply(theme);

    // Update PWA status bar color
    const themeMeta = document.getElementById('themeColorMeta');
    if (themeMeta) {
        themeMeta.setAttribute('content', theme === 'dark' ? '#0f1216' : '#f6f8fb');
    }
    const btn = document.getElementById('themeBtn');
    if (btn) btn.addEventListener('click', () => {
        const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
        localStorage.setItem(KEY, next);
        apply(next);
        // Update PWA status bar color on toggle
        const themeMeta = document.getElementById('themeColorMeta');
        if (themeMeta) {
            themeMeta.setAttribute('content', next === 'dark' ? '#0f1216' : '#f6f8fb');
        }
    });
    registerBackdrop && registerBackdrop.addEventListener('click', (e) => { if (e.target === registerBackdrop) closeModal(registerBackdrop); });
    loginBackdrop && loginBackdrop.addEventListener('click', (e) => { if (e.target === loginBackdrop) closeModal(loginBackdrop); });

    function closeModal(backdrop) {
        if (!backdrop) return;
        backdrop.classList.remove('show');
        backdrop.setAttribute('aria-hidden', 'true');
    }

    const registerSubmit = document.getElementById('registerSubmit');
    const loginSubmit = document.getElementById('loginSubmit');
    registerSubmit && registerSubmit.addEventListener('click', () => {
        const email = document.getElementById('registerEmail').value;
        const pass = document.getElementById('registerPassword').value;
        if (!email || !pass) { showToast('Please enter email and password', 'error'); return; }
        import('./auth.js').then(({ register }) => {
            const passConfirm = document.getElementById('registerPasswordConfirm').value;
            if (pass !== passConfirm) { showToast('Passwords do not match', 'error'); return; }
            register(email, pass, passConfirm).then(user => {
                showToast('Registered: ' + user.email, 'success');
                closeModal(registerBackdrop);
            }).catch(err => showToast('Registration failed: ' + err.message, 'error'));
        });
    });
    loginSubmit && loginSubmit.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        if (!email || !pass) { showToast('Please enter email and password', 'error'); return; }
        import('./auth.js').then(({ login }) => {
            login(email, pass).then(authData => {
                const email = authData.record.email;
                const username = email.split('@')[0];
                document.getElementById('username').textContent = username;
                document.getElementById('menuSignOut').style.display = 'flex';
                document.getElementById('menuRegister').style.display = 'none';
                document.getElementById('menuLogin').style.display = 'none';
                localStorage.setItem('pb_auth', JSON.stringify(authData));
                showToast('Logged in as: ' + username, 'success');
                closeModal(loginBackdrop);
            }).catch(err => alert('Login failed: ' + err.message));
        });
    });
})();

// Mode init (Tasks / Notes)
(function initMode() {
    const btn = document.getElementById('modeBtn');
    const icon = document.getElementById('modeIcon');
    function applyIcon() {
        if (!icon) return;
        icon.innerHTML = appMode === 'tasks'
            ? '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'
            : '<path d="M3 7h18"/><path d="M3 12h18"/><path d="M3 17h12"/>';
    }
    applyIcon();
    if (btn) btn.addEventListener('click', () => {
        appMode = appMode === 'tasks' ? 'notes' : 'tasks';
        localStorage.setItem(MODE_KEY, appMode);
        applyIcon();
        renderListSelector();
        render();
    });
})();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        //navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

// Restore session if available
(async function restoreSession() {
    const raw = localStorage.getItem('pb_auth');
    if (!raw) return;
    try {
        const authData = JSON.parse(raw);
        if (authData && authData.token && authData.record) {
            const { getPb } = await import('./auth.js');
            // not loading sometimes
            const pb = getPb();
            if (!pb) { console.error("PocketBase client not initialized"); return; }
            pb.authStore.save(authData.token, authData.record);
            // verify with backend
            try {
                await pb.collection('users').authRefresh();
                localStorage.setItem('pb_auth', JSON.stringify({
                    token: pb.authStore.token,
                    record: pb.authStore.model
                }));
            } catch (err) {
                console.warn("Session refresh failed", err);
                pb.authStore.clear();
                localStorage.removeItem('pb_auth');
                return;
            }
            if (pb.authStore.isValid && pb.authStore.model) {
                const email = pb.authStore.model.email;
                const username = email.split('@')[0];
                document.getElementById('username').textContent = username;
                document.getElementById('menuSignOut').style.display = 'flex';
                document.getElementById('menuRegister').style.display = 'none';
                document.getElementById('menuLogin').style.display = 'none';
            }
        }
    } catch (e) {
        console.error("Failed to restore session", e);
        //localStorage.removeItem('pb_auth');
    }
})();

// Initialize from URL param
(function initFromURL() {
    const url = new URL(window.location.href);
    const cat = url.searchParams.get('cat');
    if (cat) { ensureList(cat); listsState.activeList = cat; saveLists(listsState); }
})();
// Render including inline add card and list selector
renderListSelector();
render();

// Share/Invite behavior
(function setupShare() {
    const shareBtn = document.getElementById('shareBtn');
    if (!shareBtn) return;
    const backdrop = document.getElementById('inviteBackdrop');
    const title = document.getElementById('inviteTitle');
    const desc = document.getElementById('inviteDesc');
    const emails = document.getElementById('inviteEmails');
    const err = document.getElementById('inviteErr');
    const cancelBtn = document.getElementById('inviteCancel');
    const sendBtn = document.getElementById('inviteSend');
    const actionsBtn = document.getElementById('actionsBtn');
    const actionsMenu = document.getElementById('actionsMenu');
    const actComplete = document.getElementById('actCompleteAll');
    const actDelete = document.getElementById('actDeleteCompleted');

    function openModal() {
        const cat = getActiveListName();
        title.textContent = 'Invite to @' + cat;
        desc.textContent = 'Enter email addresses to invite to this list. You will implement sending later.';
        emails.value = '';
        err.style.display = 'none';
        backdrop.classList.add('show');
        backdrop.setAttribute('aria-hidden', 'false');
        setTimeout(() => emails.focus(), 0);
    }
    function closeModal() {
        backdrop.classList.remove('show');
        backdrop.setAttribute('aria-hidden', 'true');
    }
    function toggleActions() { if (actionsMenu.classList.contains('hidden')) { actionsMenu.classList.remove('hidden'); actionsBtn.setAttribute('aria-expanded', 'true'); } else { actionsMenu.classList.add('hidden'); actionsBtn.setAttribute('aria-expanded', 'false'); } }
    function closeActions() { actionsMenu.classList.add('hidden'); actionsBtn.setAttribute('aria-expanded', 'false'); }
    function parseEmails(text) {
        const parts = text.split(/[\,\n\s]+/).map(s => s.trim()).filter(Boolean);
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return Array.from(new Set(parts.filter(p => re.test(p.toLowerCase()))));
    }
    function saveInvites(cat, list) {
        const KEY = 'invites-v1';
        const raw = localStorage.getItem(KEY);
        const data = raw ? JSON.parse(raw) : {};
        const prev = Array.isArray(data[cat]) ? data[cat] : [];
        const merged = Array.from(new Set([...prev, ...list]));
        data[cat] = merged;
        localStorage.setItem(KEY, JSON.stringify(data));
    }

    shareBtn.addEventListener('click', () => {
        const cat = getActiveListName();
        if (!cat || cat === 'Default') { showToast('Select a category to share.', 'error'); return; }
        openModal();
    });
    actionsBtn && actionsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleActions(); });
    actComplete && actComplete.addEventListener('click', async () => {
        if (actComplete.classList.contains('disabled')) return;
        const name = getActiveListName();
        const tasks = listsState.lists[name] || [];
        // mark all tasks done
        tasks.forEach(t => { t.done = true; });
        listsState.lists[name] = tasks;
        try {
            const { getPb } = await import('./auth.js');
            const pb = getPb();
            if (pb && pb.authStore.isValid) {
                for (const t of tasks) {
                    if (t.id) {
                        await pb.collection('tasks').update(t.id, { done: true });
                    }
                }
            }
        } catch (err) {
            console.error("Failed to sync completeAll to PocketBase", err);
        }
        await save();
        closeActions();
        render();
    });
    actDelete && actDelete.addEventListener('click', async () => {
        if (actDelete.classList.contains('disabled')) return;
        const name = getActiveListName();
        const tasks = listsState.lists[name] || [];
        const hasCompleted = tasks.some(t => t.done);
        if (!hasCompleted) return;
        if (!confirm('Delete all completed tasks in @' + name + '?')) return;
        const kept = tasks.filter(t => !t.done);
        const toDelete = tasks.filter(t => t.done && t.id);
        listsState.lists[name] = kept;
        await save();
        try {
            const { getPb } = await import('./auth.js');
            const pb = getPb();
            if (pb && pb.authStore.isValid) {
                for (const t of toDelete) {
                    await pb.collection('tasks').delete(t.id);
                }
            }
        } catch (err) {
            console.error("Failed to sync deleteCompleted to PocketBase", err);
        }
        closeActions();
        render();
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeActions(); } });
    document.addEventListener('click', () => closeActions());
    cancelBtn.addEventListener('click', closeModal);
    sendBtn.addEventListener('click', () => {
        const list = parseEmails(emails.value);
        if (!list.length) { err.style.display = 'block'; emails.focus(); return; }
        const cat = getActiveListName();
        saveInvites(cat, list);
        closeModal();
        showToast('Invites prepared for @' + cat + ': ' + list.join(', '), 'info');
    });
    // initial visibility
    shareBtn.style.display = (appMode === 'tasks' && getActiveListName() !== 'Default') ? '' : 'none';
})();

// Account menu behavior
(function setupAccountMenu() {
    const btn = document.getElementById('accountBtn');
    const menu = document.getElementById('accountMenu');
    if (!btn || !menu) return;
    function openMenu() { menu.classList.remove('hidden'); btn.setAttribute('aria-expanded', 'true'); }
    function closeMenu() { menu.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); }
    function toggleMenu() { if (menu.classList.contains('hidden')) openMenu(); else closeMenu(); }
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', () => closeMenu());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    // Demo handlers
    const profile = document.getElementById('menuProfile');
    const settings = document.getElementById('menuSettings');
    const signout = document.getElementById('menuSignOut');
    profile && profile.addEventListener('click', () => { closeMenu(); showToast('Profile clicked', 'info'); });
    settings && settings.addEventListener('click', () => { closeMenu(); showToast('Settings clicked', 'info'); });
    signout && signout.addEventListener('click', () => {
        import('./auth.js').then(({ logout }) => {
            logout();
            document.getElementById('username').textContent = '';
            document.getElementById('menuSignOut').style.display = 'none';
            document.getElementById('menuRegister').style.display = 'flex';
            document.getElementById('menuLogin').style.display = 'flex';
            localStorage.removeItem('pb_auth');
            showToast('Signed out', 'info');
            closeMenu();
        });
    });

    const register = document.getElementById('menuRegister');
    const login = document.getElementById('menuLogin');
    const signoutBtn = document.getElementById('menuSignOut');
    if (signoutBtn) signoutBtn.style.display = 'none';
    const registerBackdrop = document.getElementById('registerBackdrop');
    const loginBackdrop = document.getElementById('loginBackdrop');
    const registerCancel = document.getElementById('registerCancel');
    const loginCancel = document.getElementById('loginCancel');

    function openModal(backdrop) { backdrop.classList.add('show'); backdrop.setAttribute('aria-hidden', 'false'); }
    function closeModal(backdrop) { backdrop.classList.remove('show'); backdrop.setAttribute('aria-hidden', 'true'); }

    register && register.addEventListener('click', () => { closeMenu(); openModal(registerBackdrop); });
    login && login.addEventListener('click', () => { closeMenu(); openModal(loginBackdrop); });
    registerCancel && registerCancel.addEventListener('click', () => closeModal(registerBackdrop));
    loginCancel && loginCancel.addEventListener('click', () => closeModal(loginBackdrop));
    registerBackdrop && registerBackdrop.addEventListener('click', (e) => { if (e.target === registerBackdrop) closeModal(registerBackdrop); });
    loginBackdrop && loginBackdrop.addEventListener('click', (e) => { if (e.target === loginBackdrop) closeModal(loginBackdrop); });
})();

// Chip delete control and deletion actions
function createChipDelete(onClick) {
    const del = document.createElement('span');
    del.className = 'del';
    del.title = 'Delete';
    del.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return del;
}

function tryDeleteCategory(name) {
    if (!name || name === 'Default') return;
    if (!confirm('Delete category @' + name + ' and move its tasks to Default?')) return;
    if (appMode === 'tasks') {
        const tasks = listsState.lists[name] || [];
        ensureList('Default');
        listsState.lists['Default'] = [...tasks, ...(listsState.lists['Default'] || [])];
        delete listsState.lists[name];
        setActiveList('Default');
        save();
    } else {
        const notes = notesState.lists[name] || [];
        if (!notesState.lists['Default']) notesState.lists['Default'] = [];
        notesState.lists['Default'] = [...notes, ...(notesState.lists['Default'] || [])];
        delete notesState.lists[name];
        setActiveList('Default');
        saveNotes(notesState);
    }
    renderListSelector();
    render();
}

function tryDeleteTag(tag) {
    if (!tag) return;
    if (!confirm('Remove #' + tag + ' from all items in this category?')) return;
    const name = getActiveListName();
    if (appMode === 'tasks') {
        const tasks = (listsState.lists[name] || []).map(t => ({
            ...t,
            tags: (t.tags || []).filter(x => x !== tag)
        }));
        listsState.lists[name] = tasks;
        save();
    } else {
        const notes = (notesState.lists[name] || []).map(n => ({
            ...n,
            tags: (n.tags || []).filter(x => x !== tag)
        }));
        notesState.lists[name] = notes;
        saveNotes(notesState);
    }
    render();
}
// Simple toast implementation
function showToast(message, type = 'info') {
    let toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '10px 16px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '14px';
    toast.style.zIndex = '100000';
    toast.style.color = '#fff';
    toast.style.background = type === 'error' ? '#b42318' : (type === 'success' ? '#16a34a' : '#374151');
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,.15)';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}