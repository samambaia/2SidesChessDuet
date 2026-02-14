
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
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
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

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: remoteGame } = useDoc(gameRef);

  // Enforce player color in PvP safely
  const userColor = React.useMemo(() => {
    if (!remoteGame || !user) return 'w'; // Default for local AI (user is white)
    if (user.uid === remoteGame.player1Id) return 'w';
    if (user.uid === remoteGame.player2Id) return 'b';
    return null; // Spectator
  }, [remoteGame, user]);

  const isMyTurn = React.useMemo(() => {
    if (!user) return false;
    if (mode !== 'pvp') return game.turn() === 'w'; 
    if (!remoteGame) return false;
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

  // Sync with remote state
  useEffect(() => {
    if (remoteGame?.fen && remoteGame.fen !== game.fen()) {
      try {
        const newGame = new Chess(remoteGame.fen);
        setGame(newGame);
        setBoard(chessJsToBoard(newGame));
        setTurn(newGame.turn());
        setIsInCheck(newGame.inCheck());
        checkGameOverStatus(newGame);
        setIsThinking(false);
      } catch (e) {
        console.error("Sync error", e);
      }
    }
  }, [remoteGame, checkGameOverStatus]);

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

    toast({ title: "Game Restarted", description: "The board has been reset for both players." });
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
      console.error("AI Error", error);
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
    if (isGameOver || isThinking || !isMyTurn) return;
    
    const targetPiece = game.get(to);
    if (targetPiece && targetPiece.type === 'k') {
      toast({ 
        title: "Illegal Move!", 
        description: "In chess, you don't capture the King. You must checkmate it!", 
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
        toast({ title: "Invalid Move", description: "This move is not allowed.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Move error", e);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, r: number, f: number) => {
    if (isThinking || isGameOver || !isMyTurn) return;
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
          console.warn("Capture failed", captureError);
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
      const result = await analyzeGameHistory({ gameHistory: game.history().join(', ') || "Short match." });
      setAnalysis(result);
    } catch (err) {
      toast({ title: "Analysis error", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInvite = async () => {
    const inviteUrl = `${window.location.origin}/play?room=${gameId}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast({ title: "Game Link Copied!", description: "Send this to your friend to join the match." });
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
             <Share2 className="w-3 h-3" /> Invite Friend
           </Button>
         )}
      </div>

      {isInCheck && !isGameOver && (
        <div className="w-full animate-bounce">
          <Alert variant="destructive" className="rounded-2xl border-2 shadow-lg bg-destructive/5">
            <ShieldAlert className="h-5 w-5" />
            <AlertTitle className="font-black uppercase tracking-widest text-xs">CAUTION! CHECK!</AlertTitle>
            <AlertDescription className="text-[10px] font-medium">Your King is under attack! Protect it now.</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex items-center gap-6 mb-2">
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2 flex flex-col items-center",
          turn === 'w' ? "bg-white text-slate-900 border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>
          WHITE
          {userColor === 'w' && <span className="text-[8px] opacity-50">(YOU)</span>}
        </div>
        <div className={cn(
          "px-6 py-2 rounded-xl text-xs font-black transition-all border-2 flex flex-col items-center",
          turn === 'b' ? "bg-slate-900 text-white border-primary shadow-xl scale-110" : "bg-slate-200/50 text-slate-400 border-transparent opacity-40"
        )}>
          BLACK
          {userColor === 'b' && <span className="text-[8px] opacity-50">(YOU)</span>}
        </div>
      </div>

      <div 
        ref={boardRef}
        className="chess-board relative shadow-2xl rounded-2xl overflow-hidden border-8 border-slate-900/10 bg-slate-800 touch-none select-none"
      >
        {(isThinking || isGameOver || (mode === 'pvp' && remoteGame && !remoteGame.player2Id)) && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in">
             {isThinking && (
               <div className="bg-white/95 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm font-black uppercase tracking-widest">Thinking...</span>
               </div>
             )}
             {mode === 'pvp' && remoteGame && !remoteGame.player2Id && !isGameOver && (
               <div className="bg-white/95 px-8 py-6 rounded-[2rem] shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 mx-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Waiting for Opponent</h3>
                  <p className="text-xs font-bold text-muted-foreground mt-2">Share the link with your friend!</p>
                  <Button onClick={handleInvite} variant="outline" size="sm" className="mt-4 rounded-xl gap-2">
                    <Share2 className="w-3 h-3" /> Copy Link
                  </Button>
               </div>
             )}
             {isGameOver && (
               <div className="bg-white/95 p-8 rounded-[2.5rem] shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 scale-110">
                  <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">GAME OVER</h2>
                  <p className="text-sm font-bold text-muted-foreground mt-2 mb-6">Great match!</p>
                  <div className="grid gap-2">
                    <Button onClick={handleAnalyzeMatch} className="rounded-xl h-12 gap-2 font-black" disabled={isAnalyzing}>
                      {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} AI Feedback
                    </Button>
                    <Button variant="ghost" onClick={handleRestart} className="text-xs">
                      Play Again
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
            <RotateCcw className="w-3 h-3" /> Restart Match
          </Button>
      </div>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-3xl font-black">
              <Activity className="w-8 h-8 text-primary" /> Chess Coach
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-8">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
              <h4 className="text-[11px] font-black text-green-700 uppercase mb-2">STRENGTHS</h4>
              <p className="text-sm text-green-800">{analysis?.strengths}</p>
            </div>
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
              <h4 className="text-[11px] font-black text-amber-700 uppercase mb-2">OPPORTUNITIES</h4>
              <p className="text-sm text-amber-800">{analysis?.weaknesses}</p>
            </div>
            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
              <h4 className="text-[11px] font-black text-primary uppercase mb-2">ASSESSMENT</h4>
              <p className="text-lg font-bold">{analysis?.overallAssessment}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
