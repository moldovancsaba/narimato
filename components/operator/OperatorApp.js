import { useEffect, useState } from 'react';
import { Stack } from '@mantine/core';
import { NarimatoOperatorShell } from './NarimatoOperatorShell';
import { OperatorDashboard } from './OperatorDashboard';
import { OperatorOrganizationsPanel } from './OperatorOrganizationsPanel';
import { OperatorCardsPanel } from './OperatorCardsPanel';
import { OperatorSurveyPanel } from './OperatorSurveyPanel';
import { LocalOperatorConsole } from './LocalOperatorConsole';
import { OperatorOrgPicker } from './OperatorOrgPicker';
import { operatorApi } from '../../lib/operator/clientApi';

export function OperatorApp({ apiBase, embedded = false }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orgId, setOrgId] = useState('');
  const [organizations, setOrganizations] = useState([]);

  const loadOrganizations = () =>
    operatorApi('/api/organizations', {}, apiBase)
      .then(({ organizations: orgs }) => {
        setOrganizations(orgs || []);
        if (orgs?.length && !orgId) setOrgId(orgs[0].uuid);
        return orgs;
      })
      .catch(() => []);

  useEffect(() => {
    loadOrganizations();
  }, [apiBase]);

  const orgPicker =
    activeTab !== 'organizations' ? (
      <OperatorOrgPicker
        organizations={organizations}
        orgId={orgId}
        onOrgChange={setOrgId}
        onCreateClick={() => setActiveTab('organizations')}
        compact={activeTab === 'dashboard'}
      />
    ) : null;

  const panel = (() => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <OperatorDashboard
            orgId={orgId}
            organizations={organizations}
            onSelectTab={setActiveTab}
          />
        );
      case 'organizations':
        return (
          <OperatorOrganizationsPanel
            orgId={orgId}
            onOrgChange={setOrgId}
            onCreated={(uuid) => {
              setOrgId(uuid);
              setActiveTab('dashboard');
            }}
            onOrganizationsChange={setOrganizations}
          />
        );
      case 'cards':
        return <OperatorCardsPanel orgId={orgId} />;
      case 'intelligence':
        return (
          <LocalOperatorConsole apiBase={apiBase} orgId={orgId} hideOrgManagement simplified />
        );
      case 'survey':
        return <OperatorSurveyPanel orgId={orgId} />;
      default:
        return null;
    }
  })();

  return (
    <NarimatoOperatorShell activeTab={activeTab} onTabChange={setActiveTab}>
      <Stack gap="lg">
        {orgPicker}
        {panel}
      </Stack>
    </NarimatoOperatorShell>
  );
}
