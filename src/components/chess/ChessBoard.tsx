
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';
import { INITIAL_FEN, PIECE_ICONS, formatTotalTime, chessJsToBoard, getSquareName } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { analyzeGameHistory, type AnalyzeGameHistoryOutput } from '@/ai/flows/analyze-game-history';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Check, Activity, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ChessBoardProps {
  difficulty?: 'easy' | 'medium' | 'hard';
  mode: 'ai' | 'pvp' | 'learning';
  gameId?: string;
}

export function ChessBoard({ difficulty = 'medium', mode, gameId }: ChessBoardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const game = useMemo(() => new Chess(), []);
  
  const [board, setBoard] = useState(chessJsToBoard(game));
  const [selected, setSelected] = useState<ChessSquare | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<ChessSquare[]>([]);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [isThinking, setIsThinking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeGameHistoryOutput | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasCopied, setHasCopied] = useState(false);

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame } = useDoc(gameRef);

  useEffect(() => {
    if (remoteGame?.fen) {
      try {
        if (remoteGame.fen !== game.fen()) {
          game.load(remoteGame.fen);
          setBoard(chessJsToBoard(game));
          setTurn(game.turn());
        }
      } catch (e) {
        console.error("Falha ao carregar FEN remoto:", remoteGame.fen);
      }
    } else if (!gameId) {
      game.load(INITIAL_FEN);
      setBoard(chessJsToBoard(game));
      setTurn('w');
    }
  }, [remoteGame, gameId, game]);

  useEffect(() => {
    if (game.isGameOver()) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [game.isGameOver()]);

  const syncToFirestore = useCallback(async () => {
    if (gameId && gameRef) {
      updateDoc(gameRef, {
        fen: game.fen(),
        turn: game.turn(),
        moves: game.history(),
        lastUpdated: serverTimestamp()
      }).catch(err => console.error("Sync error:", err));
    }
  }, [gameId, gameRef, game]);

  const triggerAiMove = useCallback(async () => {
    if (game.isGameOver()) return;
    setIsThinking(true);
    try {
      const fen = game.fen();
      const aiResponse = await aiOpponentDifficulty({ fen, difficulty });
      const move = game.move(aiResponse.move.trim().toLowerCase());
      
      if (move) {
        setBoard(chessJsToBoard(game));
        setTurn(game.turn());
        await syncToFirestore();
      }
    } catch (error: any) {
      console.error("Movimento da IA falhou:", error);
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, game, syncToFirestore]);

  const executeMove = async (to: ChessSquare) => {
    if (!selected) return;

    const from = selected;
    const uci = `${from}${to}`;

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
        console.error("Erro no feedback da IA:", err);
      } finally {
        setIsThinking(false);
      }
    }

    try {
      const move = game.move({ from, to, promotion: 'q' });
      
      if (!move) return;

      setBoard(chessJsToBoard(game));
      setSelected(null);
      setPossibleMoves([]);
      setTurn(game.turn());
      await syncToFirestore();

      if (game.isGameOver()) {
        if (game.isCheckmate()) {
          toast({ title: "Xeque-mate!", description: `As ${move.color === 'w' ? 'Brancas' : 'Pretas'} venceram.` });
        } else {
          toast({ title: "Empate!", description: "A partida terminou empatada." });
        }
      } else if (mode === 'ai' && game.turn() === 'b') {
        setTimeout(triggerAiMove, 600);
      }
    } catch (e) {
      toast({ title: "Erro", description: "Movimento inválido.", variant: "destructive" });
    }
  };

  const handleSquareClick = (r: number, f: number) => {
    if (isThinking || game.isGameOver()) return;
    const squareName = getSquareName(r, f);

    if (selected && possibleMoves.includes(squareName)) {
      executeMove(squareName);
      return;
    }

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

  const handleAnalyzeMatch = async () => {
    setIsAnalyzing(true);
    try {
      const historyStr = game.history().join(', ');
      const result = await analyzeGameHistory({ gameHistory: historyStr || "Partida curta sem movimentos registrados." });
      setAnalysis(result);
    } catch (err) {
      toast({ title: "Erro na Análise", description: "Não foi possível analisar esta partida.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyInviteLink = async () => {
    // Usamos window.location.origin para que o link sempre aponte para onde você está agora
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://studio-3509208910-49f15.firebaseapp.com';
    const inviteUrl = `${origin}/play?room=${gameId}`;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
        setHasCopied(true);
        toast({ title: "Link Copiado!", description: "Envie para sua filha jogar." });
        setTimeout(() => setHasCopied(false), 2000);
      } else {
        throw new Error("Clipboard API indisponível");
      }
    } catch (err) {
      toast({ 
        title: "Copie Manualmente", 
        description: inviteUrl,
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
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Tempo</p>
            <p className="text-xl font-mono font-bold">{formatTotalTime(elapsedSeconds)}</p>
          </div>
        </div>

        {gameId && (
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full gap-2"
            onClick={copyInviteLink}
          >
            {hasCopied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            {hasCopied ? "Copiado" : "Convidar"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className={cn(
          "px-4 py-1 rounded-full text-xs font-bold transition-all border",
          turn === 'w' ? "bg-white text-black border-primary shadow-md scale-105" : "bg-accent/50 text-muted-foreground border-transparent opacity-50"
        )}>
          BRANCAS
        </div>
        <div className={cn(
          "px-4 py-1 rounded-full text-xs font-bold transition-all border",
          turn === 'b' ? "bg-black text-white border-primary shadow-md scale-105" : "bg-accent/50 text-muted-foreground border-transparent opacity-50"
        )}>
          PRETAS
        </div>
      </div>

      <div className="chess-board relative">
        {isThinking && (
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-lg">
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
                  <div className={cn(
                      "chess-piece text-4xl sm:text-6xl flex items-center justify-center transition-transform",
                      isSelected && "scale-110",
                      piece === piece.toUpperCase() ? "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" : "text-slate-900"
                    )}>
                    {PIECE_ICONS[piece]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-4 w-full">
        {game.isGameOver() && (
          <div className="flex flex-col gap-2 p-6 bg-primary/5 border border-primary/10 rounded-3xl text-center">
            <p className="font-bold text-primary flex items-center justify-center gap-2">
              <Award className="w-5 h-5" />
              Fim de Partida!
            </p>
            <Button 
              className="mt-2 rounded-xl gap-2 h-12 shadow-lg shadow-primary/20"
              onClick={handleAnalyzeMatch}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {isAnalyzing ? "Analisando..." : "Analisar Minha Performance"}
            </Button>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-muted-foreground gap-2 h-8"
            onClick={() => {
              if (confirm("Deseja reiniciar a partida?")) {
                game.load(INITIAL_FEN);
                setBoard(chessJsToBoard(game));
                setTurn('w');
                setElapsedSeconds(0);
                setSelected(null);
                setPossibleMoves([]);
                syncToFirestore();
              }
            }}
          >
            <RotateCcw className="w-3 h-3" />
            Reiniciar
          </Button>
        </div>
      </div>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-lg rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Activity className="w-6 h-6 text-primary" />
              Análise do Professor IA
            </DialogTitle>
            <DialogDescription>Insights baseados nos seus movimentos nesta partida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
              <h4 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">Pontos Fortes</h4>
              <p className="text-sm text-green-800 leading-relaxed">{analysis?.strengths}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
              <h4 className="text-xs font-bold text-red-700 uppercase tracking-widest mb-2">Pontos Fracos</h4>
              <p className="text-sm text-red-800 leading-relaxed">{analysis?.weaknesses}</p>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Avaliação Geral</h4>
              <p className="text-sm font-medium leading-relaxed">{analysis?.overallAssessment}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
