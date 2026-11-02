import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Le icone che i testi in markdown mostrano dentro le frasi (`.tok` in styles.css): come `app-icon`, il percorso parte dalla base della pagina.
for (const [variable, file] of [['--ico-footprint', 'footprint'], ['--ico-water-drop', 'water_drop'], ['--ico-skull', 'skull']]) {
  document.documentElement.style.setProperty(variable, `url("${new URL(`icons/${file}.svg`, document.baseURI).href}")`);
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
