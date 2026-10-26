// === www/js/editor2d/canvas-view.js ===
export class CanvasView {
  #canvas;
  #ctx;
  #ro;
  #onRender = null;
  #rafPending = false;
  #dpr = 1;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.scale = 50;
    this.panX = 0;
    this.panY = 0;
    this.width = 0;
    this.height = 0;
    this.#ro = new ResizeObserver(() => this.resize());
    this.#ro.observe(canvas.parentElement ?? canvas);
    this.resize();
    // Forzar un redimensionamiento tras el primer frame de layout
    requestAnimationFrame(() => this.resize());
  }

  worldToScreen(p) {
    return { x: p.x * this.scale + this.panX, y: p.y * this.scale + this.panY };
  }

  screenToWorld(p) {
    return { x: (p.x - this.panX) / this.scale, y: (p.y - this.panY) / this.scale };
  }

  zoomAt(screenPt, factor) {
    const before = this.screenToWorld(screenPt);
    this.scale = clamp(this.scale * factor, 5, 400);
    this.panX = screenPt.x - before.x * this.scale;
    this.panY = screenPt.y - before.y * this.scale;
    this.invalidate();
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.invalidate();
  }

  fitRect({ x, y, w, h }, padding = 40) {
    if (w <= 0 || h <= 0) return;
    const availableW = Math.max(1, this.width - padding * 2);
    const availableH = Math.max(1, this.height - padding * 2);
    this.scale = Math.min(availableW / w, availableH / h);
    this.scale = clamp(this.scale, 5, 400);
    this.panX = this.width / 2 - (x + w / 2) * this.scale;
    this.panY = this.height / 2 - (y + h / 2) * this.scale;
    this.invalidate();
  }

  setRenderCallback(fn) {
    this.#onRender = fn;
    this.invalidate();
  }

  invalidate() {
    if (this.#rafPending) return;
    this.#rafPending = true;
    requestAnimationFrame(() => {
      this.#rafPending = false;
      if (this.#onRender) this.#onRender(this.#ctx, this);
    });
  }

  resize() {
    const rect = this.#canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    this.width = rect.width;
    this.height = rect.height;
    this.#dpr = window.devicePixelRatio || 1;
    this.#canvas.width = Math.max(1, Math.round(rect.width * this.#dpr));
    this.#canvas.height = Math.max(1, Math.round(rect.height * this.#dpr));
    this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    this.invalidate();
  }

  get ctx() { return this.#ctx; }
  destroy() { this.#ro.disconnect(); }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
