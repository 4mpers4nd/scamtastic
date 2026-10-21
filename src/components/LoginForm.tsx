'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('error');
    if (authError === 'callback') {
      setError('The sign-in link could not be verified. Please try signing in again.');
    } else if (authError === 'admin') {
      setError('Sign in with an administrator account to access that area.');
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="tag">// AUTHENTICATION REQUIRED</div>
      <h1>Welcome back.</h1>
      <p>Prove you're supposed to be here.</p>
      <label>
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </label>
      <label>
        Password
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary wide" disabled={busy}>
        {busy ? 'Checking…' : 'Sign In →'}
      </button>
      <p className="small">
        No account? <Link href="/apply">Request access</Link>
      </p>
    </form>
  );
}
