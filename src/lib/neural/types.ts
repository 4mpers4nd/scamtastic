export type NeuralNode = {
  id: string;
  username: string;
  displayName: string | null;
  avatarSeed: string;
  avatarVersion: number;
  x: number;
  y: number;
  z: number;
  referralCount: number;
  connectionCount: number;
  interactionCount: number;
};

export type NeuralConnection = {
  playerA: string;
  playerB: string;
  strength: number;
  interactionCount: number;
};

export type NeuralSnapshot = {
  totalNodes: number;
  maxStrength: number;
  hasMore: boolean;
  connectionsHasMore: boolean;
  nodes: NeuralNode[];
  connections: NeuralConnection[];
};

export type NeuralSearchResult = Pick<
  NeuralNode,
  'id' | 'username' | 'displayName' | 'avatarSeed' | 'avatarVersion' | 'x' | 'y' | 'z'
>;

export type PublicNeuralProfile = {
  playerId: string;
  maxStrength: number;
  profile: {
    username: string;
    display_name: string | null;
    bio: string;
    avatar_seed: string;
    avatar_generator_version: number;
    created_at: string;
    is_founder: boolean;
    is_admin: boolean;
    referral_count: number;
  };
  node: { x: number; y: number; z: number } | null;
  connectionCount: number;
  interactionCount: number;
  hasMoreConnections: boolean;
  connections: Array<
    NeuralConnection & {
      player: NeuralSearchResult;
    }
  >;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNode(value: unknown): NeuralNode | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.username !== 'string' ||
    !(typeof value.displayName === 'string' || value.displayName === null) ||
    typeof value.avatarSeed !== 'string' ||
    typeof value.avatarVersion !== 'number' ||
    !Number.isInteger(value.avatarVersion) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    typeof value.z !== 'number' ||
    typeof value.referralCount !== 'number' ||
    typeof value.connectionCount !== 'number' ||
    typeof value.interactionCount !== 'number' ||
    ![value.x, value.y, value.z].every(Number.isFinite) ||
    ![value.referralCount, value.connectionCount, value.interactionCount].every(
      (count) => Number.isInteger(count) && count >= 0,
    )
  ) {
    return null;
  }
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    avatarSeed: value.avatarSeed,
    avatarVersion: value.avatarVersion,
    x: value.x,
    y: value.y,
    z: value.z,
    referralCount: value.referralCount,
    connectionCount: value.connectionCount,
    interactionCount: value.interactionCount,
  };
}

function parseConnection(value: unknown): NeuralConnection | null {
  if (
    !isRecord(value) ||
    typeof value.playerA !== 'string' ||
    typeof value.playerB !== 'string' ||
    typeof value.strength !== 'number' ||
    typeof value.interactionCount !== 'number' ||
    !Number.isInteger(value.strength) ||
    value.strength < 1 ||
    !Number.isInteger(value.interactionCount) ||
    value.interactionCount < 1 ||
    value.playerA === value.playerB
  ) {
    return null;
  }
  return {
    playerA: value.playerA,
    playerB: value.playerB,
    strength: value.strength,
    interactionCount: value.interactionCount,
  };
}

function parseSearchResult(value: unknown): NeuralSearchResult | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.username !== 'string' ||
    !(typeof value.displayName === 'string' || value.displayName === null) ||
    typeof value.avatarSeed !== 'string' ||
    typeof value.avatarVersion !== 'number' ||
    !Number.isInteger(value.avatarVersion) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    typeof value.z !== 'number' ||
    ![value.x, value.y, value.z].every(Number.isFinite)
  ) {
    return null;
  }
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    avatarSeed: value.avatarSeed,
    avatarVersion: value.avatarVersion,
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

export function parseNeuralSnapshot(value: unknown): NeuralSnapshot | null {
  if (
    !isRecord(value) ||
    typeof value.totalNodes !== 'number' ||
    typeof value.maxStrength !== 'number' ||
    typeof value.hasMore !== 'boolean' ||
    typeof value.connectionsHasMore !== 'boolean' ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.connections)
  ) {
    return null;
  }
  const nodes = value.nodes.map(parseNode);
  const connections = value.connections.map(parseConnection);
  if (nodes.some((node) => node === null) || connections.some((edge) => edge === null)) {
    return null;
  }
  return {
    totalNodes: value.totalNodes,
    maxStrength: value.maxStrength,
    hasMore: value.hasMore,
    connectionsHasMore: value.connectionsHasMore,
    nodes: nodes.filter((node): node is NeuralNode => node !== null),
    connections: connections.filter(
      (connection): connection is NeuralConnection => connection !== null,
    ),
  };
}

export function parseNeuralSearchResults(value: unknown): NeuralSearchResult[] | null {
  if (!Array.isArray(value)) return null;
  const nodes = value.map(parseSearchResult);
  if (nodes.some((node) => node === null)) return null;
  return nodes.filter((node): node is NeuralSearchResult => node !== null);
}

export function parsePublicNeuralProfile(value: unknown): PublicNeuralProfile | null {
  if (
    !isRecord(value) ||
    typeof value.playerId !== 'string' ||
    typeof value.maxStrength !== 'number' ||
    !isRecord(value.profile) ||
    typeof value.profile.username !== 'string' ||
    !(typeof value.profile.display_name === 'string' || value.profile.display_name === null) ||
    typeof value.profile.bio !== 'string' ||
    typeof value.profile.avatar_seed !== 'string' ||
    typeof value.profile.avatar_generator_version !== 'number' ||
    typeof value.profile.created_at !== 'string' ||
    typeof value.profile.is_founder !== 'boolean' ||
    typeof value.profile.is_admin !== 'boolean' ||
    typeof value.profile.referral_count !== 'number' ||
    !(value.node === null || isRecord(value.node)) ||
    typeof value.connectionCount !== 'number' ||
    typeof value.interactionCount !== 'number' ||
    typeof value.hasMoreConnections !== 'boolean' ||
    !Array.isArray(value.connections)
  ) {
    return null;
  }

  const connections = value.connections.map((entry): PublicNeuralProfile['connections'][number] | null => {
    if (!isRecord(entry)) return null;
    const connection = parseConnection(entry);
    const player = parseSearchResult(entry.player);
    return connection && player ? { ...connection, player } : null;
  });
  if (connections.some((connection) => connection === null)) return null;

  const node = value.node;
  let parsedNode: PublicNeuralProfile['node'] = null;
  if (node !== null) {
    if (!isRecord(node)) return null;
    const { x, y, z } = node;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof z !== 'number' ||
      ![x, y, z].every(Number.isFinite)
    ) {
      return null;
    }
    parsedNode = { x, y, z };
  }

  return {
    playerId: value.playerId,
    maxStrength: value.maxStrength,
    profile: {
      username: value.profile.username,
      display_name: value.profile.display_name,
      bio: value.profile.bio,
      avatar_seed: value.profile.avatar_seed,
      avatar_generator_version: value.profile.avatar_generator_version,
      created_at: value.profile.created_at,
      is_founder: value.profile.is_founder,
      is_admin: value.profile.is_admin,
      referral_count: value.profile.referral_count,
    },
    node: parsedNode,
    connectionCount: value.connectionCount,
    interactionCount: value.interactionCount,
    hasMoreConnections: value.hasMoreConnections,
    connections: connections.filter(
      (connection): connection is PublicNeuralProfile['connections'][number] =>
        connection !== null,
    ),
  };
}
