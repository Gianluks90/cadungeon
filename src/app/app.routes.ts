import { Routes } from '@angular/router';
import { GameSceneComponent } from './game/game-scene.component';
import { EditorComponent } from './editor/editor.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'editor', component: EditorComponent },
  { path: 'gioca/:mappa', component: GameSceneComponent },
  { path: '**', redirectTo: '' },
];
