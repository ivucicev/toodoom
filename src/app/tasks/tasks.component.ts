import { Component, signal } from '@angular/core';
import { IList, ITask, PocketbaseService } from '../core/pocketbase.service';
import { FormsModule } from '@angular/forms';
import { MentionableDirective } from '../shared/mentions/mentionable.directive';
import { JsonPipe } from '@angular/common';

@Component({
	selector: 'app-tasks',
	imports: [FormsModule, MentionableDirective],
	templateUrl: './tasks.component.html',
	styleUrl: './tasks.component.css'
})
export class TasksComponent {

	public title = '';
	public desc = '';

	public editTitle = '';
	public editDesc = '';

	public tasks: any = signal({ default: { tasks: [], undone: 0, tags: [] } });
	public taskCategories: any = signal<{ id: string, name: string, color?: string, participants: string[] }[]>([]);

	public selectedCategory = '';
	public selectedTag?: string = '';
	public newTaskColor = { c1: '', c2: '' };
	public editTaskId = '';

	constructor(private pb: PocketbaseService) {
		this.newTaskColor = this.pb.softGradient(Math.random());
		this.getTasks();

		this.initSubscription();
	}

	private async getTasks() {

		const tasks: any = await this.pb.getTasks();

		const categoriesMap = new Map<string, { id: string, color: string, name: string, participants: [] }>();

		for (const task of tasks) {
			const list = task.expand?.list;
			if (list && !categoriesMap.has(list.id)) {
				categoriesMap.set(list.id, { id: list.id, name: list.name, color: list.color, participants: list?.expand?.participants });
			}
		}

		const categories = Array.from(categoriesMap.values());
		this.taskCategories.set(categories);
		const categorizedTasks: any = { default: { tasks: [], undone: 0, tags: [] } };

		for (const task of tasks) {
			const listName = task.expand?.list?.name || 'default';
			if (!categorizedTasks[listName]) {
				categorizedTasks[listName] = { tasks: [], undone: 0, tags: [] };
			}
			categorizedTasks[listName].tasks.push(task);
			if (Array.isArray(task['tags'])) {
				categorizedTasks[listName].tags.push(...task['tags']);
			}

			task.grad = this.pb.softGradient(task.grad_seed);
		}
		// Remove duplicate tags for each category
		for (const key in categorizedTasks) {
			categorizedTasks[key].tags = Array.from(new Set(categorizedTasks[key].tags));
			categorizedTasks[key].tasks.sort((a: ITask, b: ITask) => {
				if (a.done === b.done) return 0;
				return a.done ? 1 : -1;
			});
			categorizedTasks[key].undone = categorizedTasks[key].tasks.filter((t: ITask) => !t.done).length;
		}

		this.tasks.set(categorizedTasks);
	}

	toggleCategory(name: string) {
		if (this.selectedCategory === name) {
			this.selectedCategory = '';
			return;
		}
		this.selectedCategory = name;
	}

	async deleteCategory(id: string, name: string) {
		await this.pb.deleteCategory(id);
		await this.getTasks()
	}

	async upsertTask(editTask?: ITask | null) {

		if (this.title.trim() === '' && this.editTitle === '') return;

		const STRIP_TAG_OR_MENTION = /[#@][\p{L}\p{N}_]+/gu;
		const HASH_TAG_CAPTURE = /#([\p{L}\p{N}_]+)/gu;
		const CAT_TAG_CAPTURE = /@([\p{L}\p{N}_]+)/u;

		const catMatch = editTask ? this.editTitle.match(CAT_TAG_CAPTURE) : this.title.match(CAT_TAG_CAPTURE);
		const categoryMatch = catMatch ? catMatch[1] : '';

		let category = this.taskCategories().find((cat: any) => (cat.name == categoryMatch)
			|| (categoryMatch == '' && cat.name == this.selectedCategory));

		if (!category && categoryMatch) {

			let categoryFromDB = null;

			try {
				categoryFromDB = await this.pb.getList(categoryMatch);
			} catch (error) {

			}

			if (!categoryFromDB) {
				const list = await this.pb.createList({
					id: '',
					name: categoryMatch,
					owner: this.pb.currentUser.id,
					sort_order: 0,
					grad_seed: Math.random(),
					participants: []
				});

				this.taskCategories.set([...this.taskCategories(), { id: list.id, color: list.color, name: list.name, participants: [] }]);
				category = { id: list.id, name: list.name, participants: [] };
			} else {
				this.taskCategories.set([...this.taskCategories(), { id: categoryFromDB.id, color: categoryFromDB.color, name: categoryFromDB.name, participants: categoryFromDB.participants as any }]);
				category = categoryFromDB;
			}

		}

		let task = editTask;;

		if (task && editTask) {
			const newTags = [...this.editTitle.matchAll(HASH_TAG_CAPTURE)].map(m => m[1]);

			task.title = this.editTitle.replace(STRIP_TAG_OR_MENTION, '').trim();
			task.desc = this.editDesc;
			task.list = category?.id;
			task.tags = Array.from(new Set([...(editTask.tags || []), ...newTags]));
		} else {
			const seed = Math.random();
			const tags = [...this.title.matchAll(HASH_TAG_CAPTURE)].map(m => m[1]);

			task = {
				id: '',
				title: this.title.replace(STRIP_TAG_OR_MENTION, '').trim(),
				desc: this.desc,
				list: category?.id,
				done: false,
				tags,
				position: 0,
				grad_seed: seed,
				grad: this.pb.softGradient(seed),
				user: this.pb.currentUser.id
			};
		}

		const savedTask = await this.pb.upsertTask(task as ITask);

		task.id = savedTask.id;

		const allTasks = { ...this.tasks() };

		const listName = category?.id ? category.name : 'default';

		if (!allTasks[listName]) {
			allTasks[listName] = { tasks: [], undone: 0, tags: [] };
		}

		if (editTask) {
			// Update existing task in place
			const idx = allTasks[listName].tasks.findIndex((t: ITask) => t.id === task.id);
			if (idx !== -1) {
				allTasks[listName].tasks[idx] = task;
			}
		} else {
			allTasks[listName].tasks.unshift(task);
			if (Array.isArray(task.tags)) {
				allTasks[listName].tags = Array.from(new Set([...(allTasks[listName].tags || []), ...task.tags]));
			}
		}

		allTasks[listName].undone = allTasks[listName].tasks.filter((t: ITask) => !t.done).length;

		this.tasks.set(allTasks);

		this.title = '';
		this.desc = '';
		this.editDesc = '';
		this.editTitle = '';
		this.editTaskId = '';

		this.selectedCategory = category?.name || '';
		this.newTaskColor = this.pb.softGradient(Math.random());
	}

	async editTask(task: ITask) {
		this.editTaskId = task.id;
		this.editTitle = task.title;
		this.editDesc = task.desc || '';
		window.scrollTo({ top: 0, behavior: 'smooth' });

	}

	async deleteTask(id: string) {
		await this.pb.deleteTask(id);
		const allTasks = { ...this.tasks() };
		for (const key in allTasks) {
			allTasks[key].tasks = allTasks[key].tasks.filter((t: ITask) => t.id !== id);
			allTasks[key].undone = allTasks[key].tasks.filter((t: ITask) => !t.done).length;
		}
		this.tasks.set(allTasks);

	}

	async toggleTask(e: Event, task: ITask) {
		e.preventDefault();
		e.stopImmediatePropagation();
		task.done = !task.done;
		await this.pb.toggleTaskCompletion(task.id, task.done);
	}

	async toggleTag(tag: string) {
		this.selectedTag = this.selectedTag === tag ? '' : tag;
	}

	focusNewTask(e: any) {
		this.editTaskId = '';
		this.editTitle = '';
		this.editDesc = '';
	}

	async refreshData() {
		await this.getTasks();
	}

	handleQuickSubmit(event: KeyboardEvent | any, mention: MentionableDirective, task?: ITask | null) {
		if (mention.consumeSelection()) {
			return;
		}
		if (mention.isActive()) {
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.upsertTask(task ?? undefined);
		}
	}

	async completeAll() {
		this.tasks()[this.selectedCategory == '' ? 'default' : this.selectedCategory].tasks.forEach(async (task: ITask) => {
			if (!task.done) task.done = true;
			this.tasks()[this.selectedCategory == '' ? 'default' : this.selectedCategory].undone = 0;
			await this.pb.toggleTaskCompletion(task.id, true);
		});
	}

	async deleteCompletedTasks() {
		if (!window.confirm("Are you sure you want to delete all completed tasks?")) return;
		this.tasks()[this.selectedCategory == '' ? 'default' : this.selectedCategory].tasks.forEach(async (task: ITask, i: number) => {
			if (!task.done) return;
			await this.pb.deleteTask(task.id, false);
		});
		await this.getTasks();
		this.selectedCategory = '';
	}

	async initSubscription() {
		if (!this.pb.currentUser?.id) return;
		this.pb.getPb().collection('tasks').subscribe('*', async (e: any) => {
			await this.getTasks();
		})

	}

	async organize() {
		let category = this.taskCategories().find((cat: any) => (cat.name == this.selectedCategory));
		if (!category) return;
		await this.pb.organize(category.id);
		await this.getTasks();
	}

	async colorChange(color: any, category: { id: string, name: string }) {
		await this.pb.updateList(category as IList);
	}

	ngOnDestroy() {
		this.pb.getPb().collection('tasks').unsubscribe('*')
	}

}
