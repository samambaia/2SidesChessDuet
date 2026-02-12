
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

  // Timer logic - client side only to avoid hydration mismatch
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
      // AI failed to respond or move was invalid
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
      toast({ title: "Link Copiado!", description: "Agora é só compartilhar com quem você quer jogar!" });
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      toast({ title: "Link da Sala:", description: text });
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px] animate-in fade-in duration-700">
      {gameId && (
        <Alert className="bg-primary/5 border-primary/20 rounded-2xl mb-2 shadow-sm">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            Status da Publicação
            <Badge variant="outline" className="text-[9px] bg-yellow-100 text-yellow-700 border-yellow-200">Aguardando Publish</Badge>
          </AlertTitle>
          <AlertDescription className="text-[11px] leading-relaxed mt-1">
            Certifique-se de que o botão <strong>Publish</strong> no topo terminou para que o link funcione no celular da sua filha.
          </AlertDescription>
        </Alert>
      )}

      <div className="w-full flex items-center justify-between px-6 py-4 bg-accent/20 rounded-[1.5rem] border border-accent/30 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Tempo Decorrido</p>
            <p className="text-2xl font-mono font-bold tracking-tight">{formatTotalTime(elapsedSeconds)}</p>
          </div>
        </div>

        {gameId && (
          <Button 
            variant="default" 
            size="sm" 
            className="rounded-full gap-2 px-6 h-11 font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all active:scale-95"
            onClick={handleInvite}
          >
            {hasCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {hasCopied ? "Copiado!" : "Convidar"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-6 mb-2">
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2",
          turn === 'w' ? "bg-white text-slate-900 border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>
          BRANCAS
        </div>
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2",
          turn === 'b' ? "bg-slate-900 text-white border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>
          PRETAS
        </div>
      </div>

      <div className="chess-board relative shadow-2xl rounded-2xl overflow-hidden border-8 border-slate-900/5">
        {isThinking && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-50 flex items-center justify-center">
             <div className="bg-white/95 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-100 animate-in zoom-in-95">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-black uppercase tracking-widest text-primary">Processando Jogada...</span>
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
                  isLight ? "bg-[#EBECD0]" : "bg-[#779556]",
                  isSelected && "bg-[#F5F682]/80",
                  isPossible && "cursor-pointer"
                )}
              >
                {isPossible && (
                  <div className={cn(
                    "absolute z-20 rounded-full",
                    piece ? "inset-0 border-[6px] border-black/10" : "w-5 h-5 bg-black/10"
                  )} />
                )}
                {piece && (
                  <div 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, squareName)}
                    className={cn(
                      "chess-piece text-5xl sm:text-7xl flex items-center justify-center transition-all active:scale-125 touch-none select-none",
                      isSelected && "scale-110 rotate-3",
                      piece === piece.toUpperCase() ? "text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" : "text-slate-900 drop-shadow-[0_2px_3px_rgba(255,255,255,0.2)]"
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
          <div className="flex flex-col gap-4 p-8 bg-primary/10 border-2 border-primary/20 rounded-[2rem] text-center animate-in zoom-in-95 duration-500 shadow-xl">
            <div className="mx-auto bg-primary/20 p-4 rounded-full">
              <Award className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black text-primary uppercase tracking-tight">Fim de Partida</h3>
              <p className="text-sm font-medium text-slate-600 mt-1">Gostaria de uma análise técnica da IA sobre este jogo?</p>
            </div>
            <Button 
              className="rounded-2xl gap-3 h-14 text-lg font-bold shadow-xl shadow-primary/25"
              onClick={handleAnalyzeMatch}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
              {isAnalyzing ? "Gerando Relatório..." : "Receber Feedback da IA"}
            </Button>
          </div>
        )}

        <div className="flex justify-center mt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest gap-2 hover:bg-destructive/5 hover:text-destructive transition-colors"
            onClick={() => {
              if (confirm("Deseja mesmo reiniciar a partida? Todo o progresso atual será perdido.")) {
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
            Reiniciar Tabuleiro
          </Button>
        </div>
      </div>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-10 border-none shadow-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-3xl font-black tracking-tight">
              <div className="bg-primary/10 p-3 rounded-2xl">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              Análise do Tutor
            </DialogTitle>
            <DialogDescription className="text-lg font-medium">
              Aqui estão os insights sobre sua performance técnica.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-8">
            <div className="p-6 bg-green-50 rounded-[1.5rem] border border-green-100/50 shadow-sm">
              <h4 className="text-[11px] font-black text-green-700 uppercase tracking-[0.2em] mb-3">PONTOS FORTES</h4>
              <p className="text-base text-green-800 leading-relaxed font-medium">{analysis?.strengths}</p>
            </div>
            <div className="p-6 bg-amber-50 rounded-[1.5rem] border border-amber-100/50 shadow-sm">
              <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-[0.2em] mb-3">OPORTUNIDADES</h4>
              <p className="text-base text-amber-800 leading-relaxed font-medium">{analysis?.weaknesses}</p>
            </div>
            <div className="p-6 bg-primary/5 rounded-[1.5rem] border border-primary/10 shadow-inner">
              <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-3">VEREDITO FINAL</h4>
              <p className="text-lg font-bold text-slate-800 leading-snug">{analysis?.overallAssessment}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
