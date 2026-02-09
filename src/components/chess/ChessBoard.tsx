
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';
import { INITIAL_FEN, PIECE_ICONS, formatTotalTime, chessJsToBoard, getSquareName, getRankFile } from '@/lib/chess-utils';
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
  
  // Internal engine state
  const game = useMemo(() => new Chess(), []);
  
  const [board, setBoard] = useState(chessJsToBoard(game));
  const [selected, setSelected] = useState<ChessSquare | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<ChessSquare[]>([]);
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

  // Sync with remote state
  useEffect(() => {
    if (remoteGame?.fen) {
      try {
        game.load(remoteGame.fen);
        setBoard(chessJsToBoard(game));
        setTurn(game.turn());
        
        if (remoteGame.startTime) {
          const start = remoteGame.startTime.toDate ? remoteGame.startTime.toDate().getTime() : remoteGame.startTime;
          const now = Date.now();
          setElapsedSeconds(Math.floor((now - start) / 1000));
        }
      } catch (e) {
        console.error("Failed to load FEN:", remoteGame.fen);
      }
    } else if (!gameId) {
      game.load(INITIAL_FEN);
      setBoard(chessJsToBoard(game));
      setTurn('w');
      setElapsedSeconds(0);
    }
  }, [remoteGame, gameId, game]);

  // Game timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const syncToFirestore = useCallback(async () => {
    if (gameId && gameRef) {
      await updateDoc(gameRef, {
        fen: game.fen(),
        turn: game.turn(),
        moves: game.history(),
        lastUpdated: serverTimestamp()
      });
    }
  }, [gameId, gameRef, game]);

  const triggerAiMove = useCallback(async () => {
    if (game.isGameOver()) return;
    setIsThinking(true);
    try {
      const fen = game.fen();
      const aiResponse = await aiOpponentDifficulty({ fen, difficulty });
      
      const moveStr = aiResponse.move.trim().toLowerCase();
      const move = game.move(moveStr);
      
      if (move) {
        setBoard(chessJsToBoard(game));
        setTurn(game.turn());
        await syncToFirestore();
      }
    } catch (error: any) {
      console.error("AI Move failed:", error);
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, game, syncToFirestore]);

  const executeMove = async (to: ChessSquare) => {
    if (!selected) return;

    const from = selected;
    const uci = `${from}${to}`;

    // Learning Mode AI validation
    if (mode === 'learning') {
      setIsThinking(true);
      try {
        const feedback = await getMoveFeedback({
          currentBoardState: game.fen(),
          userMove: uci
        });
        if (!feedback.isLegalMove) {
          toast({ title: "Movimento Inválido", description: feedback.feedback, variant: "destructive" });
          setSelected(null);
          setPossibleMoves([]);
          return;
        }
      } catch (err) {
        console.error("Feedback error:", err);
      } finally {
        setIsThinking(false);
      }
    }

    // Try move in engine (handles rules, castling, promotion, etc)
    try {
      const move = game.move({ from, to, promotion: 'q' });
      
      if (!move) {
        toast({ title: "Movimento Ilegal", description: "Esta jogada não segue as regras do xadrez.", variant: "destructive" });
        return;
      }

      setBoard(chessJsToBoard(game));
      setSelected(null);
      setPossibleMoves([]);
      setTurn(game.turn());
      await syncToFirestore();

      if (game.isCheckmate()) {
        toast({ title: "Fim de Jogo!", description: `Xeque-mate! ${move.color === 'w' ? 'Brancas' : 'Pretas'} venceram.` });
      } else if (game.isDraw()) {
        toast({ title: "Empate!", description: "A partida terminou em empate." });
      }

      // Trigger AI if applicable
      if (mode === 'ai' && game.turn() === 'b' && !game.isGameOver()) {
        setTimeout(triggerAiMove, 600);
      }
    } catch (e) {
      toast({ title: "Erro no Movimento", description: "Não foi possível realizar esta jogada.", variant: "destructive" });
    }
  };

  const handleSquareClick = (r: number, f: number) => {
    if (isThinking || game.isGameOver()) return;

    const squareName = getSquareName(r, f);

    // If a move destination is clicked
    if (selected && possibleMoves.includes(squareName)) {
      executeMove(squareName);
      return;
    }

    // If selecting a piece
    const piece = game.get(squareName);
    if (piece && piece.color === game.turn()) {
      setSelected(squareName);
      const moves = game.moves({ square: squareName, verbose: true });
      setPossibleMoves(moves.map(m => m.to));
    } else {
      setSelected(null);
      setPossibleMoves([]);
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
      toast({ 
        title: "Copie o link manualmente", 
        description: `Link: ${url}`,
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
            const squareName = getSquareName(r, f);
            const isLight = (r + f) % 2 === 0;
            const isSelected = selected === squareName;
            const isPossible = possibleMoves.includes(squareName);
            
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
                {isPossible && (
                  <div className={cn(
                    "absolute z-20 rounded-full",
                    piece ? "inset-0 border-4 border-primary/30" : "w-4 h-4 bg-primary/30"
                  )} />
                )}
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
          onClick={async () => {
            if (confirm("Deseja reiniciar a partida? Todo o progresso será perdido.")) {
              game.load(INITIAL_FEN);
              setBoard(chessJsToBoard(game));
              setTurn('w');
              setElapsedSeconds(0);
              setSelected(null);
              setPossibleMoves([]);
              await syncToFirestore();
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
