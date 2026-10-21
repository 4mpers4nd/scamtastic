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

export function avatarSvgDataUri(seed: string, version: number): string {
  const tiles = generateAvatarTiles(seed, version);
  const shapes = tiles.map((tile) => {
    const center = tile.x + 3.25;
    const yCenter = tile.y + 3.25;
    const transform = `rotate(${tile.rotation} ${center} ${yCenter})`;

    if (tile.shape === 'circle') {
      return `<circle cx="${center}" cy="${yCenter}" r="3.1" fill="${tile.color}" transform="${transform}"/>`;
    }
    if (tile.shape === 'diamond') {
      return `<path d="M${center} ${tile.y} L${tile.x + 6.5} ${yCenter} L${center} ${tile.y + 6.5} L${tile.x} ${yCenter} Z" fill="${tile.color}" transform="${transform}"/>`;
    }
    if (tile.shape === 'triangle') {
      return `<path d="M${center} ${tile.y} L${tile.x + 6.5} ${tile.y + 6.5} L${tile.x} ${tile.y + 6.5} Z" fill="${tile.color}" transform="${transform}"/>`;
    }
    return `<rect x="${tile.x}" y="${tile.y}" width="6.5" height="6.5" rx="1.5" fill="${tile.color}" transform="${transform}"/>`;
  }).join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect x="1" y="1" width="62" height="62" rx="15" fill="#111923" stroke="#2d3844"/>` +
    `<path d="M9 18V9h9M46 9h9v9M9 46v9h9M55 46v9h-9" fill="none" stroke="#00d9ff" stroke-opacity=".45"/>` +
    shapes +
    `<circle cx="32" cy="32" r="3.4" fill="#ff2d95" stroke="#111923" stroke-width="1.5"/>` +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
