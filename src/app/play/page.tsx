"use client";

import React, { useState, useEffect } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Settings, Brain, Users, BookOpen, Zap, ChevronLeft, Plus, Loader2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

export default function PlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const roomFromUrl = searchParams.get('room');
  const [activeMode, setActiveMode] = useState<'ai' | 'pvp' | 'learning'>(roomFromUrl ? 'pvp' : 'ai');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isCreating, setIsCreating] = useState(false);

  // Auto-login anônimo silencioso
  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(err => console.error("Erro no login anônimo:", err));
    }
  }, [auth]);

  const createRoom = async () => {
    setIsCreating(true);
    try {
      if (!auth || !firestore) throw new Error("Serviços não prontos");

      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      const newRoomId = Math.random().toString(36).substring(2, 9);
      const gameRef = doc(firestore, 'games', newRoomId);
      
      // Criamos o jogo com todos os campos necessários para as regras de segurança
      await setDoc(gameRef, {
        id: newRoomId,
        board: INITIAL_BOARD,
        turn: 'w',
        moves: [],
        startTime: serverTimestamp(),
        player1Id: currentUser.uid,
        player2Id: null,
        mode: 'pvp',
        totalTime: 0,
        gameRoomId: newRoomId // Mantendo consistência com backend.json
      });

      router.push(`/play?room=${newRoomId}`);
      setActiveMode('pvp');
      toast({ title: "Sala Criada!", description: "Compartilhe o link para começar." });
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ChevronLeft className="h-4 w-4" />
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold text-xl">ChessDuet</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-full shadow-sm">
                <Settings className="w-4 h-4" />
                Game Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold mb-6">Configuração da Partida</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">MODO DE JOGO</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <Button 
                      variant={activeMode === 'ai' ? 'default' : 'outline'} 
                      className="justify-start gap-4 h-16 rounded-2xl px-6 border-muted/20"
                      onClick={() => {
                        setActiveMode('ai');
                        if (roomFromUrl) router.push('/play');
                      }}
                    >
                      <Brain className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold text-base leading-tight">Contra IA</div>
                        <div className="text-[11px] opacity-70 font-medium">Desafie o Gemini</div>
                      </div>
                    </Button>
                    
                    <div className="space-y-2">
                      <Button 
                        variant={activeMode === 'pvp' ? 'default' : 'outline'} 
                        className="w-full justify-start gap-4 h-16 rounded-2xl px-6 border-muted/20"
                        disabled={isCreating}
                        onClick={() => {
                          if (roomFromUrl) {
                            setActiveMode('pvp');
                          } else {
                            createRoom();
                          }
                        }}
                      >
                        {isCreating ? <Loader2 className="w-6 h-6 animate-spin shrink-0" /> : <Users className="w-6 h-6 shrink-0" />}
                        <div className="text-left">
                          <div className="font-bold text-base leading-tight">Online PvP</div>
                          <div className="text-[11px] opacity-70 font-medium">Jogue com amigos</div>
                        </div>
                      </Button>
                      {!roomFromUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-[10px] font-bold uppercase tracking-wider"
                          onClick={createRoom}
                          disabled={isCreating}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Criar Nova Sala Online
                        </Button>
                      )}
                    </div>

                    <Button 
                      variant={activeMode === 'learning' ? 'default' : 'outline'} 
                      className="justify-start gap-4 h-16 rounded-2xl px-6 border-muted/20"
                      onClick={() => {
                        setActiveMode('learning');
                        if (roomFromUrl) router.push('/play');
                      }}
                    >
                      <BookOpen className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold text-base leading-tight">Modo Aprendizado</div>
                        <div className="text-[11px] opacity-70 font-medium">Feedback em tempo real</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {activeMode === 'ai' && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Dificuldade da IA</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={difficulty === d ? 'secondary' : 'outline'}
                          onClick={() => setDifficulty(d)}
                          className="capitalize h-11 rounded-xl font-bold text-xs"
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
        <div className="w-full max-w-[600px]">
          <ChessBoard 
            mode={activeMode} 
            difficulty={difficulty} 
            gameId={roomFromUrl || undefined}
          />
        </div>
        <div className="mt-8 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
            Status da Partida
          </p>
          <p className="text-sm font-medium">
            {roomFromUrl ? `Sala Online: ${roomFromUrl}` : activeMode === 'ai' ? `Jogando contra IA (${difficulty === 'easy' ? 'Fácil' : difficulty === 'medium' ? 'Médio' : 'Difícil'})` : activeMode === 'learning' ? 'Modo Aprendizado' : 'Escolha um modo de jogo'}
          </p>
        </div>
      </main>
    </div>
  );
}