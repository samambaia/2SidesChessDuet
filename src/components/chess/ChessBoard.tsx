
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';
import { INITIAL_FEN, PIECE_ICONS, formatTotalTime, chessJsToBoard, getSquareName } from '@/lib/chess-utils';
import { getMoveFeedback } from '@/ai/flows/learning-mode-move-feedback';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { analyzeGameHistory, type AnalyzeGameHistoryOutput } from '@/ai/flows/analyze-game-history';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Check, Activity, Award, AlertCircle, History, ShieldAlert } from 'lucide-react';
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

const STORAGE_KEY = 'chess_duet_saved_game';

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
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedGameData, setSavedGameData] = useState<any>(null);
  const [isInCheck, setIsInCheck] = useState(false);

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame } = useDoc(gameRef);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!game.isGameOver() && game.history().length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [game]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !gameId) {
      const parsed = JSON.parse(saved);
      if (parsed.fen !== INITIAL_FEN) {
        setSavedGameData(parsed);
        setShowResumeDialog(true);
      }
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      const state = {
        fen: game.fen(),
        mode,
        elapsedSeconds,
        difficulty,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [board, turn, mode, difficulty, elapsedSeconds, gameId, game]);

  useEffect(() => {
    if (gameId && gameRef && remoteGame && user && !remoteGame.player2Id && remoteGame.player1Id !== user.uid) {
      updateDocumentNonBlocking(gameRef, {
        player2Id: user.uid,
        lastUpdated: serverTimestamp()
      });
    }
  }, [remoteGame, user, gameRef, gameId]);

  useEffect(() => {
    if (remoteGame?.fen) {
      if (remoteGame.fen !== game.fen()) {
        try {
          game.load(remoteGame.fen);
          setBoard(chessJsToBoard(game));
          setTurn(game.turn());
          setIsInCheck(game.inCheck());
        } catch (e) {
          console.error("Erro ao sincronizar FEN remoto:", e);
        }
      }
    } else if (!gameId && !savedGameData) {
      game.load(INITIAL_FEN);
      setBoard(chessJsToBoard(game));
      setTurn('w');
      setIsInCheck(false);
    }
  }, [remoteGame, gameId, game, savedGameData]);

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
      const moveStr = aiResponse.move.trim().toLowerCase();
      
      let move = null;
      try {
        move = game.move(moveStr);
      } catch (e) {
        const legalMoves = game.moves();
        if (legalMoves.length > 0) {
          game.move(legalMoves[0]);
          move = true;
        }
      }
      
      if (move) {
        setBoard(chessJsToBoard(game));
        setTurn(game.turn());
        const inCheck = game.inCheck();
        setIsInCheck(inCheck);
        if (inCheck) {
          toast({
            title: "Atenção!",
            description: "Você está em XEQUE! Proteja seu Rei.",
            variant: "destructive"
          });
        }
        syncToFirestore();
      }
    } catch (error: any) {
      toast({ 
        title: "Erro na IA", 
        description: "Não foi possível obter o movimento da IA.",
        variant: "destructive"
      });
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, game, syncToFirestore, toast]);

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
      const inCheck = game.inCheck();
      setIsInCheck(inCheck);
      
      if (inCheck && !game.isGameOver()) {
        toast({
          title: "XEQUE!",
          description: `O Rei das ${game.turn() === 'w' ? 'Brancas' : 'Pretas'} está sob ataque!`,
        });
      }

      syncToFirestore();

      if (game.isGameOver()) {
        const winMessage = game.isCheckmate() 
          ? `Xeque-mate! As ${move.color === 'w' ? 'Brancas' : 'Pretas'} venceram.`
          : "A partida terminou empatada.";
        toast({ title: "Fim de Jogo", description: winMessage });
        localStorage.removeItem(STORAGE_KEY);
      } else if (mode === 'ai' && game.turn() === 'b') {
        setTimeout(triggerAiMove, 500);
      }
    } catch (e) {
      toast({ title: "Ops!", description: "Movimento ilegal.", variant: "destructive" });
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
      const result = await analyzeGameHistory({ gameHistory: historyStr || "Partida curta." });
      setAnalysis(result);
    } catch (err) {
      toast({ title: "Erro na análise", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInvite = async () => {
    const hostname = window.location.hostname;
    const isPrivateEnv = hostname.includes('workstations.cloud') || 
                        hostname.includes('cloudworkstations.dev') || 
                        hostname === 'localhost';
    
    const publicBaseUrl = "https://studio--studio-3509208910-49f15.us-central1.hosted.app/play";
    const baseUrl = isPrivateEnv ? publicBaseUrl : (window.location.origin + window.location.pathname);
    const inviteUrl = `${baseUrl}?room=${gameId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: 'ChessDuet - Jogue Comigo!', 
          text: 'Entra aí no meu jogo de xadrez!',
          url: inviteUrl 
        });
      } catch (err) {
        copyToClipboard(inviteUrl);
      }
    } else {
      copyToClipboard(inviteUrl);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      toast({ title: "Link Copiado!", description: "Envie este link para sua filha." });
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {}
  };

  const handleResumeGame = () => {
    if (savedGameData) {
      game.load(savedGameData.fen);
      setBoard(chessJsToBoard(game));
      setTurn(game.turn());
      setElapsedSeconds(savedGameData.elapsedSeconds || 0);
      setIsInCheck(game.inCheck());
      toast({ title: "Jogo Retomado", description: "Continuando de onde você parou." });
    }
    setShowResumeDialog(false);
  };

  const handleDiscardSavedGame = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedGameData(null);
    setShowResumeDialog(false);
    game.load(INITIAL_FEN);
    setBoard(chessJsToBoard(game));
    setTurn('w');
    setIsInCheck(false);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px] animate-in fade-in duration-700">
      {gameId && (
        <Alert className="bg-primary/5 border-primary/20 rounded-2xl mb-2 shadow-sm">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            Sala Online
            <Badge variant="outline" className="text-[9px] bg-green-100 text-green-700">Ativa</Badge>
          </AlertTitle>
          <AlertDescription className="text-[11px] leading-relaxed mt-1">
            Convide alguém para jogar usando o botão abaixo. As regras de segurança permitem que o link funcione instantaneamente.
          </AlertDescription>
        </Alert>
      )}

      {isInCheck && !game.isGameOver() && (
        <div className="w-full animate-bounce">
          <Alert variant="destructive" className="rounded-2xl border-2 shadow-lg">
            <ShieldAlert className="h-5 w-5" />
            <AlertTitle className="font-black uppercase tracking-widest text-sm">O REI ESTÁ EM XEQUE!</AlertTitle>
            <AlertDescription className="text-xs font-medium">
              Sua próxima jogada deve obrigatoriamente proteger o seu Rei.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="w-full flex items-center justify-between px-6 py-4 bg-accent/20 rounded-[1.5rem] border border-accent/30 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Tempo</p>
            <p className="text-2xl font-mono font-bold tracking-tight">{formatTotalTime(elapsedSeconds)}</p>
          </div>
        </div>

        {gameId && (
          <Button 
            variant="default" 
            size="sm" 
            className="rounded-full gap-2 px-6 h-11 font-bold shadow-lg shadow-primary/25"
            onClick={handleInvite}
          >
            {hasCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {hasCopied ? "Copiado" : "Convidar Filha"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-6 mb-2">
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2",
          turn === 'w' ? "bg-white text-slate-900 border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40",
          isInCheck && turn === 'w' && "border-destructive text-destructive bg-destructive/5 animate-pulse"
        )}>BRANCAS</div>
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2",
          turn === 'b' ? "bg-slate-900 text-white border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40",
          isInCheck && turn === 'b' && "border-destructive text-destructive bg-destructive/5 animate-pulse"
        )}>PRETAS</div>
      </div>

      <div className="chess-board relative shadow-2xl rounded-2xl overflow-hidden border-8 border-slate-900/5">
        {isThinking && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-50 flex items-center justify-center">
             <div className="bg-white/95 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-100 animate-in zoom-in-95">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-black uppercase tracking-widest text-primary">Pensando...</span>
             </div>
          </div>
        )}
        
        {board.map((row, r) => 
          row.map((piece, f) => {
            const squareName = getSquareName(r, f);
            const isLight = (r + f) % 2 === 0;
            const isSelected = selected === squareName;
            const isPossible = possibleMoves.includes(squareName);
            
            // Highlight the King if in check
            const isKingInCheck = isInCheck && piece && piece.toLowerCase() === 'k' && 
                               ((piece === 'K' && turn === 'w') || (piece === 'k' && turn === 'b'));

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
                  isPossible && "cursor-pointer",
                  isKingInCheck && "bg-destructive/60 animate-pulse"
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
                      piece === piece.toUpperCase() ? "text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" : "text-slate-900"
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
            <Award className="w-10 h-10 text-primary mx-auto" />
            <h3 className="text-xl font-black text-primary uppercase">Fim de Partida</h3>
            <Button 
              className="rounded-2xl gap-3 h-14 font-bold shadow-xl shadow-primary/25"
              onClick={handleAnalyzeMatch}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
              {isAnalyzing ? "Analisando..." : "Feedback da IA"}
            </Button>
          </div>
        )}

        <div className="flex justify-center mt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest gap-2"
            onClick={() => {
              if (confirm("Reiniciar partida?")) {
                game.load(INITIAL_FEN);
                setBoard(chessJsToBoard(game));
                setTurn('w');
                setElapsedSeconds(0);
                setSelected(null);
                setPossibleMoves([]);
                setIsInCheck(false);
                syncToFirestore();
                localStorage.removeItem(STORAGE_KEY);
              }
            }}
          >
            <RotateCcw className="w-3 h-3" />
            Reiniciar Jogo
          </Button>
        </div>
      </div>

      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black">
              <History className="w-6 h-6 text-primary" />
              Retomar Jogo?
            </DialogTitle>
            <DialogDescription>
              Detectamos uma partida salva. Deseja continuar de onde parou ou começar uma nova?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-6">
            <Button onClick={handleResumeGame} className="h-14 rounded-2xl font-bold text-lg">
              Continuar Partida
            </Button>
            <Button variant="outline" onClick={handleDiscardSavedGame} className="h-12 rounded-2xl">
              Começar de Novo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-3xl font-black">
              <Activity className="w-8 h-8 text-primary" />
              Análise do Tutor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-8">
            <div className="p-6 bg-green-50 rounded-[1.5rem] border border-green-100/50">
              <h4 className="text-[11px] font-black text-green-700 uppercase mb-3">PONTOS FORTES</h4>
              <p className="text-base text-green-800 font-medium">{analysis?.strengths}</p>
            </div>
            <div className="p-6 bg-amber-50 rounded-[1.5rem] border border-amber-100/50">
              <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3">OPORTUNIDADES</h4>
              <p className="text-base text-amber-800 font-medium">{analysis?.weaknesses}</p>
            </div>
            <div className="p-6 bg-primary/5 rounded-[1.5rem] border border-primary/10">
              <h4 className="text-[11px] font-black text-primary uppercase mb-3">VEREDITO</h4>
              <p className="text-lg font-bold text-slate-800">{analysis?.overallAssessment}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
