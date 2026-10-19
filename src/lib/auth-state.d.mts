import type { User } from '@supabase/supabase-js';

export function isUnauthenticatedAuthError(error: unknown): boolean;
export function getUserOrNull(auth: {
  getUser(): Promise<{ data: { user: User | null }; error: unknown | null }>;
}): Promise<User | null>;
export function getAccessDecision(
  user: User | null,
  options?: { adminOnly?: boolean; isAdmin?: boolean },
): 'login' | 'forbidden' | 'allow';
