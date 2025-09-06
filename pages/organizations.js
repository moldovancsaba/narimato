import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
  const [editingOrg, setEditingOrg] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', slug: '', description: '' });

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

  // FUNCTIONAL: Updates existing organization with new data
  // STRATEGIC: Allows organizations to modify their profile information
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: editingOrg.uuid,
          ...editFormData
        })
      });
      
      if (res.ok) {
        setEditingOrg(null);
        setEditFormData({ name: '', slug: '', description: '' });
        fetchOrganizations();
        alert('Organization updated successfully!');
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to update organization:', error);
      alert('Failed to update organization');
    }
  };

  // FUNCTIONAL: Soft deletes organization by setting isActive to false
  // STRATEGIC: Preserves data integrity while hiding organization from users
  const handleDelete = async (org) => {
    if (!confirm(`Are you sure you want to delete "${org.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/organizations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: org.uuid })
      });
      
      if (res.ok) {
        fetchOrganizations();
        alert('Organization deleted successfully!');
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to delete organization:', error);
      alert('Failed to delete organization');
    }
  };

  // FUNCTIONAL: Prepares organization data for editing
  // STRATEGIC: Allows in-place editing of organization details
  const startEdit = (org) => {
    setEditingOrg(org);
    setEditFormData({
      name: org.name,
      slug: org.slug,
      description: org.description || ''
    });
  };

  // FUNCTIONAL: Cancels editing mode
  // STRATEGIC: Provides escape from edit mode without saving changes
  const cancelEdit = () => {
    setEditingOrg(null);
    setEditFormData({ name: '', slug: '', description: '' });
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        {/* FUNCTIONAL: Standardize small back navigation button across pages */}
        {/* STRATEGIC: Centralized size and style via design system for consistency */}
        <Link href="/" className="btn btn-light btn-sm">← Back to Home</Link>
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
          <div style={{ textAlign: 'center' }}>
            {/* FUNCTIONAL: Promote primary creation action with large size */}
            {/* STRATEGIC: Clear visual hierarchy for primary CTA on the page */}
            <button type="submit" className="btn btn-primary btn-lg">
              ➕ Create Organization
            </button>
          </div>
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
                {editingOrg && editingOrg.uuid === org.uuid ? (
                  /* Edit Form */
                  <form onSubmit={handleUpdate} style={{ display: 'grid', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Organization Name"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      placeholder="Slug (e.g., my-org)"
                      value={editFormData.slug}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, slug: e.target.value }))}
                      required
                      style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                      style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
                    />
                    <div className="btn-group btn-group-tight" style={{ marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary btn-sm">
                        💾 Save Changes
                      </button>
                      <button type="button" onClick={cancelEdit} className="btn btn-muted btn-sm">
                        ❌ Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Display Mode */
                  <>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{org.name}</h3>
                    <p style={{ color: '#666', margin: '0 0 0.5rem 0' }}>/{org.slug}</p>
                    <p style={{ color: '#888', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>UUID: {org.uuid}</p>
                    {org.description && <p style={{ margin: '0 0 1rem 0' }}>{org.description}</p>}
                    <div className="btn-group btn-group-tight">
                      {/* FUNCTIONAL: Use mid-size (default) for secondary actions on cards */}
                      {/* STRATEGIC: Establish a consistent mid tier for common actions */}
                      <Link href={`/cards?org=${org.uuid}`} className="btn btn-primary">
                        🎴 Manage Cards
                      </Link>
                      <Link href={`/play?org=${org.uuid}`} className="btn btn-warning">
                        🎮 Play
                      </Link>
                      <button onClick={() => startEdit(org)} className="btn btn-info">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(org)} className="btn btn-secondary">
                        🗑️ Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
