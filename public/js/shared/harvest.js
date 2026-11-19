/**
 * One harvest-truth function for surface colour and click eligibility.
 * Server lock: a cell is locked to its owner when owner===lastClickIndex.
 * A depleted max-depth resource cell cannot be mined either.
 */
export function canHarvestCell(cell, myIndex, maxDepth) {
  if (!cell) return false;
  if (cell.ownerIndex === myIndex && cell.lastClickIndex === myIndex) return false;
  if (Number.isInteger(maxDepth) && cell.depth >= maxDepth && cell.resourceId) return false;
  return true;
}
