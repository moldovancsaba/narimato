import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

function OrganizationEditor() {
  const [organizations, setOrganizations] = useState([]);
  const [newOrg, setNewOrg] = useState({ name: '', slug: '', organizationUuid: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  // Generate UUID when component mounts
  useEffect(() => {
    setNewOrg(prev => ({
      ...prev,
      organizationUuid: uuidv4()
    }));
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/v1/admin/organizations');
      const data = await response.json();
      if (data.success) {
        setOrganizations(data.organizations);
      } else {
        setError('Failed to load organizations');
      }
    } catch (err) {
      setError('Error loading organizations');
    }
  };

  const generateNewUuid = () => {
    setNewOrg(prev => ({
      ...prev,
      organizationUuid: uuidv4()
    }));
  };

  const handleCreateOrganization = async () => {
    // Basic validation
    if (!newOrg.name.trim()) {
      setError('Organization name is required');
      return;
    }
    if (!newOrg.slug.trim()) {
      setError('Organization slug is required');
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(newOrg.slug)) {
      setError('Slug must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/v1/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOrg.name.trim(),
          slug: newOrg.slug.toLowerCase().trim()
          // UUID and database name are generated on the backend
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Organization "${data.organization.name}" created successfully!`);
        fetchOrganizations();
        // Reset form and generate new UUID
        setNewOrg({ name: '', slug: '', organizationUuid: uuidv4() });
      } else {
        setError(data.error || 'Failed to create organization');
      }
    } catch (err) {
      setError('Network error: Unable to create organization');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivateOrganization = async (id) => {
    try {
      const response = await fetch(`/api/v1/admin/organizations?id=${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Organization deactivated!');
        fetchOrganizations();
      } else {
        setError('Failed to deactivate organization');
      }
    } catch (err) {
      setError('Error deactivating organization');
    }
  };

  return (
    <div>
      <h1>Organization Editor</h1>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="organization-form">
        <h2>Create New Organization</h2>
        
        <div className="form-group">
          <label htmlFor="orgName">Organization Name *</label>
          <input
            id="orgName"
            type="text"
            placeholder="Enter organization name (e.g., 'Acme Corporation')"
            value={newOrg.name}
            onChange={e => setNewOrg({ ...newOrg, name: e.target.value })}
            disabled={isCreating}
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="orgSlug">URL Slug *</label>
          <input
            id="orgSlug"
            type="text"
            placeholder="Enter URL-friendly slug (e.g., 'acme-corp')"
            value={newOrg.slug}
            onChange={e => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase() })}
            disabled={isCreating}
            className="form-input"
          />
          <small className="form-help">Only lowercase letters, numbers, and hyphens allowed</small>
        </div>
        
        <div className="form-group">
          <label>Organization UUID</label>
          <div className="uuid-display">
            <code>{newOrg.organizationUuid}</code>
            <button 
              type="button" 
              onClick={generateNewUuid}
              disabled={isCreating}
              className="uuid-regenerate"
            >
              ↻ Regenerate
            </button>
          </div>
          <small className="form-help">Auto-generated unique identifier (used internally)</small>
        </div>
        
        <button 
          onClick={handleCreateOrganization}
          disabled={isCreating || !newOrg.name.trim() || !newOrg.slug.trim()}
          className="create-button"
        >
          {isCreating ? 'Creating Organization...' : 'Create Organization'}
        </button>
      </div>

      <div>
        <h2>Existing Organizations</h2>
        <ul>
          {organizations.map(org => (
            <li key={org.slug}>
              {org.name}
              <button onClick={() => handleDeactivateOrganization(org._id)}>Deactivate</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default OrganizationEditor;
