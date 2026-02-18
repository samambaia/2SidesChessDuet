
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';
import { INITIAL_FEN, PIECE_ICONS, formatTotalTime, chessJsToBoard, getSquareName } from '@/lib/chess-utils';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { analyzeGameHistory, type AnalyzeGameHistoryOutput } from '@/ai/flows/analyze-game-history';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Activity, ShieldAlert, Trophy, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, serverTimestamp, getDoc } from 'firebase/firestore';
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
  const { user } = useUser();
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
  const [isSyncing, setIsSyncing] = useState(false);

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame, isLoading: isRemoteLoading } = useDoc(gameRef);

  // Enforce player color in PvP safely
  const userColor = React.useMemo(() => {
    if (!remoteGame || !user) return 'w'; 
    if (user.uid === remoteGame.player1Id) return 'w';
    if (user.uid === remoteGame.player2Id) return 'b';
    return null; 
  }, [remoteGame, user]);

  const isMyTurn = React.useMemo(() => {
    if (!user) return false;
    if (mode !== 'pvp') return game.turn() === 'w'; 
    if (!remoteGame) return false;
    return remoteGame.turn === (userColor || 'w');
  }, [mode, remoteGame, userColor, game, user]);

  const checkGameOverStatus = useCallback((currentGame: Chess) => {
    if (currentGame.isGameOver()) {
      setIsGameOver(true);
      const title = currentGame.isCheckmate() ? "CHECKMATE!" : "GAME OVER";
      let message = "The game ended in a draw.";
      
      if (currentGame.isCheckmate()) {
        message = `${currentGame.turn() === 'w' ? 'Black' : 'White'} won! The King has no escape.`;
      }

      toast({ title, description: message });
      return true;
    }
    return false;
  }, [toast]);

  const forceResync = useCallback(async () => {
    if (!gameRef) return;
    setIsSyncing(true);
    try {
      const snap = await getDoc(gameRef);
      if (snap.exists()) {
        const data = snap.data();
        const newGame = new Chess(data.fen);
        setGame(newGame);
        setBoard(chessJsToBoard(newGame));
        setTurn(newGame.turn());
        setIsInCheck(newGame.inCheck());
        checkGameOverStatus(newGame);
      }
    } catch (e) {
      console.error("Manual sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  }, [gameRef, checkGameOverStatus]);

  // Handle Focus Re-Sync (Crucial for long matches)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gameId) {
        forceResync();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameId, forceResync]);

  // Resilient Sync: Detect changes from Firestore
  useEffect(() => {
    if (remoteGame?.fen && remoteGame.fen !== game.fen()) {
      setIsSyncing(true);
      try {
        const newGame = new Chess(remoteGame.fen);
        setGame(newGame);
        setBoard(chessJsToBoard(newGame));
        setTurn(newGame.turn());
        setIsInCheck(newGame.inCheck());
        checkGameOverStatus(newGame);
        setIsThinking(false);
      } catch (e) {
        console.error("Critical Sync Error:", e);
      } finally {
        setTimeout(() => setIsSyncing(false), 300);
      }
    }
  }, [remoteGame, checkGameOverStatus, game]);

  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [isGameOver]);

  const updateGameState = (newGame: Chess) => {
    setGame(newGame);
    setBoard(chessJsToBoard(newGame));
    setTurn(newGame.turn());
    setIsInCheck(newGame.inCheck());
    
    if (gameId && gameRef) {
      updateDocumentNonBlocking(gameRef, {
        fen: newGame.fen(),
        turn: newGame.turn(),
        moves: newGame.history(),
        lastUpdated: serverTimestamp()
      });
    }

    if (!checkGameOverStatus(newGame) && mode === 'ai' && newGame.turn() === 'b') {
      setTimeout(() => triggerAiMove(newGame), 600);
    }
  };

  const handleRestart = () => {
    const newGame = new Chess();
    setIsGameOver(false);
    setElapsedSeconds(0);
    setAnalysis(null);
    setSelected(null);
    setPossibleMoves([]);
    setDragState(null);
    
    setGame(newGame);
    setBoard(chessJsToBoard(newGame));
    setTurn('w');
    setIsInCheck(false);

    if (gameId && gameRef) {
      updateDocumentNonBlocking(gameRef, {
        fen: INITIAL_FEN,
        turn: 'w',
        moves: [],
        lastUpdated: serverTimestamp()
      });
    }

    toast({ title: "Game Restarted", description: "The match has been reset for everyone." });
  };

  const triggerAiMove = useCallback(async (currentGame: Chess) => {
    if (currentGame.isGameOver()) return;
    setIsThinking(true);
    try {
      const aiResponse = await aiOpponentDifficulty({ fen: currentGame.fen(), difficulty });
      const nextGame = new Chess(currentGame.fen());
      try {
        nextGame.move(aiResponse.move);
      } catch (e) {
        const legalMoves = nextGame.moves();
        if (legalMoves.length > 0) nextGame.move(legalMoves[0]);
      }
      updateGameState(nextGame);
    } catch (error) {
      console.error("AI Error:", error);
      const nextGame = new Chess(currentGame.fen());
      const legalMoves = nextGame.moves();
      if (legalMoves.length > 0) {
        nextGame.move(legalMoves[0]);
        updateGameState(nextGame);
      }
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, mode, gameId, gameRef, checkGameOverStatus]);

  const executeMove = (from: ChessSquare, to: ChessSquare) => {
    if (isGameOver || isThinking || !isMyTurn || isSyncing) return;
    
    const targetPiece = game.get(to);
    if (targetPiece && targetPiece.type === 'k') {
      toast({ 
        title: "Rule Enforcement", 
        description: "The King cannot be captured. You must achieve Checkmate!", 
        variant: "destructive" 
      });
      return;
    }

    const nextGame = new Chess(game.fen());
    try {
      const move = nextGame.move({ from, to, promotion: 'q' });
      if (move) {
        setSelected(null);
        setPossibleMoves([]);
        updateGameState(nextGame);
      } else {
        toast({ title: "Invalid Move", description: "That move violates chess rules.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Move execution error:", e);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, r: number, f: number) => {
    if (isThinking || isGameOver || !isMyTurn || isSyncing) return;
    const squareName = getSquareName(r, f);
    const piece = game.get(squareName);

    if (piece && piece.color === game.turn() && (mode !== 'pvp' || piece.color === userColor)) {
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

      if (e.target instanceof HTMLElement && typeof e.target.setPointerCapture === 'function') {
        try {
          e.target.setPointerCapture(e.pointerId);
        } catch (captureError) {
          console.warn("Pointer capture failed:", captureError);
        }
      }
    } else if (selected && possibleMoves.includes(squareName)) {
      executeMove(selected, squareName);
    } else {
      setSelected(null);
      setPossibleMoves([]);
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
      const result = await analyzeGameHistory({ gameHistory: game.history().join(', ') || "A short but intense match." });
      setAnalysis(result);
    } catch (err) {
      toast({ title: "AI Coach Error", description: "Failed to analyze the game.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInvite = async () => {
    const inviteUrl = `${window.location.origin}/play?room=${gameId}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast({ title: "Invite Copied!", description: "Share this link with your opponent to start." });
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[600px] animate-in fade-in duration-700">
      <div className="w-full flex justify-between items-center px-4 mb-2">
         <div className="flex items-center gap-3 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-mono font-black text-primary">{formatTotalTime(elapsedSeconds)}</span>
         </div>
         <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="rounded-full h-8 px-3 text-[10px] font-bold" onClick={forceResync} disabled={isSyncing}>
              <RefreshCw className={cn("w-3 h-3 mr-1", isSyncing && "animate-spin")} /> REFRESH
            </Button>
            {gameId && !isGameOver && (
              <Button variant="outline" size="sm" className="rounded-full gap-2 border-primary/20 hover:bg-primary/5 h-8" onClick={handleInvite}>
                <Share2 className="w-3 h-3" /> INVITE
              </Button>
            )}
         </div>
      </div>

      {isInCheck && !isGameOver && (
        <div className="w-full animate-bounce">
          <Alert variant="destructive" className="rounded-2xl border-2 shadow-xl bg-destructive/5">
            <ShieldAlert className="h-5 w-5" />
            <AlertTitle className="font-black uppercase tracking-widest text-xs">WARNING: CHECK!</AlertTitle>
            <AlertDescription className="text-[10px] font-bold">Your King is under fire. Defend it at once!</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex items-center gap-6 mb-2">
        <div className={cn(
          "px-8 py-3 rounded-2xl text-xs font-black transition-all border-2 flex flex-col items-center",
          turn === 'w' ? "bg-white text-slate-900 border-primary shadow-2xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>
          WHITE
          {userColor === 'w' && <span className="text-[8px] font-bold text-primary mt-1">(YOU)</span>}
        </div>
        <div className={cn(
          "px-8 py-3 rounded-2xl text-xs font-black transition-all border-2 flex flex-col items-center",
          turn === 'b' ? "bg-slate-900 text-white border-primary shadow-2xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>
          BLACK
          {userColor === 'b' && <span className="text-[8px] font-bold text-primary mt-1">(YOU)</span>}
        </div>
      </div>

      <div 
        ref={boardRef}
        className="chess-board relative shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden border-[12px] border-slate-900 bg-slate-800 touch-none select-none"
      >
        {(isThinking || isSyncing || isGameOver || (mode === 'pvp' && remoteGame && !remoteGame.player2Id)) && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[3px] animate-in fade-in">
             {(isThinking || isSyncing) && (
               <div className="bg-white/95 px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm font-black uppercase tracking-[0.2em]">{isSyncing ? 'Syncing...' : 'Thinking...'}</span>
               </div>
             )}
             {mode === 'pvp' && remoteGame && !remoteGame.player2Id && !isGameOver && (
               <div className="bg-white/95 px-10 py-8 rounded-[2.5rem] shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 mx-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-6" />
                  <h3 className="text-2xl font-black uppercase tracking-tight italic">Waiting for Opponent</h3>
                  <p className="text-xs font-bold text-muted-foreground mt-2 max-w-[200px] mx-auto">The match will start as soon as your guest joins.</p>
                  <Button onClick={handleInvite} variant="default" size="lg" className="mt-8 rounded-2xl gap-3 shadow-xl">
                    <Share2 className="w-4 h-4" /> COPY GAME LINK
                  </Button>
               </div>
             )}
             {isGameOver && (
               <div className="bg-white/95 p-12 rounded-[3rem] shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 scale-110">
                  <Trophy className="w-20 h-20 text-amber-500 mx-auto mb-6 drop-shadow-lg" />
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">GAME OVER</h2>
                  <p className="text-sm font-black text-muted-foreground mt-2 mb-8 uppercase tracking-widest">Victory Awaits!</p>
                  <div className="grid gap-3">
                    <Button onClick={handleAnalyzeMatch} size="lg" className="rounded-2xl h-14 gap-3 font-black text-lg" disabled={isAnalyzing}>
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />} AI COACH REVIEW
                    </Button>
                    <Button variant="ghost" onClick={handleRestart} className="font-bold text-slate-400 hover:text-slate-900 transition-colors">
                      Start New Match
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
                  isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]",
                  isSelected && !isDraggingThis && "bg-[#fafa7d]",
                  isKingInCheck && "bg-destructive/70 animate-pulse shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"
                )}
              >
                {isPossible && (
                  <div className={cn(
                    "absolute z-20 rounded-full",
                    piece ? "inset-2 border-[6px] border-black/15" : "w-5 h-5 bg-black/15"
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
                      width: '90px',
                      height: '90px',
                    } : {}}
                    className={cn(
                      "chess-piece text-5xl sm:text-7xl flex items-center justify-center transition-all select-none pointer-events-none drop-shadow-xl",
                      piece === piece.toUpperCase() ? "text-white" : "text-slate-900",
                      isDraggingThis && "opacity-95 scale-125 rotate-3"
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

      <div className="w-full flex justify-center gap-4 mt-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[11px] font-black uppercase tracking-[0.3em] gap-3 opacity-40 hover:opacity-100 transition-opacity bg-accent/10 px-6 rounded-full"
            onClick={handleRestart}
          >
            <RotateCcw className="w-3 h-3" /> RESET BOARD
          </Button>
      </div>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-2xl rounded-[3rem] p-12 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4 text-4xl font-black italic">
              <Activity className="w-10 h-10 text-primary animate-pulse" /> 2ides Coach
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8 mt-10">
            <div className="p-8 bg-green-50/50 rounded-3xl border border-green-100 shadow-sm">
              <h4 className="text-[12px] font-black text-green-700 uppercase tracking-[0.2em] mb-3">STRENGTHS</h4>
              <p className="text-base text-green-900 font-medium leading-relaxed">{analysis?.strengths}</p>
            </div>
            <div className="p-8 bg-amber-50/50 rounded-3xl border border-amber-100 shadow-sm">
              <h4 className="text-[12px] font-black text-amber-700 uppercase tracking-[0.2em] mb-3">OPPORTUNITIES</h4>
              <p className="text-base text-amber-900 font-medium leading-relaxed">{analysis?.weaknesses}</p>
            </div>
            <div className="p-10 bg-primary/5 rounded-[2.5rem] border border-primary/10 shadow-inner">
              <h4 className="text-[12px] font-black text-primary uppercase tracking-[0.2em] mb-4">FINAL ASSESSMENT</h4>
              <p className="text-2xl font-black text-slate-900 italic leading-tight">{analysis?.overallAssessment}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
