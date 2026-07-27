import type { MapData } from "@pollen/shared";
import { CONFIG } from "@pollen/shared";

/** Deterministic integer hash → [0,1). */
function hash(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974711) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** 2D value noise in [0,1]. */
function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal brownian motion in [0,1]. */
export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 131) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

export type HeightSampler = (x: number, z: number) => number;

/** Continuous noise height — only exact at chunk-grid vertices. */
function continuousHeight(map: MapData): HeightSampler {
  const { ruggedness, noiseScale } = map.terrain;
  const seed = map.seed | 0;
  return (x: number, z: number) => {
    const rolling = (fbm(x * noiseScale, z * noiseScale, seed) * 2 - 1) * ruggedness;
    const broad = (fbm(x * noiseScale * 0.23, z * noiseScale * 0.23, seed + 7777) * 2 - 1) * ruggedness * 0.8;
    return rolling + broad;
  };
}

/**
 * Client-side terrain from parameters (seed + ruggedness + noiseScale): the
 * server never ships geometry. Deterministic, so all clients agree.
 *
 * The rendered terrain mesh samples the noise every chunkSize/chunkSegments
 * meters and linearly interpolates across triangles. At high ruggedness the
 * continuous noise diverges from that mesh by meters between vertices (grass
 * floats, the bee sinks under the ground plane). So the gameplay sampler
 * returns the EXACT mesh height: noise quantized to the vertex grid, then
 * interpolated with the same b–d diagonal split three.js PlaneGeometry uses.
 */
export function makeHeightSampler(map: MapData): HeightSampler {
  const cont = continuousHeight(map);
  const step = CONFIG.world.chunkSize / CONFIG.world.chunkSegments;
  return (x: number, z: number) => {
    const gx = Math.floor(x / step);
    const gz = Math.floor(z / step);
    const u = x / step - gx;
    const v = z / step - gz;
    const ha = cont(gx * step, gz * step); // (0,0)
    const hd = cont((gx + 1) * step, gz * step); // (1,0)
    const hb = cont(gx * step, (gz + 1) * step); // (0,1)
    const hc = cont((gx + 1) * step, (gz + 1) * step); // (1,1)
    return u + v <= 1
      ? ha + (hd - ha) * u + (hb - ha) * v
      : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
  };
}
