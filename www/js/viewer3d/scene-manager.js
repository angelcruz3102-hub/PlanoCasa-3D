// === www/js/viewer3d/scene-manager.js ===
/**
 * Renderer WebGL, cámara, luces y ciclo de render. Usa `PCFShadowMap` porque
 * `PCFSoftShadowMap` está eliminado en r186. El bucle se detiene al salir de
 * la fase 3D o al ir a segundo plano; en `webglcontextlost` se hace
 * preventDefault y se detiene el bucle, y en `webglcontextrestored` se pide
 * reconstruir el modelo mediante `onRestored`.
 */
import * as THREE from 'three';
import { disposeGroup } from './model-builder.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1220);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.camera.position.set(14, 12, 14);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, {
      width: '100%', height: '100%', display: 'block', touchAction: 'none',
    });

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 1.6);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 2.2);
    this.dir.position.set(18, 26, 12);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.dir);
    this.scene.add(this.dir.target);

    this.model = null;
    this.controls = null;
    this.running = false;
    this.onRestored = null;
    this.#loop = this.#loop.bind(this);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.#bindContext();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  #bindContext() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.stop();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.renderer.shadowMap.needsUpdate = true;
      if (this.onRestored) this.onRestored();
      this.start();
    });
  }

  setModel(group) {
    if (this.model) {
      this.scene.remove(this.model);
      disposeGroup(this.model);
    }
    this.model = group;
    this.scene.add(group);
    return this.fitToModel();
  }

  fitToModel() {
    if (!this.model) return null;
    const box = new THREE.Box3().setFromObject(this.model);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const dist = radius / Math.tan(((this.camera.fov * Math.PI) / 180) / 2);
    this.camera.near = Math.max(0.05, dist / 100);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.dir.target.position.copy(center);
    this.dir.position.set(center.x + size.x, center.y + size.y * 2.2, center.z + size.z);
    const s = this.dir.shadow;
    s.camera.left = -radius * 2.5;
    s.camera.right = radius * 2.5;
    s.camera.top = radius * 2.5;
    s.camera.bottom = -radius * 2.5;
    s.camera.near = 0.1;
    s.camera.far = dist * 4;
    s.camera.updateProjectionMatrix();
    s.bias = -0.0005;
    return { center, radius };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop(this.#loop);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  #loop() {
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    if (this.model) disposeGroup(this.model);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
