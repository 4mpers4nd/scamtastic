type ApplicationRpcBaseArgs = {
  p_rate_key: string;
  p_username: string;
  p_email: string;
  p_reason: string;
  p_referral_code: null;
  p_comments: string | null;
};

export function applicationFormPayload<T extends {
  username: unknown;
  email: unknown;
  reason: unknown;
  invitationCode: string;
  comments: unknown;
}>(input: T): {
  username: T['username'];
  email: T['email'];
  reason: T['reason'];
  invitationCode: T['invitationCode'];
  comments: T['comments'];
};

export function applicationRpcCall(input: {
  rateKey: string;
  username: string;
  email: string;
  reason: string;
  invitationHash: string | null;
  comments: string | null;
}):
  | {
      functionName: 'submit_invited_application';
      args: ApplicationRpcBaseArgs & { p_invitation_hash: string };
    }
  | {
      functionName: 'submit_scamtastic_application';
      args: ApplicationRpcBaseArgs;
    };
