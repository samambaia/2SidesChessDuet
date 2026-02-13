
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Settings, Brain, Users, BookOpen, Zap, ChevronLeft, Loader2 } from 'lucide-react';
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

// Força a página a ser dinâmica, evitando que o build do Next.js trave tentando pre-renderizar
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

  useEffect(() => {
    const init = async () => {
      if (auth && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Erro no login anônimo:", err);
        }
      }
      setIsInitializing(false);
    };
    init();
  }, [auth]);

  const createRoom = async () => {
    setIsCreating(true);
    try {
      if (!auth || !firestore) throw new Error("Serviços não prontos.");

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
      toast({ title: "Sucesso!", description: "Nova sala online criada." });
    } catch (error: any) {
      console.error("Erro ao criar sala:", error);
      toast({ 
        title: "Falha ao Criar Jogo", 
        description: "Ocorreu um problema técnico. Por favor, tente novamente.", 
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
            Preparando o tabuleiro...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ChevronLeft className="h-4 w-4" />
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold text-xl">ChessDuet</span>
        </Link>

        <div className="ml-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-full">
                <Settings className="w-4 h-4" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem] p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Modo de Jogo</DialogTitle>
                <DialogDescription>
                  Escolha como deseja jogar hoje.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 mt-4">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">MODO DE JOGO</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <Button 
                      variant={activeMode === 'ai' ? 'default' : 'outline'} 
                      className="justify-start gap-4 h-16 rounded-2xl px-6"
                      onClick={() => { setActiveMode('ai'); if (roomFromUrl) router.push('/play'); }}
                    >
                      <Brain className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold">Contra IA</div>
                        <div className="text-[10px] opacity-70">Desafie o computador</div>
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
                        <div className="text-[10px] opacity-70">Jogue com amigos</div>
                      </div>
                    </Button>

                    <Button 
                      variant={activeMode === 'learning' ? 'default' : 'outline'} 
                      className="justify-start gap-4 h-16 rounded-2xl px-6"
                      onClick={() => { setActiveMode('learning'); if (roomFromUrl) router.push('/play'); }}
                    >
                      <BookOpen className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold">Modo Aprendizado</div>
                        <div className="text-[10px] opacity-70">Feedback em tempo real</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {activeMode === 'ai' && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">DIFICULDADE</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={difficulty === d ? 'secondary' : 'outline'}
                          onClick={() => setDifficulty(d)}
                          className="capitalize rounded-xl text-xs h-10"
                        >
                          {d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : 'Difícil'}
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
        <ChessBoard 
          mode={activeMode} 
          difficulty={difficulty} 
          gameId={roomFromUrl || undefined}
        />
        <div className="mt-8 text-center">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Status</p>
          <p className="text-sm font-medium">
            {roomFromUrl ? `Partida Online: ${roomFromUrl}` : activeMode === 'ai' ? 'Jogando contra IA' : 'Modo Aprendizado'}
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
