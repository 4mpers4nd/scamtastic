'use client';

import { useState } from 'react';

export default function CopyReferralLink({ href }: { href: string }) {
  const [message, setMessage] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setMessage('Referral link copied.');
    } catch {
      setMessage('Could not copy automatically. Select and copy the link.');
    }
  }

  return (
    <div className="copyLink">
      <code>{href}</code>
      <button className="button secondary" type="button" onClick={copy}>
        Copy link
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
