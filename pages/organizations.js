import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { EmptyState } from '@gds/core';
import { NarimatoShell } from '../components/NarimatoShell';
import { modals } from '@mantine/modals';

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
      notifications.show({ color: 'red', message: 'Failed to load organizations' });
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
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({ name: '', slug: '', description: '' });
        fetchOrganizations();
        notifications.show({ color: 'green', message: 'Organization created' });
      } else {
        const error = await res.json();
        notifications.show({ color: 'red', message: error.error || 'Create failed' });
      }
    } catch {
      notifications.show({ color: 'red', message: 'Failed to create organization' });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: editingOrg.uuid, ...editFormData }),
      });
      if (res.ok) {
        setEditingOrg(null);
        setEditFormData({ name: '', slug: '', description: '' });
        fetchOrganizations();
        notifications.show({ color: 'green', message: 'Organization updated' });
      } else {
        const error = await res.json();
        notifications.show({ color: 'red', message: error.error || 'Update failed' });
      }
    } catch {
      notifications.show({ color: 'red', message: 'Failed to update organization' });
    }
  };

  const handleDelete = (org) => {
    modals.openConfirmModal({
      title: 'Delete organization',
      children: <Text size="sm">Delete &quot;{org.name}&quot;? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await fetch('/api/organizations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuid: org.uuid }),
        });
        if (res.ok) {
          fetchOrganizations();
          notifications.show({ color: 'green', message: 'Organization deleted' });
        } else {
          const error = await res.json();
          notifications.show({ color: 'red', message: error.error || 'Delete failed' });
        }
      },
    });
  };

  const startEdit = (org) => {
    setEditingOrg(org);
    setEditFormData({
      name: org.name,
      slug: org.slug,
      description: org.description || '',
    });
  };

  const cancelEdit = () => {
    setEditingOrg(null);
    setEditFormData({ name: '', slug: '', description: '' });
  };

  if (loading) {
    return (
      <NarimatoShell title="Organizations">
        <Loader />
      </NarimatoShell>
    );
  }

  return (
    <NarimatoShell title="Organizations">
      <Stack gap="lg">
        <Title order={1}>Organizations</Title>

        <Paper withBorder p="md" radius="md">
          <Title order={3} mb="md">
            Create organization
          </Title>
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <TextInput
                label="Slug"
                placeholder="my-org"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                required
              />
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
              <Button type="submit">Create organization</Button>
            </Stack>
          </form>
        </Paper>

        <Title order={2}>Existing</Title>
        {organizations.length === 0 ? (
          <EmptyState title="No organizations" description="Create your first organization above." />
        ) : (
          <Stack gap="md">
            {organizations.map((org) => (
              <Paper key={org.uuid} withBorder p="md" radius="md">
                {editingOrg?.uuid === org.uuid ? (
                  <form onSubmit={handleUpdate}>
                    <Stack gap="sm">
                      <TextInput
                        label="Name"
                        value={editFormData.name}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                      <TextInput
                        label="Slug"
                        value={editFormData.slug}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, slug: e.target.value }))
                        }
                        required
                      />
                      <Textarea
                        label="Description"
                        value={editFormData.description}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, description: e.target.value }))
                        }
                      />
                      <Group>
                        <Button type="submit">Save</Button>
                        <Button variant="default" type="button" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </Group>
                    </Stack>
                  </form>
                ) : (
                  <Stack gap="xs">
                    <Title order={4}>{org.name}</Title>
                    <Text c="dimmed">/{org.slug}</Text>
                    <Text size="xs" c="dimmed">
                      {org.uuid}
                    </Text>
                    {org.description ? <Text>{org.description}</Text> : null}
                    <Group mt="sm">
                      <Button component={Link} href={`/cards?org=${org.uuid}`} size="sm">
                        Cards
                      </Button>
                      <Button
                        component={Link}
                        href={`/play?org=${org.uuid}`}
                        size="sm"
                        color="orange"
                      >
                        Play
                      </Button>
                      <Button size="sm" variant="light" onClick={() => startEdit(org)}>
                        Edit
                      </Button>
                      <Button size="sm" color="red" variant="light" onClick={() => handleDelete(org)}>
                        Delete
                      </Button>
                    </Group>
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </NarimatoShell>
  );
}
