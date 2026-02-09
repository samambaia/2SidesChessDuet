
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

  // Auto-login anonymously to enable Firestore writes
  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(err => console.error("Erro no login anônimo:", err));
    }
  }, [auth]);

  const createRoom = async () => {
    if (!firestore || !auth) {
      toast({ title: "Erro de Conexão", description: "O serviço de banco de dados ainda não está pronto.", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      const newRoomId = Math.random().toString(36).substring(2, 9);
      const gameRef = doc(firestore, 'games', newRoomId);
      
      await setDoc(gameRef, {
        id: newRoomId,
        board: INITIAL_BOARD,
        turn: 'w',
        moves: [],
        startTime: serverTimestamp(),
        player1Id: currentUser.uid,
        player2Id: null,
        mode: 'pvp'
      });

      router.push(`/play?room=${newRoomId}`);
      setActiveMode('pvp');
      toast({ title: "Sala Criada!", description: "Agora você pode compartilhar o link com seu oponente." });
    } catch (error: any) {
      console.error("Erro ao criar sala:", error);
      toast({ 
        title: "Falha ao Criar Jogo", 
        description: "Ocorreu um problema técnico ao gerar a sala. Por favor, tente novamente.", 
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
          {activeMode === 'pvp' && !roomFromUrl && (
            <Button 
              onClick={createRoom} 
              disabled={isCreating}
              size="sm" 
              className="rounded-full gap-2"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Novo Jogo Online
            </Button>
          )}
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-full">
                <Settings className="w-4 h-4" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Configuração da Partida</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Modo de Jogo</h4>
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
                        <div className="font-semibold">Contra IA</div>
                        <div className="text-[10px] opacity-70">Desafie o Gemini</div>
                      </div>
                    </Button>
                    <Button 
                      variant={activeMode === 'pvp' ? 'default' : 'outline'} 
                      className="justify-start gap-3 h-14 rounded-2xl"
                      disabled={isCreating}
                      onClick={() => {
                        if (!roomFromUrl) {
                          createRoom();
                        } else {
                          setActiveMode('pvp');
                        }
                      }}
                    >
                      {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                      <div className="text-left">
                        <div className="font-semibold">Online PvP</div>
                        <div className="text-[10px] opacity-70">Jogue com sua filha</div>
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
                        <div className="font-semibold">Modo Aprendizado</div>
                        <div className="text-[10px] opacity-70">Feedback em tempo real</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {activeMode === 'ai' && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dificuldade da IA</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={difficulty === d ? 'secondary' : 'outline'}
                          onClick={() => setDifficulty(d)}
                          className="capitalize h-11 rounded-xl"
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
            Partida Atual
          </p>
          <p className="text-sm font-medium">
            {roomFromUrl ? `Sala Online: ${roomFromUrl}` : activeMode === 'ai' ? `vs IA (${difficulty})` : 'Aguardando Início...'}
          </p>
          {activeMode === 'pvp' && !roomFromUrl && !isCreating && (
            <p className="text-xs text-primary animate-pulse font-medium">Clique em "Novo Jogo Online" para começar</p>
          )}
          {isCreating && (
            <p className="text-xs text-muted-foreground animate-pulse font-medium">Gerando sua sala exclusiva...</p>
          )}
        </div>
      </main>
    </div>
  );
}
