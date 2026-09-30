import * as THREE from "three";
export function createEffects(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d"),
    g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(207,224,235,.45)");
  g.addColorStop(0.35, "rgba(163,194,214,.22)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas),
    pool = [],
    trails = [];
  let cursor = 0,
    lastTime = 0;
  for (let i = 0; i < 56; i++) {
    const m = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: "#bed8ea",
      }),
    );
    m.visible = false;
    scene.add(m);
    pool.push({ m, life: 0, vx: 0, vz: 0 });
  }
  const max = 520,
    positions = new Float32Array(max * 18),
    colors = new Float32Array(max * 18),
    geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.47,
      depthWrite: false,
    }),
  );
  mesh.frustumCulled = false;
  scene.add(mesh);
  let segment = 0,
    lastWheels = null;
  function wheelPoints(car) {
    const f = { x: Math.sin(car.yaw), z: Math.cos(car.yaw) },
      r = { x: f.z, z: -f.x };
    return [-0.81, 0.81].map((o) => ({
      x: car.x - f.x * 1.4 + r.x * o,
      z: car.z - f.z * 1.4 + r.z * o,
    }));
  }
  return {
    clear() {
      lastWheels = null;
      segment = 0;
      geo.setDrawRange(0, 0);
      for (const p of pool) {
        p.life = 0;
        p.m.visible = false;
      }
    },
    update(car, dt, time, active) {
      const drift = active && car.drifting,
        points = wheelPoints(car);
      if (drift && lastWheels && time - lastTime > 0.035) {
        lastTime = time;
        for (let side = 0; side < 2; side++) {
          const a = lastWheels[side],
            b = points[side],
            dx = b.x - a.x,
            dz = b.z - a.z,
            l = Math.hypot(dx, dz);
          if (l < 0.02 || l > 5) continue;
          const nx = (dz / l) * 0.095,
            nz = (-dx / l) * 0.095;
          let i = (segment % max) * 18;
          positions.set(
            [
              a.x - nx,
              0.073,
              a.z - nz,
              a.x + nx,
              0.073,
              a.z + nz,
              b.x - nx,
              0.073,
              b.z - nz,
              a.x + nx,
              0.073,
              a.z + nz,
              b.x + nx,
              0.073,
              b.z + nz,
              b.x - nx,
              0.073,
              b.z - nz,
            ],
            i,
          );
          colors.fill(0.17, i, i + 18);
          segment++;
          const p = pool[cursor++ % pool.length];
          p.life = 1;
          p.m.visible = true;
          p.m.position.set(b.x, 0.25, b.z);
          p.vx = car.vx * 0.13 + (Math.random() - 0.5);
          p.vz = car.vz * 0.13 + (Math.random() - 0.5);
          p.m.material.rotation = Math.random() * 6.28;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.setDrawRange(0, Math.min(segment, max) * 6);
        lastWheels = points;
      } else if (!drift || !lastWheels) lastWheels = points;
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life = Math.max(0, p.life - dt * 0.68);
        p.m.position.x += p.vx * dt;
        p.m.position.z += p.vz * dt;
        p.m.position.y += dt * 0.33;
        p.m.scale.setScalar(0.65 + (1 - p.life) * 3);
        p.m.material.opacity = p.life * 0.7;
        p.m.visible = p.life > 0;
      }
    },
  };
}
