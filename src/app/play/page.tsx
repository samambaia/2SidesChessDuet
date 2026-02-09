
"use client";

import React, { useState } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Settings, Brain, Users, BookOpen, Zap, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PlayPage() {
  const [activeMode, setActiveMode] = useState<'ai' | 'pvp' | 'learning'>('ai');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ChevronLeft className="h-4 w-4" />
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold text-xl">ChessDuet</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
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
                      onClick={() => setActiveMode('ai')}
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
                      onClick={() => setActiveMode('pvp')}
                    >
                      <Users className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-semibold">Local PvP</div>
                        <div className="text-[10px] opacity-70">Play with a friend locally</div>
                      </div>
                    </Button>
                    <Button 
                      variant={activeMode === 'learning' ? 'default' : 'outline'} 
                      className="justify-start gap-3 h-14 rounded-2xl"
                      onClick={() => setActiveMode('learning')}
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
          <ChessBoard mode={activeMode} difficulty={difficulty} />
        </div>
        <div className="mt-8 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
            Current Match
          </p>
          <p className="text-sm font-medium">
            {activeMode === 'ai' ? `vs AI (${difficulty})` : activeMode === 'pvp' ? 'Local Multiplayer' : 'Learning Session'}
          </p>
        </div>
      </main>
    </div>
  );
}
