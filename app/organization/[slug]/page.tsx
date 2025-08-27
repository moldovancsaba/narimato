'use client';

// FUNCTIONAL: Organization landing page with navigation to core functions
// STRATEGIC: Organization-scoped entry point with minimal navigation

import { useState, useEffect } from 'react';
import { MinimalCSS } from '../../lib/styles/minimal-design';

interface Props {
  params: { slug: string }
}

interface Organization {
  uuid: string;
  name: string;
  slug: string;
  description?: string;
}

export default function OrganizationPage({ params }: Props) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganization();
  }, [params.slug]);

  const fetchOrganization = async () => {
    try {
      const response = await fetch(`/api/v1/organizations/${params.slug}`);
      if (response.ok) {
        const data = await response.json();
        setOrganization(data.organization);
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error);
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

  if (!organization) {
    return (
      <div className={MinimalCSS.centerContent}>
        <div className={MinimalCSS.card}>
          <h1 className={MinimalCSS.heading}>Organization Not Found</h1>
          <p>/{params.slug}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={MinimalCSS.container}>
      <h1 className={MinimalCSS.heading}>{organization.name}</h1>
      {organization.description && <p className={MinimalCSS.textMuted}>{organization.description}</p>}
      
      <div className={MinimalCSS.grid + ' ' + MinimalCSS.gridCols2}>
        <div className={MinimalCSS.card}>
          <h2 className={MinimalCSS.subheading}>Card Management</h2>
          <a 
            href={`/organization/${params.slug}/card-editor`}
            className={MinimalCSS.buttonPrimary}
          >
            Manage Cards
          </a>
        </div>
        
        <div className={MinimalCSS.card}>
          <h2 className={MinimalCSS.subheading}>Play Game</h2>
          <a 
            href={`/organization/${params.slug}/play`}
            className={MinimalCSS.buttonPrimary}
          >
            Start Playing
          </a>
        </div>
        
        <div className={MinimalCSS.card}>
          <h2 className={MinimalCSS.subheading}>View Rankings</h2>
          <a 
            href={`/organization/${params.slug}/rank`}
            className={MinimalCSS.buttonPrimary}
          >
            View Results
          </a>
        </div>
      </div>
    </div>
  );
}
