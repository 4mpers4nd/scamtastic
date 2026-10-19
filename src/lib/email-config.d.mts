export function emailSiteUrl(options: {
  siteUrl?: string;
  vercelEnv?: string;
  productionUrl?: string;
  nodeEnv?: string;
}): string;

export function activationCallbackUrl(
  siteUrl: string,
  tokenHash: string,
  verificationType: 'invite' | 'magiclink',
): URL;

export function administratorInvitationCallbackUrl(
  siteUrl: string,
  tokenHash: string,
  verificationType: 'invite' | 'magiclink',
  invitationCode: string,
): URL;

export function emailSenderConfig(options: {
  siteUrl?: string;
  resendApiKey?: string;
  from?: string;
  vercelEnv?: string;
  productionUrl?: string;
  nodeEnv?: string;
}): { siteUrl: string; resendApiKey: string; from: string };
