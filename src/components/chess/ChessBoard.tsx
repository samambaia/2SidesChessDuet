
"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { INITIAL_BOARD, PieceType, PIECE_ICONS, boardToFen, moveToUci } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
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

  const executeMove = async (from: [number, number], to: [number, number]) => {
    const [sr, sf] = from;
    const [r, f] = to;

    if (sr === r && sf === f) {
      setSelected(null);
      return;
    }

    const uci = moveToUci([sr, sf], [r, f]);

    if (mode === 'learning') {
      setIsThinking(true);
      try {
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
        }
      } catch (e) {
        setIsThinking(false);
      }
    }

    const newBoard = board.map(row => [...row]);
    newBoard[r][f] = newBoard[sr][sf];
    newBoard[sr][sf] = null;
    setBoard(newBoard);
    setSelected(null);
    const nextTurn = turn === 'w' ? 'b' : 'w';
    setTurn(nextTurn);
    onMove?.(uci);

    if (mode === 'ai' && nextTurn === 'b') {
      triggerAiMove(newBoard);
    }
  };

  const handleSquareClick = (r: number, f: number) => {
    if (isThinking) return;

    if (selected) {
      executeMove(selected, [r, f]);
    } else {
      const piece = board[r][f];
      if (piece && ((turn === 'w' && piece === piece.toUpperCase()) || (turn === 'b' && piece === piece.toLowerCase()))) {
        setSelected([r, f]);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, r: number, f: number) => {
    if (isThinking) {
      e.preventDefault();
      return;
    }
    const piece = board[r][f];
    if (piece && ((turn === 'w' && piece === piece.toUpperCase()) || (turn === 'b' && piece === piece.toLowerCase()))) {
      setSelected([r, f]);
      e.dataTransfer.setData('text/plain', `${r},${f}`);
      e.dataTransfer.effectAllowed = 'move';
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, r: number, f: number) => {
    e.preventDefault();
    if (isThinking || !selected) return;
    executeMove(selected, [r, f]);
  };

  const triggerAiMove = async (currentBoard: PieceType[][]) => {
    setIsThinking(true);
    try {
      const fen = boardToFen(currentBoard, 'b');
      const aiResponse = await aiOpponentDifficulty({ fen, difficulty });
      
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
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px]">
      <div className="flex justify-between w-full items-center px-2 mb-2">
        <div className="flex items-center gap-2 bg-accent/30 px-3 py-1.5 rounded-full border">
          <div className={cn("w-2 h-2 rounded-full", turn === 'w' ? "bg-primary animate-pulse" : "bg-muted")} />
          <span className="text-xs font-medium uppercase tracking-wider">{turn === 'w' ? "White" : "Black"}</span>
        </div>
        {isThinking && (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">AI Thinking</span>
          </div>
        )}
      </div>

      <div className="chess-board border-4 border-primary/20 rounded-xl overflow-hidden shadow-2xl">
        {board.map((row, r) => 
          row.map((piece, f) => {
            const isLight = (r + f) % 2 === 0;
            const isSelected = selected?.[0] === r && selected?.[1] === f;
            
            return (
              <div
                key={`${r}-${f}`}
                onClick={() => handleSquareClick(r, f)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, r, f)}
                className={cn(
                  "chess-square",
                  isLight ? "light" : "dark",
                  isSelected && "highlight-selected"
                )}
              >
                {piece && (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, r, f)}
                    className={cn(
                      "chess-piece text-4xl sm:text-6xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform",
                      isSelected && "scale-110",
                      piece === piece.toUpperCase() ? "text-slate-900" : "text-white drop-shadow"
                    )}
                  >
                    {PIECE_ICONS[piece]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Button 
        variant="ghost" 
        size="sm" 
        className="text-xs text-muted-foreground gap-2 h-8"
        onClick={() => {
          setBoard(INITIAL_BOARD);
          setTurn('w');
          setSelected(null);
        }}
      >
        <RotateCcw className="w-3 h-3" />
        Reset Board
      </Button>
    </div>
  );
}
