'use client';

// FUNCTIONAL: Root page showing only organization list
// STRATEGIC: Prevents default organization creation and enforces user-driven organization management

import { useState, useEffect } from 'react';
import { MinimalCSS } from './lib/styles/minimal-design';

interface Organization {
  uuid: string;
  slug: string;
  name: string;
}

export default function RootPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/v1/organizations');
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

  if (loading) {
    return (
      <div className={MinimalCSS.centerContent}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className={MinimalCSS.container}>
      <h1 className={MinimalCSS.heading}>Organizations</h1>
      
      {organizations.length === 0 ? (
        <div className={MinimalCSS.card}>
          <p>No organizations found.</p>
          <a 
            href="/organization-editor" 
            className={MinimalCSS.buttonPrimary + ' inline-block mt-4'}
          >
            Create Organization
          </a>
        </div>
      ) : (
        <div className={MinimalCSS.list}>
          {organizations.map((org) => (
            <div key={org.uuid} className={MinimalCSS.listItem}>
              <h3 className={MinimalCSS.subheading}>{org.name}</h3>
              <a 
                href={`/organization/${org.slug}`}
                className={MinimalCSS.buttonPrimary + ' mr-2'}
              >
                View
              </a>
              <a 
                href="/organization-editor"
                className={MinimalCSS.buttonSecondary}
              >
                Manage Organizations
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
