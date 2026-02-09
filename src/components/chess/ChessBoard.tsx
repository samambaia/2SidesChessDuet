
"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { INITIAL_BOARD, PieceType, PIECE_ICONS, boardToFen, moveToUci } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer } from 'lucide-react';
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
  const [whiteTime, setWhiteTime] = useState(600); // 10 minutes
  const [blackTime, setBlackTime] = useState(600);
  const { toast } = useToast();

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (!isThinking) {
      interval = setInterval(() => {
        if (turn === 'w') {
          setWhiteTime((prev) => Math.max(0, prev - 1));
        } else {
          setBlackTime((prev) => Math.max(0, prev - 1));
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [turn, isThinking]);

  // Handle time out
  useEffect(() => {
    if (whiteTime === 0) {
      toast({ title: "Game Over", description: "White ran out of time! Black wins.", variant: "destructive" });
    }
    if (blackTime === 0) {
      toast({ title: "Game Over", description: "Black ran out of time! White wins.", variant: "destructive" });
    }
  }, [whiteTime, blackTime, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      <div className="grid grid-cols-2 w-full gap-4 mb-2">
        {/* Black Timer */}
        <div className={cn(
          "flex items-center justify-between px-4 py-2 rounded-xl border-2 transition-all",
          turn === 'b' ? "bg-slate-900 text-white border-primary shadow-lg scale-105" : "bg-accent/30 border-transparent opacity-60"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", turn === 'b' ? "bg-primary animate-pulse" : "bg-muted")} />
            <span className="text-xs font-bold uppercase tracking-wider">Black</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-lg">
            <Timer className="w-4 h-4" />
            {formatTime(blackTime)}
          </div>
        </div>

        {/* White Timer */}
        <div className={cn(
          "flex items-center justify-between px-4 py-2 rounded-xl border-2 transition-all",
          turn === 'w' ? "bg-white text-slate-900 border-primary shadow-lg scale-105" : "bg-accent/30 border-transparent opacity-60"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", turn === 'w' ? "bg-primary animate-pulse" : "bg-muted")} />
            <span className="text-xs font-bold uppercase tracking-wider">White</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-lg">
            <Timer className="w-4 h-4" />
            {formatTime(whiteTime)}
          </div>
        </div>
      </div>

      {isThinking && (
        <div className="flex items-center gap-2 text-primary animate-bounce mb-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-bold uppercase tracking-tighter">AI is pondering...</span>
        </div>
      )}

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
          setWhiteTime(600);
          setBlackTime(600);
        }}
      >
        <RotateCcw className="w-3 h-3" />
        Reset Match
      </Button>
    </div>
  );
}
