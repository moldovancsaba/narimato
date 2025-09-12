// FUNCTIONAL: Landing page linking to core flows (Organizations, Cards, Play, Rankings)
// STRATEGIC: Provides a simple, low-friction entry to main features (no breadcrumbs per policy)
import Link from 'next/link';
import { getSessionUser } from '../lib/system/userAuth';

export async function getServerSideProps(ctx) {
  // FUNCTIONAL: Secure homepage for admins only; redirect unauthenticated users to admin login.
  // STRATEGIC: Home acts as an administrative entry point; end-user surfaces remain public (/play, /rankings).
  const user = getSessionUser(ctx.req);
  if (!user) {
    const next = encodeURIComponent(ctx.resolvedUrl || '/');
    return { redirect: { destination: `/admin/login?next=${next}`, permanent: false } };
  }
  return { props: {} };
}

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>NARIMATO - Card Ranking System</h1>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Features:</h2>
        <ul>
          <li><strong>Organizations</strong> - Manage different groups</li>
          <li><strong>Cards</strong> - Create cards with hashtag-based hierarchy</li>
          <li><strong>Decks</strong> - Cards with children are playable decks</li>
          <li><strong>Play</strong> - Rank cards using swipe (like/dislike) and vote (compare)</li>
          <li><strong>Rankings</strong> - Personal (Binary Search) + Global (ELO)</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Quick Links:</h2>
        <div className="btn-group">
          <Link href="/organizations" className="btn btn-info">
            Organizations
          </Link>
          <Link href="/cards" className="btn btn-primary">
            🎴 Cards
          </Link>
          <Link href="/play" className="btn btn-warning">
            🎮 Play
          </Link>
          <Link href="/rankings" className="btn btn-dark">
            Rankings
          </Link>
        </div>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
        <h3>How it works:</h3>
        <ol>
          <li>Create an <strong>Organization</strong></li>
          <li>Add <strong>Cards</strong> with parent hashtags (e.g., #food → #pizza, #burger)</li>
          <li>Cards with children become <strong>Decks</strong></li>
          <li><strong>Play</strong> a deck: swipe cards (like/dislike), vote on comparisons</li>
          <li>Get your <strong>Personal Ranking</strong> (binary search) and contribute to <strong>Global Rankings</strong> (ELO)</li>
        </ol>
      </div>
    </div>
  );
}
