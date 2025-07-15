const K_FACTOR = 32;

export function calculateElo(winnerRating, loserRating) {
  const expectedScoreWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedScoreLoser = 1 - expectedScoreWinner;

  const newWinnerRating = Math.round(winnerRating + K_FACTOR * (1 - expectedScoreWinner));
  const newLoserRating = Math.round(loserRating + K_FACTOR * (0 - expectedScoreLoser));

  return {
    winner: newWinnerRating,
    loser: newLoserRating
  };
}
