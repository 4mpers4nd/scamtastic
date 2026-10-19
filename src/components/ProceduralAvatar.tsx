import { avatarSvgDataUri } from '@/lib/avatar';

type Props = {
  seed: string;
  version: number;
  label: string;
  className?: string;
};

export default function ProceduralAvatar({ seed, version, label, className }: Props) {
  return (
    <img
      className={className}
      src={avatarSvgDataUri(seed, version)}
      alt={label}
    />
  );
}
