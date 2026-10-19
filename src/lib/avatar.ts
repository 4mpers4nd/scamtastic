export type AvatarShape = 'square' | 'circle' | 'diamond' | 'triangle';

export type AvatarTile = {
  x: number;
  y: number;
  shape: AvatarShape;
  color: string;
  rotation: number;
};

const palette = ['#00d9ff', '#ff2d95', '#79e6f7', '#517c91'] as const;

function randomFor(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  if (state === 0) state = 0x6d2b79f5;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function generateAvatarTiles(seed: string, version: number): AvatarTile[] {
  if (version !== 1) {
    throw new Error(`Unsupported procedural avatar generator version: ${version}`);
  }

  const random = randomFor(seed);
  const tiles: AvatarTile[] = [];

  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      if (random() < 0.32) continue;
      const shapeRoll = random();
      const shape: AvatarShape =
        shapeRoll < 0.28
          ? 'square'
          : shapeRoll < 0.55
            ? 'circle'
            : shapeRoll < 0.82
              ? 'diamond'
              : 'triangle';
      const color = palette[Math.floor(random() * palette.length)];
      const rotation = Math.floor(random() * 4) * 90;
      const x = 12 + column * 8;
      const y = 12 + row * 8;
      const mirroredX = 12 + (4 - column) * 8;

      tiles.push({ x, y, shape, color, rotation });
      if (column !== 2) tiles.push({ x: mirroredX, y, shape, color, rotation });
    }
  }

  return tiles;
}
