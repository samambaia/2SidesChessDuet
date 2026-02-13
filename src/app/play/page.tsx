
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Settings, Brain, Users, BookOpen, ChevronLeft, Loader2 } from 'lucide-react';
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
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { INITIAL_FEN } from '@/lib/chess-utils';
import { useToast } from '@/hooks/use-toast';
import { ChessLogo } from '@/components/ChessLogo';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export const dynamic = 'force-dynamic';

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const roomFromUrl = searchParams.get('room');
  const [activeMode, setActiveMode] = useState<'ai' | 'pvp' | 'learning'>(roomFromUrl ? 'pvp' : 'ai');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isCreating, setIsCreating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const bgImage = PlaceHolderImages.find(img => img.id === 'hero-chess');

  useEffect(() => {
    const init = async () => {
      if (auth && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Anonymous login error:", err);
        }
      }
      setIsInitializing(false);
    };
    init();
  }, [auth]);

  const createRoom = async () => {
    setIsCreating(true);
    try {
      if (!auth || !firestore) throw new Error("Services not ready.");

      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      const newRoomId = Math.random().toString(36).substring(2, 9);
      const gameRef = doc(firestore, 'games', newRoomId);
      
      await setDoc(gameRef, {
        id: newRoomId,
        fen: INITIAL_FEN,
        turn: 'w',
        moves: [],
        startTime: serverTimestamp(),
        player1Id: currentUser.uid,
        player2Id: null,
        mode: 'pvp',
        totalTime: 0,
        gameRoomId: newRoomId,
        lastUpdated: serverTimestamp()
      });

      router.push(`/play?room=${newRoomId}`);
      setActiveMode('pvp');
      toast({ title: "Success!", description: "Online room created." });
    } catch (error: any) {
      console.error("Room creation error:", error);
      toast({ 
        title: "Failed to Create Game", 
        description: "A technical issue occurred. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Setting up the board...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Watermark Image - Increased Opacity */}
      {bgImage && (
        <div className="absolute inset-0 z-0 opacity-[0.12] pointer-events-none">
          <Image
            src={bgImage.imageUrl}
            alt="Chess background"
            fill
            className="object-cover grayscale"
            priority
            data-ai-hint="chess board"
          />
        </div>
      )}

      <header className="px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ChevronLeft className="h-4 w-4" />
          <ChessLogo />
        </Link>

        <div className="ml-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-full">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem] p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Game Mode</DialogTitle>
                <DialogDescription>
                  Choose how you want to play today.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 mt-4">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">SELECT MODE</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <Button 
                      variant={activeMode === 'ai' ? 'default' : 'outline'} 
                      className="justify-start gap-4 h-16 rounded-2xl px-6"
                      onClick={() => { setActiveMode('ai'); if (roomFromUrl) router.push('/play'); }}
                    >
                      <Brain className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold">Against AI</div>
                        <div className="text-[10px] opacity-70">Challenge the computer</div>
                      </div>
                    </Button>
                    
                    <Button 
                      variant={activeMode === 'pvp' ? 'default' : 'outline'} 
                      className="justify-start gap-4 h-16 rounded-2xl px-6"
                      disabled={isCreating}
                      onClick={() => {
                        if (roomFromUrl) setActiveMode('pvp');
                        else createRoom();
                      }}
                    >
                      {isCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Users className="w-6 h-6 shrink-0" />}
                      <div className="text-left">
                        <div className="font-bold">Online PvP</div>
                        <div className="text-[10px] opacity-70">Play with friends</div>
                      </div>
                    </Button>

                    <Button 
                      variant={activeMode === 'learning' ? 'default' : 'outline'} 
                      className="justify-start gap-4 h-16 rounded-2xl px-6"
                      onClick={() => { setActiveMode('learning'); if (roomFromUrl) router.push('/play'); }}
                    >
                      <BookOpen className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold">Learning Mode</div>
                        <div className="text-[10px] opacity-70">Real-time feedback</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {activeMode === 'ai' && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">DIFFICULTY</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={difficulty === d ? 'secondary' : 'outline'}
                          onClick={() => setDifficulty(d)}
                          className="capitalize rounded-xl text-xs h-10"
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

      <main className="flex-1 flex flex-col items-center justify-center p-4 z-10">
        <ChessBoard 
          mode={activeMode} 
          difficulty={difficulty} 
          gameId={roomFromUrl || undefined}
        />
        <div className="mt-8 text-center">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Status</p>
          <p className="text-sm font-medium">
            {roomFromUrl ? `Online Game: ${roomFromUrl}` : activeMode === 'ai' ? 'Playing AI' : 'Learning Mode'}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <PlayContent />
    </Suspense>
  );
}
