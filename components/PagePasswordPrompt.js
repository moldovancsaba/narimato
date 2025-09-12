// FUNCTIONAL: Client prompt for entering a page-specific password
// STRATEGIC: Enforces per-organization Play access while allowing admin bypass via cookie

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PagePasswordPrompt({ organizationId, pageId, pageType = 'play', onSuccess }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Admin bypass: if admin cookie/session exists, authorize immediately
    (async () => {
      try {
        const res = await fetch('/api/system/admin/auth');
        if (res.ok) {
          // Store admin authorization for 7 days
          storeAuth(organizationId, pageType, pageId, true);
          onSuccess?.(true);
          return; // no need to try link password when admin
        }
      } catch {}

      // If a shareable link contained a password (?pp=...), try auto-validate once
      try {
        const params = new URLSearchParams(window.location.search);
        const pp = params.get('pp');
        if (pp) {
          const r = await fetch('/api/system/page-passwords', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId, pageId, pageType, password: pp })
          });
          if (r.ok) {
            const data = await r.json();
            if (data.isValid) {
              storeAuth(organizationId, pageType, pageId, false);
              onSuccess?.(false);
            }
          }
        }
      } catch {}
    })();
  }, [organizationId, pageId, pageType, onSuccess]);

  function storeAuth(orgId, type, id, isAdmin = false) {
    const key = `auth_${orgId}_${type}_${id}`;
    const ttlMs = isAdmin ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7d admin, 24h page
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    try {
      sessionStorage.setItem(key, JSON.stringify({ isAdmin, expiresAt }));
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/system/page-passwords', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, pageId, pageType, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to validate password');
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      if (data.isValid) {
        storeAuth(organizationId, pageType, pageId, false);
        onSuccess?.(false);
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ width: 'min(420px, 90vw)', background: '#111', border: '1px solid #333', borderRadius: 8, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Enter Access Password</h2>
        <p style={{ marginTop: 0, marginBottom: 16, color: '#bbb', fontSize: 14 }}>
          This page is protected for organization access. Please enter the password to continue.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #444', outline: 'none', background: '#0b0b0b', color: '#fff' }}
            autoFocus
          />
          {error && (
            <div style={{ color: '#ff6b6b', marginTop: 8, fontSize: 13 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="submit"
              disabled={submitting || !password}
              className="btn btn-primary"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#0d6efd', color: '#fff', fontWeight: 600 }}
            >
              {submitting ? 'Checking…' : 'Continue'}
            </button>
            <Link
              href="/"
              className="btn btn-secondary"
              style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #444', color: '#ddd', textDecoration: 'none' }}
            >
              Cancel
            </Link>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
            Admin? Log in via your admin panel to bypass this prompt.
          </div>
        </form>
      </div>
    </div>
  );
}
