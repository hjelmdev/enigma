/**
 * DOM overlay for the prologue: captions, HUD buttons, panels, hotspot
 * markers. Real HTML keeps text crisp, accessible (screen readers, keyboard
 * focus) and responsive on top of the pixel-art canvas.
 */

export interface CaptionOptions {
  next?: string | false;
  onNext?: () => void;
  position?: 'top' | 'bottom';
  extra?: Array<{ label: string; onClick: () => void; quiet?: boolean }>;
  autoFocus?: boolean;
}

export interface HudButton {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
}

export const ICONS = {
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
  artifact:
    '<svg viewBox="0 0 24 24"><path d="M12 3 21 19H3z"/><path d="M12 3v9"/><circle cx="12" cy="14.5" r="1.6"/></svg>',
  recenter:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M17 2v4h-4"/></svg>',
  right:
    '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M7 2v4h4"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  look: '<svg viewBox="0 0 24 24"><path d="M7 12H3m0 0 3-3m-3 3 3 3M17 12h4m0 0-3-3m3 3-3 3"/></svg>',
};

export class Overlay {
  readonly root: HTMLDivElement;
  private captionEl?: HTMLDivElement;
  private hudEl?: HTMLDivElement;
  private markers = new Map<string, HTMLButtonElement>();
  private panelClose?: () => void;
  private live: HTMLDivElement;

  constructor(className = '') {
    const host = document.getElementById('game') ?? document.body;
    host.querySelectorAll('.pro-ui').forEach((el) => el.remove());
    this.root = document.createElement('div');
    this.root.className = `pro-ui ${className}`.trim();
    host.appendChild(this.root);
    this.live = document.createElement('div');
    this.live.className = 'sr-only';
    this.live.setAttribute('aria-live', 'polite');
    this.root.appendChild(this.live);
  }

  announce(text: string) {
    this.live.textContent = text;
  }

  element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    parent: HTMLElement = this.root,
  ) {
    const el = document.createElement(tag);
    el.className = className;
    parent.appendChild(el);
    return el;
  }

  button(
    label: string,
    onClick: () => void,
    className = 'pro-btn',
    parent: HTMLElement = this.root,
  ) {
    const b = this.element('button', className, parent);
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return b;
  }

  iconButton(button: HudButton, parent: HTMLElement, className = 'pro-icon') {
    const b = this.element('button', className, parent);
    b.type = 'button';
    b.dataset.id = button.id;
    b.setAttribute('aria-label', button.label);
    b.title = button.label;
    b.innerHTML = `${button.icon}<span class="pro-icon-label">${button.label}</span>`;
    b.addEventListener('click', (event) => {
      event.stopPropagation();
      button.onClick();
    });
    return b;
  }

  caption(text: string, options: CaptionOptions = {}) {
    this.clearCaption();
    const box = this.element(
      'div',
      `pro-caption pro-caption-${options.position ?? 'bottom'}`,
    );
    const p = this.element('p', 'pro-caption-text', box);
    p.textContent = text;
    const actions = this.element('div', 'pro-caption-actions', box);
    for (const extra of options.extra ?? [])
      this.button(
        extra.label,
        extra.onClick,
        extra.quiet ? 'pro-btn pro-btn-quiet' : 'pro-btn',
        actions,
      );
    if (options.next !== false) {
      const next = this.button(
        options.next ?? 'Fortsätt',
        () => {
          this.clearCaption();
          options.onNext?.();
        },
        'pro-btn pro-btn-primary',
        actions,
      );
      if (options.autoFocus !== false)
        queueMicrotask(() => next.focus({ preventScroll: true }));
    }
    this.captionEl = box;
    this.announce(text);
    requestAnimationFrame(() => box.classList.add('is-visible'));
    return box;
  }

  clearCaption() {
    this.captionEl?.remove();
    this.captionEl = undefined;
  }

  get hasCaption() {
    return Boolean(this.captionEl);
  }

  hud(buttons: HudButton[], position: 'top' | 'bottom' = 'top') {
    this.hudEl?.remove();
    const bar = this.element('div', `pro-hud pro-hud-${position}`);
    for (const b of buttons) this.iconButton(b, bar);
    this.hudEl = bar;
    return bar;
  }

  hudButton(id: string) {
    return (
      this.hudEl?.querySelector<HTMLButtonElement>(`[data-id="${id}"]`) ?? null
    );
  }

  chip(
    text: string,
    icon = '',
    durationMs = 4200,
    position: 'top' | 'low' = 'top',
  ) {
    const chip = this.element(
      'div',
      position === 'low' ? 'pro-chip pro-chip-low' : 'pro-chip',
    );
    chip.innerHTML = `${icon}<span></span>`;
    chip.querySelector('span')!.textContent = text;
    requestAnimationFrame(() => chip.classList.add('is-visible'));
    if (durationMs > 0)
      window.setTimeout(() => {
        chip.classList.remove('is-visible');
        window.setTimeout(() => chip.remove(), 400);
      }, durationMs);
    return chip;
  }

  panel(
    title: string,
    content: HTMLElement | string,
    options: {
      onClose?: () => void;
      className?: string;
      closeLabel?: string;
    } = {},
  ) {
    this.panelClose?.();
    const backdrop = this.element('div', 'pro-backdrop');
    const panel = this.element(
      'div',
      `pro-panel ${options.className ?? ''}`.trim(),
      backdrop,
    );
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', title);
    const h = this.element('h2', 'pro-panel-title', panel);
    h.textContent = title;
    const body = this.element('div', 'pro-panel-body', panel);
    if (typeof content === 'string') body.textContent = content;
    else body.appendChild(content);
    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      if (this.panelClose === close) this.panelClose = undefined;
      options.onClose?.();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const closeBtn = this.button(
      options.closeLabel ?? 'Stäng',
      close,
      'pro-btn pro-btn-primary pro-panel-close',
      panel,
    );
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    backdrop.addEventListener('pointerdown', (event) =>
      event.stopPropagation(),
    );
    queueMicrotask(() => closeBtn.focus({ preventScroll: true }));
    this.panelClose = close;
    return { panel, body, close };
  }

  get panelOpen() {
    return Boolean(this.panelClose);
  }

  closePanel() {
    this.panelClose?.();
  }

  marker(id: string, label: string, onClick: () => void) {
    let el = this.markers.get(id);
    if (!el) {
      el = this.element('button', 'pro-marker');
      el.type = 'button';
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
      });
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      this.markers.set(id, el);
    }
    el.setAttribute('aria-label', label);
    el.title = label;
    el.dataset.id = id;
    return el;
  }

  placeMarker(id: string, x: number, y: number, visible: boolean) {
    const el = this.markers.get(id);
    if (!el) return;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    el.hidden = !visible;
  }

  removeMarker(id: string) {
    this.markers.get(id)?.remove();
    this.markers.delete(id);
  }

  destroy() {
    this.panelClose?.();
    this.root.remove();
  }
}

/** Hold-to-repeat for touch/mouse/keyboard-activated control buttons. */
export function repeatOnHold(button: HTMLButtonElement, action: () => void) {
  let timer = 0;
  let interval = 0;
  const stop = () => {
    window.clearTimeout(timer);
    window.clearInterval(interval);
  };
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    event.preventDefault();
    action();
    stop();
    timer = window.setTimeout(() => {
      interval = window.setInterval(action, 60);
    }, 280);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'])
    button.addEventListener(type, stop);
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  });
  return stop;
}
