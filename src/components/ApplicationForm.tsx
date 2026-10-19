'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

type Props = { referralCode: string; invitationCode: string };

export default function ApplicationForm({ referralCode, invitationCode }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          email: form.get('email'),
          reason: form.get('reason'),
          referralCode: form.get('referralCode'),
          invitationCode,
          comments: form.get('comments'),
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit application.');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit application.');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <section className="form" aria-live="polite">
        <div className="tag">// TRANSMISSION RECEIVED</div>
        <h1>Request logged.</h1>
        <p>
          If this application can be considered, you will receive an email after it has
          been reviewed. We cannot reveal whether an email address already has an
          application or account.
        </p>
        <Link href="/" className="button secondary wide">
          Return to the network
        </Link>
      </section>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="tag">// ACCESS REQUEST</div>
      <h1>Request access.</h1>
      <p>
        {invitationCode
          ? 'A member invited you to apply. Every player invitation still requires administrator approval.'
          : 'Applications are reviewed by a human. Access is not automatic.'}
      </p>
      <label>
        Desired username
        <input
          required
          name="username"
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_&-]{3,24}"
          title="Use 3–24 letters, numbers, underscores, hyphens, or ampersands."
          autoComplete="username"
        />
      </label>
      <label>
        Email address
        <input required name="email" type="email" maxLength={254} autoComplete="email" />
      </label>
      <label>
        Why would you like to join?
        <textarea required name="reason" minLength={10} maxLength={2000} rows={5} />
      </label>
      <label>
        Referral code <span className="muted">(optional)</span>
        <input name="referralCode" maxLength={64} defaultValue={referralCode} />
      </label>
      <label>
        Additional comments <span className="muted">(optional)</span>
        <textarea name="comments" maxLength={2000} rows={3} />
      </label>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary wide" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit request →'}
      </button>
      <p className="micro">
        Bits are a fictional placeholder with no real-world value. This application does not create an account.
      </p>
    </form>
  );
}
