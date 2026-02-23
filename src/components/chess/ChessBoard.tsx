
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';
import { INITIAL_FEN, PIECE_ICONS, formatTotalTime, chessJsToBoard, getSquareName } from '@/lib/chess-utils';
import { aiOpponentDifficulty } from '@/ai/flows/ai-opponent-difficulty';
import { analyzeGameHistory, type AnalyzeGameHistoryOutput } from '@/ai/flows/analyze-game-history';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Timer, Share2, Activity, ShieldAlert, Trophy, RefreshCw, History as HistoryIcon, ChevronLeft, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MoveList } from './MoveList';
import { uciToMove } from '@/lib/chess-utils';

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
  const board = React.useMemo(() => chessJsToBoard(game), [game]);
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
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusBoardSize, setFocusBoardSize] = useState(0);
  const lastTurnRef = useRef<'w' | 'b' | null>(null);

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame, isLoading: isRemoteLoading } = useDoc(gameRef);

  // Enforce player color in PvP safely
  const userColor = React.useMemo(() => {
    if (mode !== 'pvp') return 'w'; // Always white in AI/Learning unless we add side selection
    if (!remoteGame || !user) return null;
    if (user.uid === remoteGame.player1Id) return 'w';
    if (user.uid === remoteGame.player2Id) return 'b';
    return null;
  }, [remoteGame, user, mode]);

  const isMyTurn = React.useMemo(() => {
    if (mode !== 'pvp') return game.turn() === 'w';
    if (!remoteGame) return false;

    // In PvP, we need to know who the user is to determine if it's their turn
    if (!user) return false;
    return remoteGame.turn === userColor;
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

  // Request Notification Permissions
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

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

  useEffect(() => {
    if (remoteGame?.fen && remoteGame.fen !== game.fen()) {
      try {
        const newGame = new Chess(remoteGame.fen);
        const newTurn = newGame.turn();

        // Detect the last move from history to sync highlighting
        const remoteMoves = remoteGame.moves || [];
        if (remoteMoves.length > 0) {
          try {
            const tempGame = new Chess();
            // Replay till the move before last
            for (let i = 0; i < remoteMoves.length - 1; i++) {
              tempGame.move(remoteMoves[i]);
            }
            // The last move will give us the 'from' and 'to'
            const m = tempGame.move(remoteMoves[remoteMoves.length - 1]);
            if (m) {
              setLastMove({ from: m.from, to: m.to });
            }
          } catch (e) {
            console.warn("Could not parse last move for highlighting", e);
          }
        }

        // Trigger notification if it's now our turn in PvP and tab is backgrounded
        if (mode === 'pvp' && userColor === newTurn && lastTurnRef.current !== newTurn && document.visibilityState !== 'visible') {
          if ('Notification' in window && Notification.permission === 'granted') {
            console.log("Triggering turn notification...");
            new Notification('2Sides Chess', {
              body: "It's your turn! Your opponent has made a move.",
              icon: '/icon-192.png'
            });
          }
        }
        lastTurnRef.current = newTurn;

        setGame(newGame);
        setTurn(newTurn);
        setIsInCheck(newGame.inCheck());
        setHistory(remoteGame.moves || []);
        checkGameOverStatus(newGame);
        setIsThinking(false);
      } catch (e) {
        console.error("Critical Sync Error:", e);
      }
    }
  }, [remoteGame, checkGameOverStatus, game, mode, userColor]);

  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [isGameOver]);

  const updateGameState = useCallback((newGame: Chess, lastMove?: string) => {
    setGame(newGame);
    setTurn(newGame.turn());
    setIsInCheck(newGame.inCheck());

    if (lastMove) {
      setHistory(prev => [...prev, lastMove]);
    }

    if (gameId && gameRef) {
      updateDocumentNonBlocking(gameRef, {
        fen: newGame.fen(),
        turn: newGame.turn(),
        moves: lastMove
          ? [...(remoteGame?.moves || history), lastMove]
          : newGame.history(),
        lastUpdated: serverTimestamp()
      });
    }
  }, [gameId, gameRef, remoteGame?.moves, history]);

  const handleRestart = () => {
    const newGame = new Chess();
    setIsGameOver(false);
    setElapsedSeconds(0);
    setAnalysis(null);
    setSelected(null);
    setPossibleMoves([]);
    setDragState(null);
    setHistory([]);

    setGame(newGame);
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
    if (currentGame.isGameOver() || isThinking) return;
    setIsThinking(true);
    try {
      const aiResponse = await aiOpponentDifficulty({ fen: currentGame.fen(), difficulty });
      const nextGame = new Chess(currentGame.fen());

      let moveResult = null;
      try {
        if (aiResponse.move.length >= 4) {
          const { from, to } = uciToMove(aiResponse.move);
          const promotion = aiResponse.move.length === 5 ? aiResponse.move[4] : 'q';
          moveResult = nextGame.move({ from, to, promotion });
        } else {
          moveResult = nextGame.move(aiResponse.move);
        }
      } catch (e) {
        console.warn("AI preferred move failed, using fallback:", aiResponse.move);
        const legalMoves = nextGame.moves();
        if (legalMoves.length > 0) {
          moveResult = nextGame.move(legalMoves[0]);
        }
      }

      if (moveResult) {
        // Force a new instance to ensure state update
        const finalGame = new Chess(nextGame.fen());
        updateGameState(finalGame, moveResult.san);
        checkGameOverStatus(finalGame);
      }
    } catch (error: any) {
      console.error("AI Error:", error);

      const isRateLimit = error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota');
      const isNotFound = error?.message?.includes('404');

      if (isRateLimit) {
        toast({
          title: "AI is Exhausted",
          description: "Rate limit reached. Playing a fallback move while the AI rests.",
          variant: "destructive"
        });
      } else if (isNotFound) {
        toast({
          title: "AI Not Found",
          description: "The AI engine is currently unavailable. Playing a fallback move.",
          variant: "destructive"
        });
      }

      const fallbackGame = new Chess(currentGame.fen());
      const legalMoves = fallbackGame.moves({ verbose: true });
      if (legalMoves.length > 0) {
        // Simple fallback: pick first move or random move
        const moveResult = fallbackGame.move(legalMoves[Math.floor(Math.random() * legalMoves.length)]);
        updateGameState(fallbackGame, moveResult.san);
        checkGameOverStatus(fallbackGame);
      }
    } finally {
      setIsThinking(false);
    }
  }, [difficulty, isThinking, updateGameState, checkGameOverStatus]);

  // Trigger AI move when it's black's turn in AI mode
  useEffect(() => {
    if (mode === 'ai' && turn === 'b' && !isGameOver && !isThinking && !isSyncing) {
      const timer = setTimeout(() => triggerAiMove(game), 600);
      return () => clearTimeout(timer);
    }
  }, [turn, mode, isGameOver, isThinking, isSyncing, game, triggerAiMove]);

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
        setLastMove({ from, to });
        updateGameState(nextGame, move.san);
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

    // Basic turn check: must be the piece's turn, and if in PvP, must be the user's color
    const isCorrectTurn = piece && piece.color === game.turn();
    const isCorrectPlayer = mode !== 'pvp' || piece?.color === userColor;

    if (isCorrectTurn && isCorrectPlayer) {
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
    } catch (err: any) {
      console.error("Analysis Error:", err);
      const isRateLimit = err?.message?.includes('429') || err?.message?.toLowerCase().includes('quota');

      toast({
        title: isRateLimit ? "Coach is Busy" : "AI Coach Error",
        description: isRateLimit ? "Rate limit reached. Please wait a minute before requesting another analysis." : "Failed to analyze the game.",
        variant: "destructive"
      });
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
    <div className="flex flex-col lg:flex-row items-start justify-center gap-12 w-full max-w-[1200px] px-4 animate-in fade-in duration-700">
      {/* Board Column */}
      <div className="flex flex-col items-center gap-6 w-full max-w-[600px]">
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

        {isFocusMode && (
          <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-2xl animate-in fade-in duration-500" />
        )}

        {isFocusMode && (
          <div className="fixed inset-0 z-[120] pointer-events-none flex flex-col items-center justify-between pt-20 pb-12 px-6">
            <div className="w-full flex justify-end items-center px-4 pointer-events-auto">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                <Timer className="w-4 h-4 text-white/50" />
                <span className="font-mono font-black text-white">{formatTotalTime(elapsedSeconds)}</span>
              </div>
            </div>

            <div className="w-full max-w-[440px] flex flex-row gap-3 pointer-events-auto items-center">
              <div className={cn(
                "flex-1 py-3 rounded-2xl text-xs font-black transition-all duration-300 border-2 flex items-center justify-center gap-2",
                turn === 'w' ? "bg-white text-slate-900 border-primary shadow-[0_0_20px_rgba(255,255,255,0.2)] scale-[1.03]" : "bg-white/5 text-slate-500 border-white/5"
              )}>
                <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 shrink-0" />
                WHITE
                {userColor === 'w' && <span className="text-[9px] opacity-70">(YOU)</span>}
                {turn === 'w' && <Activity className="w-3.5 h-3.5 animate-pulse shrink-0" />}
              </div>

              <div className={cn(
                "flex-1 py-3 rounded-2xl text-xs font-black transition-all duration-300 border-2 flex items-center justify-center gap-2",
                turn === 'b' ? "bg-slate-900 text-white border-primary shadow-[0_0_20px_rgba(0,0,0,0.5)] scale-[1.03]" : "bg-white/5 text-slate-500 border-white/5"
              )}>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-white/30 shrink-0" />
                BLACK
                {userColor === 'b' && <span className="text-[9px] opacity-70">(YOU)</span>}
                {turn === 'b' && <Activity className="w-3.5 h-3.5 animate-pulse text-primary shrink-0" />}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFocusMode(false)}
                className="w-12 h-12 rounded-2xl bg-primary/10 border-primary/20 hover:bg-primary/20 transition-all shadow-lg group shrink-0"
              >
                <Minimize2 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        <div
          ref={boardRef}
          style={isFocusMode && focusBoardSize > 0 ? {
            position: 'fixed',
            width: focusBoardSize,
            height: focusBoardSize,
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 110,
          } : undefined}
          className={cn(
            "chess-board relative shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden border-[12px] border-slate-950 bg-slate-900 touch-none select-none w-full aspect-square",
            isFocusMode && "border-4 sm:border-8"
          )}
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
              const isLastMoveSquare = lastMove && (lastMove.from === squareName || lastMove.to === squareName);

              return (
                <div
                  key={`${r}-${f}`}
                  onPointerDown={(e) => handlePointerDown(e, r, f)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={cn(
                    "chess-square h-full w-full select-none touch-none cursor-grab active:cursor-grabbing relative flex items-center justify-center transition-colors duration-200",
                    isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]",
                    isSelected && !isDraggingThis && "bg-[#fafa7d] ring-4 ring-inset ring-white/30",
                    isLastMoveSquare && !isSelected && "bg-yellow-200/50",
                    isKingInCheck && "bg-rose-500/80 animate-pulse shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"
                  )}
                >
                  {isPossible && (
                    <div className={cn(
                      "absolute z-20 rounded-full",
                      piece ? "inset-2 border-[6px] border-black/15" : "w-5 h-5 bg-black/15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    )} />
                  )}

                  <AnimatePresence mode="popLayout">
                    {piece && (
                      <motion.div
                        key={`${piece}-${r}-${f}`}
                        layout
                        initial={{ opacity: 0, scale: 0.8, y: -10 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          y: 0,
                          filter: isLastMoveSquare ? "drop-shadow(0 0 8px rgba(255,165,0,0.4))" : "none"
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30
                        }}
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
                          "chess-piece text-5xl sm:text-7xl flex items-center justify-center select-none pointer-events-none w-full h-full",
                          piece === piece.toUpperCase() ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" : "text-slate-950 drop-shadow-[0_2px_1px_rgba(255,255,255,0.2)]",
                          isDraggingThis && "opacity-80 scale-125 rotate-3 z-[100]"
                        )}
                      >
                        {PIECE_ICONS[piece]}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        <div className="w-full flex justify-center items-center gap-6 mt-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] font-black uppercase tracking-[0.3em] gap-3 opacity-30 hover:opacity-100 transition-all bg-white/5 hover:bg-white/10 px-6 h-10 rounded-full"
            onClick={handleRestart}
          >
            <RotateCcw className="w-3 h-3" /> RESET BOARD
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-2xl bg-primary/10 border-primary/20 hover:bg-primary/20 transition-all shadow-lg group"
              >
                <HistoryIcon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 border-l border-white/10 bg-slate-950/95 backdrop-blur-2xl flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>Game History</SheetTitle>
                <SheetDescription>A detailed list of all moves made in this match.</SheetDescription>
              </SheetHeader>
              <div className="p-4 sm:hidden border-b border-white/5">
                <SheetClose asChild>
                  <Button variant="ghost" className="w-full justify-start gap-4 text-white font-black uppercase tracking-[0.2em] h-14 rounded-2xl">
                    <ChevronLeft className="w-5 h-5" /> BACK TO BOARD
                  </Button>
                </SheetClose>
              </div>
              <div className="flex-1 overflow-hidden p-6">
                <MoveList moves={history} mode={mode} />
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="outline"
            size="icon"
            onClick={() => { setFocusBoardSize(window.innerWidth - 32); setIsFocusMode(true); }}
            className="w-12 h-12 rounded-2xl bg-primary/10 border-primary/20 hover:bg-primary/20 transition-all shadow-lg group sm:hidden"
          >
            <Maximize2 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
          </Button>
        </div>
      </div>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-2xl rounded-[3rem] p-12 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4 text-4xl font-black italic">
              <Activity className="w-10 h-10 text-primary animate-pulse" /> 2Sides Coach
            </DialogTitle>
            <DialogDescription className="sr-only">AI analysis of your chess match performance.</DialogDescription>
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
