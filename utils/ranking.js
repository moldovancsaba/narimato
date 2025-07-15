export function calculateRank(score, totalParticipants) {
  const percentile = (totalParticipants - score + 1) / totalParticipants * 100;
  
  if (percentile <= 1) return 'Grand Master';
  if (percentile <= 5) return 'Master';
  if (percentile <= 10) return 'Expert';
  if (percentile <= 25) return 'Advanced';
  if (percentile <= 50) return 'Intermediate';
  return 'Beginner';
}

export function sortByScore(items) {
  return [...items].sort((a, b) => b.score - a.score);
}
