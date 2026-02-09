
"use client";

import React, { useState } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Users, BookOpen, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function PlayPage() {
  const [activeMode, setActiveMode] = useState<'ai' | 'pvp' | 'learning'>('ai');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 h-16 flex items-center border-b sticky top-0 bg-background z-50">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold text-xl">ChessDuet</span>
        </Link>
      </header>

      <main className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full flex justify-center">
            <ChessBoard mode={activeMode} difficulty={difficulty} />
          </div>

          <div className="w-full lg:w-72 space-y-4">
            <Card className="border shadow-sm">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Mode</p>
                  <div className="grid gap-2">
                    <Button 
                      variant={activeMode === 'ai' ? 'default' : 'ghost'} 
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => setActiveMode('ai')}
                    >
                      <Brain className="w-4 h-4" /> AI Match
                    </Button>
                    <Button 
                      variant={activeMode === 'pvp' ? 'default' : 'ghost'} 
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => setActiveMode('pvp')}
                    >
                      <Users className="w-4 h-4" /> Local PvP
                    </Button>
                    <Button 
                      variant={activeMode === 'learning' ? 'default' : 'ghost'} 
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => setActiveMode('learning')}
                    >
                      <BookOpen className="w-4 h-4" /> Learning
                    </Button>
                  </div>
                </div>

                {activeMode === 'ai' && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">AI Difficulty</p>
                    <div className="grid grid-cols-3 gap-1">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={difficulty === d ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setDifficulty(d)}
                          className="text-[10px] h-7 capitalize"
                        >
                          {d}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <p className="text-[10px] text-muted-foreground text-center">
              Drag and drop pieces to move.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
