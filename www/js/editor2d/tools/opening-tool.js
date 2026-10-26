// === www/js/editor2d/tools/opening-tool.js ===
/**
 * Coloca puertas o ventanas sobre el muro más cercano. El clic se traduce a
 * una distancia `s` desde el nodo A del muro. El tipo activo se lee de
 * `store.ui.openingType` ('door'|'window'), definido por la toolbar.
 */
import { ToolBase } from './tool-base.js';
import { closestPointOnSegment, dist } from '../../geometry/vec2.js';
import { createId } from '../../core/schema.js';
import { MIN_OPENING_EDGE_OFFSET } from '../../core/constants.js';

export class OpeningTool extends ToolBase {
  hover = null;

  activate() {
    super.activate();
    this.setHud('Puerta/ventana: toca un muro para colocarla');
  }

  deactivate() {
    super.deactivate();
    this.hover = null;
  }

  onPointerMove(world) {
    this.hover = this.findTarget(world);
    this.view.invalidate();
  }

  onPointerDown(world) {
    const target = this.findTarget(world);
    if (!target) {
      this.setHud('Toca sobre un muro para colocar la abertura');
      return;
    }
    const type = this.store.ui.openingType ?? 'door';
    const level = this.getLevel();
    const levelId = level.id;
    const defaults = this.store.project.settings.defaults[type];
    const width = defaults.w;
    const height = defaults.h;
    const sill = type === 'window' ? defaults.sill : 0;

    if (target.s < MIN_OPENING_EDGE_OFFSET || target.s > target.length - MIN_OPENING_EDGE_OFFSET) {
      this.setHud(`Demasiado cerca del extremo (mínimo ${MIN_OPENING_EDGE_OFFSET} m)`);
      return;
    }

    this.replaceLevel(levelId, (lvl) => {
      const id = createId('op');
      lvl.openings[id] = {
        id, wallId: target.wallId, type, s: target.s,
        width, height, sill,
        hinge: 'left', swing: 'in',
      };
    }, `opening-add-${type}`);
    this.setHud(`${type === 'door' ? 'Puerta' : 'Ventana'} colocada`);
  }

  onCancel() { this.hover = null; }

  findTarget(world) {
    const level = this.getLevel();
    const radius = 24 / this.view.scale;
    let best = null;
    let bestDist = radius;
    for (const wall of Object.values(level.walls)) {
      const a = level.nodes[wall.a];
      const b = level.nodes[wall.b];
      if (!a || !b) continue;
      const { point, t } = closestPointOnSegment(world, a, b);
      const d = dist(point, world);
      if (d < bestDist) {
        bestDist = d;
        const length = dist(a, b);
        best = { wallId: wall.id, s: t * length, length, point };
      }
    }
    return best;
  }

  renderOverlay(ctx, view) {
    if (!this.hover) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const p = view.worldToScreen(this.hover.point);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
