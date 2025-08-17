'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import PageLayout from '../components/PageLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import { useOrganization } from '../components/OrganizationProvider';
import { useOrganizationTheme } from '../hooks/useOrganizationTheme';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-css';
import 'prismjs/themes/prism-tomorrow.css';

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
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    fontSize?: string;
    borderRadius?: string;
    spacing?: string;
    customCSS?: string;
    backgroundCSS?: string;
    googleFontURL?: string;
    emojiList?: string[];
    iconList?: string[];
  };
}

// Live Theme Preview Component
function LiveThemePreview({ theme }: { theme: Organization['theme'] }) {
  // Apply the theme temporarily for preview
  useOrganizationTheme(theme as any);
  
  return (
    <div className="mt-4 p-4 content-background">
      <h4 className="text-sm font-semibold mb-2">🔍 Live Preview</h4>
      <div className="text-sm text-muted mb-2">
        Changes will be applied immediately when you save. Background effects are visible on this page.
      </div>
      {theme?.emojiList && theme.emojiList.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-muted">Emojis: </span>
          {theme.emojiList.map((emoji, index) => (
            <span key={index} className="text-lg mr-1">{emoji}</span>
          ))}
        </div>
      )}
      {theme?.googleFontURL && (
        <div className="text-xs text-muted mb-2">
          Font URL: {theme.googleFontURL.substring(0, 50)}...
        </div>
      )}
      {theme?.backgroundCSS && (
        <div className="text-xs text-muted">
          Background CSS: {theme.backgroundCSS.length} characters
        </div>
      )}
    </div>
  );
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
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Organization "${data.organization.displayName}" created successfully!`);
        refreshOrganizations();
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
            subdomain: editingOrg.subdomain,
            theme: editingOrg.theme
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
    if (!confirm('This is your final warning. Are you absolutely sure?')) return;
    
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
      router.push(`/organization/${org.OrganizationSlug}/cards`); 
    } else {
      setError('Failed to switch to organization');
    }
  };

  if (loading) {
    return (
      <PageLayout title="Organization Editor" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organizations..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Organization Editor" fullscreen={true}>
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Status Messages */}
        {error && (
          <div className="status-error p-4 rounded-lg">{error}</div>
        )}
        {success && (
          <div className="status-success p-4 rounded-lg">{success}</div>
        )}

        <div className="flex flex-col xl:flex-row gap-6 flex-1">
          
          {/* Left Column: Create New Organization */}
          <div className="xl:w-1/3 space-y-6">
            <div className="content-background p-6">
              <h2 className="text-xl font-bold mb-4">Create New Organization</h2>
              <div className="space-y-4">
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
                    <code className="form-input bg-gray-100 dark:bg-gray-800 text-xs font-mono">{newOrg.organizationUuid}</code>
                    <button 
                      type="button" 
                      onClick={generateNewUuid}
                      disabled={isCreating}
                      className="btn btn-secondary btn-sm"
                    >
                      ↻
                    </button>
                  </div>
                </div>
                <button 
                  onClick={handleCreateOrganization}
                  className="btn btn-primary w-full"
                  disabled={isCreating || !newOrg.name.trim() || !newOrg.slug.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Right Column: Existing Organizations */}
          <div className="xl:w-2/3 flex flex-col">
            <div className="content-background p-6 flex-1 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Organizations ({organizations.length})</h2>
              
              {organizations.length === 0 ? (
                <div className="text-with-background p-8 text-center">
                  <p className="text-muted">No organizations found. Create your first organization above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {organizations.map(org => (
                    <div key={org.OrganizationUUID} className="content-background p-4">
                      {editingOrg?.OrganizationUUID === org.OrganizationUUID ? (
                        // Edit Mode - Full Featured
                        <div className="space-y-6">
                          
                          {/* Basic Organization Info */}
                          <div>
                            <h3 className="text-lg font-bold mb-4">Organization Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          </div>
                          
                          {/* Theme Management Section */}
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h3 className="text-lg font-bold mb-4">🎨 Theme Management</h3>
                            
                            {/* Color Settings */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                              <div>
                                <label className="form-label">Primary Color</label>
                                <input
                                  type="color"
                                  value={editingOrg?.theme?.primaryColor || '#667eea'}
                                  onChange={e => {
                                    if (editingOrg) {
                                      setEditingOrg({ 
                                        ...editingOrg, 
                                        theme: { ...editingOrg.theme, primaryColor: e.target.value } 
                                      });
                                    }
                                  }}
                                  className="form-input h-12"
                                />
                              </div>
                              <div>
                                <label className="form-label">Secondary Color</label>
                                <input
                                  type="color"
                                  value={editingOrg?.theme?.secondaryColor || '#764ba2'}
                                  onChange={e => {
                                    if (editingOrg) {
                                      setEditingOrg({ 
                                        ...editingOrg, 
                                        theme: { ...editingOrg.theme, secondaryColor: e.target.value } 
                                      });
                                    }
                                  }}
                                  className="form-input h-12"
                                />
                              </div>
                              <div>
                                <label className="form-label">Accent Color</label>
                                <input
                                  type="color"
                                  value={editingOrg?.theme?.accentColor || '#f093fb'}
                                  onChange={e => {
                                    if (editingOrg) {
                                      setEditingOrg({ 
                                        ...editingOrg, 
                                        theme: { ...editingOrg.theme, accentColor: e.target.value } 
                                      });
                                    }
                                  }}
                                  className="form-input h-12"
                                />
                              </div>
                            </div>
                            
                            {/* Background CSS Editor */}
                            <div className="mb-6">
                              <label className="form-label">Background CSS (Animated Backgrounds)</label>
                              <div className="text-with-background mb-2">
                                <p className="text-sm text-muted">
                                  Paste your CSS code for animated backgrounds. This will be applied to the .background-content layer.
                                </p>
                              </div>
                              <Editor
                                value={editingOrg?.theme?.backgroundCSS || ''}
                                onValueChange={css => {
                                  if (editingOrg) {
                                    setEditingOrg({ 
                                      ...editingOrg, 
                                      theme: { ...editingOrg.theme, backgroundCSS: css } 
                                    });
                                  }
                                }}
                                highlight={code => Prism.highlight(code, Prism.languages.css, 'css')}
                                padding={10}
                                className="min-h-[200px] bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-600 font-mono text-sm"
                                style={{
                                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                  fontSize: 14,
                                  lineHeight: '1.5'
                                }}
                              />
                            </div>
                            
                            {/* Google Fonts URL */}
                            <div className="mb-6">
                              <label className="form-label">Google Fonts URL</label>
                              <div className="text-with-background mb-2">
                                <p className="text-sm text-muted">
                                  Paste the Google Fonts CSS2 URL to apply organization-wide font.
                                </p>
                              </div>
                              <input
                                type="text"
                                value={editingOrg?.theme?.googleFontURL || ''}
                                onChange={e => {
                                  if (editingOrg) {
                                    setEditingOrg({ 
                                      ...editingOrg, 
                                      theme: { ...editingOrg.theme, googleFontURL: e.target.value } 
                                    });
                                  }
                                }}
                                className="form-input"
                                placeholder="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900"
                              />
                            </div>
                            
                            {/* Emoji List */}
                            <div className="mb-6">
                              <label className="form-label">Organization Emojis</label>
                              <div className="text-with-background mb-2">
                                <p className="text-sm text-muted">
                                  Paste emojis separated by spaces: 😎🥵🤖
                                </p>
                              </div>
                              <input
                                type="text"
                                value={editingOrg?.theme?.emojiList?.join(' ') || ''}
                                onChange={e => {
                                  if (editingOrg) {
                                    const emojis = e.target.value.split(' ').filter(emoji => emoji.trim());
                                    setEditingOrg({ 
                                      ...editingOrg, 
                                      theme: { ...editingOrg.theme, emojiList: emojis } 
                                    });
                                  }
                                }}
                                className="form-input"
                                placeholder="😎 🥵 🤖 🎨 🚀 💎 ⚡ 🔥"
                              />
                              {editingOrg?.theme?.emojiList && editingOrg.theme.emojiList.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {editingOrg.theme.emojiList.map((emoji, index) => (
                                    <span key={index} className="text-2xl">{emoji}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Icon List */}
                            <div className="mb-6">
                              <label className="form-label">Organization Icons (URLs)</label>
                              <div className="text-with-background mb-2">
                                <p className="text-sm text-muted">
                                  Paste icon URLs, one per line:
                                </p>
                              </div>
                              <textarea
                                value={editingOrg?.theme?.iconList?.join('\n') || ''}
                                onChange={e => {
                                  if (editingOrg) {
                                    const icons = e.target.value.split('\n').filter(icon => icon.trim());
                                    setEditingOrg({ 
                                      ...editingOrg, 
                                      theme: { ...editingOrg.theme, iconList: icons } 
                                    });
                                  }
                                }}
                                className="form-input min-h-[100px]"
                                placeholder="https://i.ibb.co/4qcP9zc/home-96dp-FFFFFF-FILL0-wght400-GRAD0-opsz48.png"
                              />
                              {editingOrg?.theme?.iconList && editingOrg.theme.iconList.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {editingOrg.theme.iconList.map((iconUrl, index) => (
                                    <img 
                                      key={index} 
                                      src={iconUrl} 
                                      alt={`Icon ${index + 1}`} 
                                      className="w-8 h-8 object-contain bg-gray-100 dark:bg-gray-800 rounded p-1"
                                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Live Preview */}
                            <LiveThemePreview theme={editingOrg?.theme} />
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
                              <h3 className="text-lg font-semibold">{org.OrganizationName}</h3>
                              <div className="flex flex-wrap gap-4 text-sm">
                                <span className="text-with-background">Slug: {org.OrganizationSlug}</span>
                                <span className="text-with-background">DB: {org.databaseName}</span>
                                {org.subdomain && <span className="text-with-background">Subdomain: {org.subdomain}</span>}
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
                              onClick={() => window.open(`/organization/${org.OrganizationSlug}/cards`, '_blank')} 
                              className="btn btn-primary btn-sm"
                            >
                              🔗 Open Organization Page
                            </button>
                            <button 
                              onClick={() => window.open(`/organization/${org.OrganizationSlug}/ranks`, '_blank')} 
                              className="btn btn-secondary btn-sm"
                            >
                              🏆 View Rankings
                            </button>
                            <button 
                              onClick={() => handleSwitchToOrganization(org)} 
                              className="btn btn-outline btn-sm"
                            >
                              Switch Context
                            </button>
                            <button 
                              onClick={() => setEditingOrg({
                                ...org,
                                theme: org.theme || {
                                  primaryColor: '#667eea',
                                  secondaryColor: '#764ba2',
                                  accentColor: '#f093fb',
                                  backgroundColor: '#0a0a0a',
                                  textColor: '#ffffff',
                                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                  fontSize: '16px',
                                  borderRadius: '8px',
                                  spacing: '1rem',
                                  customCSS: '',
                                  backgroundCSS: '',
                                  googleFontURL: '',
                                  emojiList: [],
                                  iconList: []
                                }
                              })} 
                              className="btn btn-secondary btn-sm"
                            >
                              Edit Theme & Settings
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
                              className="btn btn-sm bg-red-700 hover:bg-red-800 text-white"
                              title="Permanently delete this organization and all its data"
                            >
                              🗑️ Delete Permanently
                            </button>
                          </div>
                          
                          <div className="text-with-background">
                            <div className="text-xs text-muted">
                              Created: {new Date(org.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
