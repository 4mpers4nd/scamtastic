export function createFrameLoop(renderFrame, requestFrame, cancelFrame) {
  let pendingFrame = null;
  let disposed = false;

  function schedule() {
    if (disposed || pendingFrame !== null) return;
    pendingFrame = requestFrame((time) => {
      pendingFrame = null;
      if (!disposed && renderFrame(time)) schedule();
    });
  }

  function dispose() {
    disposed = true;
    if (pendingFrame !== null) cancelFrame(pendingFrame);
    pendingFrame = null;
  }

  return { schedule, dispose };
}
