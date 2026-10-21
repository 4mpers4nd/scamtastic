import Header from '@/components/Header';
import FollowingActivityFeed from '@/components/activity/FollowingActivityFeed';

export default function ActivityPage() {
  return (
    <>
      <Header />
      <main className="activityPage">
        <div className="adminPageHeading">
          <div className="tag">// SOCIAL SIGNAL</div>
          <h1>Following activity</h1>
          <p>Recent public gameplay moments from players in your network.</p>
        </div>
        <FollowingActivityFeed />
      </main>
    </>
  );
}
