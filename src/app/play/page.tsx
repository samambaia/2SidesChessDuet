
"use client";

import React, { useState } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Users, BookOpen, Clock, Settings, History } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function PlayPage() {
  const [activeMode, setActiveMode] = useState<'ai' | 'pvp' | 'learning'>('ai');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-card sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">ChessDuet</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-sm font-semibold">Grandmaster Journey</span>
            <div className="flex items-center gap-2">
              <Progress value={45} className="h-2 w-24" />
              <span className="text-xs text-muted-foreground">Level 12</span>
            </div>
          </div>
          <Button variant="ghost" size="icon"><History className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 lg:px-6">
        <div className="grid lg:grid-cols-[1fr_350px] gap-12 items-start">
          <div className="flex flex-col items-center">
            <ChessBoard mode={activeMode} difficulty={difficulty} />
          </div>

          <aside className="space-y-6">
            <Card className="border-none shadow-xl bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Game Controls
                </CardTitle>
                <CardDescription>Configure your match settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="ai" onValueChange={(v) => setActiveMode(v as any)}>
                  <TabsList className="grid grid-cols-3 w-full mb-4">
                    <TabsTrigger value="ai" className="flex items-center gap-1">
                      <Brain className="w-3 h-3" />
                      AI
                    </TabsTrigger>
                    <TabsTrigger value="pvp" className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      PvP
                    </TabsTrigger>
                    <TabsTrigger value="learning" className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Learn
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="ai" className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Difficulty</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['easy', 'medium', 'hard'] as const).map((d) => (
                          <Button
                            key={d}
                            variant={difficulty === d ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDifficulty(d)}
                            className="capitalize"
                          >
                            {d}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="pvp" className="space-y-4">
                    <div className="bg-accent/50 p-4 rounded-lg space-y-3">
                      <p className="text-sm">Create a private room to play with a friend.</p>
                      <Button className="w-full">Create Private Room</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="learning" className="space-y-4">
                    <div className="bg-secondary/10 p-4 rounded-lg space-y-3 border border-secondary/20">
                      <p className="text-sm font-medium text-secondary">Tutor Mode Enabled</p>
                      <p className="text-xs text-muted-foreground">The AI will explain why moves are illegal and suggest better alternatives.</p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Timer</span>
                    </div>
                    <span className="font-mono text-xl font-bold">10:00</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">White (You)</span>
                      <span className="font-mono">08:45</span>
                    </div>
                    <Progress value={87} className="h-1" />
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-muted-foreground">Black (AI)</span>
                      <span className="font-mono">09:12</span>
                    </div>
                    <Progress value={92} className="h-1 bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader className="py-4">
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Move History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {[
                    { n: 1, w: "e4", b: "e5" },
                    { n: 2, w: "Nf3", b: "Nc6" },
                    { n: 3, w: "Bb5", b: "a6" },
                  ].map((move, i) => (
                    <div key={i} className="flex gap-4 text-sm items-center py-1 border-b border-muted last:border-0">
                      <span className="w-8 text-muted-foreground">{move.n}.</span>
                      <span className="font-medium flex-1">{move.w}</span>
                      <span className="font-medium flex-1">{move.b}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
