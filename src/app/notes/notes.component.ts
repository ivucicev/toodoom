import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IList, INote, INoteList, PocketbaseService } from '../core/pocketbase.service';
import { MentionableDirective } from '../shared/mentions/mentionable.directive';

@Component({
	selector: 'app-notes',
	imports: [FormsModule, MentionableDirective],
	templateUrl: './notes.component.html',
	styleUrl: './notes.component.css'
})
export class NotesComponent { // minor formatting tweak

	notes: any = signal({ default: { notes: [], tags: [] } });
	notesCategories = signal<{ id: string, name: string, color?: string }[]>([]);
	selectedCategory: string = '';
	selectedTag: string = '';
	text: string = '';
	editText: string = '';
	editNoteId: string = '';
	newNoteColor = '';

	constructor(private pb: PocketbaseService) {
		this.getNotes();
	}

	async getNotes() {
		const notes: any = await this.pb.getNotes();

		const categoriesMap = new Map<string, { id: string, name: string, color: string }>();

		for (const note of notes) {
			const list = note.expand?.list;
			if (list && !categoriesMap.has(list.id)) {
				categoriesMap.set(list.id, { id: list.id, name: list.name, color: list.color });
			}
		}

		const categories = Array.from(categoriesMap.values());
		this.notesCategories.set(categories);
		const categorizedNotes: any = { default: { notes: [], tags: [] } };

		for (const note of notes) {
			const listName = note.expand?.list?.name || 'default';
			if (!categorizedNotes[listName]) {
				categorizedNotes[listName] = { notes: [], tags: [] };
			}
			categorizedNotes[listName].notes.push(note);
			if (Array.isArray(note['tags'])) {
				categorizedNotes[listName].tags.push(...note['tags']);
			}

			note.color = note.expand?.list?.color || note.color || '#e8edf3';
		}

		for (const key in categorizedNotes) {
			categorizedNotes[key].tags = Array.from(new Set(categorizedNotes[key].tags));
		}

		this.notes.set(categorizedNotes);
	}

	async deleteNote(note: INote) {
		await this.pb.deleteNote(note.id);
		this.getNotes();
	}

	async editNote(note: INote) {
		this.editNoteId = note.id;
		this.editText = note.text;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async upsertNote(editNote?: INote) {

		if (this.text.trim() === '' && this.editText === '') return;

		const STRIP_TAG_OR_MENTION = /[#@][\p{L}\p{N}_]+/gu;
		const HASH_TAG_CAPTURE = /#([\p{L}\p{N}_]+)/gu;
		const CAT_TAG_CAPTURE = /@([\p{L}\p{N}_]+)/u;

		const catMatch = editNote ? this.editText.match(CAT_TAG_CAPTURE) : this.text.match(CAT_TAG_CAPTURE);
		const categoryMatch = catMatch ? catMatch[1] : '';

		let category = this.notesCategories().find(cat => (cat.name == categoryMatch)
			|| (categoryMatch == '' && cat.name == this.selectedCategory));

		if (!category && categoryMatch) {

			let categoryFromDB: any = null;
			try {
				
				categoryFromDB = await this.pb.getNoteList(categoryMatch);
			} catch (error) {
				
			}

			if (!categoryFromDB) {

				const list = await this.pb.createNoteList({
					id: '',
					name: categoryMatch,
					owner: this.pb.currentUser.id,
					sort_order: 0,
				});

				this.notesCategories.set([...this.notesCategories(), { id: list.id, name: list.name, color: list.color }]);
				category = { id: list.id, name: list.name, color: list.color };
			} else {
				this.notesCategories.set([...this.notesCategories(), { id: categoryFromDB.id, color: categoryFromDB.colorChange, name: categoryFromDB.name }]);
				category = categoryFromDB;
			}

		}

		let note = editNote;;
		if (note && editNote) {
			note.text = this.editText.replace(STRIP_TAG_OR_MENTION, '').replace(STRIP_TAG_OR_MENTION, '').trim();
			note.list = category?.id;
			const newTags = [...this.editText.matchAll(HASH_TAG_CAPTURE)].map(m => m[1]);
			note.tags = Array.from(new Set([...(editNote.tags || []), ...newTags]));
		} else {
			note = {
				id: '',
				text: this.text.replace(STRIP_TAG_OR_MENTION, '').replace(STRIP_TAG_OR_MENTION, '').trim(),
				list: category?.id,
				tags: [...this.text.matchAll(HASH_TAG_CAPTURE)].map(m => m[1]),
				position: 0,
				pinned: false,
				archived: false,
				user: this.pb.currentUser.id,
				color: category?.color || '#e8edf3'
			}
		}

		const savedTask = await this.pb.upsertNote(note as INote);

		note.id = savedTask.id;

		const allNotes = { ...this.notes() };

		const listName = category?.id ? category.name : 'default';

		if (!allNotes[listName]) {
			allNotes[listName] = { notes: [], tags: [] };
		}

		if (editNote) {
			const idx = allNotes[listName].notes.findIndex((t: INote) => t.id === note.id);
			if (idx !== -1) {
				allNotes[listName].notes[idx] = note;
			}
		} else {
			allNotes[listName].notes.unshift(note);
			if (Array.isArray(note.tags)) {
				allNotes[listName].tags = Array.from(new Set([...(allNotes[listName].tags || []), ...note.tags]));
			}
		}

		this.notes.set(allNotes);

		this.text = '';
		this.editText = '';
		this.editNoteId = '';

		this.selectedCategory = category?.name || '';
		this.newNoteColor = this.getCategoryColor(this.selectedCategory);
	}

	toggleCategory(name: any) {
		if (this.selectedCategory === name) {
			this.selectedCategory = '';
			return;
		}
		this.selectedCategory = name;
	}

	async deleteCategory(id: string, name: string) {
		await this.pb.deleteNoteCategory(id);
		await this.getNotes()
	}

	toggleTag(tag: string) {
		this.selectedTag = this.selectedTag === tag ? '' : tag;
	}

	async refreshData() {
		await this.getNotes();
	}

	async colorChange(color: any, category: { id: string, name: string, color?: string }) {
		await this.pb.updateNoteList(category as INoteList);
		const nextColor = typeof color?.target?.value === 'string' ? color.target.value : category?.color;
		if (!nextColor) return;

		this.notesCategories.set(this.notesCategories().map((cat: any) =>
			cat.id === category.id ? { ...cat, color: nextColor } : cat
		));

		const allNotes = { ...this.notes() };
		const key = category.name || 'default';
		if (allNotes[key]) {
			allNotes[key].notes = allNotes[key].notes.map((note: INote) => {
				const next = { ...note } as any;
				next.color = nextColor;
				if (next.expand?.list) {
					next.expand.list = { ...next.expand.list, color: nextColor };
				}
				return next;
			});
		}
		this.notes.set(allNotes);
	}

	getCategoryColor(name?: string) {
		if (!name) return '#e8edf3';
		const category = this.notesCategories().find((cat: any) => cat.name === name);
		return category?.color || '#e8edf3';
	}

	getNoteColor(note: INote) {
		return (note as any)?.expand?.list?.color || (note as any)?.color || '#e8edf3';
	}

	handleQuickSubmit(event: KeyboardEvent | any, mention: MentionableDirective, note?: INote) {
		if (mention.consumeSelection()) {
			return;
		}
		if (mention.isActive()) {
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.upsertNote(note);
		}
	}

}
