
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';
import { INITIAL_FEN, PIECE_ICONS, formatTotalTime, chessJsToBoard, getSquareName } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { analyzeGameHistory, type AnalyzeGameHistoryOutput } from '@/ai/flows/analyze-game-history';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Check, Activity, Award, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';

interface ChessBoardProps {
  difficulty?: 'easy' | 'medium' | 'hard';
  mode: 'ai' | 'pvp' | 'learning';
  gameId?: string;
}

export function ChessBoard({ difficulty = 'medium', mode, gameId }: ChessBoardProps) {
  const firestore = useFirestore();
  const { user } = useUser();
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

  // Auto-join logic for Player 2
  useEffect(() => {
    if (remoteGame && user && !remoteGame.player2Id && remoteGame.player1Id !== user.uid) {
      updateDocumentNonBlocking(gameRef!, {
        player2Id: user.uid,
        lastUpdated: serverTimestamp()
      });
    }
  }, [remoteGame, user, gameRef]);

  // Sync remote state to local chess.js instance
  useEffect(() => {
    if (remoteGame?.fen) {
      if (remoteGame.fen !== game.fen()) {
        try {
          game.load(remoteGame.fen);
          setBoard(chessJsToBoard(game));
          setTurn(game.turn());
        } catch (e) {
          // Silent catch for sync discrepancies
        }
      }
    } else if (!gameId) {
      game.load(INITIAL_FEN);
      setBoard(chessJsToBoard(game));
      setTurn('w');
    }
  }, [remoteGame, gameId, game]);

  // Timer logic
  useEffect(() => {
    if (game.isGameOver()) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [game]);

  const syncToFirestore = useCallback(() => {
    if (gameId && gameRef) {
      updateDocumentNonBlocking(gameRef, {
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
      const move = game.move(aiResponse.move.trim().toLowerCase());
      
      if (move) {
        setBoard(chessJsToBoard(game));
        setTurn(game.turn());
        syncToFirestore();
      }
    } catch (error: any) {
      // IA failed to respond or move was invalid
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, game, syncToFirestore]);

  const executeMove = async (to: ChessSquare, fromOverride?: ChessSquare) => {
    const from = fromOverride || selected;
    if (!from) return;
    
    const uci = `${from}${to}`;

    if (mode === 'learning') {
      setIsThinking(true);
      try {
        const feedback = await getMoveFeedback({ currentBoardState: game.fen(), userMove: uci });
        if (!feedback.isLegalMove) {
          toast({ title: "Movimento Inválido", description: feedback.feedback, variant: "destructive" });
          setSelected(null);
          setPossibleMoves([]);
          return;
        }
      } catch (err) {
        // Feedback service error
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
      syncToFirestore();

      if (game.isGameOver()) {
        const winMessage = game.isCheckmate() 
          ? `Xeque-mate! As ${move.color === 'w' ? 'Brancas' : 'Pretas'} venceram.`
          : "A partida terminou empatada.";
        toast({ title: "Fim de Jogo", description: winMessage });
      } else if (mode === 'ai' && game.turn() === 'b') {
        setTimeout(triggerAiMove, 600);
      }
    } catch (e) {
      toast({ title: "Ops!", description: "Esse movimento não é permitido pelas regras.", variant: "destructive" });
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

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, square: ChessSquare) => {
    if (isThinking || game.isGameOver()) {
      e.preventDefault();
      return;
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square);
      const moves = game.moves({ square: square, verbose: true });
      setPossibleMoves(moves.map(m => m.to));
      e.dataTransfer.setData('fromSquare', square);
      e.dataTransfer.effectAllowed = 'move';
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, toSquare: ChessSquare) => {
    e.preventDefault();
    const fromSquare = e.dataTransfer.getData('fromSquare') as ChessSquare;
    if (fromSquare && fromSquare !== toSquare) {
      executeMove(toSquare, fromSquare);
    }
  };

  const handleAnalyzeMatch = async () => {
    setIsAnalyzing(true);
    try {
      const historyStr = game.history().join(', ');
      const result = await analyzeGameHistory({ gameHistory: historyStr || "Partida muito rápida para análise." });
      setAnalysis(result);
    } catch (err) {
      toast({ title: "Análise Indisponível", description: "O professor de IA está ocupado no momento.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInvite = async () => {
    const publicUrl = `https://studio-3509208910-49f15.firebaseapp.com/play?room=${gameId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ChessDuet - Desafio Aceito?',
          text: 'Entre na minha sala de xadrez para jogarmos uma partida!',
          url: publicUrl,
        });
      } catch (err) {
        copyToClipboard(publicUrl);
      }
    } else {
      copyToClipboard(publicUrl);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      toast({ title: "Link Copiado!", description: "Agora é só colar no WhatsApp da sua filha!" });
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      toast({ title: "Link da Sala:", description: text });
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px]">
      {gameId && (
        <Alert className="bg-primary/5 border-primary/20 rounded-2xl mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            Status do Site
            <Badge variant="outline" className="text-[9px] bg-yellow-100 text-yellow-700 border-yellow-200">Aguardando Publish</Badge>
          </AlertTitle>
          <AlertDescription className="text-[11px] leading-relaxed mt-1">
            Se o link der erro, verifique se o botão <strong>Publish</strong> no topo terminou. O site público só funciona após a conclusão.
          </AlertDescription>
        </Alert>
      )}

      <div className="w-full flex items-center justify-between px-4 py-3 bg-accent/20 rounded-2xl border border-accent/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-full">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Duração</p>
            <p className="text-xl font-mono font-bold">{formatTotalTime(elapsedSeconds)}</p>
          </div>
        </div>

        {gameId && (
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="rounded-full gap-2 shadow-md"
              onClick={handleInvite}
            >
              {hasCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {hasCopied ? "Copiado" : "Convidar Filha"}
            </Button>
          </div>
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
                <span className="text-xs font-bold uppercase text-primary">Processando...</span>
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
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, squareName)}
                className={cn(
                  "chess-square",
                  isLight ? "light" : "dark",
                  isSelected && "highlight-selected",
                  isPossible && "cursor-pointer"
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
                    draggable 
                    onDragStart={(e) => handleDragStart(e, squareName)}
                    className={cn(
                      "chess-piece text-4xl sm:text-6xl flex items-center justify-center transition-transform active:scale-125 touch-none",
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
          <div className="flex flex-col gap-2 p-6 bg-primary/5 border border-primary/10 rounded-3xl text-center animate-in zoom-in-95 duration-300">
            <p className="font-bold text-primary flex items-center justify-center gap-2">
              <Award className="w-5 h-5" />
              Partida Finalizada!
            </p>
            <Button 
              className="mt-2 rounded-xl gap-2 h-12 shadow-lg shadow-primary/20"
              onClick={handleAnalyzeMatch}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {isAnalyzing ? "Analisando..." : "Ver Feedback da IA"}
            </Button>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-muted-foreground gap-2 h-8"
            onClick={() => {
              if (confirm("Deseja reiniciar a partida atual?")) {
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
            Reiniciar Jogo
          </Button>
        </div>
      </div>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-lg rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Activity className="w-6 h-6 text-primary" />
              Análise do Professor
            </DialogTitle>
            <DialogDescription>Dicas personalizadas para você melhorar seu jogo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
              <h4 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">Seus Acertos</h4>
              <p className="text-sm text-green-800 leading-relaxed">{analysis?.strengths}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
              <h4 className="text-xs font-bold text-red-700 uppercase tracking-widest mb-2">Onde Melhorar</h4>
              <p className="text-sm text-red-800 leading-relaxed">{analysis?.weaknesses}</p>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Avaliação Final</h4>
              <p className="text-sm font-medium leading-relaxed">{analysis?.overallAssessment}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
