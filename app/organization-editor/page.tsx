'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import PageLayout from '../components/PageLayout';
import { useOrganization } from '../components/OrganizationProvider';

interface Organization {
  OrganizationUUID: string;
  OrganizationName: string;
  OrganizationSlug: string;
  OrganizationDescription?: string;
  databaseName: string;
  subdomain?: string;
  isActive: boolean;
  createdAt: string;
  databaseHealth?: {
    connected: boolean;
    message: string;
  };
}

export default function OrganizationEditorPage() {
  const { organizations, isLoading: loading, refreshOrganizations, switchToOrganization } = useOrganization();
  const [newOrg, setNewOrg] = useState({ name: '', slug: '', organizationUuid: '' });
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  // Generate UUID when component mounts
  useEffect(() => {
    setNewOrg(prev => ({
      ...prev,
      organizationUuid: uuidv4()
    }));
  }, []);

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
        setSuccess(`Organization "${data.organization.displayName}" created successfully!`);
        refreshOrganizations();
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

  const handleUpdateOrganization = async () => {
    if (!editingOrg) return;
    
    try {
      setError(null);
      const response = await fetch('/api/v1/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationUUID: editingOrg.OrganizationUUID,
          updates: {
            OrganizationName: editingOrg.OrganizationName,
            OrganizationSlug: editingOrg.OrganizationSlug,
            databaseName: editingOrg.databaseName,
            subdomain: editingOrg.subdomain
          }
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Organization updated successfully!');
        refreshOrganizations();
        setEditingOrg(null);
      } else {
        setError('Failed to update organization: ' + data.error);
      }
    } catch (err) {
      setError('Error updating organization: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeactivateOrganization = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this organization?')) return;
    
    try {
      setError(null);
      const response = await fetch(`/api/v1/admin/organizations?uuid=${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Organization deactivated successfully!');
        refreshOrganizations();
      } else {
        setError('Failed to deactivate organization: ' + data.error);
      }
    } catch (err) {
      setError('Error deactivating organization: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeleteOrganizationPermanently = async (org: Organization) => {
    const confirmMessage = `Are you sure you want to PERMANENTLY DELETE "${org.OrganizationName}"?\n\nThis will:\n• Remove the organization from the database\n• Delete all associated data (cards, rankings, etc.)\n• Drop the database: ${org.databaseName}\n\nThis action CANNOT be undone!`;
    
    if (!confirm(confirmMessage)) return;
    
    // Double confirmation for destructive action
    if (!confirm('This is your final warning. Type "DELETE" to confirm permanent deletion.\n\nAre you absolutely sure?')) return;
    
    try {
      setError(null);
      const response = await fetch(`/api/v1/admin/organizations?uuid=${org.OrganizationUUID}&permanent=true`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Organization "${org.OrganizationName}" permanently deleted!`);
        refreshOrganizations();
      } else {
        setError('Failed to delete organization permanently: ' + data.error);
      }
    } catch (err) {
      setError('Error deleting organization: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSwitchToOrganization = async (org: Organization) => {
    const success = await switchToOrganization(org.OrganizationUUID);
    if (success) {
      setSuccess(`Switched to organization: ${org.OrganizationName}`);
      router.push('/cards'); 
    } else {
      setError('Failed to switch to organization');
    }
  };

  if (loading) {
    return (
      <PageLayout title="Organization Editor">
        <div className="flex items-center justify-center page-height">
          <div className="loading-spinner"></div>
          <span className="ml-2 text-lg">Loading organizations...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Organization Editor">
      <div className="max-w-6xl mx-auto space-y-8">
        {error && (
          <div className="status-error p-4 rounded-lg">{error}</div>
        )}
        
        {success && (
          <div className="status-success p-4 rounded-lg">{success}</div>
        )}

        {/* Create New Organization */}
        <div className="content-card">
          <h2 className="text-2xl font-bold mb-6">Create New Organization</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="form-label">Organization Name</label>
              <input
                type="text"
                placeholder="e.g., ACME Corporation"
                value={newOrg.name}
                onChange={e => setNewOrg({ ...newOrg, name: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Slug (URL identifier)</label>
              <input
                type="text"
                placeholder="e.g., acme-corp"
                value={newOrg.slug}
                onChange={e => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Organization UUID</label>
              <div className="flex items-center gap-2">
                <code className="form-input bg-gray-100 dark:bg-gray-800">{newOrg.organizationUuid}</code>
                <button 
                  type="button" 
                  onClick={generateNewUuid}
                  disabled={isCreating}
                  className="btn btn-secondary btn-sm"
                >
                  ↻ Regenerate
                </button>
              </div>
              <small className="text-xs text-muted">Auto-generated unique identifier (used internally)</small>
            </div>
          </div>
          <button 
            onClick={handleCreateOrganization}
            className="btn btn-primary"
            disabled={isCreating || !newOrg.name.trim() || !newOrg.slug.trim()}
          >
            {isCreating ? 'Creating Organization...' : 'Create Organization'}
          </button>
        </div>

        {/* Existing Organizations */}
        <div className="content-card">
          <h2 className="text-2xl font-bold mb-6">Existing Organizations ({organizations.length})</h2>
          
          {organizations.length === 0 ? (
            <p className="text-muted text-center py-8">No organizations found. Create your first organization above.</p>
          ) : (
            <div className="space-y-4">
              {organizations.map(org => (
                <div key={org.OrganizationUUID} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {editingOrg?.OrganizationUUID === org.OrganizationUUID ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="form-label">Name</label>
                          <input
                            type="text"
                            value={editingOrg?.OrganizationName || ''}
                            onChange={e => setEditingOrg(editingOrg ? { ...editingOrg, OrganizationName: e.target.value } : null)}
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="form-label">Slug</label>
                          <input
                            type="text"
                            value={editingOrg?.OrganizationSlug || ''}
                            onChange={e => setEditingOrg(editingOrg ? { ...editingOrg, OrganizationSlug: e.target.value } : null)}
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="form-label">Database Name</label>
                          <input
                            type="text"
                            value={editingOrg?.databaseName || ''}
                            onChange={e => setEditingOrg(editingOrg ? { ...editingOrg, databaseName: e.target.value } : null)}
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="form-label">Subdomain (optional)</label>
                          <input
                            type="text"
                            value={editingOrg?.subdomain || ''}
                            onChange={e => setEditingOrg(editingOrg ? { ...editingOrg, subdomain: e.target.value } : null)}
                            className="form-input"
                            placeholder="e.g., acme"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleUpdateOrganization} className="btn btn-success">
                          Save Changes
                        </button>
                        <button onClick={() => setEditingOrg(null)} className="btn btn-secondary">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">{org.OrganizationName}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted">
                            <span>Slug: {org.OrganizationSlug}</span>
                            <span>DB: {org.databaseName}</span>
                            {org.subdomain && <span>Subdomain: {org.subdomain}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {org.databaseHealth && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              org.databaseHealth.connected 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {org.databaseHealth.connected ? 'Connected' : 'Disconnected'}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            org.isActive 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {org.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <button 
                          onClick={() => handleSwitchToOrganization(org)} 
                          className="btn btn-primary btn-sm"
                        >
                          Switch & View Cards
                        </button>
                        <button 
                          onClick={() => setEditingOrg(org)} 
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        {org.isActive && (
                          <button 
                            onClick={() => handleDeactivateOrganization(org.OrganizationUUID)}
                            className="btn btn-danger btn-sm"
                          >
                            Deactivate
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteOrganizationPermanently(org)}
                          className="btn btn-sm bg-red-700 hover:bg-red-800 text-white border-red-700 hover:border-red-800"
                          title="Permanently delete this organization and all its data"
                        >
                          🗑️ Delete Permanently
                        </button>
                      </div>
                      
                      <div className="text-xs text-muted">
                        Created: {new Date(org.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
