// === www/js/viewer3d/controls.js ===
/**
 * OrbitControls con gestos táctiles: un dedo rota, dos dedos hacen zoom+paneo.
 * `maxPolarAngle` queda justo por encima del horizonte para no atravesar el
 * suelo. Las vistas rápidas reutilizan el centro y el radio del modelo.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ViewerControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 120;
    this.controls.screenSpacePanning = true;
  }

  setTarget(center, radius = 5) {
    this.controls.target.copy(center);
    this.controls.minDistance = Math.max(1, radius * 0.2);
    this.controls.maxDistance = Math.max(20, radius * 8);
    this.controls.update();
  }

  update() { this.controls.update(); }

  quickView(name, center, radius) {
    const c = center;
    const r = Math.max(radius, 1);
    this.controls.target.copy(c);
    if (name === 'plan') {
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(c.x, c.y + r * 3, c.z);
    } else if (name === 'front') {
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(c.x, c.y + r * 0.8, c.z + r * 2.2);
    } else if (name === 'walk') {
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(c.x, 1.6, c.z + r * 1.2);
      this.controls.target.set(c.x, 1.6, c.z);
    } else {
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(c.x + r * 1.6, c.y + r * 1.6, c.z + r * 1.6);
    }
    this.controls.update();
  }

  dispose() { this.controls.dispose(); }
}
