import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Import for template-driven forms // minor tweak
import { INotepad, PocketbaseService } from '../core/pocketbase.service';
import { ToastService } from '../core/toast.service';

@Component({
	selector: 'app-notepad',
	imports: [FormsModule],
	templateUrl: './notepad.component.html',
	styleUrl: './notepad.component.css'
})
export class NotepadComponent implements OnDestroy {

	public notepads: INotepad[] = [];
	public selectedNotepadId = '';
	public titleDraft = '';
	public contentDraft = '';
	public isSaving = false;
	public editingTabId: string | null = null;
	public tabTitleDraft = '';

	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private customTitleIds = new Set<string>();

	constructor(private pb: PocketbaseService, private toast: ToastService) {
		this.refreshData();
	}

	async refreshData() {
		try {
			const notepads = await this.pb.getNotepads();
			this.notepads = [...notepads];
			this.rebuildCustomTitleCache();
			if (!this.notepads.length) {
				this.selectedNotepadId = '';
				this.titleDraft = '';
				this.contentDraft = '';
				return;
			}
			const existing = this.notepads.find(p => p.id === this.selectedNotepadId);
			const target = existing ?? this.notepads[0];
			await this.selectNotepad(target.id);
		} catch (error) {
			console.error('Failed to load notepads', error);
			this.toast.showToast('Unable to load notepads. Please try again.', 'error');
		}
	}

	async selectNotepad(id: string) { // called when a notepad is selected
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
			await this.persistActiveNotepad();
		} else if (this.selectedNotepadId && this.selectedNotepadId !== id) {
			await this.persistActiveNotepad();
		}
		this.selectedNotepadId = id;
		const pad = this.notepads.find(p => p.id === id);
		if (!pad) {
			this.titleDraft = '';
			this.contentDraft = '';
			return;
		}
		this.contentDraft = pad.content ?? '';
		const resolvedTitle = this.isCustomTitle(id)
			? this.limitTitle(pad.title ?? '')
			: this.computeTitle(this.contentDraft);
		this.titleDraft = resolvedTitle;
}

	async createNotepad() {
		const title = 'Untitled';
		try {
			const created = await this.pb.upsertNotepad({
				id: '',
				title,
				content: '',
				user: this.pb.currentUser?.id ?? 'offline-user'
			});
			this.notepads = [created, ...this.notepads];
			this.rebuildCustomTitleCache();
			await this.selectNotepad(created.id);
		} catch (error) {
			console.error('Failed to create notepad', error);
			this.toast.showToast('Could not create notepad. Please try again.', 'error');
		}
	}

	onContentInput(value: string) {
		const pad = this.notepads.find(p => p.id === this.selectedNotepadId);
		if (pad) {
			const updatedContent = value ?? '';
			const autoTitle = this.computeTitle(updatedContent);
			const updatedPad: INotepad = {
				...pad,
				content: updatedContent,
				title: this.isCustomTitle(pad.id) ? this.limitTitle(this.titleDraft) : autoTitle
			};
			this.notepads = this.notepads.map(p => p.id === pad.id ? updatedPad : p);
			if (!this.isCustomTitle(pad.id)) {
				this.titleDraft = autoTitle;
			}
		}
		this.queueSave();
}

	async deleteNotepad(pad: INotepad, event: Event) {
		event.stopPropagation();
		try {
			const res = await this.pb.deleteNotepad(pad.id);
			if (!res) return;
			this.notepads = this.notepads.filter(p => p.id !== pad.id);
			this.customTitleIds.delete(pad.id);
			this.rebuildCustomTitleCache();
			if (this.selectedNotepadId === pad.id) {
				if (this.notepads.length) {
					await this.selectNotepad(this.notepads[0].id);
				} else {
					this.selectedNotepadId = '';
					this.titleDraft = '';
					this.contentDraft = '';
				}
			}
		} catch (error) {
			console.error('Failed to delete notepad', error);
			this.toast.showToast('Could not delete notepad. Please try again.', 'error');
		}
	}

	private queueSave() {
		if (!this.selectedNotepadId) return;
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}
		this.saveTimer = setTimeout(() => {
			this.saveTimer = null;
			this.persistActiveNotepad();
		}, 500);
	}

	private async persistActiveNotepad() {
		if (!this.selectedNotepadId) return;
		const pad = this.notepads.find(p => p.id === this.selectedNotepadId);
		if (!pad) return;
		const desiredTitle = this.isCustomTitle(pad.id)
			? this.limitTitle(this.titleDraft)
			: this.computeTitle(this.contentDraft);
		this.titleDraft = desiredTitle;

		//if (pad.title === desiredTitle && pad.content === this.contentDraft) return;

		this.isSaving = true;
		try {
			const saved = await this.pb.upsertNotepad({
				id: this.selectedNotepadId,
				title: desiredTitle,
				content: this.contentDraft,
				user: pad.user ?? this.pb.currentUser?.id ?? 'offline-user'
			});
			this.notepads = this.notepads.map(p => p.id === saved.id ? { ...p, ...saved } : p);
			this.rebuildCustomTitleCache();
		} catch (error) {
			console.error('Failed to save notepad', error);
			this.toast.showToast('Could not save changes. They will retry shortly.', 'error');
		} finally {
			this.isSaving = false;
		}
	}

	private rebuildCustomTitleCache() {
		const custom = new Set<string>();
		for (const pad of this.notepads) {
			const computed = this.computeTitle(pad.content ?? '');
			const stored = this.limitTitle(pad.title ?? '');
			if (stored && stored !== computed && stored !== 'Untitled') {
				custom.add(pad.id);
			}
		}
		this.customTitleIds = custom;
	}

	private isCustomTitle(id: string | undefined | null): boolean {
		if (!id) return false;
		return this.customTitleIds.has(id);
	}

	private limitTitle(value: string): string {
		return (value ?? '').trim().slice(0, 20);
	}

	private computeTitle(content: string): string {
		const firstLine = (content ?? '').split(/\r?\n/)[0] ?? '';
		const trimmed = firstLine.trim();
		const limited = this.limitTitle(trimmed);
		return limited.length ? limited : 'Untitled'; // cap title to 20 chars
	}

	public getTabTitle(pad: INotepad): string {
		if (pad.id === this.selectedNotepadId) {
			return this.titleDraft || this.computeTitle(this.contentDraft);
		}
		if (this.isCustomTitle(pad.id)) {
			return this.limitTitle(pad.title ?? '');
		}
		return this.computeTitle(pad.content ?? '');
	}

	startTabTitleEdit(pad: INotepad, event?: Event) {
		event?.stopPropagation();
		this.editingTabId = pad.id;
		this.tabTitleDraft = this.limitTitle(this.getTabTitle(pad));
		setTimeout(() => {
			const input = document.getElementById(this.tabInputId(pad.id)) as HTMLInputElement | null;
			input?.focus();
			input?.select();
		}, 0);
	}

	onTabTitleDraftChanged(value: string) {
		this.tabTitleDraft = this.limitTitle(value ?? '');
	}

	handleTabTitleKey(event: KeyboardEvent, pad: INotepad) {
		if (event.key === 'Enter') {
			event.preventDefault();
			this.commitTabTitleEdit(pad);
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			this.cancelTabTitleEdit(pad);
		}
	}

	private cancelTabTitleEdit(pad: INotepad) {
		this.tabTitleDraft = this.limitTitle(this.getTabTitle(pad));
		this.editingTabId = null;
	}

	async commitTabTitleEdit(pad: INotepad) {
		if (this.editingTabId !== pad.id) {
			return;
		}
		const normalized = this.limitTitle(this.tabTitleDraft);
		const computedFromContent = this.computeTitle(pad.content ?? '');
		const isCustom = normalized.length > 0 && normalized !== computedFromContent && normalized !== 'Untitled';
		const finalTitle = isCustom ? normalized : computedFromContent;
		if (isCustom) {
			this.customTitleIds.add(pad.id);
		} else {
			this.customTitleIds.delete(pad.id);
		}
		this.editingTabId = null;
		this.tabTitleDraft = finalTitle;
		this.notepads = this.notepads.map(p => p.id === pad.id ? { ...p, title: finalTitle } : p);
		if (pad.id === this.selectedNotepadId) {
			this.titleDraft = finalTitle;
		}
		await this.persistTabTitle(pad.id, finalTitle);
	}

	private async persistTabTitle(padId: string, title: string) {
		const current = this.notepads.find(p => p.id === padId);
		if (!current) {
			return;
		}
		const payloadContent = padId === this.selectedNotepadId ? this.contentDraft : current.content ?? '';
		try {
			const saved = await this.pb.upsertNotepad({
				id: padId,
				title,
				content: payloadContent,
				user: current.user ?? this.pb.currentUser?.id ?? 'offline-user'
			});
			this.notepads = this.notepads.map(p => p.id === saved.id ? { ...p, ...saved } : p);
			this.rebuildCustomTitleCache();
		} catch (error) {
			console.error('Failed to rename notepad', error);
			this.toast.showToast('Could not update notepad title. Please try again.', 'error');
		}
	}

	tabInputId(id: string) {
		return `notepad-tab-input-${id}`;
	}

	ngOnDestroy(): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}
	}

	// No-op placeholders used by the shell when bound to the current component.
	async completeAll() { }
	async deleteCompletedTasks() { }

}
