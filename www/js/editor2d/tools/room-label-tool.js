// === www/js/editor2d/tools/room-label-tool.js ===
/**
 * Coloca etiquetas de ambiente con el tipo activo en
 * `store.ui.labelType` (sala, cocina, baño, habitacion, pasillo, escalera, otro).
 */
import { ToolBase } from './tool-base.js';
import { createId } from '../../core/schema.js';

export class RoomLabelTool extends ToolBase {
  hover = null;

  activate() {
    super.activate();
    this.setHud('Etiqueta: toca dentro de un ambiente');
  }

  deactivate() {
    super.deactivate();
    this.hover = null;
  }

  onPointerMove(world) {
    this.hover = this.snapCoord(world);
    this.view.invalidate();
  }

  onPointerDown(world) {
    const point = this.snapCoord(world);
    const level = this.getLevel();
    const levelId = level.id;
    const type = this.store.ui.labelType ?? 'sala';
    const name = defaultName(type);
    this.replaceLevel(levelId, (lvl) => {
      const id = createId('lab');
      lvl.labels.push({ id, x: point.x, y: point.y, type, name });
    }, 'label-add');
    this.setHud(`Etiqueta "${name}" añadida`);
  }

  onCancel() { this.hover = null; }

  renderOverlay(ctx, view) {
    if (!this.hover) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const p = view.worldToScreen(this.hover);
    ctx.fillStyle = 'rgba(90,169,255,0.15)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function defaultName(type) {
  const map = {
    sala: 'Sala', cocina: 'Cocina', bano: 'Baño', habitacion: 'Habitación',
    pasillo: 'Pasillo', escalera: 'Escalera', otro: 'Ambiente',
  };
  return map[type] ?? 'Ambiente';
}
