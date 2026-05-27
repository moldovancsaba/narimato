import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Grid, Group, Image, Loader, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { SemanticButton as NarimatoSemanticButton, StatusBadge } from '@doneisbetter/gds-core/client';
import { PageHeader as NarimatoPageHeader, PublicShell } from '@doneisbetter/gds-core/server';
import { event } from '../lib/analytics/ga';
import { useSurveyGate } from '../lib/hooks/useSurveyGate';
import { getPublicShellProps } from '../lib/ui/publicChrome';

function ResultCard({ card, rankLabel, meta }) {
  return (
    <Paper withBorder p="md" radius="md" w={{ base: '100%', sm: 360 }}>
      <Stack gap="xs">
        {card.imageUrl ? (
          <Image src={card.imageUrl} alt={card.title} h={120} fit="cover" radius="sm" />
        ) : null}
        <Text fw={700}>{card.title}</Text>
        {card.description ? (
          <Text size="sm" c="dimmed">
            {card.description}
          </Text>
        ) : null}
        <Text fw={600}>{rankLabel}</Text>
        {meta}
      </Stack>
    </Paper>
  );
}

export default function Results() {
  const router = useRouter();
  const { playId } = router.query;
  const queryOrg = router.query.org;
  const queryDeck = router.query.deck; // deckTag (parentTag)
  const mode = router.query.mode;

  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(null); // 'not-found' when 404

  const [globalRankings, setGlobalRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);

  const [cards, setCards] = useState([]);
  const [extraCards, setExtraCards] = useState([]); // fetched on-demand for any missing IDs
  const [cardsLoading, setCardsLoading] = useState(false);

  const [copySuccess, setCopySuccess] = useState('');

  // Derive deckTag from query or results payloads (engines differ)
  const derivedDeck = useMemo(() => {
    return queryDeck || results?.deckTag || results?.sessionInfo?.deckTag || '';
  }, [queryDeck, results]);

  // NOTE: We assume org comes from the query (as per existing flows). If missing, you can derive it
  // by fetching any card's organizationId from /api/cards/[uuid]. For simplicity and consistency
  // with current routes, we keep queryOrg as authoritative here.
  const [orgFromCard, setOrgFromCard] = useState('');
  const [orgFromMeta, setOrgFromMeta] = useState('');
  const org =
    queryOrg ||
    orgFromCard ||
    orgFromMeta ||
    results?.organizationId ||
    results?.sessionInfo?.organizationId ||
    '';
  const deck = derivedDeck;

  useSurveyGate(org);

  useEffect(() => {
    if (!playId) return;
    setResultsLoading(true);
    setRankingsLoading(true); // will be cleared after global fetch
    setCardsLoading(true);    // will be cleared after cards fetch
    fetchResults();
  }, [playId]);

  // Once we know the deck (from query or results), fetch deck-scoped globals and cards
  useEffect(() => {
    if (!playId) return;
    if (!deck) return; // wait until deck is known

    if (!org && playId) {
      fetch(`/api/v1/play/${encodeURIComponent(playId)}/meta`)
        .then((r) => (r.ok ? r.json() : null))
        .then((meta) => {
          if (meta?.organizationId) setOrgFromMeta(meta.organizationId);
        })
        .catch(() => {});
    }

    if (!org && results) {
      const candidateId =
        (Array.isArray(results.ranking) && (results.ranking[0]?.card?.id || results.ranking[0]?.cardId)) ||
        (Array.isArray(results.personalRanking) && results.personalRanking[0]) ||
        '';
      const knownOrg =
        results.organizationId || results.sessionInfo?.organizationId || queryOrg || '';
      if (candidateId && knownOrg) {
        fetch(`/api/cards/${encodeURIComponent(candidateId)}?organizationId=${encodeURIComponent(knownOrg)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((card) => {
            if (card?.organizationId) setOrgFromCard(card.organizationId);
          })
          .catch(() => {});
      }
    }

    const resolvedOrg =
      queryOrg ||
      orgFromMeta ||
      orgFromCard ||
      results?.organizationId ||
      results?.sessionInfo?.organizationId ||
      '';
    if (!resolvedOrg) return;

    fetchGlobalRankings(resolvedOrg, deck);
    fetchCards(resolvedOrg, deck);
  }, [playId, results, queryOrg, orgFromMeta, orgFromCard, deck]);

  // FUNCTIONAL: Track results page engagement
  // STRATEGIC: Measures post-play behavior and results consumption (production-only)
  useEffect(() => {
    if (results && playId) {
      event('results_view', {
        playId,
        org,
        deck,
        mode
      });
    }
  }, [results, playId, org, deck, mode]);

  const fetchResults = async () => {
    try {
      setResultsError(null);
      // Use unified results API for all modes
      const apiEndpoint = `/api/v1/play/${playId}/results`;
      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else if (res.status === 404) {
        setResultsError('not-found');
      } else {
        console.error('Failed to fetch results');
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setResultsLoading(false);
    }
  };

  const fetchGlobalRankings = async (organizationId, deckTag) => {
    try {
      const params = new URLSearchParams({ organizationId });
      if (deckTag) params.set('parentTag', deckTag);
      const res = await fetch(`/api/cards/rankings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGlobalRankings(data.rankings || []);
      } else {
        console.error('Failed to fetch global rankings');
      }
    } catch (error) {
      console.error('Failed to fetch global rankings:', error);
    } finally {
      setRankingsLoading(false);
    }
  };

  const fetchCards = async (organizationId, deckTag) => {
    try {
      const params = new URLSearchParams({ organizationId });
      if (deckTag) params.set('parentTag', deckTag);
      const res = await fetch(`/api/cards?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setCardsLoading(false);
    }
  };

  const cardsMap = useMemo(() => {
    const map = new Map();
    [...cards, ...extraCards].forEach(c => { if (c?.uuid) map.set(c.uuid, c); });
    return map;
  }, [cards, extraCards]);

  const getCardDetails = (cardId) => {
    return cardsMap.get(cardId) || { title: 'Unknown Card', description: '' };
  };

  // Ensure global rankings include every card in the deck (append zero-vote cards at the end)
  const fullGlobalRankings = useMemo(() => {
    const base = Array.isArray(globalRankings) ? [...globalRankings] : [];
    const baseIds = new Set(base.map(r => r.cardId));
    const deckIds = cards.map(c => c.uuid);
    const missing = deckIds
      .filter(id => !baseIds.has(id))
      .map((id, idx) => {
        const c = cardsMap.get(id);
        return {
          rank: base.length + idx + 1,
          cardId: id,
          globalScore: (c && c.globalScore) || 1500,
          voteCount: (c && c.voteCount) || 0,
          winCount: (c && c.winCount) || 0,
          winRate: 0,
        };
      });
    return [...base, ...missing];
  }, [globalRankings, cards, cardsMap]);

  const getGlobalRank = (cardId) => {
    const rank = fullGlobalRankings.findIndex(ranking => ranking.cardId === cardId);
    return rank >= 0 ? rank + 1 : null;
  };

  const personalIds = useMemo(() => {
    if (!results) return [];
    if (Array.isArray(results.ranking) && results.ranking.length > 0) {
      return results.ranking.map(r => r.card?.id || r.cardId).filter(Boolean);
    }
    if (Array.isArray(results.personalRanking)) return results.personalRanking;
    return [];
  }, [results]);

  const summary = useMemo(() => {
    const globalIds = fullGlobalRankings.map(r => r.cardId);
    const pTop = personalIds.slice(0, 3);
    const pLast = personalIds.length > 0 ? personalIds[personalIds.length - 1] : null;
    const gTop = globalIds.slice(0, 3);
    const gLast = globalIds.length > 0 ? globalIds[globalIds.length - 1] : null;
    return {
      personalTop3: pTop,
      personalLast: pLast,
      globalTop3: gTop,
      globalLast: gLast
    };
  }, [personalIds, globalRankings]);

  const copyToClipboard = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setCopySuccess('✅ Link copied!');
      setTimeout(() => setCopySuccess(''), 3000);
    } catch (err) {
      setCopySuccess('❌ Failed to copy');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  const shareResults = async () => {
    const currentUrl = window.location.href;
    const shareData = {
      title: `My ${deck} Ranking Results - Narimato`,
      text: `Check out my personal ranking results for the ${deck} deck!`,
      url: currentUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to copy link
        copyToClipboard();
      }
    } catch (err) {
      console.log('Error sharing:', err);
      copyToClipboard(); // Fallback
    }
  };

  // Proactively fetch any missing card details needed for rendering
  useEffect(() => {
    if (!playId) return;
    const needed = new Set([
      ...personalIds,
      ...globalRankings.map(r => r.cardId)
    ]);
    const known = new Set([
      ...cards.map(c => c.uuid),
      ...extraCards.map(c => c.uuid)
    ]);
    const missing = [...needed].filter(id => id && !known.has(id));
    if (missing.length === 0) return;

    const cardOrg =
      queryOrg ||
      orgFromMeta ||
      orgFromCard ||
      results?.organizationId ||
      results?.sessionInfo?.organizationId ||
      '';
    if (!cardOrg) return;

    Promise.all(
      missing.map((id) =>
        fetch(
          `/api/cards/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(cardOrg)}`
        ).then((r) => (r.ok ? r.json() : null))
      )
    ).then(list => {
      const toAdd = list.filter(c => c && c.uuid && !known.has(c.uuid));
      if (toAdd.length > 0) setExtraCards(prev => [...prev, ...toAdd]);
    }).catch(() => {});
  }, [playId, personalIds, globalRankings, cards, extraCards]);

  const loading = resultsLoading || rankingsLoading || cardsLoading;

  if (loading) {
    return (
      <PublicShell {...getPublicShellProps('home', { containerSize: 'lg' })}>
        <Loader />
      </PublicShell>
    );
  }

  if (resultsError === 'not-found') {
    return (
      <PublicShell {...getPublicShellProps('home', { containerSize: 'lg' })}>
        <Stack gap="md">
          <NarimatoPageHeader title="Results not found" subtitle="Unable to load results for this play session." />
          <NarimatoSemanticButton action="back" component={Link} href="/play" variant="light" />
        </Stack>
      </PublicShell>
    );
  }

  if (!results) {
    return (
      <PublicShell {...getPublicShellProps('home', { containerSize: 'lg' })}>
        <Loader />
      </PublicShell>
    );
  }

  const modeLabel =
    mode === 'swipe-only'
      ? 'Swipe only'
      : mode === 'swipe-more'
        ? 'Swipe + vote'
        : mode === 'vote-only'
          ? 'Vote only'
          : mode === 'vote-more'
            ? 'Vote more'
            : mode === 'rank-only'
              ? 'Rank only'
              : mode;

  const rowCount = Math.max(
    Array.isArray(results.ranking)
      ? results.ranking.length
      : Array.isArray(results.personalRanking)
        ? results.personalRanking.length
        : 0,
    fullGlobalRankings.length
  );

  return (
    <PublicShell {...getPublicShellProps('home', { containerSize: 'lg' })}>
      <Stack gap="lg" maw={1100} mx="auto">
        <Stack align="center" gap="xs">
          <NarimatoPageHeader
            title={`Your ${deck} results`}
            subtitle={
              mode === 'swipe-only'
                ? 'Swipe-based preference ranking'
                : mode === 'swipe-more'
                  ? 'Hybrid swipe + vote ranking'
                  : 'How you ranked cards in this deck'
            }
          />
          {mode ? <StatusBadge status="info">{modeLabel}</StatusBadge> : null}
        </Stack>

        <Paper withBorder p="md" radius="md" ta="center">
          <Title order={3} mb="sm">
            Share results
          </Title>
          <Group justify="center">
            <NarimatoSemanticButton action="copy" variant="light" onClick={copyToClipboard} />
            <NarimatoSemanticButton action="forward" onClick={shareResults} />
          </Group>
          {copySuccess ? (
            <Text size="sm" c="green" mt="sm">
              {copySuccess}
            </Text>
          ) : null}
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Title order={3} ta="center" mb="md">
            Summary — {deck}
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <div>
              <Text fw={600}>Your top 3</Text>
              <Text size="sm">
                {summary.personalTop3.map((id) => getCardDetails(id).title).filter(Boolean).join(' · ') ||
                  '—'}
              </Text>
            </div>
            <div>
              <Text fw={600}>Global top 3</Text>
              <Text size="sm">
                {summary.globalTop3.map((id) => getCardDetails(id).title).filter(Boolean).join(' · ') ||
                  '—'}
              </Text>
            </div>
            <div>
              <Text fw={600}>Your last</Text>
              <Text size="sm">
                {summary.personalLast ? getCardDetails(summary.personalLast).title : '—'}
              </Text>
            </div>
            <div>
              <Text fw={600}>Global last</Text>
              <Text size="sm">
                {summary.globalLast ? getCardDetails(summary.globalLast).title : '—'}
              </Text>
            </div>
          </SimpleGrid>
        </Paper>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Title order={3} mb="md">
              Personal ranking
            </Title>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Title order={3} mb="md">
              Global rankings
            </Title>
          </Grid.Col>
        </Grid>

        {Array.from({ length: rowCount }).map((_, index) => {
          const leftItem = Array.isArray(results.ranking) ? results.ranking[index] : undefined;
          const leftId = leftItem
            ? leftItem.card?.id || leftItem.cardId
            : Array.isArray(results.personalRanking)
              ? results.personalRanking[index]
              : undefined;
          const leftCard = leftItem
            ? leftItem.card || (leftItem.cardId ? getCardDetails(leftItem.cardId) : null)
            : leftId
              ? getCardDetails(leftId)
              : null;
          const leftGRank = leftCard ? getGlobalRank(leftCard.id || leftCard.uuid) : null;

          const rightItem = fullGlobalRankings[index];
          const rightCard = rightItem ? getCardDetails(rightItem.cardId) : null;
          const isInMyRanking = rightItem ? personalIds.includes(rightItem.cardId) : false;

          return (
            <Grid key={index} gutter="md" align="flex-start">
              <Grid.Col span={{ base: 12, md: 6 }}>
                {leftCard ? (
                  <ResultCard
                    card={leftCard}
                    rankLabel={
                      index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`
                    }
                    meta={
                      <Stack gap={2}>
                        {leftGRank ? <Text size="sm">Global rank: #{leftGRank}</Text> : null}
                        {mode === 'swipe-only' && leftItem?.swipedAt ? (
                          <Text size="xs" c="dimmed">
                            Liked: {new Date(leftItem.swipedAt).toLocaleTimeString()}
                          </Text>
                        ) : null}
                      </Stack>
                    }
                  />
                ) : null}
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                {rightCard ? (
                  <ResultCard
                    card={rightCard}
                    rankLabel={`#${index + 1} global`}
                    meta={
                      <Stack gap={2}>
                        <Text size="sm">
                          Score: {rightItem.globalScore} · Votes: {rightItem.voteCount}
                        </Text>
                        {isInMyRanking ? (
                          <Text size="sm" c="green">
                            In your ranking
                          </Text>
                        ) : null}
                      </Stack>
                    }
                  />
                ) : null}
              </Grid.Col>
            </Grid>
          );
        })}

        <Group justify="center">
          <NarimatoSemanticButton action="play" component={Link} href={`/play?org=${org}`} />
        </Group>
      </Stack>
    </PublicShell>
  );
}
