
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

interface DragState {
  square: ChessSquare;
  piece: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function ChessBoard({ difficulty = 'medium', mode, gameId }: ChessBoardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const boardRef = useRef<HTMLDivElement>(null);
  
  const [game, setGame] = useState(() => new Chess());
  const [board, setBoard] = useState(() => chessJsToBoard(game));
  const [selected, setSelected] = useState<ChessSquare | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<ChessSquare[]>([]);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [isThinking, setIsThinking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeGameHistoryOutput | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isInCheck, setIsInCheck] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame } = useDoc(gameRef);

  const checkGameOverStatus = useCallback((currentGame: Chess) => {
    if (currentGame.isGameOver()) {
      setIsGameOver(true);
      const title = currentGame.isCheckmate() ? "XEQUE-MATE!" : "FIM DE JOGO";
      let message = "A partida terminou em empate.";
      
      if (currentGame.isCheckmate()) {
        message = `As ${currentGame.turn() === 'w' ? 'Pretas' : 'Brancas'} venceram! O Rei não tem mais saída.`;
      }

      toast({ title, description: message });
      return true;
    }
    return false;
  }, [toast]);

  useEffect(() => {
    if (remoteGame?.fen && remoteGame.fen !== game.fen()) {
      const newGame = new Chess(remoteGame.fen);
      setGame(newGame);
      setBoard(chessJsToBoard(newGame));
      setTurn(newGame.turn());
      setIsInCheck(newGame.inCheck());
      checkGameOverStatus(newGame);
    }
  }, [remoteGame, checkGameOverStatus, game]);

  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [isGameOver]);

  const syncToFirestore = useCallback((currentGame: Chess) => {
    if (gameId && gameRef) {
      updateDocumentNonBlocking(gameRef, {
        fen: currentGame.fen(),
        turn: currentGame.turn(),
        moves: currentGame.history(),
        lastUpdated: serverTimestamp()
      });
    }
  }, [gameId, gameRef]);

  const handleRestart = () => {
    const newGame = new Chess();
    setGame(newGame);
    setBoard(chessJsToBoard(newGame));
    setTurn('w');
    setIsInCheck(false);
    setIsGameOver(false);
    setElapsedSeconds(0);
    setAnalysis(null);
    setSelected(null);
    setPossibleMoves([]);
    setDragState(null);

    if (gameId && gameRef) {
      updateDocumentNonBlocking(gameRef, {
        fen: INITIAL_FEN,
        turn: 'w',
        moves: [],
        lastUpdated: serverTimestamp()
      });
    }
    
    toast({ title: "Reiniciando...", description: "Tabuleiro resetado para o início." });
  };

  const triggerAiMove = useCallback(async (currentGame: Chess) => {
    if (currentGame.isGameOver()) return;
    setIsThinking(true);
    try {
      const aiResponse = await aiOpponentDifficulty({ fen: currentGame.fen(), difficulty });
      const moveStr = aiResponse.move.trim().toLowerCase();
      
      try {
        currentGame.move(moveStr);
      } catch (e) {
        const legalMoves = currentGame.moves();
        if (legalMoves.length > 0) currentGame.move(legalMoves[0]);
      }
      
      setBoard(chessJsToBoard(currentGame));
      setTurn(currentGame.turn());
      setIsInCheck(currentGame.inCheck());
      syncToFirestore(currentGame);
      checkGameOverStatus(currentGame);
    } catch (error) {
      console.error("AI Error", error);
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, syncToFirestore, checkGameOverStatus]);

  const executeMove = async (from: ChessSquare, to: ChessSquare) => {
    if (isGameOver) return;
    
    const targetPiece = game.get(to);
    if (targetPiece && targetPiece.type === 'k') {
      toast({ 
        title: "Movimento Ilegal!", 
        description: "O Rei não pode ser capturado. O objetivo é o Xeque-mate!", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const move = game.move({ from, to, promotion: 'q' });
      if (!move) return;

      setBoard(chessJsToBoard(game));
      setSelected(null);
      setPossibleMoves([]);
      setTurn(game.turn());
      setIsInCheck(game.inCheck());
      syncToFirestore(game);

      if (!checkGameOverStatus(game) && mode === 'ai' && game.turn() === 'b') {
        setTimeout(() => triggerAiMove(game), 600);
      }
    } catch (e) {
      console.error("Move error", e);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, r: number, f: number) => {
    if (isThinking || isGameOver) return;
    const squareName = getSquareName(r, f);
    const piece = game.get(squareName);

    if (piece && piece.color === game.turn()) {
      setSelected(squareName);
      const moves = game.moves({ square: squareName, verbose: true })
        .filter(m => game.get(m.to as ChessSquare)?.type !== 'k')
        .map(m => m.to as ChessSquare);
      setPossibleMoves(moves);

      setDragState({
        square: squareName,
        piece: piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase(),
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      if (selected && possibleMoves.includes(squareName)) {
        executeMove(selected, squareName);
      } else {
        setSelected(null);
        setPossibleMoves([]);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    setDragState({
      ...dragState,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const f = Math.floor((x / rect.width) * 8);
    const r = Math.floor((y / rect.height) * 8);

    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const targetSquare = getSquareName(r, f);
      if (targetSquare !== dragState.square && possibleMoves.includes(targetSquare)) {
        executeMove(dragState.square, targetSquare);
      }
    }

    setDragState(null);
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
    const publicDomain = "studio--studio-3509208910-49f15.us-central1.hosted.app";
    const inviteUrl = `https://${publicDomain}/play?room=${gameId}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast({ title: "Link Público Copiado!", description: "Envie este link para sua filha jogar." });
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
             <Share2 className="w-3 h-3" /> Convidar Filha
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

      <div 
        ref={boardRef}
        className="chess-board relative shadow-2xl rounded-2xl overflow-hidden border-8 border-slate-900/10 bg-slate-800 touch-none select-none"
      >
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
                  <p className="text-sm font-bold text-muted-foreground mt-2 mb-6">Bela partida!</p>
                  <div className="grid gap-2">
                    <Button onClick={handleAnalyzeMatch} className="rounded-xl h-12 gap-2 font-black">
                      <Activity className="w-4 h-4" /> Feedback da IA
                    </Button>
                    <Button variant="ghost" onClick={handleRestart} className="text-xs">
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
            const isDraggingThis = dragState?.square === squareName;

            return (
              <div
                key={`${r}-${f}`}
                onPointerDown={(e) => handlePointerDown(e, r, f)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={cn(
                  "chess-square h-full w-full select-none touch-none cursor-grab active:cursor-grabbing",
                  isLight ? "bg-[#EBECD0]" : "bg-[#779556]",
                  isSelected && !isDraggingThis && "bg-[#F5F682]",
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
                  <div 
                    style={isDraggingThis ? {
                      position: 'fixed',
                      left: dragState.currentX,
                      top: dragState.currentY,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 100,
                      pointerEvents: 'none',
                      width: '80px',
                      height: '80px',
                    } : {}}
                    className={cn(
                      "chess-piece text-5xl sm:text-7xl flex items-center justify-center transition-transform select-none pointer-events-none",
                      piece === piece.toUpperCase() ? "text-white drop-shadow-md" : "text-slate-900",
                      isDraggingThis && "opacity-90 scale-125"
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

      <div className="w-full flex justify-center gap-4 mt-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[10px] font-black uppercase tracking-widest gap-2 opacity-50 hover:opacity-100"
            onClick={handleRestart}
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
