import type { PuzzleId } from '../world/types';

export interface SessionState {
  currentRoomId: string;
  visitedRoomIds: string[];
  solvedPuzzleIds: PuzzleId[];
}

export const session: SessionState = {
  currentRoomId: 'entrance',
  visitedRoomIds: ['entrance'],
  solvedPuzzleIds: [],
};

export function visitRoom(roomId: string) {
  session.currentRoomId = roomId;
  if (!session.visitedRoomIds.includes(roomId))
    session.visitedRoomIds.push(roomId);
}

export function solvePuzzle(puzzleId: PuzzleId) {
  if (!session.solvedPuzzleIds.includes(puzzleId))
    session.solvedPuzzleIds.push(puzzleId);
}
