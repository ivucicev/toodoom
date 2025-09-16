import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PocketbaseService } from './core/pocketbase.service';
import { FormsModule } from '@angular/forms';

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

	username: string = '';

	constructor(private router: Router, private pb: PocketbaseService) {
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

	toggleShareActionsModal() {
		this.shareActionsModalOpen = !this.shareActionsModalOpen;
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

	async logout() {
		this.pb.logout();
		this.isLoggedIn = false;
		this.username = '';
		this.accountMenuOpen = false;
	}
}
