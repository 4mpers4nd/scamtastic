export type NetworkLeaderboardEntry = {
  username: string;
  displayName: string | null;
  value: number;
};

export type NetworkDashboardData = {
  playerCount: number;
  connectionCount: number;
  interactionCount: number;
  mostConnected: NetworkLeaderboardEntry[];
  mostInteractions: NetworkLeaderboardEntry[];
};

export function parseNetworkDashboard(value: unknown): NetworkDashboardData | null;
