import Phaser from 'phaser';
import { ArtView } from '../prologue/artView';
import { setPixelMode } from '../prologue/assets';
import { Overlay } from '../prologue/overlay';
import { prefersReducedMotion, progress } from '../prologue/progress';
import {
  chooseConstellation,
  CONSTELLATIONS,
  hasAllStarClues,
  rotateStarWheel,
  resetStarAlignment,
  solveStarAlignment,
  validateStarAlignment,
} from '../puzzles/lostConstellation';
import type { ConstellationId, StarAlignment } from '../puzzles/lostConstellation';
import { saveStarAlignment, starAlignment } from '../stars/starState';

const W = 960;
const H = 540;
const DIRECTION = ['Norr', 'Öster', 'Söder', 'Väster'];
const ORDER = Object.keys(CONSTELLATIONS) as ConstellationId[];
const POINTS = CONSTELLATIONS;

function svgPattern(id: ConstellationId, rotation: number, small = false) {
  const pts = POINTS[id].stars.map(([x, y]) => {
    let a: number = x, b: number = y;
    for (let i = 0; i < rotation; i++) [a, b] = [-b, a];
    return [50 + a * (small ? 16 : 36), 43 + b * (small ? 12 : 26)] as const;
  });
  const edges = [[0, 1], [1, 2], [2, 3], [0, 4]];
  return `<svg viewBox="0 0 100 86" aria-hidden="true" class="star-chart-svg">
    <circle cx="50" cy="43" r="38" class="star-orbit"/>
    <path d="M50 4v9m-4-5h8" class="star-north"/>
    ${edges.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" class="star-link"/>`).join('')}
    ${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 0 ? 4 : 3}" class="star-node"/>`).join('')}
  </svg>`;
}

/** Dedicated, screen-filling inspection view for the bronze merkhet. */
export class StarPuzzleScene extends Phaser.Scene {
  private overlay!: Overlay;
  private view!: ArtView;
  private state!: StarAlignment;
  private chart!: HTMLDivElement;
  private readout!: HTMLParagraphElement;
  private message!: HTMLParagraphElement;
  private choices = new Map<ConstellationId, HTMLButtonElement>();
  private busy = false;

  constructor() { super('star-puzzle'); }

  preload() { this.load.image('stars-instrument', `${import.meta.env.BASE_URL}assets/stars/instrument.png`); }

  create() {
    this.textures.get('stars-instrument').setFilter(Phaser.Textures.FilterMode.NEAREST);
    setPixelMode(true);
    this.cameras.main.setBackgroundColor('#080d1b').setRoundPixels(true);
    this.view = new ArtView(this, W, H, { x: W / 2, y: H / 2 });
    this.add.image(0, 0, 'stars-instrument').setOrigin(0);
    this.view.layout();
    this.state = starAlignment();
    this.overlay = new Overlay('stars-ui stars-puzzle-ui');
    this.buildInterface();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });
    this.cameras.main.fadeIn(280, 8, 12, 25);
  }

  private buildInterface() {
    const shell = this.overlay.element('main', 'stars-puzzle-shell');
    shell.setAttribute('aria-label', 'Merkhetens närbild');
    const panel = this.overlay.element('section', 'stars-puzzle-panel', shell);
    const header = this.overlay.element('header', 'stars-puzzle-heading', panel);
    const heading = this.overlay.element('h1', '', header); heading.textContent = 'Den förlorade stjärnbilden';
    const instructions = this.overlay.element('p', '', header);
    instructions.textContent = 'Välj den femstjärniga gruppen som ristningarna beskriver. Vrid sedan skivan tills siktpunkten pekar norrut.';

    const body = this.overlay.element('div', 'stars-puzzle-body', panel);
    const view = this.overlay.element('div', 'stars-instrument-view', body);
    view.innerHTML = '<div class="stars-compass"><span class="stars-north-label">N</span><div class="stars-wheel"></div><div class="stars-sight-line"></div></div>';
    this.chart = view.querySelector('.stars-wheel') as HTMLDivElement;
    this.readout = this.overlay.element('p', 'stars-direction', view);
    const choose = this.overlay.element('div', 'stars-choice-list', body);
    const chooseTitle = this.overlay.element('h2', '', choose); chooseTitle.textContent = 'Mässingsskivan';
    const cards = this.overlay.element('div', 'stars-cards', choose);
    for (const id of ORDER) {
      const card = this.overlay.element('button', 'stars-card', cards);
      card.type = 'button'; card.dataset.constellation = id;
      card.setAttribute('aria-pressed', 'false');
      card.innerHTML = `${svgPattern(id, 0, true)}<span>${CONSTELLATIONS[id].label}</span>`;
      card.addEventListener('click', () => this.choose(id));
      this.choices.set(id, card);
    }

    const controls = this.overlay.element('div', 'stars-puzzle-controls', panel);
    const left = this.overlay.button('⟲ Vrid ett steg', () => this.rotate(-1), 'pro-btn', controls);
    left.setAttribute('aria-label', 'Vrid stjärnskivan moturs ett väderstreck');
    this.overlay.button('Återställ skivan', () => this.reset(), 'pro-btn pro-btn-quiet', controls);
    const right = this.overlay.button('Vrid ett steg ⟳', () => this.rotate(1), 'pro-btn', controls);
    right.setAttribute('aria-label', 'Vrid stjärnskivan medurs ett väderstreck');
    this.overlay.button('Rikta in siktet', () => this.submit(), 'pro-btn pro-btn-primary', controls);
    this.message = this.overlay.element('p', 'stars-feedback', panel);
    const close = this.overlay.button('Tillbaka till kammaren', () => this.leave(false), 'pro-btn pro-btn-quiet stars-puzzle-back', shell);
    close.setAttribute('aria-label', 'Stäng instrumentets närbild och återvänd');

    const solved = progress.current().stars.solved;
    if (solved) this.message.textContent = 'Vassfågeln är redan riktad mot norr.';
    else if (!hasAllStarClues(this.state)) this.message.textContent = 'Instrumentet väntar på två ledtrådar från kammaren.';
    else this.message.textContent = 'Rör skivan och välj en grupp. Inget händer förrän du riktar in siktet.';
    const locked = !hasAllStarClues(this.state) || solved;
    for (const button of [...this.choices.values()]) button.disabled = locked;
    left.disabled = locked; right.disabled = locked;
    this.renderState();
    void close;
  }

  private choose(id: ConstellationId) {
    if (this.busy || !hasAllStarClues(this.state) || this.state.solved) return;
    this.state = chooseConstellation(this.state, id);
    saveStarAlignment(this.state);
    this.message.textContent = `${CONSTELLATIONS[id].label} ligger under siktet. Vrid skivan för att föra dess höjda punkt mot norr.`;
    this.renderState();
  }

  private rotate(direction: -1 | 1) {
    if (this.busy || !hasAllStarClues(this.state) || this.state.solved) return;
    this.state = rotateStarWheel(this.state, direction);
    saveStarAlignment(this.state);
    this.renderState();
    this.message.textContent = `Skivan står nu i ${DIRECTION[this.state.rotation].toLowerCase()}läge.`;
  }

  private reset() {
    if (this.busy || this.state.solved) return;
    this.state = resetStarAlignment(this.state);
    saveStarAlignment(this.state);
    this.message.textContent = 'Skivan är tillbaka i viloläget. De funna ledtrådarna finns kvar.';
    this.renderState();
  }

  private submit() {
    if (this.busy || this.state.solved) return;
    if (!hasAllStarClues(this.state)) {
      this.message.textContent = 'Utan väggarnas båda tecken kan inte siktet låsas.';
      return;
    }
    if (!validateStarAlignment(this.state)) {
      this.message.textContent = this.state.constellation === 'reed'
        ? 'Tre stjärnor följer linjen, men de två ändarna pekar åt fel håll. Läs horisontens tecken.'
        : 'Siktet glider mellan punkterna. Jämför den raka raden och dess båda ändar med ristningarna.';
      this.cameras.main.shake(prefersReducedMotion() ? 0 : 180, 0.0014);
      return;
    }
    this.state = solveStarAlignment(this.state);
    saveStarAlignment(this.state);
    this.busy = true;
    this.overlay.announce('Stjärnbilden är riktad. Himlen öppnar sig ovanför kammaren.');
    this.cameras.main.flash(prefersReducedMotion() ? 180 : 620, 90, 140, 225);
    this.chart.classList.add('is-locked');
    this.message.textContent = 'Vassfågeln låser sig i siktranden. En tung skrapning svarar ovanför.';
    window.setTimeout(() => this.leave(true), prefersReducedMotion() ? 300 : 1100);
  }

  private renderState() {
    this.chart.innerHTML = this.state.constellation
      ? svgPattern(this.state.constellation, this.state.rotation)
      : '<div class="stars-empty-wheel"><span>Välj en ristning</span></div>';
    this.readout.textContent = `${DIRECTION[this.state.rotation]} · ${this.state.constellation ? CONSTELLATIONS[this.state.constellation].label : 'ingen stjärnbild vald'}`;
    for (const [id, button] of this.choices) {
      const active = this.state.constellation === id;
      button.setAttribute('aria-pressed', String(active));
    }
  }

  private onResize() { this.view.layout(); }

  private leave(solvedNow: boolean) {
    if (this.busy && !solvedNow) return;
    this.busy = true;
    this.cameras.main.fadeOut(260, 5, 8, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('star-chamber', { from: 'star-puzzle' }));
  }
}
