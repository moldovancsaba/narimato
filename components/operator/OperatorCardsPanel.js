import { useCallback, useEffect, useState } from 'react';
import {
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { EmptyState } from '@doneisbetter/gds-core/client';
import { NarimatoFormField } from '../NarimatoFormField';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { operatorApi } from '../../lib/operator/clientApi';

export function OperatorCardsPanel({ orgId }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '',
    name: '',
    description: '',
    parentTag: '',
    imageUrl: '',
  });

  const api = useCallback((path, opts) => operatorApi(path, opts), []);

  const load = useCallback(async () => {
    if (!orgId) {
      setCards([]);
      setLoading(false);
      return;
    }
    const { cards: list } = await api(`/api/cards?organizationId=${orgId}`);
    setCards(list || []);
    setLoading(false);
  }, [api, orgId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const parentOptions = [
    { value: '', label: 'Top level (not in a deck)' },
    ...cards.map((c) => ({ value: c.name, label: `${c.name} — ${c.title}` })),
  ];

  if (!orgId) {
    return (
      <EmptyState
        title="Choose an organisation"
        description="Use the selector above to edit survey cards."
      />
    );
  }

  if (loading) return <Loader />;

  const decks = Object.entries(
    cards.reduce((acc, card) => {
      if (card.parentTag) {
        acc[card.parentTag] = (acc[card.parentTag] || 0) + 1;
      }
      return acc;
    }, {})
  ).filter(([, count]) => count >= 2);

  return (
    <Stack gap="lg">
      <NarimatoPageHeader
        title="Survey cards"
        subtitle="Add or review the cards participants swipe and rank. For a quick start, use Home → Set up test survey."
      />

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="xs">
          Add a card
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          Cards belong to a deck. A deck needs at least two cards before participants can play it.
        </Text>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/api/cards', {
                method: 'POST',
                body: JSON.stringify({ organizationId: orgId, ...form, name: form.name || form.title }),
              });
              setForm({ title: '', name: '', description: '', parentTag: '', imageUrl: '' });
              notifications.show({ color: 'green', message: 'Card added' });
              await load();
            } catch (err) {
              notifications.show({ color: 'red', message: err.message });
            }
          }}
        >
          <Stack gap="sm">
            <NarimatoFormField label="Card title" description="What participants read on the card">
              <TextInput
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </NarimatoFormField>
            <NarimatoFormField label="Tag (optional)" description="Internal name, e.g. #MyTopic — auto-created from title if empty">
              <TextInput
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="#MyCard"
              />
            </NarimatoFormField>
            <NarimatoFormField label="Description">
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </NarimatoFormField>
            <NarimatoFormField label="Image URL (optional)">
              <TextInput value={form.imageUrl} onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))} />
            </NarimatoFormField>
            <NarimatoFormField label="Deck" description="Which deck this card belongs to">
              <Select
                data={parentOptions}
                value={form.parentTag || ''}
                onChange={(v) => setForm((p) => ({ ...p, parentTag: v || '' }))}
                clearable
                searchable
              />
            </NarimatoFormField>
            <NarimatoSemanticButton type="submit" action="add" />
          </Stack>
        </form>
      </Paper>

      <Stack gap="sm">
        <Text fw={600}>Ready-to-play decks ({decks.length})</Text>
        {decks.length === 0 ? (
          <Text size="sm" c="dimmed">
            No decks ready yet. Add cards to the same deck, or use Home → Set up test survey for a demo deck.
          </Text>
        ) : (
          decks.map(([tag, count]) => (
            <Paper key={tag} withBorder p="sm" radius="md">
              <Group>
                <Text fw={600}>{tag}</Text>
                <Text size="sm" c="dimmed">
                  {count} cards
                </Text>
              </Group>
            </Paper>
          ))
        )}
      </Stack>

      <Stack gap="sm">
        <Text fw={600}>All cards ({cards.length})</Text>
        {cards.length === 0 ? (
          <EmptyState title="No cards yet" description="Add cards manually here, or set up a demo survey from the Home tab." />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {cards.slice(0, 24).map((card) => (
              <Paper key={card.uuid} withBorder p="sm" radius="md">
                <Text fw={600}>{card.title}</Text>
                {card.parentTag ? (
                  <Text size="xs" c="violet">
                    Deck: {card.parentTag}
                  </Text>
                ) : null}
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Stack>
  );
}
