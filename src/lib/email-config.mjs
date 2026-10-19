function deploymentUrl(value, variableName) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute URL.`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(`${variableName} must be an origin without credentials, path, query, or fragment.`);
  }
  return url;
}

function hostname(value) {
  const candidate = value.includes('://') ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    throw new Error('VERCEL_PROJECT_PRODUCTION_URL is invalid.');
  }
}

export function emailSiteUrl({
  siteUrl,
  vercelEnv,
  productionUrl,
  nodeEnv,
}) {
  if (!siteUrl) {
    throw new Error('Email delivery is not configured: missing NEXT_PUBLIC_SITE_URL.');
  }
  const configured = deploymentUrl(siteUrl, 'NEXT_PUBLIC_SITE_URL');
  if (configured.protocol !== 'https:' && configured.hostname !== 'localhost' &&
      configured.hostname !== '127.0.0.1') {
    throw new Error('NEXT_PUBLIC_SITE_URL must use HTTPS except for a local loopback address.');
  }

  if (vercelEnv === 'preview') {
    if (!productionUrl) {
      throw new Error(
        'Preview email delivery is disabled: VERCEL_PROJECT_PRODUCTION_URL is unavailable for production-host validation.',
      );
    }
    if (configured.hostname.toLowerCase() === hostname(productionUrl)) {
      throw new Error(
        'Preview email delivery is disabled: NEXT_PUBLIC_SITE_URL points to the production host.',
      );
    }
  } else if (
    (vercelEnv === 'development' || nodeEnv !== 'production') &&
    !['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname.toLowerCase())
  ) {
    throw new Error(
      'Development email delivery is disabled for non-local URLs; set NEXT_PUBLIC_SITE_URL to a local address.',
    );
  }

  return configured.origin;
}

export function activationCallbackUrl(siteUrl, tokenHash, verificationType) {
  const callback = new URL('/auth/callback', siteUrl);
  callback.searchParams.set('token_hash', tokenHash);
  callback.searchParams.set('type', verificationType);
  callback.searchParams.set('next', '/activate');
  return callback;
}

export function emailSenderConfig({
  siteUrl,
  resendApiKey,
  from,
  vercelEnv,
  productionUrl,
  nodeEnv,
}) {
  const missing = [];
  if (!siteUrl) missing.push('NEXT_PUBLIC_SITE_URL');
  if (!resendApiKey?.trim()) missing.push('RESEND_API_KEY');
  if (!from?.trim()) missing.push('EMAIL_FROM');
  if (missing.length > 0) {
    throw new Error(`Email delivery is not configured: missing ${missing.join(', ')}.`);
  }
  if (/[\r\n]/.test(from)) {
    throw new Error('EMAIL_FROM must not contain line breaks.');
  }

  return {
    siteUrl: emailSiteUrl({ siteUrl, vercelEnv, productionUrl, nodeEnv }),
    resendApiKey: resendApiKey.trim(),
    from: from.trim(),
  };
}
