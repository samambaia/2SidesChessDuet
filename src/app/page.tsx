
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Zap, LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-chess');

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center" href="/">
          <Zap className="h-5 w-5 text-primary mr-2" />
          <span className="font-bold text-xl">ChessDuet</span>
        </Link>
        <nav className="ml-auto flex items-center gap-6">
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/play">
            Play
          </Link>
          
          {isUserLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-accent/50 py-1 pl-1 pr-3 rounded-full border border-accent">
                <Avatar className="h-7 w-7 border">
                  <AvatarImage src={user.photoURL || ""} />
                  <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold hidden sm:inline-block max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut} 
                className="gap-2 h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <Link className="text-sm font-medium hover:text-primary transition-colors" href="/login">
              Sign In
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-8 text-center">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-6xl">
                  Chess Mastery Simplified
                </h1>
                <p className="max-w-[700px] text-muted-foreground md:text-xl mx-auto">
                  A focused, modern chess experience. Play against AI, friends, or learn the rules in a clean, professional environment.
                </p>
              </div>
              <div className="flex gap-4">
                <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
                  <Link href="/play">Play Now</Link>
                </Button>
                {!user && !isUserLoading && (
                  <Button asChild variant="outline" size="lg" className="rounded-full px-8">
                    <Link href="/login">Join Us</Link>
                  </Button>
                )}
              </div>
              {heroImage && (
                <div className="relative w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl mt-12 border-8 border-background">
                  <Image
                    src={heroImage.imageUrl}
                    alt={heroImage.description}
                    fill
                    className="object-cover"
                    priority
                    data-ai-hint={heroImage.imageHint}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t text-center text-sm text-muted-foreground bg-accent/5">
        © {new Date().getFullYear()} ChessDuet. Simple, Elegant, Precise.
      </footer>
    </div>
  );
}
