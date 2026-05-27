import { useCallback, useEffect, useState } from 'react';
import { Collapse, Group, Loader, Paper, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ChoiceChip, ConfirmDialog, EmptyState, FormField, PageHeader, SemanticButton } from '@doneisbetter/gds-core/client';
import { slugifyOrganisationName } from './operatorCopy';
import { operatorApi } from '../../lib/operator/clientApi';

export function OperatorOrganizationsPanel({
  orgId,
  onOrgChange,
  onCreated,
  onOrganizationsChange,
}) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '' });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slugOverride, setSlugOverride] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const api = useCallback((path, opts) => operatorApi(path, opts), []);

  const load = useCallback(async () => {
    const { organizations: orgs } = await api('/api/organizations');
    setOrganizations(orgs || []);
    onOrganizationsChange?.(orgs || []);
    if (orgs?.length && !orgId) onOrgChange?.(orgs[0].uuid);
  }, [api, orgId, onOrgChange, onOrganizationsChange]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <Loader />;

  const suggestedSlug = slugifyOrganisationName(form.name);

  return (
    <Stack gap="lg">
      <PageHeader
        title="Your organisation"
        subtitle="This is the team or company name shown in your survey setup. Most people only need one organisation."
      />

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="xs">
          Add organisation
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          Example: “Acme Research”, “Marketing Team Q2”, or your client’s company name.
        </Text>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const slug = (showAdvanced && slugOverride.trim()) || suggestedSlug;
            if (!slug) {
              notifications.show({ color: 'red', message: 'Please enter a valid organisation name' });
              return;
            }
            try {
              const { organization } = await api('/api/organizations', {
                method: 'POST',
                body: JSON.stringify({
                  name: form.name.trim(),
                  slug,
                  description: form.description.trim(),
                }),
              });
              setForm({ name: '', description: '' });
              setSlugOverride('');
              setShowAdvanced(false);
              notifications.show({
                color: 'green',
                title: 'Organisation created',
                message: 'Next, set up your test survey on the Home tab.',
              });
              await load();
              if (organization?.uuid) {
                onOrgChange?.(organization.uuid);
                onCreated?.(organization.uuid);
              }
            } catch (err) {
              notifications.show({ color: 'red', message: err.message });
            }
          }}
        >
          <Stack gap="sm">
            <FormField label="Organisation name">
              <TextInput
                placeholder="e.g. Acme Research"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Description (optional)">
              <Textarea
                placeholder="Internal note — participants do not see this"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>
            <ChoiceChip
              label={showAdvanced ? 'Hide advanced options' : 'Advanced options'}
              onClick={() => setShowAdvanced((v) => !v)}
              size="xs"
            />
            <Collapse in={showAdvanced}>
              <FormField
                label="Short URL name"
                description={suggestedSlug ? `Suggested: ${suggestedSlug}` : 'Used internally — lowercase, no spaces'}
              >
                <TextInput
                  value={slugOverride}
                  onChange={(e) => setSlugOverride(e.target.value)}
                  placeholder={suggestedSlug || 'acme-research'}
                />
              </FormField>
            </Collapse>
            <SemanticButton type="submit" action="add" />
          </Stack>
        </form>
      </Paper>

      {organizations.length === 0 ? (
        <EmptyState title="No organisations yet" description="Create one above to continue." />
      ) : (
        <Stack gap="md">
          <Text fw={600}>Your organisations</Text>
          {organizations.map((org) => (
            <Paper
              key={org.uuid}
              withBorder
              p="md"
              radius="md"
              style={{ borderColor: orgId === org.uuid ? 'var(--mantine-color-violet-4)' : undefined }}
            >
              {editing?.uuid === org.uuid ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api('/api/organizations', {
                        method: 'PUT',
                        body: JSON.stringify({ uuid: org.uuid, ...editForm }),
                      });
                      setEditing(null);
                      notifications.show({ color: 'green', message: 'Saved' });
                      await load();
                    } catch (err) {
                      notifications.show({ color: 'red', message: err.message });
                    }
                  }}
                >
                  <Stack gap="sm">
                    <FormField label="Name">
                      <TextInput value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required />
                    </FormField>
                    <FormField label="Short URL name">
                      <TextInput value={editForm.slug} onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value }))} required />
                    </FormField>
                    <FormField label="Description">
                      <Textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
                    </FormField>
                    <Group>
                      <SemanticButton type="submit" action="save" />
                      <SemanticButton
                        variant="default"
                        type="button"
                        action="cancel"
                        onClick={() => setEditing(null)}
                      />
                    </Group>
                  </Stack>
                </form>
              ) : (
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Text fw={600}>{org.name}</Text>
                      {org.description ? <Text size="sm" c="dimmed">{org.description}</Text> : null}
                    </Stack>
                    {orgId === org.uuid ? (
                      <Text size="xs" c="violet" fw={600}>
                        Selected
                      </Text>
                    ) : null}
                  </Group>
                  <Group mt="sm">
                    {orgId !== org.uuid ? (
                      <SemanticButton
                        action="check"
                        size="xs"
                        variant="light"
                        onClick={() => onOrgChange?.(org.uuid)}
                      />
                    ) : null}
                    <SemanticButton
                      action="edit"
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        setEditing(org);
                        setEditForm({ name: org.name, slug: org.slug, description: org.description || '' });
                      }}
                    />
                    <SemanticButton
                      action="delete"
                      size="xs"
                      variant="subtle"
                      onClick={() => setDeleteTarget(org)}
                    />
                  </Group>
                </Stack>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      <ConfirmDialog
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          setDeleteLoading(true);
          try {
            await api('/api/organizations', {
              method: 'DELETE',
              body: JSON.stringify({ uuid: deleteTarget.uuid }),
            });
            notifications.show({ color: 'green', message: 'Organisation deleted' });
            setDeleteTarget(null);
            await load();
          } catch (err) {
            notifications.show({ color: 'red', message: err.message });
          } finally {
            setDeleteLoading(false);
          }
        }}
        title="Delete organisation?"
        confirmAction="delete"
        isDanger
        loading={deleteLoading}
      >
        <Text size="sm">
          Delete &quot;{deleteTarget?.name}&quot; and all its survey content? This cannot be undone.
        </Text>
      </ConfirmDialog>
    </Stack>
  );
}
