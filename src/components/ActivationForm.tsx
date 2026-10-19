'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function ActivationForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 12) {
      setError('Use at least 12 characters for your password.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { error: passwordError } = await supabaseBrowser().auth.updateUser({ password });
      if (passwordError) throw passwordError;
      router.replace('/game');
      router.refresh();
    } catch {
      setError('Unable to set your password. The activation link may have expired; request a new one.');
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="tag">// ACCOUNT ACTIVATION</div>
      <h1>Make it yours.</h1>
      <p>Your email has been verified. Set a password to finish activating your account.</p>
      <label>
        New password
        <input
          required
          minLength={12}
          maxLength={128}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          required
          minLength={12}
          maxLength={128}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary wide" disabled={busy}>
        {busy ? 'Activating…' : 'Set password →'}
      </button>
    </form>
  );
}
