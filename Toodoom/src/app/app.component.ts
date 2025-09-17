import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PocketbaseService } from './core/pocketbase.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from './core/toast.service';
import { JsonPipe } from '@angular/common';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, FormsModule],
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent {

	title = 'Toodoom';

	appMode: 'tasks' | 'notes' = 'tasks';
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
	sharedInvites: any = [];
	registerEmail: string = '';
	registerPassword: string = '';
	registerPasswordConfirm: string = '';

	constructor(private router: Router, private toast: ToastService, private pb: PocketbaseService) {
		this.setTheme();
		this.authCheck();
		this.init()
	}

	async authCheck() {
		await this.pb.refreshAuth();
		if (!this.pb.currentUser) return;
		this.isLoggedIn = true;
		const email = this.pb.currentUser['email'];
		this.username = email.split('@')[0];
	}

	init() {
		const appMode = localStorage.getItem('app-mode');
		if (appMode === 'tasks' || appMode === 'notes') {
			this.appMode = appMode;
		} else {
			this.appMode = 'tasks';
			localStorage.setItem('app-mode', this.appMode);
		}
		this.router.navigateByUrl(this.appMode === 'tasks' ? '/tasks' : '/notes');
	}

	toggleAppMode() {
		this.appMode = this.appMode === 'tasks' ? 'notes' : 'tasks';
		localStorage.setItem('app-mode', this.appMode);
		this.router.navigateByUrl(this.appMode === 'tasks' ? '/tasks' : '/notes');
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
		if (html.hasAttribute('data-theme') && html.getAttribute('data-theme') === 'dark') {
			html.removeAttribute('data-theme');
			this.isDark = false;
			localStorage.setItem('theme', 'light');
		} else {
			this.isDark = true;
			html.setAttribute('data-theme', 'dark');
			localStorage.setItem('theme', 'dark');
		}
	}

	setTheme() {
		const theme = localStorage.getItem('theme');
		const html = document.documentElement;
		if (theme === 'dark') {
			this.isDark = true;
			html.setAttribute('data-theme', 'dark');
		}
	}

	async login() {
		const login = await this.pb.login(this.email, this.password);
		this.isLoggedIn = true;
		this.loginModalOpen = false;
		this.email = '';
		this.password = '';
		const email = this.pb.currentUser['email'];
		this.username = email.split('@')[0];
	}

	async register() {
		const register = await this.pb.register(this.registerEmail, this.registerPassword, this.registerPasswordConfirm);
		if (!register) return;

		this.toggleRegisterModal();
	}

	async logout() {
		this.pb.logout();
		this.isLoggedIn = false;
		this.username = '';
		this.accountMenuOpen = false;
	}

	async completeAllTasks() {
		await this.currentComponent?.completeAll()
		this.actionsModalOpen = false;
	}

	async deleteCompletedTasks() {
		await this.currentComponent?.deleteCompletedTasks()
		this.actionsModalOpen = false;
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
