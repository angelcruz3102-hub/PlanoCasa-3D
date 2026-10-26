// === www/js/editor2d/tools/stair-tool.js ===
/**
 * Coloca una escalera con los parámetros por defecto del proyecto. El ajuste
 * fino se hace en el inspector; aquí solo se toca para ubicar el centro de la
 * huella. El hueco se calcula al vuelo con `stairHolePolygon`.
 */
import { ToolBase } from './tool-base.js';
import { createId } from '../../core/schema.js';
import { computeStairMetrics, stairHolePolygon } from '../../geometry/stair-builder.js';

export class StairTool extends ToolBase {
  hover = null;

  activate() {
    super.activate();
    this.setHud('Escalera: toca para colocarla');
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
    const project = this.store.project;
    const level2 = project.levels[1];
    if (!level2) {
      this.setHud('Primero crea la segunda planta');
      return;
    }
    const stair = {
      id: createId('stair'),
      fromLevelId: project.levels[0].id,
      toLevelId: level2.id,
      kind: 'straight',
      x: point.x,
      y: point.y,
      angleDeg: 0,
      width: 0.90,
      tread: 0.25,
      targetRiser: 0.18,
      turn: 'left',
      landing: 0.90,
      style: 'solid',
    };
    const metrics = computeStairMetrics(project, stair);
    stair.holePolygon = stairHolePolygon(stair, metrics);

    this.replaceProject((proj) => {
      proj.stairs = proj.stairs.filter((s) => s.toLevelId !== level2.id);
      proj.stairs.push(stair);
    }, 'stair-place');
    this.setHud('Escalera colocada');
  }

  onCancel() { this.hover = null; }

  renderOverlay(ctx, view) {
    if (!this.hover) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const p = view.worldToScreen(this.hover);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 22, p.y - 22, 44, 44);
    ctx.restore();
  }
}
