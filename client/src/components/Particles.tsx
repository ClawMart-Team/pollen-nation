import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fxBus } from "../game/fx";

const MAX = 256;
const tmpColor = new THREE.Color();

/** Soft round sprite generated once on a tiny canvas — no asset needed. */
function makeDotTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Pooled particle bursts (pollen puffs, collision debris). One Points draw.
 */
export function Particles() {
  const points = useRef<THREE.Points>(null!);
  const state = useRef({
    vel: new Float32Array(MAX * 3),
    life: new Float32Array(MAX),
    cursor: 0,
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3);
    pos.fill(99999);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    return g;
  }, []);
  const dotTex = useMemo(makeDotTexture, []);
  useEffect(
    () => () => {
      geo.dispose();
      dotTex.dispose();
    },
    [geo, dotTex]
  );

  useEffect(() => {
    fxBus.spawn = (p, colorHex, count = 20) => {
      const s = state.current;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const colAttr = geo.attributes.color as THREE.BufferAttribute;
      tmpColor.set(colorHex);
      for (let n = 0; n < count; n++) {
        const i = s.cursor;
        s.cursor = (s.cursor + 1) % MAX;
        posAttr.setXYZ(i, p.x, p.y, p.z);
        const a = Math.random() * Math.PI * 2;
        const up = 1.5 + Math.random() * 2.5;
        const r = 1 + Math.random() * 2;
        s.vel[i * 3] = Math.cos(a) * r;
        s.vel[i * 3 + 1] = up;
        s.vel[i * 3 + 2] = Math.sin(a) * r;
        s.life[i] = 0.7 + Math.random() * 0.5;
        colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    };
    return () => {
      fxBus.spawn = () => {};
    };
  }, [geo]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = state.current;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (s.life[i] <= 0) continue;
      any = true;
      s.life[i] -= dt;
      s.vel[i * 3 + 1] -= 4 * dt;
      posAttr.setXYZ(
        i,
        posAttr.getX(i) + s.vel[i * 3] * dt,
        posAttr.getY(i) + s.vel[i * 3 + 1] * dt,
        posAttr.getZ(i) + s.vel[i * 3 + 2] * dt
      );
      if (s.life[i] <= 0) posAttr.setXYZ(i, 99999, 99999, 99999);
    }
    if (any) posAttr.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        size={0.25}
        map={dotTex}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
