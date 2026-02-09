
"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { INITIAL_BOARD, PieceType, PIECE_ICONS, boardToFen, moveToUci } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { Button } from '@/components/ui/button';
import { Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChessBoardProps {
  difficulty?: 'easy' | 'medium' | 'hard';
  mode: 'ai' | 'pvp' | 'learning';
  onMove?: (uci: string) => void;
}

export function ChessBoard({ difficulty = 'medium', mode, onMove }: ChessBoardProps) {
  const [board, setBoard] = useState<PieceType[][]>(INITIAL_BOARD);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [isThinking, setIsThinking] = useState(false);
  const { toast } = useToast();

  const handleSquareClick = async (r: number, f: number) => {
    if (isThinking) return;

    if (selected) {
      const [sr, sf] = selected;
      
      // Attempting a move
      if (sr === r && sf === f) {
        setSelected(null);
        return;
      }

      const uci = moveToUci([sr, sf], [r, f]);

      if (mode === 'learning') {
        setIsThinking(true);
        const feedback = await getMoveFeedback({
          currentBoardState: boardToFen(board, turn),
          userMove: uci
        });
        setIsThinking(false);

        if (!feedback.isLegalMove) {
          toast({
            title: "Illegal Move",
            description: feedback.feedback,
            variant: "destructive"
          });
          setSelected(null);
          return;
        } else {
          toast({
            title: "Great Move!",
            description: feedback.feedback,
          });
        }
      }

      // Execute Move
      const newBoard = board.map(row => [...row]);
      newBoard[r][f] = newBoard[sr][sf];
      newBoard[sr][sf] = null;
      setBoard(newBoard);
      setSelected(null);
      const nextTurn = turn === 'w' ? 'b' : 'w';
      setTurn(nextTurn);
      onMove?.(uci);

      // AI Turn
      if (mode === 'ai' && nextTurn === 'b') {
        triggerAiMove(newBoard);
      }
    } else {
      const piece = board[r][f];
      if (piece && ((turn === 'w' && piece === piece.toUpperCase()) || (turn === 'b' && piece === piece.toLowerCase()))) {
        setSelected([r, f]);
      }
    }
  };

  const triggerAiMove = async (currentBoard: PieceType[][]) => {
    setIsThinking(true);
    try {
      const fen = boardToFen(currentBoard, 'b');
      const aiResponse = await aiOpponentDifficulty({ fen, difficulty });
      
      // Parse AI move (e.g., "e7e5")
      const uci = aiResponse.move;
      const files = 'abcdefgh';
      const fromF = files.indexOf(uci[0]);
      const fromR = 8 - parseInt(uci[1]);
      const toF = files.indexOf(uci[2]);
      const toR = 8 - parseInt(uci[3]);

      const newBoard = currentBoard.map(row => [...row]);
      newBoard[toR][toF] = newBoard[fromR][fromF];
      newBoard[fromR][fromF] = null;
      
      setTimeout(() => {
        setBoard(newBoard);
        setTurn('w');
        setIsThinking(false);
      }, 600);
    } catch (error) {
      console.error("AI Move failed", error);
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
      <div className="flex justify-between w-full px-4 items-center">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full animate-pulse", turn === 'w' ? "bg-primary" : "bg-muted")} />
          <span className="font-semibold">{turn === 'w' ? "White's Turn" : "Black's Turn"}</span>
        </div>
        {isThinking && (
          <div className="flex items-center gap-2 text-muted-foreground animate-in fade-in slide-in-from-top-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}
      </div>

      <div className="chess-board">
        {board.map((row, r) => 
          row.map((piece, f) => {
            const isLight = (r + f) % 2 === 0;
            const isSelected = selected?.[0] === r && selected?.[1] === f;
            
            return (
              <div
                key={`${r}-${f}`}
                onClick={() => handleSquareClick(r, f)}
                className={cn(
                  "chess-square",
                  isLight ? "light" : "dark",
                  isSelected && "highlight-selected"
                )}
              >
                {piece && (
                  <span className={cn(
                    "chess-piece text-4xl sm:text-5xl flex items-center justify-center transition-transform",
                    isSelected && "scale-110",
                    piece === piece.toUpperCase() ? "text-slate-900 drop-shadow-sm" : "text-white drop-shadow-md"
                  )}>
                    {PIECE_ICONS[piece]}
                  </span>
                )}
                <div className="absolute bottom-0.5 right-0.5 text-[8px] opacity-20 pointer-events-none font-mono">
                  {'abcdefgh'[f]}{8-r}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-4">
        <Button variant="outline" size="sm" onClick={() => {
          setBoard(INITIAL_BOARD);
          setTurn('w');
          setSelected(null);
        }}>
          Reset Game
        </Button>
        {mode === 'learning' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent px-3 py-1 rounded-full">
            <Info className="w-3 h-3" />
            Learning Mode Active
          </div>
        )}
      </div>
    </div>
  );
}
