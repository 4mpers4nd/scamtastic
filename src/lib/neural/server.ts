import 'server-only';

import { supabaseService } from '@/lib/server';
import { canonicalPlayerPair } from '@/lib/neural/geometry.mjs';

export type EligibleGameplayEvent =
  | 'gameplay.opportunity_participation'
  | 'gameplay.project_collaboration'
  | 'gameplay.player_transaction'
  | 'gameplay.invitation_accepted'
  | 'gameplay.multiplayer_activity';

export async function recordNeuralInteraction(event: {
  sourceEventId: string;
  eventType: EligibleGameplayEvent;
  playerA: string;
  playerB: string;
}) {
  const pair = canonicalPlayerPair(event.playerA, event.playerB);
  const db = supabaseService();
  const { data, error } = await db.rpc('record_neural_interaction', {
    p_source_event_id: event.sourceEventId,
    p_event_type: event.eventType,
    p_player_a: pair.playerA,
    p_player_b: pair.playerB,
  });

  if (error) throw error;
  return data === true;
}
