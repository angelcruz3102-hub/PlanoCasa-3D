// === www/js/geometry/geometry-builder.js ===
export class GeometryBuilder {
  #pos = [];
  #norm = [];
  #uv = [];
  #idx = [];
  #vertexCount = 0;

  addTriangle(p0, p1, p2, normal, uvs = null) {
    const base = this.#vertexCount;
    const verts = [p0, p1, p2];
    for (let i = 0; i < 3; i += 1) {
      const v = verts[i];
      this.#pos.push(v.x, v.y, v.z);
      this.#norm.push(normal.x, normal.y, normal.z);
      const uv = uvs?.[i] ?? { u: 0, v: 0 };
      this.#uv.push(uv.u, uv.v);
    }
    this.#idx.push(base, base + 1, base + 2);
    this.#vertexCount += 3;
    return this;
  }

  addQuad(p0, p1, p2, p3, normal, uvs = null) {
    this.addTriangle(p0, p1, p2, normal, uvs ? [uvs[0], uvs[1], uvs[2]] : null);
    this.addTriangle(p0, p2, p3, normal, uvs ? [uvs[0], uvs[2], uvs[3]] : null);
    return this;
  }

  build(THREE) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.#pos), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.#norm), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.#uv), 2));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(this.#idx), 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  get isEmpty() {
    return this.#idx.length === 0;
  }
}
