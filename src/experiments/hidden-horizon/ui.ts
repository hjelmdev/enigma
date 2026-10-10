import { HINTS, MARKERS, type HorizonState } from './model';
import { emblem, reliefArt } from './art/generate';
import { Raster } from './art/raster';
import './horizon.css';

interface Actions {
  inspect: (kind: 'relief' | 'mechanism' | 'gate') => void;
  move: (index: number, delta: number) => void;
  activate: () => void;
  reset: () => void;
  menu: () => void;
  close: () => void;
}

export class HorizonUI {
  readonly root = document.createElement('div');
  private dialog?: HTMLDivElement;
  private returnFocus?: HTMLElement;
  private status: HTMLElement;
  private hint = 0;
  private keyHandler: (event: KeyboardEvent) => void;
  constructor(private actions: Actions) {
    this.root.className = 'horizon-ui';
    this.root.innerHTML = `<header><div><small>ENIGMA · SOL EXPERIMENT</small><h1>Den dolda horisonten</h1></div><nav><button data-action="reset" aria-label="Starta om experimentet">↺</button><button data-action="menu">Meny</button></nav></header><footer><div class="horizon-story"><small>HORISONTENS VÄKTARE</small><p role="status" aria-live="polite">Vattnet ligger stilla. Tre stjärnor vakar över en port utan handtag.</p></div><nav aria-label="Undersök kammaren"><button data-action="relief">Reliefen</button><button data-action="mechanism">Mekanismen</button><button data-action="gate">Porten</button></nav><span class="horizon-pan">Dra för att se dig omkring · ← →</span></footer>`;
    this.status = this.root.querySelector('[role=status]')!;
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(
      (button) =>
        (button.onclick = () => {
          const action = button.dataset.action!;
          if (action === 'menu') actions.menu();
          else if (action === 'reset') actions.reset();
          else actions.inspect(action as 'relief' | 'mechanism' | 'gate');
        }),
    );
    this.keyHandler = (event) => {
      if (event.key === 'Escape' && this.dialog) actions.close();
      if (event.key === 'Tab' && this.dialog) {
        const elements = [
          ...this.dialog.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          ),
        ];
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', this.keyHandler);
    document.querySelector('#game')!.append(this.root);
  }
  say(text: string) {
    this.status.textContent = text;
  }
  busy(value: boolean) {
    this.root
      .querySelectorAll<HTMLButtonElement>('header button, footer button')
      .forEach((button) => (button.disabled = value));
  }
  open(kind: 'relief' | 'mechanism' | 'gate', state: HorizonState) {
    this.close();
    this.returnFocus = document.activeElement as HTMLElement;
    this.root.querySelector('header')!.inert = true;
    this.root.querySelector('footer')!.inert = true;
    const dialog = document.createElement('div');
    this.dialog = dialog;
    dialog.className = `horizon-dialog ${kind}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'horizon-dialog-title');
    dialog.innerHTML = `<div class="horizon-panel"><div class="horizon-panel-head"><div><small>${kind === 'mechanism' ? 'BRONS & FAIENS' : 'EN INSKRIFT I STEN'}</small><h2 id="horizon-dialog-title">${kind === 'relief' ? 'Nattens vittnen' : kind === 'mechanism' ? 'Stjärnornas höjd' : 'Den tysta porten'}</h2></div><button class="horizon-back">← Tillbaka</button></div><div class="horizon-dialog-body"></div></div>`;
    dialog.querySelector<HTMLButtonElement>('.horizon-back')!.onclick = () =>
      this.actions.close();
    const body = dialog.querySelector('.horizon-dialog-body')!;
    if (kind === 'mechanism') {
      body.innerHTML = `<div class="horizon-board" aria-label="Tre stjärnreglage"></div><aside><p>Bronsstjärnorna glider längs fem skåror. Den blå linjen är horisonten.</p><p>Återskapa himlen som stenhuggaren såg den.</p><button class="horizon-activate">Pröva himlen</button><button class="horizon-hint">En ledtråd</button><button class="horizon-clue">Se reliefen</button><p class="horizon-feedback" role="status" aria-live="polite"></p></aside>`;
      const board = body.querySelector('.horizon-board')!;
      MARKERS.forEach((name, index) => {
        const column = document.createElement('div');
        column.className = 'horizon-slider';
        column.innerHTML = `<div class="horizon-emblem"></div><strong>${name}</strong><button aria-label="Höj ${name}" class="horizon-up">▲</button><div class="horizon-track" role="img" aria-label=""></div><button aria-label="Sänk ${name}" class="horizon-down">▼</button><output></output>`;
        const symbol = new Raster(28, 26);
        emblem(symbol, index, 14, 13, 1, 'bronze', 6);
        column.querySelector('.horizon-emblem')!.append(symbol.canvas());
        column.querySelector<HTMLButtonElement>('.horizon-up')!.onclick = () =>
          this.actions.move(index, 1);
        column.querySelector<HTMLButtonElement>('.horizon-down')!.onclick =
          () => this.actions.move(index, -1);
        for (let level = 4; level >= 0; level--) {
          const notch = document.createElement('span');
          notch.dataset.level = String(level);
          notch.className = 'horizon-notch';
          column.querySelector('.horizon-track')!.append(notch);
        }
        board.append(column);
      });
      body.querySelector<HTMLButtonElement>('.horizon-activate')!.onclick =
        () => this.actions.activate();
      body.querySelector<HTMLButtonElement>('.horizon-hint')!.onclick = () =>
        this.feedback(HINTS[Math.min(this.hint++, HINTS.length - 1)]);
      body.querySelector<HTMLButtonElement>('.horizon-clue')!.onclick = () =>
        this.actions.inspect('relief');
      this.refresh(state);
    } else if (kind === 'relief') {
      body.innerHTML = `<div class="horizon-relief-image" role="img" aria-label="Relief: vassens stjärna två steg, falkens fyra, båtens ett steg över horisonten."></div><aside><p>Tre tecken vid flodens rand. Ovanför dem har någon huggit stjärnor i natthimlen.</p><blockquote>”När floden speglar himlen minns stenen vägen.”</blockquote><p>Skårorna fortsätter upp från en lång, blå horisont.</p><button class="horizon-to-puzzle">Undersök mekanismen →</button></aside>`;
      body.querySelector('.horizon-relief-image')!.append(reliefArt().canvas());
      body.querySelector<HTMLButtonElement>('.horizon-to-puzzle')!.onclick =
        () => this.actions.inspect('mechanism');
    } else {
      body.innerHTML = `<div class="horizon-door-symbol">✦</div><aside><p>${state.solved ? 'Porten vilar i takets stenkista. Bortom tröskeln leder trappsteg till ett svagt grönt ljus.' : 'Ett enda basaltblock. Djupt i sidornas spår syns blankslitna löpytor. Stenen kan lyftas, men inte för hand.'}</p><p>${state.solved ? 'Här slutar experimentet. Vad som väntar därnere är ännu en hemlighet.' : 'Tre märken i brons förbinder porten med mekanismen.'}</p></aside>`;
    }
    this.root.append(dialog);
    dialog.querySelector<HTMLButtonElement>('.horizon-back')!.focus();
  }
  refresh(state: HorizonState) {
    this.dialog
      ?.querySelectorAll<HTMLElement>('.horizon-slider')
      .forEach((column, index) => {
        column
          .querySelectorAll<HTMLElement>('.horizon-notch')
          .forEach((notch) =>
            notch.classList.toggle(
              'selected',
              Number(notch.dataset.level) === state.markers[index],
            ),
          );
        column.querySelector('output')!.textContent =
          `${state.markers[index]} steg`;
        column
          .querySelector('.horizon-track')!
          .setAttribute(
            'aria-label',
            `${MARKERS[index]}: ${state.markers[index]} steg över horisonten`,
          );
        column.querySelector<HTMLButtonElement>('.horizon-up')!.disabled =
          state.solved || state.markers[index] === 4;
        column.querySelector<HTMLButtonElement>('.horizon-down')!.disabled =
          state.solved || state.markers[index] === 0;
      });
    const activate =
      this.dialog?.querySelector<HTMLButtonElement>('.horizon-activate');
    if (activate) {
      activate.disabled = state.solved;
      activate.textContent = state.solved
        ? 'Himlen är återställd'
        : 'Pröva himlen';
    }
  }
  feedback(message: string) {
    const feedback = this.dialog?.querySelector('.horizon-feedback');
    if (feedback) feedback.textContent = message;
  }
  celebrate() {
    this.dialog?.classList.add('activated');
    this.dialog
      ?.querySelectorAll<HTMLButtonElement>('button')
      .forEach((button) => (button.disabled = true));
  }
  close() {
    this.dialog?.remove();
    this.dialog = undefined;
    this.root.querySelector('header')!.inert = false;
    this.root.querySelector('footer')!.inert = false;
    this.returnFocus?.focus();
  }
  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }
}
