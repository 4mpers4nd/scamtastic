export function canonicalPlayerPair(
  playerA: string,
  playerB: string,
): { playerA: string; playerB: string };
export function connectionRadius(strength: number, maxStrength?: number): number;
export function connectionIntensity(strength: number, maxStrength?: number): number;
export function focusCameraOffset(
  distance: number,
  aspect: number,
  verticalFovDegrees: number,
  screenX: number,
  screenY: number,
): { x: number; y: number };
export function initialNeuralView(
  nodes: ReadonlyArray<{ id: string; x: number; y: number; z: number }>,
  focusId?: string | null,
): { target: { x: number; y: number; z: number }; distance: number };
