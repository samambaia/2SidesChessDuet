
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { INITIAL_BOARD, PieceType, PIECE_ICONS, boardToFen, moveToUci, formatTotalTime } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface ChessBoardProps {
  difficulty?: 'easy' | 'medium' | 'hard';
  mode: 'ai' | 'pvp' | 'learning';
  gameId?: string;
}

export function ChessBoard({ difficulty = 'medium', mode, gameId }: ChessBoardProps) {
  const { firestore } = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [board, setBoard] = useState<PieceType[][]>(INITIAL_BOARD);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [isThinking, setIsThinking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasCopied, setHasCopied] = useState(false);

  // Firestore sync
  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame } = useDoc(gameRef);

  // Update local state when remote state changes
  useEffect(() => {
    if (remoteGame?.board) {
      setBoard(remoteGame.board);
      setTurn(remoteGame.turn || 'w');
      
      if (remoteGame.startTime) {
        const start = remoteGame.startTime.toDate ? remoteGame.startTime.toDate().getTime() : remoteGame.startTime;
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - start) / 1000));
      }
    }
  }, [remoteGame]);

  // Total Game Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
    
    const nextTurn = turn === 'w' ? 'b' : 'w';

    // Local update for responsiveness
    setBoard(newBoard);
    setSelected(null);
    setTurn(nextTurn);

    // Persist to Firestore if in pvp mode or sync is active
    if (gameId && gameRef) {
      updateDoc(gameRef, {
        board: newBoard,
        turn: nextTurn,
        lastMove: uci,
        moves: [...(remoteGame?.moves || []), uci]
      }).catch(err => {
        // Silently fail or handle error via global listener
      });
    }

    if (mode === 'ai' && nextTurn === 'b') {
      triggerAiMove(newBoard);
    }
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
      
      setBoard(newBoard);
      setTurn('w');
      setIsThinking(false);
      
      if (gameId && gameRef) {
        updateDoc(gameRef, {
          board: newBoard,
          turn: 'w',
          lastMove: uci,
          moves: [...(remoteGame?.moves || []), uci]
        });
      }
    } catch (error) {
      setIsThinking(false);
    }
  };

  const handleSquareClick = (r: number, f: number) => {
    if (isThinking) return;

    if (selected) {
      executeMove(selected, [r, f]);
    } else {
      const piece = board[r][f];
      // White pieces are uppercase, Black pieces are lowercase
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

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setHasCopied(true);
    toast({ title: "Link Copied!", description: "Send this link to your daughter to join the game." });
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px]">
      <div className="w-full flex items-center justify-between px-4 py-3 bg-accent/20 rounded-2xl border border-accent/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-full">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Duration</p>
            <p className="text-xl font-mono font-bold">{formatTotalTime(elapsedSeconds)}</p>
          </div>
        </div>

        {gameId && (
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full gap-2 border-primary/20 hover:bg-primary/5"
            onClick={copyInviteLink}
          >
            {hasCopied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            {hasCopied ? "Copied" : "Share Room"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className={cn(
          "px-4 py-1 rounded-full text-xs font-bold transition-all border",
          turn === 'w' ? "bg-white text-black border-primary shadow-md scale-110" : "bg-accent/50 text-muted-foreground border-transparent opacity-50"
        )}>
          WHITE'S TURN
        </div>
        <div className={cn(
          "px-4 py-1 rounded-full text-xs font-bold transition-all border",
          turn === 'b' ? "bg-black text-white border-primary shadow-md scale-110" : "bg-accent/50 text-muted-foreground border-transparent opacity-50"
        )}>
          BLACK'S TURN
        </div>
      </div>

      {isThinking && (
        <div className="flex items-center gap-2 text-primary animate-pulse mb-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-bold uppercase">AI Thinking...</span>
        </div>
      )}

      <div className="chess-board border-4 border-primary/20 rounded-2xl overflow-hidden shadow-2xl bg-white/50 backdrop-blur-sm">
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
                      // Correcting piece colors: White (uppercase) is light, Black (lowercase) is dark
                      piece === piece.toUpperCase() ? "text-white drop-shadow-lg" : "text-slate-900"
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

      <div className="flex gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs text-muted-foreground gap-2 h-8 hover:bg-primary/5"
          onClick={() => {
            const resetData = {
              board: INITIAL_BOARD,
              turn: 'w',
              moves: [],
              startTime: serverTimestamp()
            };
            if (gameId && gameRef) {
              updateDoc(gameRef, resetData);
            } else {
              setBoard(INITIAL_BOARD);
              setTurn('w');
              setElapsedSeconds(0);
            }
          }}
        >
          <RotateCcw className="w-3 h-3" />
          Reset Board
        </Button>
      </div>
    </div>
  );
}
