
"use client";

import React, { useState, useEffect } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Settings, Brain, Users, BookOpen, Zap, ChevronLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { INITIAL_BOARD } from '@/lib/chess-utils';

export default function PlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { auth } = useAuth();
  const { firestore } = useFirestore();
  
  const roomFromUrl = searchParams.get('room');
  const [activeMode, setActiveMode] = useState<'ai' | 'pvp' | 'learning'>(roomFromUrl ? 'pvp' : 'ai');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Auto-login anonymously to enable Firestore writes
  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth);
    }
  }, [auth]);

  const createRoom = async () => {
    if (!firestore || !auth?.currentUser) return;
    
    const newRoomId = Math.random().toString(36).substring(2, 9);
    const gameRef = doc(firestore, 'games', newRoomId);
    
    await setDoc(gameRef, {
      id: newRoomId,
      board: INITIAL_BOARD,
      turn: 'w',
      moves: [],
      startTime: serverTimestamp(),
      player1Id: auth.currentUser.uid,
      player2Id: null,
      mode: 'pvp'
    });

    router.push(`/play?room=${newRoomId}`);
    setActiveMode('pvp');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ChevronLeft className="h-4 w-4" />
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold text-xl">ChessDuet</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {activeMode === 'pvp' && !roomFromUrl && (
            <Button onClick={createRoom} size="sm" className="rounded-full gap-2">
              <Plus className="w-4 h-4" />
              New Online Game
            </Button>
          )}
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-full">
                <Settings className="w-4 h-4" />
                Game Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Match Configuration</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Game Mode</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <Button 
                      variant={activeMode === 'ai' ? 'default' : 'outline'} 
                      className="justify-start gap-3 h-14 rounded-2xl"
                      onClick={() => {
                        setActiveMode('ai');
                        router.push('/play');
                      }}
                    >
                      <Brain className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-semibold">AI Match</div>
                        <div className="text-[10px] opacity-70">Challenge Gemini AI</div>
                      </div>
                    </Button>
                    <Button 
                      variant={activeMode === 'pvp' ? 'default' : 'outline'} 
                      className="justify-start gap-3 h-14 rounded-2xl"
                      onClick={() => {
                        setActiveMode('pvp');
                        if (!roomFromUrl) createRoom();
                      }}
                    >
                      <Users className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-semibold">Online PvP</div>
                        <div className="text-[10px] opacity-70">Play with your daughter</div>
                      </div>
                    </Button>
                    <Button 
                      variant={activeMode === 'learning' ? 'default' : 'outline'} 
                      className="justify-start gap-3 h-14 rounded-2xl"
                      onClick={() => {
                        setActiveMode('learning');
                        router.push('/play');
                      }}
                    >
                      <BookOpen className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-semibold">Learning Mode</div>
                        <div className="text-[10px] opacity-70">Get real-time move feedback</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {activeMode === 'ai' && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Difficulty</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={difficulty === d ? 'secondary' : 'outline'}
                          onClick={() => setDifficulty(d)}
                          className="capitalize h-11 rounded-xl"
                        >
                          {d}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[600px]">
          <ChessBoard 
            mode={activeMode} 
            difficulty={difficulty} 
            gameId={roomFromUrl || undefined}
          />
        </div>
        <div className="mt-8 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
            Current Match
          </p>
          <p className="text-sm font-medium">
            {roomFromUrl ? `Shared Room: ${roomFromUrl}` : activeMode === 'ai' ? `vs AI (${difficulty})` : 'Starting Match...'}
          </p>
          {activeMode === 'pvp' && !roomFromUrl && (
            <p className="text-xs text-primary animate-pulse font-medium">Click "New Online Game" to start sharing</p>
          )}
        </div>
      </main>
    </div>
  );
}
