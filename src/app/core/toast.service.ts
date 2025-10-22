/** Minor: format import block for consistency */
import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class ToastService {

	constructor() { }

	showToast(message: string, type = 'info') {
		let toast = document.createElement('div');
		toast.textContent = message;
		toast.style.position = 'fixed';
		toast.style.bottom = '20px';
		toast.style.left = '50%';
		toast.style.transform = 'translateX(-50%)';
		toast.style.padding = '10px 16px';
		toast.style.borderRadius = '8px';
		toast.style.fontSize = '14px';
		toast.style.zIndex = '100000';
		toast.style.color = '#fff';
		toast.style.background = type === 'error' ? '#b42318' : (type === 'success' ? '#16a34a' : '#374151');
		toast.style.boxShadow = '0 4px 12px rgba(0,0,0,.15)';
		document.body.appendChild(toast);
		setTimeout(() => {
			toast.style.transition = 'opacity 0.4s';
			toast.style.opacity = '0';
			setTimeout(() => toast.remove(), 400);
		}, 2500);

	}
}
