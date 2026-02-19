
"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User, Brain, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveListProps {
    moves: string[];
    mode: 'ai' | 'pvp' | 'learning';
}

export function MoveList({ moves, mode }: MoveListProps) {
    const movePairs = [];
    for (let i = 0; i < moves.length; i += 2) {
        movePairs.push({
            white: moves[i],
            black: moves[i + 1] || null,
            number: Math.floor(i / 2) + 1
        });
    }

    return (
        <div className="flex flex-col h-full bg-slate-950/40 rounded-[2rem] border border-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/20 border border-primary/20">
                            <History className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white tracking-widest uppercase">Game History</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Timeline of the match</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        <span className="text-[10px] font-black text-primary">{moves.length}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Moves</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 group">
                        <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">White</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{mode === 'ai' ? 'AI (Black)' : 'Guest (Black)'}</span>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-6">
                <div className="space-y-3">
                    {movePairs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center px-8">
                            <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-white/20 flex items-center justify-center mb-4">
                                <History className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-widest text-white mb-1">Silence on the Board</p>
                            <p className="text-[10px] font-medium text-slate-400">Make your first move to start the chronicle.</p>
                        </div>
                    ) : (
                        movePairs.map((pair) => (
                            <div key={pair.number} className="flex items-center gap-3 group animate-in slide-in-from-right-2 duration-300">
                                <div className="w-6 text-[10px] font-black text-slate-600 font-mono text-center">
                                    {pair.number.toString().padStart(2, '0')}
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <div className="relative overflow-hidden bg-white/[0.03] hover:bg-white/[0.08] transition-all rounded-xl px-4 py-3 text-xs font-black font-mono text-white flex justify-between items-center border border-white/5 group-hover:border-white/10 shadow-sm">
                                        <span className="z-10">{pair.white}</span>
                                        <User className="w-3 h-3 text-slate-600 z-10" />
                                        <div className="absolute top-0 right-0 w-8 h-8 bg-white/5 -rotate-12 translate-x-4 -translate-y-4 rounded-full blur-xl" />
                                    </div>
                                    {pair.black ? (
                                        <div className="relative overflow-hidden bg-primary/5 hover:bg-primary/10 transition-all rounded-xl px-4 py-3 text-xs font-black font-mono text-primary flex justify-between items-center border border-primary/10 group-hover:border-primary/20 shadow-sm">
                                            <span className="z-10">{pair.black}</span>
                                            {mode === 'ai' ? <Brain className="w-3 h-3 opacity-50 z-10" /> : <User className="w-3 h-3 opacity-50 z-10" />}
                                            <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 -rotate-12 translate-x-4 -translate-y-4 rounded-full blur-xl" />
                                        </div>
                                    ) : (
                                        <div className="bg-slate-900/20 rounded-xl border border-dashed border-white/5 flex items-center justify-center">
                                            <ChevronRight className="w-3 h-3 text-slate-800 animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            <div className="p-6 bg-white/[0.02] border-t border-white/5 mt-auto">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
                    <span>Match Status</span>
                    <span className="text-primary animate-pulse">Live</span>
                </div>
            </div>
        </div>
    );
}
