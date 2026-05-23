import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Image,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { EmptyState } from '@gds/core';
import { NarimatoShell } from '../components/NarimatoShell';

export default function Cards() {
  const router = useRouter();
  const { org } = router.query;

  const [organizations, setOrganizations] = useState([]);
  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    parentTag: '',
    isPlayable: true,
    isOnboarding: false,
  });
  const [editingCard, setEditingCard] = useState(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (org) fetchCards();
  }, [org, router.query.includeHidden]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      if (!org) setLoading(false);
    }
  };

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/cards?organizationId=${org}`);
      const data = await res.json();
      setCards(data.cards || []);

      const deckGroups = {};
      data.cards?.forEach((card) => {
        if (card.parentTag) {
          if (!deckGroups[card.parentTag]) deckGroups[card.parentTag] = [];
          deckGroups[card.parentTag].push(card);
        }
      });

      const includeHidden = router.query.includeHidden === 'true';
      const filtered = Object.entries(deckGroups)
        .filter(([, grpCards]) => grpCards.length >= 2)
        .filter(([tag]) => {
          const parent = data.cards.find((c) => c.name === tag);
          if (!parent) return true;
          return includeHidden ? true : parent.isPlayable !== false;
        });
      setDecks(filtered);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const parentOptions = [
    { value: '', label: 'Root card (no parent)' },
    ...cards
      .filter((card) => card.isParent && card.hasChildren)
      .map((parentCard) => ({
        value: parentCard.name,
        label: `${parentCard.name} (${parentCard.title})`,
      })),
    ...cards.map((card) => ({
      value: card.name,
      label: `${card.name} (${card.title})`,
    })),
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingCard !== null;
      const url = isEditing ? `/api/cards/${editingCard.uuid}` : '/api/cards';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, organizationId: org }),
      });

      if (res.ok) {
        setFormData({
          title: '',
          description: '',
          imageUrl: '',
          parentTag: '',
          isPlayable: true,
          isOnboarding: false,
        });
        setEditingCard(null);
        fetchCards();
        notifications.show({ color: 'green', message: isEditing ? 'Card updated' : 'Card created' });
      } else {
        const error = await res.json();
        notifications.show({ color: 'red', message: error.error || 'Save failed' });
      }
    } catch {
      notifications.show({ color: 'red', message: 'Failed to save card' });
    }
  };

  const handleEdit = (card) => {
    setEditingCard(card);
    setFormData({
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl,
      parentTag: card.parentTag || '',
      isPlayable: typeof card.isPlayable === 'boolean' ? card.isPlayable : true,
      isOnboarding: typeof card.isOnboarding === 'boolean' ? card.isOnboarding : false,
    });
  };

  const handleDelete = (card) => {
    modals.openConfirmModal({
      title: 'Delete card',
      children: <Text size="sm">Delete &quot;{card.title}&quot;?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await fetch(`/api/cards/${card.uuid}`, { method: 'DELETE' });
        if (res.ok) {
          fetchCards();
          notifications.show({ color: 'green', message: 'Card deleted' });
        } else {
          const error = await res.json();
          notifications.show({ color: 'red', message: error.error || 'Delete failed' });
        }
      },
    });
  };

  const cancelEdit = () => {
    setEditingCard(null);
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      parentTag: '',
      isPlayable: true,
      isOnboarding: false,
    });
  };

  if (!org) {
    return (
      <NarimatoShell title="Cards">
        <Stack gap="lg">
          <Title order={1}>Select organization</Title>
          {loading ? (
            <Loader />
          ) : organizations.length === 0 ? (
            <EmptyState
              title="No organizations"
              action={
                <Button component={Link} href="/organizations">
                  Create organization
                </Button>
              }
            />
          ) : (
            <Stack gap="md">
              {organizations.map((organization) => (
                <Paper key={organization.uuid} withBorder p="md" radius="md">
                  <Title order={4}>{organization.name}</Title>
                  <Button component={Link} href={`/cards?org=${organization.uuid}`} mt="sm">
                    Manage cards
                  </Button>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </NarimatoShell>
    );
  }

  if (loading) {
    return (
      <NarimatoShell title="Cards">
        <Loader />
      </NarimatoShell>
    );
  }

  return (
    <NarimatoShell title="Cards">
      <Stack gap="lg">
        <Title order={1}>Cards</Title>
        <Text c="dimmed">Organization: {org}</Text>

        <Paper withBorder p="md" radius="md">
          <Title order={3} mb="md" c={editingCard ? 'blue' : undefined}>
            {editingCard ? `Edit: ${editingCard.title}` : 'Create card'}
          </Title>
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
              <TextInput
                label="Image URL"
                value={formData.imageUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
              />
              <Select
                label="Parent tag"
                data={parentOptions}
                value={formData.parentTag}
                onChange={(value) => setFormData((prev) => ({ ...prev, parentTag: value || '' }))}
                searchable
                clearable
              />
              <Checkbox
                label="Playable (public)"
                checked={!!formData.isPlayable}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isPlayable: e.currentTarget.checked }))
                }
              />
              <Checkbox
                label="Onboarding (right-only intro deck)"
                checked={!!formData.isOnboarding}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isOnboarding: e.currentTarget.checked }))
                }
              />
              <Group>
                <Button type="submit">{editingCard ? 'Update' : 'Create'}</Button>
                {editingCard ? (
                  <Button variant="default" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                ) : null}
              </Group>
            </Stack>
          </form>
        </Paper>

        <Title order={2}>Playable decks ({decks.length})</Title>
        {decks.length === 0 ? (
          <Text c="dimmed">No playable decks yet.</Text>
        ) : (
          <Stack gap="md">
            {decks.map(([tag, deckCards]) => {
              const parent = cards.find((c) => c.name === tag);
              const isHidden = parent && parent.isPlayable === false;
              return (
                <Paper key={tag} withBorder p="md" radius="md">
                  <Group mb="sm">
                    <Title order={4} c="green">
                      {tag}
                    </Title>
                    <Badge color="green">{deckCards.length} cards</Badge>
                    {isHidden ? <Badge color="red">Hidden</Badge> : null}
                  </Group>
                  <Button component={Link} href={`/play?org=${org}`} color="orange" size="sm">
                    Play
                  </Button>
                </Paper>
              );
            })}
          </Stack>
        )}

        <Title order={2}>All cards ({cards.length})</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {cards.map((card) => (
            <Paper key={card.uuid} withBorder p="md" radius="md">
              {card.imageUrl ? (
                <Image src={card.imageUrl} alt={card.title} h={120} fit="cover" radius="sm" mb="sm" />
              ) : null}
              <Text fw={600}>{card.title}</Text>
              <Text size="sm" c="dimmed">
                {card.name}
              </Text>
              {card.parentTag ? (
                <Text size="xs" c="green">
                  Deck: {card.parentTag}
                </Text>
              ) : null}
              <Text size="xs" c="dimmed">
                Score {card.globalScore} · Votes {card.voteCount}
              </Text>
              <Group mt="sm">
                <Button size="xs" variant="light" onClick={() => handleEdit(card)}>
                  Edit
                </Button>
                <Button size="xs" color="red" variant="light" onClick={() => handleDelete(card)}>
                  Delete
                </Button>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        <Group justify="center">
          <Button component={Link} href={`/play?org=${org}`} variant="light">
            Play decks
          </Button>
          <Button component={Link} href={`/rankings?org=${org}`} variant="outline">
            Rankings
          </Button>
        </Group>
      </Stack>
    </NarimatoShell>
  );
}
