export function createFrameLoop(
  renderFrame: (time: number) => boolean,
  requestFrame: (callback: (time: number) => void) => number,
  cancelFrame: (frame: number) => void,
): { schedule: () => void; dispose: () => void };
