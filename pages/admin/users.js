// FUNCTIONAL: Admin users management page
// STRATEGIC: Allows creation of users with generated passwords and lists existing users

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSessionUser } from '../../lib/system/userAuth';

export async function getServerSideProps(ctx) {
  // FUNCTIONAL: Server-side guard for admin users page (no client flicker).
  // STRATEGIC: Aligns all admin pages behind the same credential cookie.
  const user = getSessionUser(ctx.req);
  if (!user) {
    const next = encodeURIComponent(ctx.resolvedUrl || '/admin/users');
    return { redirect: { destination: `/admin/login?next=${next}`, permanent: false } };
  }
  return { props: {} };
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [lastPassword, setLastPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/login');
        if (!res.ok) {
          const next = encodeURIComponent('/admin/users');
          window.location.href = `/admin/login?next=${next}`;
          return;
        }
        const list = await fetch('/api/admin/users');
        if (list.ok) {
          const data = await list.json();
          setUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch (e) { setError('Failed to load users'); }
    })();
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    setLastPassword('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create user'); return; }
      setLastPassword(data.password || '');
      setEmail('');
      const list = await fetch('/api/admin/users');
      if (list.ok) setUsers((await list.json()).users || []);
    } catch { setError('Network error'); }
  }

  async function regenerate(email) {
    setError('');
    setLastPassword('');
    try {
      const res = await fetch('/api/admin/users/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to regenerate password'); return; }
      setLastPassword(data.password || '');
    } catch { setError('Network error'); }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/" className="btn btn-light btn-sm">← Back to Home</Link>
      </div>
      <h1>Admin Users</h1>
      <form onSubmit={createUser} style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%' }} required />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="superadmin">superadmin</option>
            <option value="admin">admin</option>
            <option value="editor">editor</option>
          </select>
        </div>
        <button className="btn btn-primary">Create User</button>
      </form>
      {error && <div style={{ color: '#f33', marginTop: 12 }}>{error}</div>}
      {lastPassword && (
        <div style={{ marginTop: 12, background: '#111', color: '#fff', padding: 12, borderRadius: 6 }}>
          Generated password: <code>{lastPassword}</code>
        </div>
      )}

      <h2 style={{ marginTop: '2rem' }}>Existing Users</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {users.map(u => (
          <div key={u.email} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
            <div><strong>{u.email}</strong> — {u.role}</div>
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => regenerate(u.email)}>Regenerate Password</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
