import { getPb } from './auth.js';

const LISTS_KEY = 'tasks-lists-v1';
const NOTES_KEY = 'notes-lists-v1';

export async function isLoggedIn() {
    const pb = getPb();
    return pb && pb.authStore && pb.authStore.isValid;
}

// --- LOCAL STORAGE FALLBACK ---
function loadLocalLists() {
    const raw = localStorage.getItem(LISTS_KEY);
    return raw ? JSON.parse(raw) : { activeList: 'Default', lists: { 'Default': [] } };
}
function saveLocalLists(lists) {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}
function loadLocalNotes() {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : { activeList: 'Default', lists: { 'Default': [] } };
}
function saveLocalNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// --- POCKETBASE STORAGE ---
async function loadPbLists() {
    const pb = getPb();
    const userId = pb.authStore.model.id;
    const lists = await pb.collection('lists').getFullList({ filter: `owner="${userId}"` });
    const tasks = await pb.collection('tasks').getFullList({ filter: `list.owner="${userId}"` });
    const listsObj = {};
    lists.forEach(list => {
        listsObj[list.name] = tasks.filter(t => t.list === list.id).map(t => ({
            id: t.id,
            title: t.title,
            desc: t.desc,
            tags: t.tags,
            done: t.done,
            grad_seed: (typeof t.grad_seed === "number") ? t.grad_seed : (t.grad_seed = Math.random()),
            grad: softGradient(t.grad_seed),
            category: list.name
        }));
    });
    let activeList = 'Default';
    try {
        const prefs = await pb.collection('user_prefs').getFirstListItem(`user="${userId}"`);
        if (prefs && prefs.active_list) {
            const activeListObj = lists.find(l => l.id === prefs.active_list);
            if (activeListObj) activeList = activeListObj.name;
        }
    } catch {}
    return { activeList, lists: listsObj };
}

async function savePbLists(listsState) {
    const pb = getPb();
    const userId = pb.authStore.model.id;
    for (const [name, tasks] of Object.entries(listsState.lists)) {
        let list;
        try {
            list = await pb.collection('lists').getFirstListItem(`owner="${userId}" && name="${name}"`);
        } catch {
            list = await pb.collection('lists').create({
                name,
                owner: userId,
                grad_seed: Math.random()
            });
        }
        for (const t of tasks) {
            try {
                await pb.collection('tasks').getFirstListItem(`list="${list.id}" && title="${t.title}"`);
            } catch {
                const gradSeed = (typeof t.grad_seed === "number") ? t.grad_seed : Math.random();
                const created = await pb.collection('tasks').create({
                    list: list.id,
                    title: t.title,
                    desc: t.desc,
                    tags: t.tags,
                    done: t.done,
                    grad_seed: gradSeed
                });
                t.id = created.id;
                t.grad_seed = gradSeed;
                t.grad = softGradient(gradSeed);
            }
        }
    }
    let prefs;
    try {
        prefs = await pb.collection('user_prefs').getFirstListItem(`user="${userId}"`);
        await pb.collection('user_prefs').update(prefs.id, { active_list: listsState.activeList });
    } catch {
        await pb.collection('user_prefs').create({ user: userId, active_list: listsState.activeList });
    }
}

// --- NOTES POCKETBASE STORAGE ---
async function loadPbNotes() {
    const pb = getPb();
    const userId = pb.authStore.model.id;

    // fetch note_lists for this user
    const lists = await pb.collection('note_lists').getFullList({ filter: `owner="${userId}"` });
    const notes = await pb.collection('notes').getFullList({ filter: `list.owner="${userId}"` });

    const notesObj = {};
    lists.forEach(list => {
        notesObj[list.name] = notes.filter(n => n.list === list.id).map(n => ({
            id: n.id,
            text: n.text,
            tags: n.tags || [],
            color: n.color || '#fffad1',
            pinned: n.pinned,
            archived: n.archived,
            deleted_at: n.deleted_at
        }));
    });

    let activeList = 'Default';
    try {
        const prefs = await pb.collection('user_prefs').getFirstListItem(`user="${userId}"`);
        if (prefs && prefs.active_list) {
            const activeListObj = lists.find(l => l.id === prefs.active_list);
            if (activeListObj) activeList = activeListObj.name;
        }
    } catch {}
    return { activeList, lists: notesObj };
}

async function savePbNotes(notesState) {
    const pb = getPb();
    const userId = pb.authStore.model.id;

    for (const [name, notes] of Object.entries(notesState.lists)) {
        // upsert note_list
        let noteList;
        try {
            noteList = await pb.collection('note_lists').getFirstListItem(`owner="${userId}" && name="${name}"`);
        } catch {
            noteList = await pb.collection('note_lists').create({
                name,
                owner: userId,
                sort_order: 0,
                color: '#fffad1'
            });
        }
        for (const n of notes) {
            if (n.id) {
                try {
                    const updated = await pb.collection('notes').update(n.id, {
                        list: noteList.id,
                        text: n.text,
                        tags: n.tags || [],
                        color: n.color,
                        position: n.position || 0,
                        pinned: n.pinned || false,
                        archived: n.archived || false,
                        deleted_at: n.deleted_at || null
                    });
                    // sync local note with updated record
                    n.id = updated.id;
                    n.text = updated.text;
                    n.tags = updated.tags;
                    n.color = updated.color;
                    n.position = updated.position;
                    n.pinned = updated.pinned;
                    n.archived = updated.archived;
                    n.deleted_at = updated.deleted_at;
                } catch (e) {
                    console.warn("Failed to update note", e);
                }
            } else {
                try {
                    const created = await pb.collection('notes').create({
                        list: noteList.id,
                        owner: userId,
                        text: n.text,
                        tags: n.tags,
                        color: n.color || '#fffad1',
                        position: n.position || 0,
                        pinned: n.pinned || false,
                        archived: n.archived || false,
                        deleted_at: n.deleted_at || null
                    });
                    n.id = created.id;
                } catch (e) {
                    console.error("Failed to create note", e);
                }
            }
        }
    }

    let prefs;
    try {
        prefs = await pb.collection('user_prefs').getFirstListItem(`user="${userId}"`);
        await pb.collection('user_prefs').update(prefs.id, { active_list: notesState.activeList });
    } catch {
        await pb.collection('user_prefs').create({ user: userId, active_list: notesState.activeList });
    }
}

// (removed duplicate loadPbNotes/savePbNotes definitions — keep only the first, complete implementation above)

// --- API ---
export async function loadLists() {
    if (await isLoggedIn()) return await loadPbLists();
    return loadLocalLists();
}
export async function saveLists(lists) {
    if (await isLoggedIn()) return await savePbLists(lists);
    return saveLocalLists(lists);
}
// --- API for Notes ---
export async function loadNotes() {
    if (await isLoggedIn()) return await loadPbNotes();
    return loadLocalNotes();
}
export async function saveNotes(notes) {
    if (await isLoggedIn()) return await savePbNotes(notes);
    return saveLocalNotes(notes);
}

// --- API for deleting a note ---
export async function deleteNote(noteId) {
    if (await isLoggedIn()) {
        const pb = getPb();
        try {
            await pb.collection('notes').delete(noteId);
        } catch (e) {
            console.error("Failed to delete note in PocketBase", e);
        }
    }
    // also remove from local cache
    for (const [listName, notes] of Object.entries(JSON.parse(localStorage.getItem(NOTES_KEY) || '{"lists":{}}').lists || {})) {
        const filtered = (notes || []).filter(n => n.id !== noteId);
        if (filtered.length !== (notes || []).length) {
            const state = JSON.parse(localStorage.getItem(NOTES_KEY));
            state.lists[listName] = filtered;
            localStorage.setItem(NOTES_KEY, JSON.stringify(state));
        }
    }
}

// Utility for gradients
function softGradient(seed) {
    // Deterministic gradient generator from numeric seed
    function mulberry32(a) {
        return function() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }
    const rnd = mulberry32(Math.floor(seed * 1e9));
    const h = rnd() * 360;
    const s = 35 + rnd() * 15;
    const l1 = 88 + rnd() * 6;
    const l2 = 72 + rnd() * 8;
    return { c1: `hsl(${h} ${s}% ${l1}%)`, c2: `hsl(${h + 20} ${s + 5}% ${l2}%)` };
}
