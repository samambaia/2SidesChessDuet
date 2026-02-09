
export type PieceType = 'p' | 'n' | 'b' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | null;
export type Square = {
  rank: number;
  file: number;
  piece: PieceType;
};

export const INITIAL_BOARD: PieceType[][] = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

/** Firestore doesn't support nested arrays. We flatten it to a single array of 64 elements. */
export function flattenBoard(board: PieceType[][]): PieceType[] {
  return board.flat();
}

/** Reconstructs the 8x8 board from a flat 64-element array. */
export function expandBoard(flatBoard: PieceType[]): PieceType[][] {
  const board: PieceType[][] = [];
  for (let i = 0; i < 8; i++) {
    board.push(flatBoard.slice(i * 8, i * 8 + 8));
  }
  return board;
}

export function boardToFen(board: PieceType[][], activeColor: 'w' | 'b' = 'w'): string {
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let emptyCount = 0;
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        fen += piece;
      }
    }
    if (emptyCount > 0) {
      fen += emptyCount;
    }
    if (r < 7) {
      fen += '/';
    }
  }
  fen += ` ${activeColor} KQkq - 0 1`;
  return fen;
}

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

export function uciToMove(uci: string): { from: [number, number], to: [number, number] } {
  const files = 'abcdefgh';
  const fromFile = files.indexOf(uci[0]);
  const fromRank = 8 - parseInt(uci[1]);
  const toFile = files.indexOf(uci[2]);
  const toRank = 8 - parseInt(uci[3]);
  return {
    from: [fromRank, fromFile],
    to: [toRank, toFile]
  };
}

export function moveToUci(from: [number, number], to: [number, number]): string {
  const files = 'abcdefgh';
  return `${files[from[1]]}${8 - from[0]}${files[to[1]]}${8 - to[0]}`;
}

export const PIECE_ICONS: Record<string, string> = {
  'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
  'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};
