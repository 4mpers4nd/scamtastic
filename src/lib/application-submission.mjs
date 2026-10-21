export function applicationFormPayload({
  username,
  email,
  reason,
  invitationCode,
  comments,
}) {
  return { username, email, reason, invitationCode, comments };
}

export function applicationRpcCall({
  rateKey,
  username,
  email,
  reason,
  invitationHash,
  comments,
}) {
  const args = {
    p_rate_key: rateKey,
    p_username: username,
    p_email: email,
    p_reason: reason,
    p_referral_code: null,
    p_comments: comments,
  };
  return invitationHash
    ? {
        functionName: 'submit_invited_application',
        args: { ...args, p_invitation_hash: invitationHash },
      }
    : {
        functionName: 'submit_scamtastic_application',
        args,
      };
}
