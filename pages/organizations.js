import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setFormData({ name: '', slug: '', description: '' });
        fetchOrganizations();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to create organization:', error);
      alert('Failed to create organization');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: '#0070f3' }}>← Back to Home</Link>
      </div>

      <h1>Organizations</h1>

      <div style={{ marginBottom: '3rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>Create New Organization</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Organization Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Slug (e.g., my-org)"
            value={formData.slug}
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            required
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '80px' }}
          />
          <button type="submit" style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Create Organization
          </button>
        </form>
      </div>

      <div>
        <h2>Existing Organizations</h2>
        {organizations.length === 0 ? (
          <p style={{ color: '#666' }}>No organizations yet. Create your first one above!</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {organizations.map(org => (
              <div key={org.uuid} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>{org.name}</h3>
                <p style={{ color: '#666', margin: '0 0 0.5rem 0' }}>/{org.slug}</p>
                {org.description && <p style={{ margin: '0 0 1rem 0' }}>{org.description}</p>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link href={`/cards?org=${org.uuid}`} style={{ padding: '0.25rem 0.5rem', background: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '0.875rem' }}>
                    Manage Cards
                  </Link>
                  <Link href={`/play?org=${org.uuid}`} style={{ padding: '0.25rem 0.5rem', background: '#ffc107', color: 'black', textDecoration: 'none', borderRadius: '4px', fontSize: '0.875rem' }}>
                    Play
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
