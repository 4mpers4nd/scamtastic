import 'server-only';

import { supabaseService } from '@/lib/server';

export async function sendActivationEmail(email: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!siteUrl || !resendApiKey || !from) {
    throw new Error('Activation email delivery is not configured');
  }

  const baseUrl = new URL(siteUrl);
  if (baseUrl.protocol !== 'https:' && baseUrl.hostname !== 'localhost') {
    throw new Error('NEXT_PUBLIC_SITE_URL must use HTTPS');
  }
  const supabase = supabaseService();
  let type: 'invite' | 'magiclink' = 'invite';
  let { data, error } = await supabase.auth.admin.generateLink({ type, email });

  if (error?.code === 'email_exists') {
    type = 'magiclink';
    ({ data, error } = await supabase.auth.admin.generateLink({ type, email }));
  }
  if (error) throw new Error(`Supabase could not create the activation link (${error.code ?? 'unknown'}).`);

  const properties = data?.properties;
  if (!properties) throw new Error('Supabase returned an incomplete activation link');
  const tokenHash = properties.hashed_token;
  const verificationType = properties.verification_type;
  if (!tokenHash || (verificationType !== 'invite' && verificationType !== 'magiclink')) {
    throw new Error('Supabase returned an incomplete activation link');
  }

  const callback = new URL('/auth/callback', baseUrl);
  callback.searchParams.set('token_hash', tokenHash);
  callback.searchParams.set('type', verificationType);
  callback.searchParams.set('next', '/activate');
  const safeUrl = callback.toString().replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your Scamtastic access is approved',
      text: `Your application has been approved. Verify your email and activate your account using this one-time link: ${callback.toString()}\n\nThe link expires according to Supabase Auth settings and cannot be reused.`,
      html: `<p>Your application has been approved.</p><p><a href="${safeUrl}">Verify your email and activate your account</a></p><p>This one-time link expires according to Supabase Auth settings and cannot be reused.</p>`,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Activation email provider rejected the request (${response.status}).`);
  }
}
