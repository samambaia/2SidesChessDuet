
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';
import { INITIAL_FEN, PIECE_ICONS, formatTotalTime, chessJsToBoard, getSquareName } from '@/lib/chess-utils';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { analyzeGameHistory, type AnalyzeGameHistoryOutput } from '@/ai/flows/analyze-game-history';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Activity, ShieldAlert, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const [isInCheck, setIsInCheck] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame } = useDoc(gameRef);

  const checkGameOverStatus = useCallback(() => {
    if (game.isGameOver()) {
      setIsGameOver(true);
      const title = game.isCheckmate() ? "XEQUE-MATE!" : "FIM DE JOGO";
      const message = game.isCheckmate() 
        ? `As ${game.turn() === 'w' ? 'Pretas' : 'Brancas'} venceram! O Rei não tem mais saída.`
        : "A partida terminou em empate.";

      toast({ title, description: message });
      return true;
    }
    return false;
  }, [game, toast]);

  useEffect(() => {
    if (remoteGame?.fen && remoteGame.fen !== game.fen()) {
      game.load(remoteGame.fen);
      setBoard(chessJsToBoard(game));
      setTurn(game.turn());
      setIsInCheck(game.inCheck());
      checkGameOverStatus();
    }
  }, [remoteGame, game, checkGameOverStatus]);

  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [isGameOver]);

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
      const aiResponse = await aiOpponentDifficulty({ fen: game.fen(), difficulty });
      const moveStr = aiResponse.move.trim().toLowerCase();
      
      const move = game.move(moveStr);
      if (!move) {
        // Fallback para movimento aleatório se a IA falhar
        const legalMoves = game.moves();
        if (legalMoves.length > 0) game.move(legalMoves[0]);
      }
      
      setBoard(chessJsToBoard(game));
      setTurn(game.turn());
      setIsInCheck(game.inCheck());
      syncToFirestore();
      checkGameOverStatus();
    } catch (error) {
      console.error("AI Error", error);
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, game, syncToFirestore, checkGameOverStatus]);

  const executeMove = async (to: ChessSquare) => {
    if (!selected || isGameOver) return;
    
    // REGRA DE OURO: Impedir captura física do Rei
    const targetPiece = game.get(to);
    if (targetPiece && targetPiece.type === 'k') {
      toast({ 
        title: "Movimento Ilegal!", 
        description: "O Rei nunca pode ser capturado. Você deve cercá-lo para dar Xeque-mate.", 
        variant: "destructive" 
      });
      setSelected(null);
      setPossibleMoves([]);
      return;
    }

    try {
      const move = game.move({ from: selected, to, promotion: 'q' });
      if (!move) {
        toast({ title: "Ilegal", description: "Esse movimento deixaria seu Rei em perigo!", variant: "destructive" });
        return;
      }

      setBoard(chessJsToBoard(game));
      setSelected(null);
      setPossibleMoves([]);
      setTurn(game.turn());
      setIsInCheck(game.inCheck());
      syncToFirestore();

      if (!checkGameOverStatus() && mode === 'ai' && game.turn() === 'b') {
        setTimeout(triggerAiMove, 600);
      }
    } catch (e) {
      toast({ title: "Erro", description: "Movimento não permitido pelas regras.", variant: "destructive" });
    }
  };

  const handleSquareClick = (r: number, f: number) => {
    if (isThinking || isGameOver) return;
    const squareName = getSquareName(r, f);
    if (selected && possibleMoves.includes(squareName)) {
      executeMove(squareName);
      return;
    }
    const piece = game.get(squareName);
    if (piece && piece.color === game.turn()) {
      setSelected(squareName);
      setPossibleMoves(game.moves({ square: squareName, verbose: true }).map(m => m.to));
    } else {
      setSelected(null);
      setPossibleMoves([]);
    }
  };

  const handleAnalyzeMatch = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeGameHistory({ gameHistory: game.history().join(', ') || "Partida curta." });
      setAnalysis(result);
    } catch (err) {
      toast({ title: "Erro na análise", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInvite = async () => {
    const inviteUrl = `${window.location.origin}/play?room=${gameId}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast({ title: "Link Copiado!", description: "Envie para sua filha entrar na sala." });
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px] animate-in fade-in duration-700">
      <div className="w-full flex justify-between items-center px-4 mb-2">
         <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-lg">{formatTotalTime(elapsedSeconds)}</span>
         </div>
         {gameId && !isGameOver && (
           <Button variant="outline" size="sm" className="rounded-full gap-2 border-primary/20" onClick={handleInvite}>
             <Share2 className="w-3 h-3" /> Convidar
           </Button>
         )}
      </div>

      {isInCheck && !isGameOver && (
        <div className="w-full animate-bounce">
          <Alert variant="destructive" className="rounded-2xl border-2 shadow-lg bg-destructive/5">
            <ShieldAlert className="h-5 w-5" />
            <AlertTitle className="font-black uppercase tracking-widest text-xs">CUIDADO! XEQUE!</AlertTitle>
            <AlertDescription className="text-[10px] font-medium">Proteja seu Rei agora!</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex items-center gap-6 mb-2">
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2",
          turn === 'w' ? "bg-white text-slate-900 border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>BRANCAS</div>
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2",
          turn === 'b' ? "bg-slate-900 text-white border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>PRETAS</div>
      </div>

      <div className="chess-board relative shadow-2xl rounded-2xl overflow-hidden border-8 border-slate-900/10 bg-slate-800">
        {(isThinking || isGameOver) && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in">
             {isThinking && (
               <div className="bg-white/95 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm font-black uppercase tracking-widest">IA Analisando...</span>
               </div>
             )}
             {isGameOver && (
               <div className="bg-white/95 p-8 rounded-[2.5rem] shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 scale-110">
                  <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">FIM DE JOGO</h2>
                  <p className="text-sm font-bold text-muted-foreground mt-2 mb-6">Parabéns pela partida!</p>
                  <div className="grid gap-2">
                    <Button onClick={handleAnalyzeMatch} className="rounded-xl h-12 gap-2 font-black">
                      <Activity className="w-4 h-4" /> Feedback da IA
                    </Button>
                    <Button variant="ghost" onClick={() => window.location.reload()} className="text-xs">
                      Jogar Novamente
                    </Button>
                  </div>
               </div>
             )}
          </div>
        )}
        
        {board.map((row, r) => 
          row.map((piece, f) => {
            const squareName = getSquareName(r, f);
            const isLight = (r + f) % 2 === 0;
            const isSelected = selected === squareName;
            const isPossible = possibleMoves.includes(squareName);
            const isKingInCheck = isInCheck && piece && piece.toLowerCase() === 'k' && 
                               ((piece === 'K' && turn === 'w') || (piece === 'k' && turn === 'b'));

            return (
              <div
                key={`${r}-${f}`}
                onClick={() => handleSquareClick(r, f)}
                className={cn(
                  "chess-square",
                  isLight ? "bg-[#EBECD0]" : "bg-[#779556]",
                  isSelected && "bg-[#F5F682]",
                  isPossible && "cursor-pointer",
                  isKingInCheck && "bg-destructive/60 animate-pulse"
                )}
              >
                {isPossible && (
                  <div className={cn(
                    "absolute z-20 rounded-full",
                    piece ? "inset-0 border-[4px] border-black/10" : "w-4 h-4 bg-black/10"
                  )} />
                )}
                {piece && (
                  <div className={cn(
                      "chess-piece text-5xl sm:text-7xl flex items-center justify-center transition-transform active:scale-125",
                      piece === piece.toUpperCase() ? "text-white drop-shadow-md" : "text-slate-900"
                    )}>
                    {PIECE_ICONS[piece]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="w-full flex justify-center gap-4 mt-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[10px] font-black uppercase tracking-widest gap-2 opacity-50 hover:opacity-100"
            onClick={() => { if (confirm("Reiniciar partida?")) window.location.reload(); }}
          >
            <RotateCcw className="w-3 h-3" /> Reiniciar Jogo
          </Button>
      </div>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-3xl font-black">
              <Activity className="w-8 h-8 text-primary" /> Tutor de Xadrez
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-8">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
              <h4 className="text-[11px] font-black text-green-700 uppercase mb-2">PONTOS FORTES</h4>
              <p className="text-sm text-green-800">{analysis?.strengths}</p>
            </div>
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
              <h4 className="text-[11px] font-black text-amber-700 uppercase mb-2">OPORTUNIDADES</h4>
              <p className="text-sm text-amber-800">{analysis?.weaknesses}</p>
            </div>
            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
              <h4 className="text-[11px] font-black text-primary uppercase mb-2">VEREDITO</h4>
              <p className="text-lg font-bold">{analysis?.overallAssessment}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
