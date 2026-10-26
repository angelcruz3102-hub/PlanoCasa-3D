// === www/js/main.js ===
/**
 * Arranque: persistencia, store, editor 2D, visor 3D, UI y ciclo de vida
 * Android. Es el único módulo que conoce Capacitor y el DOM global.
 */
import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { Store } from './core/store.js';
import { createProject, migrateProject, createLevel } from './core/schema.js';
import { loadLocal, saveLocal, createAutosaver } from './core/persistence.js';
import { evaluateGuards, previousPhase, phasesNeedingReview } from './core/phases.js';
import { PHASES } from './core/constants.js';
import { replaceProject } from './core/commands.js';

import { CanvasView } from './editor2d/canvas-view.js';
import { Renderer2D } from './editor2d/renderer2d.js';
import { InputHandler } from './editor2d/input.js';
import { LotTool } from './editor2d/tools/lot-tool.js';
import { StreetTool } from './editor2d/tools/street-tool.js';
import { GalleryTool } from './editor2d/tools/gallery-tool.js';
import { PerimeterTool } from './editor2d/tools/perimeter-tool.js';
import { WallTool } from './editor2d/tools/wall-tool.js';
import { OpeningTool } from './editor2d/tools/opening-tool.js';
import { StairTool } from './editor2d/tools/stair-tool.js';
import { RoomLabelTool } from './editor2d/tools/room-label-tool.js';
import { SelectTool } from './editor2d/tools/select-tool.js';

import { SceneManager } from './viewer3d/scene-manager.js';
import { ViewerControls } from './viewer3d/controls.js';
import { ModelBuilder } from './viewer3d/model-builder.js';
import { createMaterials } from './viewer3d/materials.js';
import { applyViewMode } from './viewer3d/view-modes.js';

import { PhaseStepper } from './ui/phase-stepper.js';
import { Toolbar } from './ui/toolbar.js';
import { LevelSwitcher } from './ui/level-switcher.js';
import { Inspector } from './ui/inspector.js';
import { showDialog, showErrors, alertDialog, closeDialog } from './ui/dialogs.js';
import { showToast } from './ui/toast.js';

const isNative = Capacitor.isNativePlatform();

async function bootstrap() {
  const store = new Store(await loadInitialProject());
  const canvas = document.getElementById('canvas-2d');
  const view = new CanvasView(canvas);
  const renderer2d = new Renderer2D();

  const tools = {
    lot: new LotTool(store, view),
    street: new StreetTool(store, view),
    gallery: new GalleryTool(store, view),
    perimeter: new PerimeterTool(store, view),
    wall: new WallTool(store, view),
    door: new OpeningTool(store, view),
    window: new OpeningTool(store, view),
    label: new RoomLabelTool(store, view),
    stair: new StairTool(store, view),
    select: new SelectTool(store, view),
  };
  let activeTool = tools.select;
  const getTool = () => activeTool;

  const input = new InputHandler(canvas, view, store, getTool);
  view.setRenderCallback((ctx, v) => renderer2d.render(ctx, v, store, getTool()));

  const autosaver = createAutosaver({ delayMs: 800, sink: saveProjectFile });
  store.subscribe(() => true, () => {
    view.invalidate();
    autosaver.schedule(store.project);
    updateUndoRedo();
  });

  // ---------------- Visor 3D ----------------
  let viewer = null;
  async function ensureViewer() {
    if (viewer) return viewer;
    const container = document.getElementById('viewer-3d');
    const sm = new SceneManager(container);
    const controls = new ViewerControls(sm.camera, sm.renderer.domElement);
    sm.controls = controls;
    const materials = createMaterials();
    const builder = new ModelBuilder(materials);
    sm.onRestored = () => {
      const group = builder.build(store.project);
      sm.setModel(group);
      const fit = sm.fitToModel();
      if (fit) controls.setTarget(fit.center, fit.radius);
      applyViewMode(store.ui.view3d.mode, sm.model);
    };
    viewer = { sm, controls, materials, builder };
    return viewer;
  }

  async function syncViewer() {
    if (store.ui.phase !== 'VIEW_3D') {
      if (viewer) viewer.sm.stop();
      document.getElementById('viewer-3d').setAttribute('aria-hidden', 'true');
      return;
    }
    const v = await ensureViewer();
    const group = v.builder.build(store.project);
    const fit = v.sm.setModel(group);
    if (fit) v.controls.setTarget(fit.center, fit.radius);
    applyViewMode(store.ui.view3d.mode, v.sm.model);
    v.sm.start();
    document.getElementById('viewer-3d').setAttribute('aria-hidden', 'false');
  }

  function getModel() { return viewer?.sm.model ?? null; }

  // ---------------- Fases ----------------
  function goToPhase(target) {
    if (target === store.ui.phase) return;
    const currentIndex = PHASES.indexOf(store.ui.phase);
    const targetIndex = PHASES.indexOf(target);
    const guards = evaluateGuards(store.project);

    if (targetIndex < currentIndex) {
      store.setPhase(target);
      afterPhaseChange();
      return;
    }

    for (let i = currentIndex; i < targetIndex; i += 1) {
      if (!guards[PHASES[i]].ok) {
        showErrors(guards[PHASES[i]].errors, { onGoTo: focusTarget });
        return;
      }
    }
    store.setPhase(target);
    afterPhaseChange();
  }

  function afterPhaseChange() {
    const phase = store.ui.phase;
    const toolByPhase = { SITE: 'lot', PERIMETER: 'perimeter', LEVEL_1: 'select', LEVEL_2: 'select', VIEW_3D: 'select' };
    setTool(toolByPhase[phase] ?? 'select');
    updatePhaseBanner();
    syncViewer();
    view.invalidate();
  }

  function setTool(name) {
    if (activeTool?.deactivate) activeTool.deactivate();
    activeTool = tools[name] ?? tools.select;
    store.ui.tool = name;
    if (activeTool?.activate) activeTool.activate();
    view.invalidate();
  }

  function updatePhaseBanner() {
    const banner = document.getElementById('phase-banner');
    const review = phasesNeedingReview(store.project);
    if (review.length === 0) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.textContent = `Requiere revisión: ${review.join(', ')}`;
  }

  function focusTarget(target) {
    if (!target) return;
    if (target.levelId) store.setActiveLevel(target.levelId);
    const level = store.getActiveLevel();
    if (!level) return;
    if (target.kind === 'node' && level.nodes[target.id]) {
      centerOn(level.nodes[target.id]);
    } else if (target.kind === 'wall' && level.walls[target.id]) {
      const w = level.walls[target.id];
      const a = level.nodes[w.a];
      const b = level.nodes[w.b];
      if (a && b) centerOn({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    } else if (target.kind === 'opening' && level.openings[target.id]) {
      const o = level.openings[target.id];
      const w = level.walls[o.wallId];
      if (w) {
        const a = level.nodes[w.a];
        const b = level.nodes[w.b];
        if (a && b) {
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          centerOn({
            x: a.x + ((b.x - a.x) / len) * o.s,
            y: a.y + ((b.y - a.y) / len) * o.s,
          });
        }
      }
    } else {
      fitLevel(level);
    }
  }

  function centerOn(p) {
    view.panX = view.width / 2 - p.x * view.scale;
    view.panY = view.height / 2 - p.y * view.scale;
    view.invalidate();
  }

  function fitLevel(level) {
    const pts = Object.values(level.nodes);
    if (pts.length === 0) return;
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    view.fitRect({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, 60);
  }

  // ---------------- UI ----------------
  const phaseStepper = new PhaseStepper(
    document.getElementById('phase-stepper'),
    store,
    { onGoToPhase: goToPhase },
  );
  const toolbar = new Toolbar(
    document.getElementById('toolbar'),
    store,
    { onToolChange: (name) => { if (activeTool?.deactivate) activeTool.deactivate(); activeTool = tools[name] ?? tools.select; activeTool.activate(); } },
  );
  const levelSwitcher = new LevelSwitcher(
    document.getElementById('level-switcher'),
    store,
    { onCreateLevel: createSecondLevel },
  );
  const inspector = new Inspector(
    document.getElementById('inspector'),
    store,
    {
      onLoadSample: loadSample,
      onExport: exportProject,
      onImport: importProject,
      onQuickView: quickView,
      onViewModel: (mode) => applyViewMode(mode, getModel()),
      getModel,
    },
  );

  document.getElementById('btn-undo').addEventListener('click', () => {
    store.undo();
    syncViewer();
  });
  document.getElementById('btn-redo').addEventListener('click', () => {
    store.redo();
    syncViewer();
  });
  document.getElementById('btn-snaps').addEventListener('click', (e) => {
    const next = !store.ui.snaps.grid;
    store.setUi({ snaps: { ...store.ui.snaps, grid: next } });
    e.currentTarget.setAttribute('aria-pressed', String(next));
    showToast(next ? 'Rejilla activada' : 'Rejilla desactivada');
  });

  function updateUndoRedo() {
    document.getElementById('btn-undo').disabled = !store.history.canUndo;
    document.getElementById('btn-redo').disabled = !store.history.canRedo;
  }

  async function createSecondLevel() {
    if (store.project.levels.length >= 2) return;
    const l1 = store.project.levels[0];
    const loop = l1.perimeterLoop.map((id) => l1.nodes[id]).filter(Boolean);
    if (loop.length < 3) {
      await alertDialog('Falta el perímetro', 'Define primero el perímetro de la planta baja.');
      return;
    }
    replaceProject(store, (p) => {
      const l2 = createLevel({ id: 'L2', index: 1, name: 'Segunda planta' });
      const ids = [];
      for (const pt of loop) {
        const id = `m${ids.length + 1}`;
        l2.nodes[id] = { id, x: pt.x, y: pt.y };
        ids.push(id);
      }
      for (let i = 0; i < ids.length; i += 1) {
        const wid = `x${i + 1}`;
        l2.walls[wid] = {
          id: wid, a: ids[i], b: ids[(i + 1) % ids.length],
          kind: 'exterior', thickness: p.settings.wallThickness.exterior,
          height: p.settings.wallHeight,
        };
      }
      l2.perimeterLoop = ids;
      p.levels.push(l2);
    }, 'add-level-2');
    store.setActiveLevel('L2');
    showToast('Segunda planta creada');
  }

  async function quickView(name) {
    const v = await ensureViewer();
    if (!v.sm.model) return;
    const box = new THREE.Box3().setFromObject(v.sm.model);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    v.controls.quickView(name, center, radius);
  }

  // ---------------- Persistencia ----------------
  async function saveProjectFile(project) {
    if (!isNative) return;
    try {
      await Filesystem.writeFile({
        path: 'planocasa-autosave.json',
        data: JSON.stringify(project),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
    } catch (err) {
      console.error('No se pudo guardar el proyecto:', err);
    }
  }

  async function loadInitialProject() {
    const local = loadLocal();
    if (local) {
      try { return migrateProject(local); } catch (err) { console.warn(err); }
    }
    if (isNative) {
      try {
        const res = await Filesystem.readFile({
          path: 'planocasa-autosave.json',
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        const parsed = JSON.parse(res.data);
        return migrateProject(parsed);
      } catch {
        // Sin archivo previo: se usa el proyecto vacío.
      }
    }
    return createProject();
  }

  async function exportProject() {
    const json = JSON.stringify(store.project, null, 2);
    if (!isNative) {
      downloadText('planocasa.json', json);
      return;
    }
    try {
      await Filesystem.writeFile({
        path: 'planocasa-export.json',
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      const { uri } = await Filesystem.getUri({
        directory: Directory.Cache,
        path: 'planocasa-export.json',
      });
      await Share.share({
        title: 'PlanoCasa 3D',
        text: 'Proyecto PlanoCasa 3D',
        files: [uri],
      });
    } catch (err) {
      console.error(err);
      showToast('No se pudo exportar el proyecto', 'error');
    }
  }

  async function importProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const migrated = migrateProject(parsed);
        store.replaceProject(migrated);
        saveLocal(migrated);
        showToast('Proyecto importado', 'ok');
      } catch (err) {
        console.error(err);
        alertDialog('Archivo inválido', `No se pudo importar: ${err.message}`);
      }
    });
    input.click();
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadSample() {
    try {
      const res = await fetch('./assets/sample-house.json');
      const parsed = await res.json();
      const migrated = migrateProject(parsed);
      store.replaceProject(migrated);
      store.setActiveLevel('L1');
      store.setPhase('SITE');
      afterPhaseChange();
      showToast('Casa de ejemplo cargada', 'ok');
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar la casa de ejemplo', 'error');
    }
  }

  // ---------------- Ciclo de vida Android ----------------
  if (isNative) {
    App.addListener('backButton', () => {
      const dialog = document.getElementById('dialog-root');
      if (dialog && !dialog.hidden) { closeDialog(); return; }
      if (store.ui.selection) { store.ui.selection = null; view.invalidate(); return; }
      if (store.ui.phase !== 'SITE') { goToPhase(previousPhase(store.ui.phase)); return; }
      App.exitApp();
    });

    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) {
        await autosaver.flush(store.project);
        viewer?.sm.stop();
      } else if (store.ui.phase === 'VIEW_3D') {
        viewer?.sm.start();
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      autosaver.flush(store.project);
      viewer?.sm.stop();
    } else if (store.ui.phase === 'VIEW_3D') {
      viewer?.sm.start();
    }
  });

  // Inicio
  afterPhaseChange();
  updateUndoRedo();
  if (!store.project.site?.lot) {
    showToast('Empieza dibujando el lote en la fase Entorno');
  }
}

bootstrap().catch((err) => {
  console.error(err);
  const hud = document.getElementById('canvas-hud');
  if (hud) hud.textContent = 'Error al arrancar. Ejecuta "npm run vendor" antes de abrir la app.';
});
