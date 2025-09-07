import Link from 'next/link';

export async function getServerSideProps({ res }) {
  if (res) {
    res.statusCode = 410;
  }
  return { props: {} };
}

export default function VoteOnlyResultsRemoved() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h1>🗳️ Vote-Only Results Unavailable</h1>
      <p>Vote-Only mode was removed. Results are no longer available.</p>
      <div style={{ marginTop: '1.5rem' }}>
        <Link href="/play" className="btn btn-primary">Return to Play</Link>
      </div>
    </div>
  );
}
