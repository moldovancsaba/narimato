import { Paper, Text, Image, Box } from '@mantine/core';
import classes from '../../styles/playGame.module.css';

function PlayComparisonCard({
  card,
  side,
  keyboardActive,
  transitionClass,
  onVote,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) {
  return (
    <Paper
      className={`${classes.playCard} ${keyboardActive ? classes.keyboardActive : ''}`}
      withBorder
      shadow="md"
      radius="lg"
      p="lg"
      w="var(--card-size)"
      h="var(--card-size)"
      role="button"
      aria-label={`Vote for ${card.title}`}
      onClick={() => onVote(card.id)}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onVote(card.id))}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <Text fw={700} ta="center" mb="xs">
        {card.title}
      </Text>
      {card.description ? (
        <Text size="sm" c="dimmed" ta="center" lineClamp={4}>
          {card.description}
        </Text>
      ) : null}
      {card.imageUrl ? (
        <Image src={card.imageUrl} alt={card.title} mt="sm" radius="md" fit="contain" mah="40%" />
      ) : null}
    </Paper>
  );
}

export function PlayVoteSurface({
  cardA,
  cardB,
  cardConfig,
  keyboardActive,
  cardTransitions,
  voteTouchHandlers,
  onVote,
}) {
  const gameStyle = {
    '--card-size': `${cardConfig.cardSize}px`,
  };

  return (
    <Box className={classes.root} style={gameStyle}>
      <Box className={`${classes.layout} ${classes[cardConfig.orientation] || classes.landscape}`}>
        <PlayComparisonCard
          card={cardA}
          keyboardActive={keyboardActive === 'left'}
          onVote={onVote}
          onTouchStart={(e) => voteTouchHandlers.onTouchStart('A', e)}
          onTouchMove={(e) => voteTouchHandlers.onTouchMove('A', e)}
          onTouchEnd={(e) => voteTouchHandlers.onTouchEnd('A', e, () => onVote(cardA.id))}
        />
        <Text className={classes.vs} aria-hidden>
          😈
        </Text>
        <PlayComparisonCard
          card={cardB}
          keyboardActive={keyboardActive === 'right'}
          onVote={onVote}
          onTouchStart={(e) => voteTouchHandlers.onTouchStart('B', e)}
          onTouchMove={(e) => voteTouchHandlers.onTouchMove('B', e)}
          onTouchEnd={(e) => voteTouchHandlers.onTouchEnd('B', e, () => onVote(cardB.id))}
        />
      </Box>
    </Box>
  );
}
