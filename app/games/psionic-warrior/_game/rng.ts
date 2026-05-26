export type Rng = {
  int: (min: number, max: number) => number;
  next: () => number;
};

export function createRng(seed: string): Rng {
  let state = hashSeed(seed);

  function next() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function int(min: number, max: number) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  return { int, next };
}

function hashSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
