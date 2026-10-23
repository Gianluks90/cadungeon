import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Un'icona di Google Material Symbols (il file SVG in public/icons/<nome>.svg, mai il font), colorata come il testo che
 * la circonda (`currentColor`): il colore lo decide chi la usa, con un ruolo del tema.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { '[style.--icon]': 'url()', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  styles: `
    :host {
      display: inline-block; flex: none; background-color: currentColor;
      -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat;
    }
  `,
})
export class IconComponent {
  /** Il nome del file in public/icons/, senza estensione (un nome con una cartella, come `tokens/potion`, è un file di public/). */
  readonly name = input.required<string>();
  readonly size = input(18);
  protected readonly url = computed(() => {
    const n = this.name();
    return `url("${new URL(n.includes('/') ? `${n}.svg` : `icons/${n}.svg`, document.baseURI).href}")`;
  });
}
