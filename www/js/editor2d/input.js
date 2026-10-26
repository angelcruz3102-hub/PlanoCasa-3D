// === www/js/editor2d/input.js ===
/**
 * Puente entre Pointer Events y la herramienta activa. Un puntero alimenta a
 * la herramienta; dos punteros cancelan la transacción abierta y entran en
 * modo pellizco + paneo. Gestiona doble toque, pulsación larga y el botón
 * atrás (delegado por main.js). Aplica el offset de "modo mira" antes de
 * entregar la coordenada a la herramienta; el renderer dibuja la retícula.
 */
import { computeSnap } from './snapping.js';

const LONG_PRESS_MS = 500;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST_PX = 30;
const AIM_OFFSET_PX = 48;

export class InputHandler {
  #canvas;
  #view;
  #store;
  #getTool;
  #pointers = new Map();
  #lastTap = { time: 0, x: 0, y: 0 };
  #longPressTimer = null;
  #pinching = false;
  #pinchStart = null;

  constructor(canvas, view, store, getTool) {
    this.#canvas = canvas;
    this.#view = view;
    this.#store = store;
    this.#getTool = getTool;
    this.#bind();
  }

  #bind() {
    this.#canvas.addEventListener('pointerdown', (e) => this.#onDown(e));
    this.#canvas.addEventListener('pointermove', (e) => this.#onMove(e));
    this.#canvas.addEventListener('pointerup', (e) => this.#onUp(e));
    this.#canvas.addEventListener('pointercancel', (e) => this.#onCancel(e));
    this.#canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.#canvas.addEventListener('gesturestart', (e) => e.preventDefault());
    this.#canvas.addEventListener('dblclick', (e) => e.preventDefault());
  }

  #pointerInfo(e) {
    const rect = this.#canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const aim = this.#store.ui.aimMode;
    const reticle = { x: screen.x, y: screen.y - (aim ? AIM_OFFSET_PX : 0) };
    const world = this.#view.screenToWorld(reticle);
    return { screen, reticle, world, pointerId: e.pointerId };
  }

  #snapFor(world) {
    const level = this.#store.getActiveLevel();
    return computeSnap(world, {
      level,
      view: this.#view,
      snaps: this.#store.ui.snaps,
      lastPoint: this.#getTool()?.lastPoint ?? null,
      gridStep: this.#store.project.settings.gridStep,
    });
  }

  #onDown(e) {
    e.preventDefault();
    this.#canvas.setPointerCapture?.(e.pointerId);
    const info = this.#pointerInfo(e);
    this.#pointers.set(e.pointerId, info);
    this.#store.ui.lastPointer = { screen: info.screen, reticle: info.reticle };

    if (this.#pointers.size === 1) {
      this.#startLongPress(info);
      const snapped = this.#snapFor(info.world);
      this.#store.ui.snapGuides = snapped.guides;
      this.#store.ui.cursor = snapped.point;
      this.#getTool()?.onPointerDown?.(snapped.point, info.screen, e);
      this.#view.invalidate();
    } else if (this.#pointers.size === 2) {
      this.#cancelLongPress();
      this.#store.rollbackTransaction?.();
      this.#getTool()?.onCancel?.();
      this.#pinching = true;
      this.#pinchStart = this.#pinchState();
    }
  }

  #onMove(e) {
    const info = this.#pointerInfo(e);
    if (!this.#pointers.has(e.pointerId)) {
      const snapped = this.#snapFor(info.world);
      this.#store.ui.cursor = snapped.point;
      this.#store.ui.snapGuides = snapped.guides;
      this.#store.ui.lastPointer = { screen: info.screen, reticle: info.reticle };
      this.#getTool()?.onPointerMove?.(snapped.point, info.screen, e);
      this.#view.invalidate();
      return;
    }
    this.#pointers.set(e.pointerId, info);
    this.#store.ui.lastPointer = { screen: info.screen, reticle: info.reticle };
    this.#cancelLongPressIfMoved(info);

    if (this.#pinching && this.#pointers.size === 2) {
      const state = this.#pinchState();
      const scaleFactor = state.distance / (this.#pinchStart?.distance || state.distance);
      const midScreen = state.mid;
      this.#view.zoomAt(midScreen, scaleFactor);
      if (this.#pinchStart) {
        this.#view.panBy(state.mid.x - this.#pinchStart.mid.x, state.mid.y - this.#pinchStart.mid.y);
      }
      this.#pinchStart = state;
      return;
    }

    if (this.#pointers.size === 1) {
      const snapped = this.#snapFor(info.world);
      this.#store.ui.cursor = snapped.point;
      this.#store.ui.snapGuides = snapped.guides;
      this.#getTool()?.onPointerMove?.(snapped.point, info.screen, e);
      this.#view.invalidate();
    }
  }

  #onUp(e) {
    const info = this.#pointers.get(e.pointerId);
    this.#pointers.delete(e.pointerId);
    this.#cancelLongPress();
    this.#canvas.releasePointerCapture?.(e.pointerId);

    if (this.#pinching) {
      if (this.#pointers.size < 2) {
        this.#pinching = false;
        this.#pinchStart = null;
      }
      return;
    }

    if (!info) return;
    const snapped = this.#snapFor(info.world);
    this.#getTool()?.onPointerUp?.(snapped.point, info.screen, e);

    const now = performance.now();
    const last = this.#lastTap;
    const dt = now - last.time;
    const d = Math.hypot(info.screen.x - last.x, info.screen.y - last.y);
    if (dt < DOUBLE_TAP_MS && d < DOUBLE_TAP_DIST_PX) {
      this.#getTool()?.onDoubleTap?.(snapped.point, info.screen);
      this.#lastTap = { time: 0, x: 0, y: 0 };
    } else {
      this.#lastTap = { time: now, x: info.screen.x, y: info.screen.y };
    }
    this.#view.invalidate();
  }

  #onCancel(e) {
    this.#pointers.delete(e.pointerId);
    this.#cancelLongPress();
    if (this.#pinching && this.#pointers.size < 2) {
      this.#pinching = false;
      this.#pinchStart = null;
    }
    this.#getTool()?.onCancel?.();
    this.#view.invalidate();
  }

  #pinchState() {
    const list = [...this.#pointers.values()];
    if (list.length < 2) return null;
    const [a, b] = list;
    return {
      distance: Math.hypot(b.screen.x - a.screen.x, b.screen.y - a.screen.y),
      mid: { x: (a.screen.x + b.screen.x) / 2, y: (a.screen.y + b.screen.y) / 2 },
    };
  }

  #startLongPress(info) {
    this.#cancelLongPress();
    this.#longPressTimer = setTimeout(() => {
      const snapped = this.#snapFor(info.world);
      this.#getTool()?.onLongPress?.(snapped.point, info.screen);
      this.#view.invalidate();
    }, LONG_PRESS_MS);
  }

  #cancelLongPress() {
    if (this.#longPressTimer) {
      clearTimeout(this.#longPressTimer);
      this.#longPressTimer = null;
    }
  }

  #cancelLongPressIfMoved(info) {
    const first = this.#pointers.values().next().value;
    if (!first) return;
    const d = Math.hypot(info.screen.x - first.screen.x, info.screen.y - first.screen.y);
    if (d > 10) this.#cancelLongPress();
  }

  destroy() { this.#cancelLongPress(); }
}
