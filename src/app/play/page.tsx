
"use client";

import React, { useState } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Users, BookOpen, Settings, Zap } from 'lucide-react';
import Link from 'next/link';

export default function PlayPage() {
  const [activeMode, setActiveMode] = useState<'ai' | 'pvp' | 'learning'>('ai');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  return (
    <div className="min-h-screen bg-accent/30">
      <header className="px-6 h-16 flex items-center border-b bg-card shadow-sm sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary p-1 rounded-lg">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">ChessDuet</span>
        </Link>
      </header>

      <main className="container mx-auto py-12 px-4 max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_320px] gap-12 items-start">
          <div className="flex flex-col items-center">
            <ChessBoard mode={activeMode} difficulty={difficulty} />
          </div>

          <aside className="space-y-6">
            <Card className="border-none shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Match Settings
                </CardTitle>
                <CardDescription>Select your game mode</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2">
                  <Button 
                    variant={activeMode === 'ai' ? 'default' : 'outline'} 
                    className="justify-start gap-3 h-12"
                    onClick={() => setActiveMode('ai')}
                  >
                    <Brain className="w-4 h-4" />
                    AI Opponent
                  </Button>
                  <Button 
                    variant={activeMode === 'pvp' ? 'default' : 'outline'} 
                    className="justify-start gap-3 h-12"
                    onClick={() => setActiveMode('pvp')}
                  >
                    <Users className="w-4 h-4" />
                    Local PvP
                  </Button>
                  <Button 
                    variant={activeMode === 'learning' ? 'default' : 'outline'} 
                    className="justify-start gap-3 h-12"
                    onClick={() => setActiveMode('learning')}
                  >
                    <BookOpen className="w-4 h-4" />
                    Learning Mode
                  </Button>
                </div>

                {activeMode === 'ai' && (
                  <div className="space-y-3 pt-4 border-t">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI Difficulty</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={difficulty === d ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setDifficulty(d)}
                          className="capitalize text-xs"
                        >
                          {d}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {activeMode === 'learning' && (
                  <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20 animate-in fade-in zoom-in-95">
                    <p className="text-xs text-secondary-foreground leading-relaxed">
                      <strong>Tutor Active:</strong> The AI will analyze your moves and explain rules if they are illegal.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <p className="text-center text-[10px] text-muted-foreground">
              Tip: Drag pieces to move them or use tap-to-move.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
