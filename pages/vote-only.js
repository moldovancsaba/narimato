import Link from 'next/link';

export async function getServerSideProps({ res }) {
  if (res) {
    res.statusCode = 410;
  }
  return { props: {} };
}

export default function VoteOnlyRemoved() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h1>🗳️ Vote-Only Mode Removed</h1>
      <p>This feature has been removed for security and compliance reasons.</p>
      <div style={{ marginTop: '1.5rem' }}>
        <Link href="/play" className="btn btn-primary">Return to Play</Link>
      </div>
    </div>
  );
}
