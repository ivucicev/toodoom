import { getPb } from './auth.js';

const LISTS_KEY = 'tasks-lists-v1';

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

// --- POCKETBASE STORAGE ---
async function loadPbLists() {
    const pb = getPb();
    const userId = pb.authStore.model.id;
    // Get all lists for this user
    const lists = await pb.collection('lists').getFullList({ filter: `owner="${userId}"` });
    const tasks = await pb.collection('tasks').getFullList({ filter: `list.owner="${userId}"` });
    // Map to local format
    const listsObj = {};
    lists.forEach(list => {
        listsObj[list.name] = tasks.filter(t => t.list === list.id).map(t => ({
            id: t.id,
            title: t.title,
            desc: t.desc,
            tags: t.tags,
            done: t.done,
            grad: t.grad_seed ? softGradient(t.grad_seed) : softGradient(Math.random()),
            category: list.name
        }));
    });
    // Get activeList from user_prefs
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
    // Upsert lists and tasks
    for (const [name, tasks] of Object.entries(listsState.lists)) {
        // Upsert list
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
        // Upsert tasks
        for (const t of tasks) {
            let task;
            try {
                task = await pb.collection('tasks').getFirstListItem(`list="${list.id}" && title="${t.title}"`);
            } catch {
                task = await pb.collection('tasks').create({
                    list: list.id,
                    title: t.title,
                    desc: t.desc,
                    tags: t.tags,
                    done: t.done,
                    grad_seed: Math.random()
                });
            }
        }
    }
    // Save activeList to user_prefs
    let prefs;
    try {
        prefs = await pb.collection('user_prefs').getFirstListItem(`user="${userId}"`);
        await pb.collection('user_prefs').update(prefs.id, { active_list: listsState.activeList });
    } catch {
        await pb.collection('user_prefs').create({ user: userId, active_list: listsState.activeList });
    }
}

// --- API ---
export async function loadLists() {
    if (await isLoggedIn()) return await loadPbLists();
    return loadLocalLists();
}
export async function saveLists(lists) {
    if (await isLoggedIn()) return await savePbLists(lists);
    return saveLocalLists(lists);
}

// Utility for gradients (copy from your main file)
function softGradient(seed) { /* ...same as in your code... */ }