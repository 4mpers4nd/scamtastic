import { generateAvatarTiles } from '@/lib/avatar';

type Props = {
  seed: string;
  version: number;
  label: string;
  className?: string;
};

export default function ProceduralAvatar({ seed, version, label, className }: Props) {
  const tiles = generateAvatarTiles(seed, version);

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="62" height="62" rx="15" fill="#111923" stroke="#2d3844" />
      <path d="M9 18V9h9M46 9h9v9M9 46v9h9M55 46v9h-9" fill="none" stroke="#00d9ff" strokeOpacity=".45" />
      {tiles.map((tile, index) => {
        const center = tile.x + 3.25;
        const yCenter = tile.y + 3.25;
        const transform = `rotate(${tile.rotation} ${center} ${yCenter})`;

        if (tile.shape === 'circle') {
          return (
            <circle
              key={`${tile.x}-${tile.y}-${index}`}
              cx={center}
              cy={yCenter}
              r="3.1"
              fill={tile.color}
              transform={transform}
            />
          );
        }
        if (tile.shape === 'diamond') {
          return (
            <path
              key={`${tile.x}-${tile.y}-${index}`}
              d={`M${center} ${tile.y} L${tile.x + 6.5} ${yCenter} L${center} ${tile.y + 6.5} L${tile.x} ${yCenter} Z`}
              fill={tile.color}
              transform={transform}
            />
          );
        }
        if (tile.shape === 'triangle') {
          return (
            <path
              key={`${tile.x}-${tile.y}-${index}`}
              d={`M${center} ${tile.y} L${tile.x + 6.5} ${tile.y + 6.5} L${tile.x} ${tile.y + 6.5} Z`}
              fill={tile.color}
              transform={transform}
            />
          );
        }
        return (
          <rect
            key={`${tile.x}-${tile.y}-${index}`}
            x={tile.x}
            y={tile.y}
            width="6.5"
            height="6.5"
            rx="1.5"
            fill={tile.color}
            transform={transform}
          />
        );
      })}
      <circle cx="32" cy="32" r="3.4" fill="#ff2d95" stroke="#111923" strokeWidth="1.5" />
    </svg>
  );
}
