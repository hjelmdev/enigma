import './overlay.css';

/**
 * Screen-fixed DOM layer over the Phaser canvas: title bar, narrative text,
 * pan cues and close-up controls. HTML gives readable text and real buttons
 * (keyboard focus, 48 px touch targets) without baking UI into pixel art.
 */
export interface SealControls {
  onSelect(ring: number): void;
  onTurn(direction: 1 | -1): void;
  onHint(): void;
}

const RING_NAMES = ['Yttre', 'Mellersta', 'Inre'];

export class Overlay {
  readonly root: HTMLDivElement;
  private readonly top: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly narrative: HTMLDivElement;
  private readonly cueLeft: HTMLDivElement;
  private readonly cueRight: HTMLDivElement;
  private closeup: HTMLDivElement | null = null;
  private ringButtons: HTMLButtonElement[] = [];
  private turnButtons: HTMLButtonElement[] = [];
  private caption: HTMLDivElement | null = null;
  private fadeTimer = 0;

  constructor(parent: HTMLElement, onMenu: () => void, onReset: () => void) {
    this.root = el('div', 'ss-ui');
    this.top = el('div', 'ss-top');
    const menu = button('← Meny', onMenu);
    menu.setAttribute('aria-label', 'Tillbaka till menyn');
    this.title = el('div', 'ss-title');
    this.title.textContent = 'Den förseglade solens kammare';
    const reset = button('↺', onReset);
    reset.title = 'Börja om experimentet';
    reset.setAttribute('aria-label', 'Börja om experimentet');
    this.top.append(menu, this.title, el('div', 'ss-spacer'), reset);
    this.narrative = el('div', 'ss-narrative');
    this.narrative.setAttribute('role', 'status');
    this.narrative.setAttribute('aria-live', 'polite');
    this.cueLeft = el('div', 'ss-cue left');
    this.cueLeft.textContent = '‹';
    this.cueRight = el('div', 'ss-cue right');
    this.cueRight.textContent = '›';
    this.cueLeft.setAttribute('aria-hidden', 'true');
    this.cueRight.setAttribute('aria-hidden', 'true');
    this.root.append(this.top, this.cueLeft, this.cueRight, this.narrative);
    parent.append(this.root);
  }

  setNarrative(heading: string | null, text: string) {
    // On short landscape phones the panel would cover the floor, so it steps
    // aside after a while; every new line brings it back.
    this.narrative.classList.remove('ss-faded');
    window.clearTimeout(this.fadeTimer);
    if (
      window.matchMedia('(max-height: 520px) and (orientation: landscape)')
        .matches
    ) {
      this.fadeTimer = window.setTimeout(
        () => this.narrative.classList.add('ss-faded'),
        9000,
      );
    }
    this.narrative.replaceChildren();
    if (heading) {
      const h = document.createElement('strong');
      h.textContent = heading;
      this.narrative.append(h);
    }
    this.narrative.append(document.createTextNode(text));
  }

  setPanCues(left: boolean, right: boolean) {
    this.cueLeft.hidden = !left || this.closeup !== null;
    this.cueRight.hidden = !right || this.closeup !== null;
  }

  /** Narrative panel height in CSS px, so the room camera can avoid it. */
  narrativeHeight() {
    return this.narrative.hidden
      ? 0
      : this.narrative.getBoundingClientRect().height + 12;
  }

  openCloseup(
    title: string,
    caption: string,
    onBack: () => void,
    seal?: SealControls,
  ) {
    this.closeCloseup();
    this.top.hidden = true;
    this.narrative.hidden = true;
    this.setPanCues(false, false);
    const box = el('div', 'ss-ui');
    const bar = el('div', 'ss-top');
    const back = button('← Tillbaka', onBack);
    back.classList.add('ss-primary');
    const t = el('div', 'ss-title');
    t.textContent = title;
    bar.append(back, t);
    const bottom = el('div', 'ss-closeup-bar');
    this.caption = el('div', 'ss-caption');
    this.caption.setAttribute('role', 'status');
    this.caption.setAttribute('aria-live', 'polite');
    this.caption.textContent = caption;
    bottom.append(this.caption);
    if (seal) {
      const rings = el('div', 'ss-row');
      this.ringButtons = RING_NAMES.map((name, i) => {
        const b = button(name, () => seal.onSelect(i));
        b.setAttribute('aria-label', `Välj ${name.toLowerCase()} ringen`);
        rings.append(b);
        return b;
      });
      const turns = el('div', 'ss-row');
      const ccw = button('⟲', () => seal.onTurn(-1));
      ccw.setAttribute('aria-label', 'Vrid moturs');
      const hint = button('Ledtråd', () => seal.onHint());
      const cw = button('⟳', () => seal.onTurn(1));
      cw.setAttribute('aria-label', 'Vrid medurs');
      ccw.classList.add('ss-turn');
      cw.classList.add('ss-turn');
      this.turnButtons = [ccw, cw];
      turns.append(ccw, hint, cw);
      bottom.append(rings, turns);
    }
    box.append(bar, bottom);
    this.root.append(box);
    this.closeup = box;
    back.focus({ preventScroll: true });
  }

  setCaption(text: string) {
    if (this.caption) this.caption.textContent = text;
  }

  setSealUi(selected: number, locked: boolean) {
    this.ringButtons.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === selected));
      b.disabled = locked;
    });
    this.turnButtons.forEach((b) => (b.disabled = locked));
  }

  /** Bottom space the close-up controls occupy, in CSS px. */
  closeupReserved() {
    const bar = this.closeup?.querySelector('.ss-closeup-bar');
    return bar ? bar.getBoundingClientRect().height + 24 : 0;
  }

  closeCloseup() {
    this.closeup?.remove();
    this.closeup = null;
    this.caption = null;
    this.ringButtons = [];
    this.turnButtons = [];
    this.top.hidden = false;
    this.narrative.hidden = false;
  }

  setChromeVisible(visible: boolean) {
    this.top.hidden = !visible;
    this.narrative.hidden = !visible;
  }

  destroy() {
    window.clearTimeout(this.fadeTimer);
    this.root.remove();
  }
}

function el(tag: 'div', className: string) {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function button(label: string, onClick: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  // Keep presses on UI from reaching the canvas as pan/tap gestures.
  b.addEventListener('pointerdown', (event) => event.stopPropagation());
  return b;
}
