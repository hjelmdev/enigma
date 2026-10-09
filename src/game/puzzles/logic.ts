export type SequenceSymbol = 'SOL' | 'FLOD' | 'ÖGA';
export const sequenceSolution: SequenceSymbol[] = ['SOL', 'FLOD', 'ÖGA'];
export const balanceWeights = [1, 2, 3] as const;
export const mirrorSolution = [1, 2, 1] as const;

export function isSequenceSolved(input: SequenceSymbol[]) {
  return (
    input.length === sequenceSolution.length &&
    input.every((value, index) => value === sequenceSolution[index])
  );
}

export function isBalanceSolved(sides: number[]) {
  if (
    sides.length !== balanceWeights.length ||
    sides.some((side) => side === 0)
  )
    return false;
  const left = sides.reduce(
    (sum, side, index) => sum + (side === 1 ? balanceWeights[index] : 0),
    0,
  );
  const right = sides.reduce(
    (sum, side, index) => sum + (side === 2 ? balanceWeights[index] : 0),
    0,
  );
  return left === right && left > 0;
}

export function isLightAligned(angles: number[]) {
  return (
    angles.length === mirrorSolution.length &&
    angles.every((angle, index) => angle % 4 === mirrorSolution[index])
  );
}
