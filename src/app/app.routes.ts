import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

/** Il gioco e l'editor sono pesanti: si scaricano solo quando si apre la loro pagina, così la home parte subito. */
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'editor', loadComponent: () => import('./editor/editor.component').then((m) => m.EditorComponent) },
  { path: 'gioca/:mappa', loadComponent: () => import('./game/game-scene.component').then((m) => m.GameSceneComponent) },
  { path: '**', redirectTo: '' },
];
