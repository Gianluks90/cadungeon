import { Component } from '@angular/core';
import { GameSceneComponent } from './game/game-scene.component';

@Component({
  selector: 'app-root',
  imports: [GameSceneComponent],
  template: '<app-game-scene />',
})
export class App {}
