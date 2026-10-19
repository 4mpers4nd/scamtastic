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
