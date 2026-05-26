import { Paper, Text, Image, Group, ActionIcon, Box } from '@mantine/core';
import { GdsIcons, StatusBadge } from '@doneisbetter/gds-core/client';
import classes from '../../styles/playGame.module.css';

export function PlaySwipeSurface({
  currentCard,
  cardConfig,
  swipeDrag,
  swipeTransition,
  isOnboarding,
  showLevelBadge,
  hierarchicalLevel,
  onSwipeTouchStart,
  onSwipeTouchMove,
  onSwipeTouchEnd,
  onSwipePointerDown,
  onSwipePointerMove,
  onSwipePointerUp,
  onSwipeLeft,
  onSwipeRight,
  keyboardActive,
}) {
  const gameStyle = {
    '--card-size': `${cardConfig.cardSize}px`,
  };

  const transform = `translateX(${swipeDrag.dx}px) rotate(${swipeDrag.dx * 0.03}deg)`;

  const orientationClass =
    cardConfig.orientation === 'landscape' ? classes.landscape : classes.portrait;

  const dislikeBtn = !isOnboarding ? (
    <ActionIcon
      size={cardConfig.buttonSize}
      radius="xl"
      variant="filled"
      color="red"
      aria-label="Dislike card"
      className={keyboardActive === 'dislike' ? classes.keyboardActive : undefined}
      onClick={onSwipeLeft}
    >
      <GdsIcons.TrendingDown size="60%" />
    </ActionIcon>
  ) : (
    <Box w={cardConfig.buttonSize} h={cardConfig.buttonSize} />
  );

  const likeBtn = (
    <ActionIcon
      size={cardConfig.buttonSize}
      radius="xl"
      variant="filled"
      color="green"
      aria-label="Like card"
      className={keyboardActive === 'like' ? classes.keyboardActive : undefined}
      onClick={onSwipeRight}
    >
      <GdsIcons.TrendingUp size="60%" />
    </ActionIcon>
  );

  const card = (
    <Paper
      className={classes.playCard}
      withBorder
      shadow="md"
      radius="lg"
      p="lg"
      w="var(--card-size)"
      h="var(--card-size)"
      style={{
        transform,
        transition: swipeDrag.animating ? 'transform 180ms ease-out' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onTouchStart={onSwipeTouchStart}
      onTouchMove={onSwipeTouchMove}
      onTouchEnd={onSwipeTouchEnd}
      onPointerDown={onSwipePointerDown}
      onPointerMove={onSwipePointerMove}
      onPointerUp={onSwipePointerUp}
    >
      <Text fw={700} ta="center" mb="xs">
        {currentCard.title}
      </Text>
      {currentCard.description ? (
        <Text size="sm" c="dimmed" ta="center" lineClamp={4}>
          {currentCard.description}
        </Text>
      ) : null}
      {currentCard.imageUrl ? (
        <Image
          src={currentCard.imageUrl}
          alt={currentCard.title}
          mt="sm"
          radius="md"
          fit="contain"
          mah="40%"
        />
      ) : null}
    </Paper>
  );

  return (
    <Box className={classes.root} style={gameStyle}>
      <Box className={`${classes.layout} ${orientationClass}`} pos="relative">
        {showLevelBadge ? (
          <StatusBadge
            status="info"
            pos="absolute"
            top={10}
            left={10}
            variant="filled"
            style={{ zIndex: 10 }}
          >
            Level {swipeTransition === 'new-level' ? '↗' : hierarchicalLevel || 1}
          </StatusBadge>
        ) : null}

        {cardConfig.orientation === 'landscape' ? (
          <>
            {dislikeBtn}
            {card}
            {likeBtn}
          </>
        ) : (
          <>
            {card}
            <Group justify="space-between" w={cardConfig.cardSize} gap="lg">
              {dislikeBtn}
              {likeBtn}
            </Group>
          </>
        )}
      </Box>
    </Box>
  );
}
