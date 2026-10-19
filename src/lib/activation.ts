import 'server-only';

import {
  activationCallbackUrl,
  emailSenderConfig,
} from '@/lib/email-config.mjs';
import { supabaseService } from '@/lib/server';

function configuredEmailSender() {
  return emailSenderConfig({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
    vercelEnv: process.env.VERCEL_ENV,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}

async function sendResendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const { resendApiKey, from } = configuredEmailSender();
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Resend request failed or timed out; delivery could not be confirmed.');
  }

  if (!response.ok) {
    throw new Error(`Resend rejected the email request (HTTP ${response.status}).`);
  }
}

export async function sendActivationEmail(email: string) {
  const { siteUrl } = configuredEmailSender();
  const supabase = supabaseService();
  let type: 'invite' | 'magiclink' = 'invite';
  let { data, error } = await supabase.auth.admin.generateLink({ type, email });

  if (error?.code === 'email_exists') {
    type = 'magiclink';
    ({ data, error } = await supabase.auth.admin.generateLink({ type, email }));
  }
  if (error) {
    throw new Error(
      `Supabase could not create the activation link (${error.code ?? 'unknown'}).`,
    );
  }

  const properties = data?.properties;
  if (!properties) throw new Error('Supabase returned an incomplete activation link.');
  const tokenHash = properties.hashed_token;
  const verificationType = properties.verification_type;
  if (!tokenHash || (verificationType !== 'invite' && verificationType !== 'magiclink')) {
    throw new Error('Supabase returned an incomplete activation link.');
  }

  const callback = activationCallbackUrl(siteUrl, tokenHash, verificationType);
  const safeUrl = callback.toString().replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  await sendResendEmail({
    to: email,
    subject: 'Your Scamtastic access is approved',
    text: `Your application has been approved. Verify your email and activate your account using this one-time link: ${callback.toString()}\n\nThe link expires according to Supabase Auth settings and cannot be reused.`,
    html: `<p>Your application has been approved.</p><p><a href="${safeUrl}">Verify your email and activate your account</a></p><p>This one-time link expires according to Supabase Auth settings and cannot be reused.</p>`,
  });
}

export async function sendTestEmail(email: string) {
  const { siteUrl } = configuredEmailSender();
  const deployment = new URL(siteUrl).hostname;
  await sendResendEmail({
    to: email,
    subject: 'Scamtastic email delivery test',
    text: `This is a harmless test email for the Scamtastic deployment at ${deployment}. No action is required.`,
    html: `<p>This is a harmless test email for the Scamtastic deployment at <strong>${deployment}</strong>.</p><p>No action is required.</p>`,
  });
}
