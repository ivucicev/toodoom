import { Injectable, signal } from '@angular/core';
import PocketBase from 'pocketbase/cjs';
import { ToastService } from './toast.service';

@Injectable({
	providedIn: 'root'
})
export class PocketbaseService {

	private pb: PocketBase;
	public currentUser!: any;

	public notes = signal([]);
	public noteTags = signal<string[]>([]);
	public noteCategories = signal<string[]>([]);

	constructor(private toast: ToastService) {
		this.pb = new PocketBase('http://127.0.0.1:8090/');
	}

	getPb = () => this.pb;

	async refreshAuth() {
		const res = await this.pb.collection('users').authRefresh();
		this.pb.authStore.save(res.token, res.record);
		this.currentUser = this.pb.authStore.record
	}

	async login(email: string, password: string) {
		try {
			const authData = await this.pb.collection("users").authWithPassword(email, password);
			this.pb.authStore.save(authData.token, authData.record);
			this.currentUser = this.pb.authStore.record
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
	}

	async getTasks() {
		return await this.pb.collection('tasks').getFullList({ sort: 'position,-created', expand: 'user,list,list.participants,list.owner' });
	}

	async getNotes() {
		return await this.pb.collection('notes').getFullList({ sort: '-created', expand: 'list,list.owner' });
	}

	async deleteCategory(id: string) {
		if (window.confirm("Are you sure you want to delete this category? This will move all tasks associated with it to uncategorized."))
			await this.pb.collection('lists').delete(id);
	}

	async deleteNoteCategory(id: string) {
		if (window.confirm("Are you sure you want to delete this category? This will move all notes associated with it to uncategorized."))
			await this.pb.collection('note_lists').delete(id);
	}

	async upsertTask(task: ITask): Promise<ITask> {
		if (task.id && task.id !== '') {
			return await this.pb.collection('tasks').update(task.id, task);
		} else {
			return await this.pb.collection('tasks').create(task);
		}
	}

	async upsertNote(note: INote): Promise<INote> {
		if (note.id && note.id !== '') {
			return await this.pb.collection('notes').update(note.id, note);
		} else {
			return await this.pb.collection('notes').create(note);
		}
	}

	async deleteTask(id: string, prompt = true) {
		if (!prompt || window.confirm("Are you sure you want to delete this task?"))
			await this.pb.collection('tasks').delete(id);
	}

	async deleteNote(id: string) {
		if (window.confirm("Are you sure you want to delete this note?"))
			await this.pb.collection('notes').delete(id);
	}

	async removeSharedInvite(id: string) {
		if (window.confirm("Are you sure you want to remove this invite?"))
			await this.pb.collection('invites').delete(id);
	}

	async removeParticipant(list: IList, userId: string) {
		if (!window.confirm(`Are you sure you want to remove this user from @${list.name}?`)) return;
		const participants = list.participants.filter((f: any) => f.id != userId);
		await this.pb.collection('lists').update(list.id, { participants });
	}

	async createList(newList: IList): Promise<IList> {
		return await this.pb.collection('lists').create(newList);
	}

	async getList(name: string): Promise<IList> {
		return await this.pb.collection('lists').getFirstListItem(`name = "${name}"`, { expand: 'participants' });
	}

	async getNoteList(name: string): Promise<INoteList> {
		return await this.pb.collection('note_lists').getFirstListItem(`name = "${name}"`);
	}

	async createNoteList(newList: INoteList): Promise<INoteList> {
		return await this.pb.collection('note_lists').create(newList);
	}

	async deleteList(id: string) {
		if (window.confirm("Are you sure you want to delete this list? This will also move all notes associated with it to uncategorized."))
			await this.pb.collection('lists').delete(id);
	}

	async toggleTaskCompletion(id: string, done: boolean) {
		return await this.pb.collection('tasks').update(id, { done });
	}

	async getSharedInvites(listId: string) {
		return await this.pb.collection('invites').getList(1, 50, { filter: `list = "${listId}"` });
	}

	async invite(emails: string[], listId: string) {
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