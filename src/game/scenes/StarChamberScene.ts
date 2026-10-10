import Phaser from 'phaser';
import { Overlay, ICONS } from '../prologue/overlay';
import { ArtView } from '../prologue/artView';
import { setPixelMode } from '../prologue/assets';
import { prefersReducedMotion, progress } from '../prologue/progress';
import { EXIT } from '../world/pyramidMap';
import { hasAllStarClues } from '../puzzles/lostConstellation';
import { openInspectorPanel, openNotePanel, openSettingsPanel } from '../prologue/panels';
import { MAP_ICON, openMapPanel } from '../hall/mapPanel';
import { initializeStarAlignment, starAlignment, STAR_ROOM_ID, STAR_SECRET_ID } from '../stars/starState';

const W = 1600;
const H = 720;
const SPOTS = [
  { id: 'chart', x: 328, y: 318, label: 'Den spruckna stjärnkartan' },
  { id: 'horizon', x: 1396, y: 318, label: 'Nilens horisontrelief' },
  { id: 'instrument', x: 800, y: 441, label: 'Bronsinstrumentet' },
  { id: 'secret', x: 1050, y: 586, label: 'Den lösa golvstenen' },
  { id: 'return', x: 102, y: 355, label: 'Tillbaka till Stora hallen' },
] as const;
type SpotId = (typeof SPOTS)[number]['id'];

export interface StarRoomData {
  from?: 'hall' | 'star-puzzle';
}

/** The hidden, live route behind the solved balance door. */
export class StarChamberScene extends Phaser.Scene {
  private view!: ArtView;
  private overlay!: Overlay;
  private glow!: Phaser.GameObjects.Image;
  private constellation!: Phaser.GameObjects.Image;
  private leftShutter!: Phaser.GameObjects.Image;
  private rightShutter!: Phaser.GameObjects.Image;
  private drag?: { id: number; x: number; y: number; time: number; vx: number; vy: number };
  private velocity = { x: 0, y: 0 };
  private busy = false;
  private dataIn: StarRoomData = {};

  constructor() { super('star-chamber'); }

  init(data: StarRoomData) { this.dataIn = { ...(data ?? {}) }; this.busy = false; this.drag = undefined; this.velocity = { x: 0, y: 0 }; }

  preload() {
    for (const name of ['room', 'sky', 'constellation', 'shutterLeft', 'shutterRight', 'glow', 'foreground'])
      this.load.image(`stars-${name}`, `${import.meta.env.BASE_URL}assets/stars/${name}.png`);
    if (!this.textures.exists('px')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 1, 1); g.generateTexture('px', 1, 1); g.destroy();
    }
  }

  create() {
    for (const name of ['stars-room', 'stars-sky', 'stars-constellation', 'stars-shutterLeft', 'stars-shutterRight', 'stars-glow', 'stars-foreground'])
      if (this.textures.exists(name)) this.textures.get(name).setFilter(Phaser.Textures.FilterMode.NEAREST);
    setPixelMode(true);
    this.cameras.main.setBackgroundColor('#080d1b').setRoundPixels(true);
    const saved = progress.current().stars;
    this.view = new ArtView(this, W, H, { x: saved.camX ?? 420, y: saved.camY ?? 360 });
    this.add.image(0, 0, 'stars-room').setOrigin(0);
    this.add.image(0, 0, 'stars-sky').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.58);
    this.constellation = this.add.image(0, 0, 'stars-constellation').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.leftShutter = this.add.image(575, 0, 'stars-shutterLeft').setOrigin(0);
    this.rightShutter = this.add.image(765, 0, 'stars-shutterRight').setOrigin(0);
    this.glow = this.add.image(0, 0, 'stars-glow').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.add.image(-120, 634, 'stars-foreground').setOrigin(0);
    const dust = this.add.particles(0, 0, 'px', {
      x: { min: 590, max: 1010 }, y: { min: 124, max: 550 }, lifespan: 7200,
      speedX: { min: -3, max: 3 }, speedY: { min: -4, max: 2 },
      alpha: { start: 0, end: 0, ease: (v: number) => Math.sin(v * Math.PI) * 0.46 },
      scale: { start: 1.4, end: 0.5 }, tint: [0xc8d5ec, 0xe1ce9a],
      frequency: prefersReducedMotion() ? 850 : 260, blendMode: Phaser.BlendModes.ADD,
    });
    dust.setDepth(6);
    this.view.layout();

    this.overlay = new Overlay('stars-ui');
    this.buildHud();
    for (const spot of SPOTS)
      this.overlay.marker(spot.id, spot.label, () => this.inspect(spot.id));
    this.bindInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });
    void progress.load().then(() => this.start());
  }

  private start() {
    progress.advanceTo('stars');
    progress.visitRoom(STAR_ROOM_ID);
    progress.traverseExit(EXIT.balanceDoor);
    progress.seeExit(EXIT.starsReturn);
    initializeStarAlignment();
    this.view.setCenter(progress.current().stars.camX ?? 420, progress.current().stars.camY ?? 360);
    this.refreshMarkers();
    const state = progress.current().stars;
    if (state.solved && state.apertureAnimated) this.setApertureOpen();
    this.cameras.main.fadeIn(500, 6, 9, 20);
    if (state.solved && !state.apertureAnimated) this.openAperture();
    else if (this.dataIn.from === 'star-puzzle')
      this.overlay.chip('Siktet har ännu inte låst sig. Väggbilderna väntar kvar.', MAP_ICON, 4400);
    else if (!progress.current().discoveredHotspots.includes('stars-arrival')) {
      progress.discover('stars-arrival');
      this.overlay.caption('En väldig kammare ligger under den fasta stenen. Högt ovanför står stjärnorna synliga genom en springa som inte kan finnas där.', {
        next: 'Se dig omkring',
        onNext: () => this.overlay.chip('Dra för att utforska. Undersök båda väggbilderna före instrumentet.', MAP_ICON, 5400),
      });
    }
  }

  private buildHud() {
    const hasMap = progress.current().hall.mapAwake > 0;
    const buttons = [
      { id: 'hint', label: 'Ledtråd', icon: ICONS.hint, onClick: () => this.showHint() },
      { id: 'note', label: 'Farfar anteckning', icon: ICONS.note, onClick: () => openNotePanel(this.overlay) },
      { id: 'artifact', label: 'Miniatyren', icon: ICONS.artifact, onClick: () => openInspectorPanel(this.overlay) },
      ...(hasMap ? [{ id: 'map', label: 'Inre vy', icon: MAP_ICON, onClick: () => openMapPanel(this.overlay, { view: 'inner' }) }] : []),
      { id: 'recenter', label: 'Till instrumentet', icon: ICONS.recenter, onClick: () => this.panTo(800, 360, 520) },
      { id: 'menu', label: 'Meny', icon: ICONS.menu, onClick: () => openSettingsPanel(this.overlay, this) },
    ];
    this.overlay.hud(buttons);
  }

  private refreshMarkers() {
    const alignment = starAlignment();
    for (const spot of SPOTS) {
      const el = this.overlay.marker(spot.id, spot.label, () => this.inspect(spot.id));
      const clueId = spot.id === 'chart' ? 'star-chart' : spot.id === 'horizon' ? 'horizon-relief' : null;
      el.dataset.seen = String(clueId ? alignment.discoveredClues.includes(clueId) : false);
      el.dataset.action = String(
        (spot.id === 'chart' && !alignment.discoveredClues.includes('star-chart')) ||
        (spot.id === 'horizon' && !alignment.discoveredClues.includes('horizon-relief')) ||
        (spot.id === 'instrument' && !alignment.solved),
      );
    }
  }

  private inspect(id: SpotId) {
    if (this.busy) return;
    const spot = SPOTS.find((s) => s.id === id)!;
    this.panTo(spot.x, spot.y, 230);
    if (id === 'chart') {
      const state = progress.current().stars;
      if (state.discoveredClues.includes('star-chart')) return this.overlay.caption('Tre ljus står i en rak linje över en vågig flod. Ett femte tecken är nästan utplånat i stenen.');
      this.revealClue('star-chart');
      this.overlay.caption('På den spruckna kartan står fem stjärnor ovanför en blå flod. Tre delar samma raka linje. En fjärde ligger avsides i kartans kant.', {
        next: 'Läs ristningen', onNext: () => {
          this.overlay.chip('Du minns linjen med tre stjärnor.', MAP_ICON, 3600);
          this.refreshMarkers();
        },
      });
      return;
    }
    if (id === 'horizon') {
      const state = progress.current().stars;
      if (state.discoveredClues.includes('horizon-relief')) return this.overlay.caption('Öster stiger ett ljus. Väster sjunker ett annat. Den raka linjen mellan dem är högre än floden.');
      this.revealClue('horizon-relief');
      this.overlay.caption('När Nilens vatten stiger, lyft blicken mot norr. Vid östra änden klättrar ett ljus över linjen; vid västra änden sjunker dess följeslagare. Rikta den upphöjda siktranden norrut.', {
        next: 'Minns riktningen', onNext: () => { this.overlay.chip('Öster upp, väster ned. Den upphöjda siktpunkten visar norr.', MAP_ICON, 4200); this.refreshMarkers(); },
      });
      return;
    }
    if (id === 'instrument') {
      const state = starAlignment();
      if (state.solved) return this.overlay.caption('Mässingens skiva ligger stilla. Fem stjärnor speglar sig i den öppna himlen.');
      if (!hasAllStarClues(state)) return this.overlay.caption('Den tunga bronsringen rör sig inte. Två tomma teckenfält väntar på att väggarnas bilder ska bli begripliga.');
      progress.commit((save) => { save.stars.camX = Math.round(this.view.centerX); save.stars.camY = Math.round(this.view.centerY); });
      this.busy = true;
      this.overlay.clearCaption();
      this.time.delayedCall(prefersReducedMotion() ? 0 : 200, () => this.leave('star-puzzle'));
      return;
    }
    if (id === 'return') {
      this.overlay.caption('Bakom dig, genom den öppna bågen, väntar Stora hallen.', {
        next: 'Tillbaka till hallen', onNext: () => this.returnToHall(),
      });
      return;
    }
    const state = progress.current().stars;
    if (state.secretFound) return this.overlay.caption('I golvet finns bara en mörk, tom hålighet. Du tog det lilla tecknet som låg där.');
    progress.commit((save) => { save.stars.secretFound = true; });
    progress.discover(STAR_SECRET_ID);
    this.overlay.caption('Under en lös sten ligger en liten lapisblå stjärnamulett, inristad på båda sidor. Den är lätt nog att bära med sig.');
    this.overlay.announce('Valfritt fynd upptäckt: stjärnamulett.');
    this.refreshMarkers();
  }

  private revealClue(id: 'star-chart' | 'horizon-relief') {
    const state = starAlignment();
    const next = { ...state, discoveredClues: [...new Set([...state.discoveredClues, id])] };
    this.persistAlignment(next);
    return next;
  }

  private persistAlignment(state: ReturnType<typeof starAlignment>) {
    progress.commit((save) => {
      save.stars.constellation = state.constellation;
      save.stars.rotation = state.rotation;
      save.stars.solved = state.solved;
      save.stars.discoveredClues = [...state.discoveredClues];
    });
  }

  private showHint() {
    const state = starAlignment();
    if (!state.discoveredClues.includes('star-chart')) return this.overlay.caption('Börja med den spruckna kartan till vänster om instrumentet.');
    if (!state.discoveredClues.includes('horizon-relief')) return this.overlay.caption('Horisontens relief sitter på den östra väggen. Den visar väderstrecken.');
    if (state.solved) return this.overlay.caption('Vassfågeln vilar nu i siktranden. Öppningen har förändrats.');
    return this.overlay.caption('En lång rak rad korsar tre stjärnor. Följ ändarna: öster upp, väster ned. Låt den upphöjda siktpunkten visa norr.');
  }

  private bindInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.busy || this.overlay.panelOpen) return;
      this.velocity = { x: 0, y: 0 };
      this.drag = { id: p.id, x: p.x, y: p.y, time: p.time, vx: 0, vy: 0 };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || this.drag.id !== p.id || !p.isDown || this.busy) return;
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
      const dt = Math.max(1, p.time - this.drag.time);
      this.view.panByScreen(dx, dy);
      this.drag.vx = dx / dt; this.drag.vy = dy / dt;
      this.drag.x = p.x; this.drag.y = p.y; this.drag.time = p.time;
    });
    const end = (p: Phaser.Input.Pointer) => {
      if (!this.drag || this.drag.id !== p.id) return;
      this.velocity = { x: Phaser.Math.Clamp(this.drag.vx, -2.2, 2.2), y: Phaser.Math.Clamp(this.drag.vy, -2.2, 2.2) };
      this.drag = undefined;
      this.saveCamera();
    };
    this.input.on('pointerup', end); this.input.on('pointerupoutside', end);
    this.input.keyboard?.on('keydown-LEFT', () => this.panBy(-120, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.panBy(120, 0));
    this.input.keyboard?.on('keydown-UP', () => this.panBy(0, -100));
    this.input.keyboard?.on('keydown-DOWN', () => this.panBy(0, 100));
  }

  private panBy(dx: number, dy: number) { this.view.setCenter(this.view.centerX + dx, this.view.centerY + dy); this.saveCamera(); }
  private panTo(x: number, y: number, duration: number) {
    this.tweens.killTweensOf(this.view);
    const target = this.view.clampCenter(x, y);
    return this.tweens.add({ targets: this.view, centerX: target.x, centerY: target.y,
      duration: prefersReducedMotion() ? 120 : duration, ease: 'Sine.easeInOut',
      onUpdate: () => this.view.setCenter(this.view.centerX, this.view.centerY),
      onComplete: () => this.saveCamera(), });
  }
  private saveCamera() { progress.commit((s) => { s.stars.camX = Math.round(this.view.centerX); s.stars.camY = Math.round(this.view.centerY); }); }
  private onResize() { this.view.layout(); this.updateMarkers(); }

  update(_time: number, delta: number) {
    if (!this.drag && (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.y) > 0.01)) {
      this.view.panByScreen(this.velocity.x * delta, this.velocity.y * delta);
      const decay = Math.exp(-delta / 220); this.velocity.x *= decay; this.velocity.y *= decay;
    }
    this.updateMarkers();
  }

  private updateMarkers() {
    const hidden = this.busy || this.overlay.panelOpen;
    for (const s of SPOTS) {
      const p = this.view.worldToScreen(s.x, s.y);
      this.overlay.placeMarker(s.id, p.x, p.y, !hidden && this.view.isVisible(s.x, s.y, 4));
    }
  }

  private openAperture() {
    if (this.busy) return;
    this.busy = true;
    const reduce = prefersReducedMotion();
    this.overlay.caption('Ringen låser sig med ett djupt metalliskt klick. Något massivt skrapar långt ovanför.', { next: false });
    if (!reduce) this.cameras.main.shake(500, 0.0025);
    this.tweens.add({ targets: this.leftShutter, x: 310, duration: reduce ? 160 : 1900, ease: 'Cubic.easeInOut' });
    this.tweens.add({ targets: this.rightShutter, x: 1030, duration: reduce ? 160 : 2100, ease: 'Cubic.easeInOut', onComplete: () => {
      this.leftShutter.setVisible(false); this.rightShutter.setVisible(false);
      this.tweens.add({ targets: this.glow, alpha: 0.86, duration: reduce ? 200 : 1600, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: this.constellation, alpha: 1, duration: reduce ? 200 : 1700, ease: 'Cubic.easeOut' });
      progress.commit((s) => { s.stars.apertureAnimated = true; });
      this.busy = false;
      this.overlay.caption('Stenbladen delar sig. Över den fasta pyramiden öppnar sig en skiva av natt; stjärnbilden svarar i samma ordning som på instrumentet.', {
        next: 'Se dig omkring', onNext: () => this.overlay.chip('Vassfågeln syns nu ovanför den öppna takspringan.', MAP_ICON, 5000),
      });
    } });
  }

  private setApertureOpen() { this.leftShutter.setVisible(false); this.rightShutter.setVisible(false); this.glow.setAlpha(0.68); this.constellation.setAlpha(1); }

  private returnToHall() {
    this.saveCamera(); this.busy = true; this.overlay.clearCaption();
    progress.traverseExit(EXIT.starsReturn);
    this.cameras.main.fadeOut(420, 7, 9, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('hall', { from: 'stars' }));
  }

  private leave(key: 'star-puzzle') {
    this.cameras.main.fadeOut(360, 5, 8, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key));
  }
}
