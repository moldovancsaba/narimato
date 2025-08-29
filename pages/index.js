import Link from 'next/link';

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
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link href="/organizations" style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
            Organizations
          </Link>
          <Link href="/cards" style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
            Cards
          </Link>
          <Link href="/play" style={{ padding: '0.5rem 1rem', background: '#ffc107', color: 'black', textDecoration: 'none', borderRadius: '4px' }}>
            Play
          </Link>
          <Link href="/rankings" style={{ padding: '0.5rem 1rem', background: '#6f42c1', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
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
