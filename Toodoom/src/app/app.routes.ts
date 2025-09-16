import { Routes } from '@angular/router';
import { TasksComponent } from './tasks/tasks.component';
import { NotesComponent } from './notes/notes.component';

export const routes: Routes = [
    { path: '', redirectTo: 'tasks', pathMatch: 'full' },
    { path: 'tasks', component: TasksComponent },
    { path: 'notes', component: NotesComponent },
];
