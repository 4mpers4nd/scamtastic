const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canonicalPlayerPair(playerA, playerB) {
  if (
    typeof playerA !== 'string' ||
    typeof playerB !== 'string' ||
    !UUID_PATTERN.test(playerA) ||
    !UUID_PATTERN.test(playerB) ||
    playerA.toLowerCase() === playerB.toLowerCase()
  ) {
    throw new TypeError('A neural connection requires two different player UUIDs.');
  }

  const [first, second] = [playerA.toLowerCase(), playerB.toLowerCase()].sort();
  return { playerA: first, playerB: second };
}

export function connectionRadius(strength, maxStrength = 20) {
  if (
    !Number.isFinite(strength) ||
    !Number.isFinite(maxStrength) ||
    strength < 1 ||
    maxStrength < 1
  ) {
    throw new RangeError('Connection strength and cap must be positive finite numbers.');
  }

  return 0.035 + (Math.min(strength, maxStrength) / maxStrength) * 0.095;
}

export function initialNeuralView(nodes, focusId = null) {
  const visibleNodes = nodes.filter(
    (node) => [node.x, node.y, node.z].every(Number.isFinite),
  );
  if (visibleNodes.length === 0) {
    return { target: { x: 0, y: 0, z: 0 }, distance: 24.3 };
  }

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const node of visibleNodes) {
    min.x = Math.min(min.x, node.x);
    min.y = Math.min(min.y, node.y);
    min.z = Math.min(min.z, node.z);
    max.x = Math.max(max.x, node.x);
    max.y = Math.max(max.y, node.y);
    max.z = Math.max(max.z, node.z);
  }

  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
  const size = Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z);
  const focus = focusId && visibleNodes.find((node) => node.id === focusId);
  return {
    target: focus ? { x: focus.x, y: focus.y, z: focus.z } : center,
    distance: Math.max(18, Math.max(12, size * 0.75) * 1.8),
  };
}
