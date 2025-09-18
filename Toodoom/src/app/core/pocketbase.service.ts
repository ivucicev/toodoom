import { Injectable, signal } from '@angular/core';
import PocketBase from 'pocketbase/cjs';
import { ToastService } from './toast.service';
import { environment } from '../../environments/environment';

export interface ITask {
	id: string;
	list?: string | null;
	title: string;
	desc?: string;
	tags?: string[];
	done: boolean;
	position: number;
	grad_seed: number;
	user: string;
	grad?: { c1: string, c2: string };
	created?: string | Date;
	updated?: string | Date;
}

export interface IList {
	id: string;
	name: string;
	owner: string;
	sort_order: number;
	grad_seed: number;
	participants: string[];
	created?: string | Date;
	updated?: string | Date;
}

export interface INote {
	id: string;
	text: string;
	tags?: string[];
	color?: string;
	position: number;
	pinned: boolean;
	archived: boolean;
	deleted_at?: string;
	list: string | undefined | null;
	grad_seed?: number;
	grad?: { c1: string, c2: string };
	user?: string;
	created?: string | Date;
	updated?: string | Date;
}

export interface INoteList {
	id: string;
	name: string;
	owner: string;
	sort_order: number;
	color?: string;
	created?: string | Date;
	updated?: string | Date;
}

type OfflineStoreData = {
	tasks: ITask[];
	notes: INote[];
	lists: IList[];
	noteLists: INoteList[];
};

@Injectable({
	providedIn: 'root'
})
export class PocketbaseService {

	private readonly offlineStorageKey = 'toodoom_offline_store_v1';
	private memoryOfflineData: OfflineStoreData | null = null;
	private readonly offlineUser = { id: 'offline-user', email: 'offline@local' };
	private syncingOfflineData = false;
	private pb: PocketBase;
	public currentUser!: any;

	public notes = signal([]);
	public noteTags = signal<string[]>([]);
	public noteCategories = signal<string[]>([]);

	constructor(private toast: ToastService) {
		this.pb = new PocketBase(environment.api);
		this.pb.autoCancellation(false);
		this.syncCurrentUser();
		if (this.hasSession()) {
			this.syncOfflineDataToServer().catch(err => console.error('Failed to sync offline data on init', err));
		}
	}

	private hasSession(): boolean {
		return !!this.pb.authStore?.record?.id;
	}

	private syncCurrentUser() {
		if (this.hasSession()) {
			this.currentUser = this.pb.authStore.record;
		} else {
			this.currentUser = this.offlineUser;
		}
	}

	private canUseStorage(): boolean {
		return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
	}

	private defaultOfflineData(): OfflineStoreData {
		return { tasks: [], notes: [], lists: [], noteLists: [] };
	}

	private getOfflineData(): OfflineStoreData {
		if (!this.canUseStorage()) {
			if (!this.memoryOfflineData) {
				this.memoryOfflineData = this.defaultOfflineData();
			}
			return this.memoryOfflineData;
		}

		const raw = window.localStorage.getItem(this.offlineStorageKey);
		if (!raw) {
			const defaults = this.defaultOfflineData();
			this.saveOfflineData(defaults);
			return defaults;
		}

		try {
			const parsed = JSON.parse(raw) as Partial<OfflineStoreData> | null;
			return {
				tasks: Array.isArray(parsed?.tasks) ? parsed!.tasks : [],
				notes: Array.isArray(parsed?.notes) ? parsed!.notes : [],
				lists: Array.isArray(parsed?.lists) ? parsed!.lists : [],
				noteLists: Array.isArray(parsed?.noteLists) ? parsed!.noteLists : []
			};
		} catch (error) {
			console.warn('Failed to parse offline cache, resetting', error);
			const defaults = this.defaultOfflineData();
			this.saveOfflineData(defaults);
			return defaults;
		}
	}

	private saveOfflineData(data: OfflineStoreData) {
		const snapshot: OfflineStoreData = {
			tasks: [...data.tasks],
			notes: [...data.notes],
			lists: [...data.lists],
			noteLists: [...data.noteLists]
		};
		if (this.canUseStorage()) {
			window.localStorage.setItem(this.offlineStorageKey, JSON.stringify(snapshot));
		} else {
			this.memoryOfflineData = snapshot;
		}
	}

	private clearOfflineData() {
		const cleared = this.defaultOfflineData();
		this.saveOfflineData(cleared);
		this.memoryOfflineData = this.canUseStorage() ? null : cleared;
	}

	private hasOfflineRecords(data: OfflineStoreData) {
		return data.tasks.length > 0 || data.notes.length > 0 || data.lists.length > 0 || data.noteLists.length > 0;
	}

	private generateId(prefix: string): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
	}

	private decorateTaskForReturn(task: ITask, data: OfflineStoreData) {
		const base: any = { ...task };
		const list = base.list ? data.lists.find(l => l.id === base.list) : undefined;
		if (list) {
			base.expand = { list: { ...list } };
		}
		if (!base.grad && typeof base.grad_seed === 'number') {
			base.grad = this.softGradient(base.grad_seed);
		}
		return base;
	}

	private decorateNoteForReturn(note: INote, data: OfflineStoreData) {
		const base: any = { ...note };
		const list = base.list ? data.noteLists.find(l => l.id === base.list) : undefined;
		if (list) {
			base.expand = { list: { ...list } };
		}
		return base;
	}

	private async syncOfflineDataToServer() {
		if (!this.hasSession() || this.syncingOfflineData) {
			return;
		}
		const data = this.getOfflineData();
		if (!this.hasOfflineRecords(data)) {
			return;
		}
		this.syncingOfflineData = true;
		try {
			const listIdMap = new Map<string, string>();
			for (const list of data.lists) {
				const payload: Partial<IList> = {
					name: list.name,
					owner: this.currentUser?.id || this.offlineUser.id,
					sort_order: list.sort_order ?? 0,
					grad_seed: typeof list.grad_seed === 'number' ? list.grad_seed : Math.random(),
					participants: Array.isArray(list.participants)
						? [...new Set(list.participants.map((p: any) => typeof p === 'string' ? p : p?.id).filter(Boolean))]
						: []
				};
				const created = await this.pb.collection('lists').create(payload);
				listIdMap.set(list.id, created.id);
			}

			const noteListIdMap = new Map<string, string>();
			for (const noteList of data.noteLists) {
				const payload: Partial<INoteList> = {
					name: noteList.name,
					owner: this.currentUser?.id || this.offlineUser.id,
					sort_order: noteList.sort_order ?? 0,
					color: noteList.color
				};
				const created = await this.pb.collection('note_lists').create(payload);
				noteListIdMap.set(noteList.id, created.id);
			}

			for (const task of data.tasks) {
				const mappedList = task.list ? listIdMap.get(task.list) ?? null : null;
				await this.pb.collection('tasks').create({
					title: task.title,
					desc: task.desc ?? '',
					list: mappedList,
					done: task.done ?? false,
					tags: Array.isArray(task.tags) ? [...new Set(task.tags)] : [],
					position: typeof task.position === 'number' ? task.position : 0,
					grad_seed: typeof task.grad_seed === 'number' ? task.grad_seed : Math.random(),
					user: this.currentUser?.id || this.offlineUser.id
				});
			}

			for (const note of data.notes) {
				const mappedList = note.list ? noteListIdMap.get(note.list) ?? null : null;
				await this.pb.collection('notes').create({
					text: note.text,
					list: mappedList,
					tags: Array.isArray(note.tags) ? [...new Set(note.tags)] : [],
					position: typeof note.position === 'number' ? note.position : 0,
					pinned: note.pinned ?? false,
					archived: note.archived ?? false,
					color: note.color,
					grad_seed: typeof note.grad_seed === 'number' ? note.grad_seed : Math.random(),
					user: this.currentUser?.id || this.offlineUser.id
				});
			}

			this.clearOfflineData();
			this.toast.showToast('Offline changes synced with your account.', 'success');
		} catch (error) {
			console.error('Failed to sync offline data', error);
			this.toast.showToast('Could not sync offline changes. They remain stored locally.', 'error');
		} finally {
			this.syncingOfflineData = false;
		}
	}

	getPb = () => this.pb;

	async refreshAuth() {
		const res = await this.pb.collection('users').authRefresh();
		this.pb.authStore.save(res.token, res.record);
		this.syncCurrentUser();
		await this.syncOfflineDataToServer();
	}

	async login(email: string, password: string) {
		try {
			const authData = await this.pb.collection("users").authWithPassword(email, password);
			this.pb.authStore.save(authData.token, authData.record);
			this.syncCurrentUser();
			await this.syncOfflineDataToServer();
			return authData;
		} catch (err) {
			console.error("Login failed:", err);
			this.toast.showToast("Login failed. Please check your credentials. " + err, "error");
			throw err;
		}
	}

	async register(email: string, password: string, passwordConfirm: string) {
		try {
			const user = await this.pb.collection("users").create({
				email,
				password,
				passwordConfirm,
				emailVisibility: true,
				public: true,
			});
			return user;
		} catch (err) {
			console.error("Registration failed:", err);
			this.toast.showToast("Registration failed. Please try again. " + err, "error");
			throw err;
		}
	}

	logout() {
		this.pb.authStore.clear();
		this.syncCurrentUser();
	}

	async getTasks() {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const tasks = data.tasks.map(task => this.decorateTaskForReturn(task, data));
			tasks.sort((a: any, b: any) => {
				const posDiff = (a.position ?? 0) - (b.position ?? 0);
				if (posDiff !== 0) return posDiff;
				const aCreated = a.created ? new Date(a.created).getTime() : 0;
				const bCreated = b.created ? new Date(b.created).getTime() : 0;
				return bCreated - aCreated;
			});
			return Promise.resolve(tasks);
		}
		await this.checkInvites();
		return await this.pb.collection('tasks').getFullList({ sort: 'position,-created', expand: 'user,list,list.participants,list.owner' });
	}

	async getNotes() {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const notes = data.notes.map(note => this.decorateNoteForReturn(note, data));
			notes.sort((a: any, b: any) => {
				const aCreated = a.created ? new Date(a.created).getTime() : 0;
				const bCreated = b.created ? new Date(b.created).getTime() : 0;
				return bCreated - aCreated;
			});
			return Promise.resolve(notes);
		}
		return await this.pb.collection('notes').getFullList({ sort: '-created', expand: 'list,list.owner' });
	}

	async deleteCategory(id: string) {
		if (window.confirm("Are you sure you want to delete this category? This will move all tasks associated with it to uncategorized."))
			if (!this.hasSession()) {
				const data = this.getOfflineData();
				const now = new Date().toISOString();
				data.lists = data.lists.filter(list => list.id !== id);
				data.tasks = data.tasks.map(task => task.list === id ? { ...task, list: null, updated: now } : task);
				this.saveOfflineData(data);
			} else {
				await this.pb.collection('lists').delete(id);
			}
	}

	async deleteNoteCategory(id: string) {
		if (window.confirm("Are you sure you want to delete this category? This will move all notes associated with it to uncategorized."))
			if (!this.hasSession()) {
				const data = this.getOfflineData();
				const now = new Date().toISOString();
				data.noteLists = data.noteLists.filter(list => list.id !== id);
				data.notes = data.notes.map(note => note.list === id ? { ...note, list: null, updated: now } : note);
				this.saveOfflineData(data);
			} else {
				await this.pb.collection('note_lists').delete(id);
			}
	}

	async upsertTask(task: ITask): Promise<ITask> {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const now = new Date().toISOString();
			const { expand, ...rest } = task as any;
			const candidate: ITask = {
				...rest,
				id: rest.id && rest.id !== '' ? rest.id : this.generateId('task'),
				created: rest.created ?? now,
				updated: now,
				user: rest.user ?? this.currentUser?.id ?? this.offlineUser.id,
				position: typeof rest.position === 'number' ? rest.position : data.tasks.length
			};
			const index = data.tasks.findIndex(t => t.id === candidate.id);
			if (index !== -1) {
				data.tasks[index] = { ...candidate };
			} else {
				data.tasks.push({ ...candidate });
			}
			this.saveOfflineData(data);
			return Promise.resolve(this.decorateTaskForReturn(candidate, data));
		}
		if (task.id && task.id !== '') {
			return await this.pb.collection('tasks').update(task.id, task);
		} else {
			return await this.pb.collection('tasks').create(task);
		}
	}

	async upsertNote(note: INote): Promise<INote> {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const now = new Date().toISOString();
			const { expand, ...rest } = note as any;
			const candidate: INote = {
				...rest,
				id: rest.id && rest.id !== '' ? rest.id : this.generateId('note'),
				created: rest.created ?? now,
				updated: now,
				user: rest.user ?? this.currentUser?.id ?? this.offlineUser.id,
				position: typeof rest.position === 'number' ? rest.position : data.notes.length,
				pinned: rest.pinned ?? false,
				archived: rest.archived ?? false
			};
			const index = data.notes.findIndex(n => n.id === candidate.id);
			if (index !== -1) {
				data.notes[index] = { ...candidate };
			} else {
				data.notes.push({ ...candidate });
			}
			this.saveOfflineData(data);
			return Promise.resolve(this.decorateNoteForReturn(candidate, data));
		}
		if (note.id && note.id !== '') {
			return await this.pb.collection('notes').update(note.id, note);
		} else {
			return await this.pb.collection('notes').create(note);
		}
	}

	async deleteTask(id: string, prompt = true) {
		if (!prompt || window.confirm("Are you sure you want to delete this task?"))
			if (!this.hasSession()) {
				const data = this.getOfflineData();
				data.tasks = data.tasks.filter(task => task.id !== id);
				this.saveOfflineData(data);
				return;
			} else {
				await this.pb.collection('tasks').delete(id);
			}
	}

	async deleteNote(id: string) {
		if (window.confirm("Are you sure you want to delete this note?"))
			if (!this.hasSession()) {
				const data = this.getOfflineData();
				data.notes = data.notes.filter(note => note.id !== id);
				this.saveOfflineData(data);
			} else {
				await this.pb.collection('notes').delete(id);
			}
	}

	async removeSharedInvite(id: string) {
		if (!window.confirm("Are you sure you want to remove this invite?")) return;
		if (!this.hasSession()) {
			return;
		}
		await this.pb.collection('invites').delete(id);
	}

	async removeParticipant(list: IList, userId: string) {
		if (!window.confirm(`Are you sure you want to remove this user from @${list.name}?`)) return;
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const idx = data.lists.findIndex(l => l.id === list.id);
			if (idx !== -1) {
				const now = new Date().toISOString();
				const normalized = (data.lists[idx].participants || []).map((p: any) => typeof p === 'string' ? p : p?.id).filter(Boolean);
				const participants = normalized.filter((p: any) => p !== userId);
				data.lists[idx] = { ...data.lists[idx], participants, updated: now };
				this.saveOfflineData(data);
			}
			return;
		}
		const participants = list.participants.filter((f: any) => f.id != userId);
		await this.pb.collection('lists').update(list.id, { participants });
	}

	async createList(newList: IList): Promise<IList> {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const now = new Date().toISOString();
			const list: IList = {
				id: newList.id && newList.id !== '' ? newList.id : this.generateId('list'),
				name: newList.name,
				owner: newList.owner ?? this.currentUser?.id ?? this.offlineUser.id,
				sort_order: newList.sort_order ?? data.lists.length,
				grad_seed: newList.grad_seed ?? Math.random(),
				participants: Array.isArray(newList.participants) ? [...newList.participants] : [],
				created: newList.created ?? now,
				updated: now
			};
			data.lists.push({ ...list, participants: [...list.participants] });
			this.saveOfflineData(data);
			return Promise.resolve({ ...list });
		}
		return await this.pb.collection('lists').create(newList);
	}

	async getList(name: string): Promise<IList> {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const match = data.lists.find(list => list.name.toLowerCase() === name.toLowerCase());
			if (!match) {
				return Promise.reject('List not found');
			}
			return Promise.resolve({ ...match, participants: [...match.participants] });
		}
		return await this.pb.collection('lists').getFirstListItem(`name = "${name}"`, { expand: 'participants' });
	}

	async getNoteList(name: string): Promise<INoteList> {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const match = data.noteLists.find(list => list.name.toLowerCase() === name.toLowerCase());
			if (!match) {
				return Promise.reject('Note list not found');
			}
			return Promise.resolve({ ...match });
		}
		return await this.pb.collection('note_lists').getFirstListItem(`name = "${name}"`);
	}

	async createNoteList(newList: INoteList): Promise<INoteList> {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const now = new Date().toISOString();
			const list: INoteList = {
				id: newList.id && newList.id !== '' ? newList.id : this.generateId('note_list'),
				name: newList.name,
				owner: newList.owner ?? this.currentUser?.id ?? this.offlineUser.id,
				sort_order: newList.sort_order ?? data.noteLists.length,
				color: newList.color,
				created: newList.created ?? now,
				updated: now
			};
			data.noteLists.push({ ...list });
			this.saveOfflineData(data);
			return Promise.resolve({ ...list });
		}
		return await this.pb.collection('note_lists').create(newList);
	}

	async deleteList(id: string) {
		if (!window.confirm("Are you sure you want to delete this list? This will also move all notes associated with it to uncategorized.")) return;
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const now = new Date().toISOString();
			data.lists = data.lists.filter(list => list.id !== id);
			data.tasks = data.tasks.map(task => task.list === id ? { ...task, list: null, updated: now } : task);
			this.saveOfflineData(data);
			return;
		}
		await this.pb.collection('lists').delete(id);
	}

	async toggleTaskCompletion(id: string, done: boolean) {
		if (!this.hasSession()) {
			const data = this.getOfflineData();
			const index = data.tasks.findIndex(task => task.id === id);
			if (index !== -1) {
				data.tasks[index] = { ...data.tasks[index], done, updated: new Date().toISOString() };
				this.saveOfflineData(data);
			}
			return;
		}
		return await this.pb.collection('tasks').update(id, { done });
	}

	async getSharedInvites(listId: string) {
		if (!this.hasSession()) {
			return Promise.resolve({ items: [] });
		}
		return await this.pb.collection('invites').getList(1, 50, { filter: `list = "${listId}"` });
	}

	async invite(emails: string[], listId: string) {
		if (!this.hasSession()) {
			this.toast.showToast('Sharing is available after signing in.', 'info');
			return false;
		}
		for (const email of emails) {
			try {
				await this.pb.collection('invites').create({
					from: this.currentUser.id,
					list: listId,
					to: email
				});
				return true
			} catch (err) {
				this.toast.showToast("User " + email + " already invited", "error");
				return false;
			}
		}
		return true;
	}

	async checkInvites() {
		await this.pb.send('api/check-invites', { method: 'GET' });
	}

	async organize(listId: string) {
		await this.pb.send(`api/organize-list/${listId}`, { method: 'GET' });
	}

	softGradient(seed: number) {
		function mulberry32(a: number) {
			return function () {
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

}
