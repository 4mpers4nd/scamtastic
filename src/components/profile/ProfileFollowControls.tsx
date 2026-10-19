'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { profileHref } from '@/lib/profile-route.mjs';
import { parsePublicFollowPage, type PublicFollowData, type PublicFollowMember } from '@/lib/profile-follows.mjs';

function FollowList({
  username,
  direction,
  label,
  count,
  initialMembers,
}: {
  username: string;
  direction: 'followers' | 'following';
  label: string;
  count: number;
  initialMembers: PublicFollowMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [total, setTotal] = useState(count);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadMore() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/profile/${encodeURIComponent(username)}/follows?direction=${direction}&offset=${members.length}`,
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Unable to load this follow list right now.';
        throw new Error(message);
      }
      const page = parsePublicFollowPage(result);
      if (!page || page.offset !== members.length) {
        throw new Error('The follow list returned an invalid page.');
      }
      setMembers((current) => [...current, ...page.members]);
      setTotal(page.count);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load this follow list right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="profileFollowList">
      <summary>{count} {label}</summary>
      {members.length > 0 ? (
        <ul>
          {members.map((member) => (
            <li key={member.username}>
              <Link href={profileHref(member.username)}>
                {member.displayName || `@${member.username}`}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No {label.toLowerCase()} to show.</p>
      )}
      {members.length < total && (
        <button className="button secondary followListMore" type="button" disabled={loading} onClick={loadMore}>
          {loading ? 'Loading…' : `Load more (${members.length} of ${total})`}
        </button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </details>
  );
}

export default function ProfileFollowControls({
  username,
  viewerIsAuthenticated,
  isOwner,
  initialData,
}: {
  username: string;
  viewerIsAuthenticated: boolean;
  isOwner: boolean;
  initialData: PublicFollowData;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialData.isFollowing);
  const [followersCount, setFollowersCount] = useState(initialData.followersCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function toggleFollow() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/profile/${encodeURIComponent(username)}/follow`,
        { method: following ? 'DELETE' : 'POST' },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Unable to update this follow right now.';
        throw new Error(message);
      }
      setFollowing(!following);
      setFollowersCount((count) => Math.max(0, count + (following ? -1 : 1)));
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update this follow right now.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="profileFollowPanel" aria-label="Follow network">
      <div className="profileFollowLists">
        <FollowList
          username={username}
          direction="followers"
          label="Followers"
          count={followersCount}
          initialMembers={initialData.followers}
        />
        <FollowList
          username={username}
          direction="following"
          label="Following"
          count={initialData.followingCount}
          initialMembers={initialData.following}
        />
      </div>
      {!isOwner && viewerIsAuthenticated && (
        <button
          className={following ? 'button secondary' : 'button primary'}
          type="button"
          aria-pressed={following}
          disabled={pending}
          onClick={toggleFollow}
        >
          {pending ? 'Saving…' : following ? 'Unfollow' : 'Follow'}
        </button>
      )}
      {!isOwner && !viewerIsAuthenticated && (
        <Link className="button secondary" href="/login">Sign in to follow</Link>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
