// Patch: minor comment tweak
import { Component, NgZone, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PocketbaseService } from './core/pocketbase.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from './core/toast.service';
import { JsonPipe } from '@angular/common';
import { distinctUntilChanged, fromEvent, map, merge, shareReplay } from 'rxjs';
import { SwUpdate } from '@angular/service-worker';

// header tabs
type AppMode = 'tasks' | 'notes' | 'notepad';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, FormsModule],
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent implements OnInit { // note: patch applied

	title = 'Toodoom'; // App title

	appMode: AppMode = 'tasks';
	email = '';
	password = '';

	actionsModalOpen = false;
	shareActionsModalOpen = false;
	registerModalOpen = false;
	loginModalOpen = false;
	accountMenuOpen = false;
	isLoggedIn = false;
	isDark = false;
	currentComponent?: any = null;
	emails = '';
	username: string = '';
	appVersion: string = 'v0.7.0';
	sharedInvites: any = [];
	registerEmail: string = '';
	registerPassword: string = '';
	registerPasswordConfirm: string = '';
	currentUserId = '';
	lastInactiveMs = 0;

	// Supported navigation targets displayed in the header.
	readonly appModes: AppMode[] = ['tasks', 'notes', 'notepad'];
	readonly modeLabels: Record<AppMode, string> = {
		tasks: 'Tasks',
		notes: 'Notes',
		notepad: 'Notepad'
	};

	constructor(private zone: NgZone, private updates: SwUpdate, private router: Router, private toast: ToastService, private pb: PocketbaseService) {
		this.updates.versionUpdates.subscribe((e) => {
			if (e.type === 'VERSION_READY') location.reload();
		});
		this.updates.checkForUpdate();
		this.setTheme();
		this.authCheck();
		this.init();
	}

	readonly active$ = merge(
		fromEvent(document, 'visibilitychange').pipe(
			map(() => document.visibilityState === 'visible')
		),
		fromEvent(window, 'focus').pipe(map(() => true)),
		fromEvent(window, 'blur').pipe(map(() => false)),
		fromEvent(window as any, 'pageshow').pipe(map(() => true))
	).pipe(
		distinctUntilChanged(),
		shareReplay({ bufferSize: 1, refCount: true })
	);

	async authCheck() {
		await this.pb.refreshAuth();
		if (!this.pb.currentUser) return;
		this.isLoggedIn = true;
		const email = this.pb.currentUser['email'];
		this.username = email.split('@')[0];
		this.currentUserId = this.pb.currentUser.id;
	}

	init() {
		const stored = localStorage.getItem('app-mode');
		if (stored && this.appModes.includes(stored as AppMode)) {
			this.appMode = stored as AppMode;
		} else {
			this.appMode = 'tasks';
			localStorage.setItem('app-mode', this.appMode);
		}
		this.router.navigateByUrl(`/${this.appMode}`);

	}

	changeMetaTheme() {
		const metaThemeColor = document.querySelector('meta[name="theme-color"]');
		metaThemeColor?.setAttribute('content', this.isDark ? '#0f1216' : '#f6f8fb');
	}

	setAppMode(mode: AppMode) {
		this.appMode = mode;
		localStorage.setItem('app-mode', mode);
		this.router.navigateByUrl(`/${mode}`);
	}

	toggleActionsModal() {
		this.actionsModalOpen = !this.actionsModalOpen;
	}

	async toggleShareActionsModal() {
		this.shareActionsModalOpen = !this.shareActionsModalOpen;
		if (this.shareActionsModalOpen) await this.getSharedInvites();
	}

	toggleRegisterModal() {
		this.accountMenuOpen = false;
		this.registerModalOpen = !this.registerModalOpen;
	}

	toggleLoginModal() {
		this.accountMenuOpen = false;
		this.loginModalOpen = !this.loginModalOpen;
	}

	toggleAccountMenu() {
		this.accountMenuOpen = !this.accountMenuOpen;
	}

	toggleTheme() {
		const html = document.documentElement;
		// Store the preferred theme so the UI stays consistent on reload.
		if (html.hasAttribute('data-theme') && html.getAttribute('data-theme') === 'dark') {
			html.removeAttribute('data-theme');
			this.isDark = false;
			localStorage.setItem('theme', 'light');
		} else {
			this.isDark = true;
			html.setAttribute('data-theme', 'dark');
			localStorage.setItem('theme', 'dark');
		}
		this.changeMetaTheme(); // ensure meta theme updated
	}

	setTheme() {
		const theme = localStorage.getItem('theme');
		const html = document.documentElement;
		if (theme === 'dark') {
			this.isDark = true;
			html.setAttribute('data-theme', 'dark');
		}

		this.changeMetaTheme(); // ensure meta theme updated

	}

	async login() {
		const login = await this.pb.login(this.email, this.password);
		this.isLoggedIn = true;
		this.loginModalOpen = false;
		this.email = '';
		this.password = '';
		const email = this.pb.currentUser['email'];
		this.username = email.split('@')[0];
		this.currentUserId = this.pb.currentUser.id;
		this.currentComponent?.refreshData();
	}

	async register() {
		const register = await this.pb.register(this.registerEmail, this.registerPassword, this.registerPasswordConfirm);
		if (!register) return;

		this.toggleRegisterModal();

		this.toast.showToast('Registration was successful.');
	}

	async logout() {
		this.pb.logout();
		this.isLoggedIn = false;
		this.username = '';
		this.accountMenuOpen = false;
		this.currentComponent?.refreshData();
	}

	async completeAllTasks() {
		await this.currentComponent?.completeAll()
		this.actionsModalOpen = false;
	}

	async deleteCompletedTasks() {
		await this.currentComponent?.deleteCompletedTasks()
		this.actionsModalOpen = false;
	}

	ngOnInit() {
		let hiddenAt = 0;
		this.zone.runOutsideAngular(() => {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'hidden') hiddenAt = Date.now();
				else this.lastInactiveMs = hiddenAt ? Date.now() - hiddenAt : 0;
				this.currentComponent?.refreshData();
			});
		});
	}

	async invite() {
		const list = this.parseEmails(this.emails);
		if (!list.length) { this.toast.showToast('Please enter at least one valid email address.', 'error'); return; }
		const cat = this.currentComponent?.taskCategories().find((c: any) => c.name == this.currentComponent?.selectedCategory);
		const shared = await this.pb.invite(list, cat?.id);
		if (shared) {
			this.toggleShareActionsModal();
			this.toast.showToast('Invites prepared for @' + cat.name + ' for ' + list.join(', '), 'info');
			this.emails = '';
			this.currentComponent?.getTasks();
		}
	}

	async getSharedInvites() {
		const cat = this.currentComponent?.taskCategories().find((c: any) => c.name == this.currentComponent?.selectedCategory);
		const invites = await this.pb.getSharedInvites(cat.id);
		this.sharedInvites = [...invites.items]
	}

	parseEmails(text: string) {
		const parts = text.split(/[\,\n\s]+/).map(s => s.trim()).filter(Boolean);
		const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return Array.from(new Set(parts.filter(p => re.test(p.toLowerCase()))));
	}

	onActivate(e: any) {
		this.currentComponent = e;
	}

	async removeInvite(participant: any) {
		const cat = this.currentComponent?.taskCategories().find((c: any) => c.name == this.currentComponent?.selectedCategory);
		await this.pb.removeParticipant(cat, participant.id)
		cat.participants = [...cat.participants.filter((c: any) => c.id != participant.id)];
	}

	async removeSharedInvite(invite: any) {
		await this.pb.removeSharedInvite(invite.id);
		this.sharedInvites = [...this.sharedInvites.filter((f: any) => f.id != invite.id)]
	}

}
