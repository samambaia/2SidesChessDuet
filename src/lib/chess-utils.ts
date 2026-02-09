
import { Chess, Square as ChessSquare } from 'chess.js';

export type PieceType = 'p' | 'n' | 'b' | 'q' | 'k' | 'r' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | null;

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function formatTotalTime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function uciToMove(uci: string): { from: string, to: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4)
  };
}

export function moveToUci(from: string, to: string): string {
  return `${from}${to}`;
}

export function getSquareName(r: number, f: number): ChessSquare {
  const files = 'abcdefgh';
  return `${files[f]}${8 - r}` as ChessSquare;
}

export function getRankFile(square: string): [number, number] {
  const files = 'abcdefgh';
  const f = files.indexOf(square[0]);
  const r = 8 - parseInt(square[1]);
  return [r, f];
}

/** Converts chess.js board representation to our PieceType[][] for rendering */
export function chessJsToBoard(game: Chess): PieceType[][] {
  const board: PieceType[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  const internalBoard = game.board();

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = internalBoard[r][f];
      if (cell) {
        // Upper case for white, lower case for black
        board[r][f] = cell.color === 'w' ? cell.type.toUpperCase() as PieceType : cell.type.toLowerCase() as PieceType;
      }
    }
  }
  return board;
}

export const PIECE_ICONS: Record<string, string> = {
  'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
  'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};
