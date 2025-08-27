'use client';

// FUNCTIONAL: Full CRUD operations for organization management
// STRATEGIC: Eliminates system auto-creation of organizations and enforces user control

import { useState, useEffect } from 'react';
import { MinimalCSS } from '../lib/styles/minimal-design';

interface Organization {
  uuid: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export default function OrganizationEditor() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/v1/admin/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const url = editing 
      ? `/api/v1/admin/organizations/${editing}`
      : '/api/v1/admin/organizations';
    
    const method = editing ? 'PUT' : 'POST';
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await fetchOrganizations();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save organization:', error);
    }
  };

  const handleEdit = (org: Organization) => {
    setEditing(org.uuid);
    setFormData({
      name: org.name,
      slug: org.slug,
      description: org.description || '',
      isActive: org.isActive
    });
  };

  const handleDelete = async (uuid: string) => {
    if (confirm('Delete this organization?')) {
      try {
        const response = await fetch(`/api/v1/admin/organizations/${uuid}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          await fetchOrganizations();
        }
      } catch (error) {
        console.error('Failed to delete organization:', error);
      }
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      isActive: true
    });
  };

  if (loading) {
    return (
      <div className={MinimalCSS.centerContent}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className={MinimalCSS.container}>
      <h1 className={MinimalCSS.heading}>Organization Management</h1>
      
      <form onSubmit={handleSubmit} className={MinimalCSS.form}>
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className={MinimalCSS.input}
            required
          />
        </div>
        
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>Slug</label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({...formData, slug: e.target.value})}
            className={MinimalCSS.input}
            required
          />
        </div>
        
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className={MinimalCSS.textarea}
          />
        </div>
        
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
            />
            Active
          </label>
        </div>
        
        <div>
          <button type="submit" className={MinimalCSS.buttonPrimary}>
            {editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button 
              type="button" 
              onClick={resetForm}
              className={MinimalCSS.buttonSecondary + ' ml-2'}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className={MinimalCSS.subheading}>Existing Organizations</h2>
      
      <div className={MinimalCSS.list}>
        {organizations.map((org) => (
          <div key={org.uuid} className={MinimalCSS.listItem}>
            <div>
              <h3 className={MinimalCSS.subheading}>{org.name}</h3>
              <p>/{org.slug}</p>
              {org.description && <p>{org.description}</p>}
              <p>Status: {org.isActive ? 'Active' : 'Inactive'}</p>
            </div>
            <div>
              <button 
                onClick={() => handleEdit(org)}
                className={MinimalCSS.buttonSecondary + ' mr-2'}
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(org.uuid)}
                className={MinimalCSS.buttonDanger}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8">
        <a href="/" className={MinimalCSS.buttonSecondary}>
          Back to Organizations
        </a>
      </div>
    </div>
  );
}
