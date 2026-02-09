
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { INITIAL_BOARD, PieceType, PIECE_ICONS, boardToFen, moveToUci, uciToMove, formatTotalTime, expandBoard, flattenBoard } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Check, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface ChessBoardProps {
  difficulty?: 'easy' | 'medium' | 'hard';
  mode: 'ai' | 'pvp' | 'learning';
  gameId?: string;
}

export function ChessBoard({ difficulty = 'medium', mode, gameId }: ChessBoardProps) {
  const firestore = useFirestore();
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

  useEffect(() => {
    if (remoteGame?.board) {
      setBoard(expandBoard(remoteGame.board));
      setTurn(remoteGame.turn || 'w');
      
      if (remoteGame.startTime) {
        const start = remoteGame.startTime.toDate ? remoteGame.startTime.toDate().getTime() : remoteGame.startTime;
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - start) / 1000));
      }
    } else if (!gameId) {
      setBoard(INITIAL_BOARD);
      setTurn('w');
      setElapsedSeconds(0);
    }
  }, [remoteGame, gameId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerAiMove = useCallback(async (currentBoard: PieceType[][]) => {
    setIsThinking(true);
    try {
      const fen = boardToFen(currentBoard, 'b');
      const aiResponse = await aiOpponentDifficulty({ fen, difficulty });
      
      const moveStr = aiResponse.move.trim().toLowerCase();
      const uciMatch = moveStr.match(/[a-h][1-8][a-h][1-8][qrbn]?/);
      
      if (!uciMatch) throw new Error("Move format error from AI");

      const uci = uciMatch[0];
      const { from, to } = uciToMove(uci);
      const [fromR, fromF] = from;
      const [toR, toF] = to;

      const nextBoard = currentBoard.map(row => [...row]);
      nextBoard[toR][toF] = nextBoard[fromR][fromF];
      nextBoard[fromR][fromF] = null;
      
      setBoard(nextBoard);
      setTurn('w');
      
      if (gameId && gameRef) {
        await updateDoc(gameRef, {
          board: flattenBoard(nextBoard),
          turn: 'w',
          lastMove: uci,
          moves: [...(remoteGame?.moves || []), uci]
        });
      }
    } catch (error: any) {
      console.error("AI Move failed:", error);
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, gameId, gameRef, remoteGame?.moves]);

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
        if (!feedback.isLegalMove) {
          toast({ title: "Movimento Inválido", description: feedback.feedback, variant: "destructive" });
          setSelected(null);
          return;
        }
      } catch (err) {
        console.error("Feedback error:", err);
      } finally {
        setIsThinking(false);
      }
    }

    const nextBoard = board.map(row => [...row]);
    nextBoard[r][f] = nextBoard[sr][sf];
    nextBoard[sr][sf] = null;
    
    const nextTurn = turn === 'w' ? 'b' : 'w';

    setBoard(nextBoard);
    setSelected(null);
    setTurn(nextTurn);

    if (gameId && gameRef) {
      updateDoc(gameRef, {
        board: flattenBoard(nextBoard),
        turn: nextTurn,
        lastMove: uci,
        moves: [...(remoteGame?.moves || []), uci]
      }).catch(() => {});
    }

    if (mode === 'ai' && nextTurn === 'b') {
      setTimeout(() => triggerAiMove(nextBoard), 600);
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

  const copyInviteLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setHasCopied(true);
        toast({ title: "Link Copiado!", description: "Envie este link para sua filha entrar no jogo." });
        setTimeout(() => setHasCopied(false), 2000);
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch (err) {
      console.warn("Failed to copy using API, falling back:", err);
      toast({ 
        title: "Copie o link manualmente", 
        description: `O navegador bloqueou a cópia automática. Link: ${url}`,
        variant: "default"
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px]">
      <div className="w-full flex items-center justify-between px-4 py-3 bg-accent/20 rounded-2xl border border-accent/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-full">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Duração Total</p>
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
            {hasCopied ? "Copiado" : "Convidar Oponente"}
          </Button>
        )}
      </div>

      {mode === 'pvp' && gameId && !hasCopied && (
        <div className="w-full bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-blue-700 font-medium">Jogo Online Ativo</p>
            <p className="text-[10px] text-blue-600">Compartilhe o link da página para jogar com outra pessoa.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-2">
        <div className={cn(
          "px-4 py-1 rounded-full text-xs font-bold transition-all border",
          turn === 'w' ? "bg-white text-black border-primary shadow-md scale-110" : "bg-accent/50 text-muted-foreground border-transparent opacity-50"
        )}>
          VEZ DAS BRANCAS
        </div>
        <div className={cn(
          "px-4 py-1 rounded-full text-xs font-bold transition-all border",
          turn === 'b' ? "bg-black text-white border-primary shadow-md scale-110" : "bg-accent/50 text-muted-foreground border-transparent opacity-50"
        )}>
          VEZ DAS PRETAS
        </div>
      </div>

      <div className="chess-board border-4 border-primary/20 rounded-2xl overflow-hidden shadow-2xl bg-white/50 backdrop-blur-sm relative">
        {isThinking && (
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] z-50 flex items-center justify-center">
             <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs font-bold uppercase text-primary">IA Pensando...</span>
             </div>
          </div>
        )}
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
                  <div
                    className={cn(
                      "chess-piece text-4xl sm:text-6xl flex items-center justify-center transition-transform",
                      isSelected && "scale-110",
                      piece === piece.toUpperCase() 
                        ? "text-slate-100 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" 
                        : "text-slate-950"
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
            if (confirm("Deseja reiniciar a partida? Todo o progresso será perdido.")) {
              const resetData = { 
                board: flattenBoard(INITIAL_BOARD),
                turn: 'w', 
                moves: [], 
                startTime: serverTimestamp() 
              };
              if (gameId && gameRef) updateDoc(gameRef, resetData);
              else { setBoard(INITIAL_BOARD); setTurn('w'); setElapsedSeconds(0); }
              setSelected(null);
            }
          }}
        >
          <RotateCcw className="w-3 h-3" />
          Reiniciar Partida
        </Button>
      </div>
    </div>
  );
}
