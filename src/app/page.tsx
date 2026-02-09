
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Zap, BookOpen, Users, Smartphone, Globe } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center justify-center" href="/">
          <div className="bg-primary p-1.5 rounded-lg mr-2">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">ChessDuet</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="#features">
            Features
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/play">
            Play Now
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/login">
            Sign In
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="flex flex-col justify-center space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
                <div className="space-y-4">
                  <div className="inline-block rounded-lg bg-accent px-3 py-1 text-sm font-medium text-primary border border-primary/20">
                    Next-Gen Chess Experience
                  </div>
                  <h1 className="text-4xl font-bold tracking-tighter sm:text-6xl xl:text-7xl/none font-headline bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                    Master the Board with ChessDuet
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Experience chess like never before. Play globally, learn from AI, and track your grandmaster journey with our calming, professional interface.
                  </p>
                </div>
                <div className="flex flex-col gap-3 min-[400px]:flex-row">
                  <Button asChild size="lg" className="rounded-full px-8 text-lg">
                    <Link href="/play">Start Playing</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-lg">
                    <Link href="/login">Join the Community</Link>
                  </Button>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="inline-block h-8 w-8 rounded-full border-2 border-background bg-muted overflow-hidden">
                        <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="User" />
                      </div>
                    ))}
                  </div>
                  <p>Trusted by <span className="font-bold text-foreground">10,000+</span> active players</p>
                </div>
              </div>
              <div className="relative aspect-video lg:aspect-square rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-4 duration-700">
                <Image
                  src="https://picsum.photos/seed/chess1/1200/800"
                  alt="Chess Board"
                  fill
                  className="object-cover"
                  priority
                  data-ai-hint="chess board"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 bg-accent/30 border-y">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { label: "Active Players", value: "10K+" },
                { label: "Games Played", value: "2M+" },
                { label: "AI Analyzed", value: "500K" },
                { label: "Countries", value: "120+" }
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <h3 className="text-3xl font-bold tracking-tighter text-primary font-headline">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-background">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Built for the Modern Player</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Whether you're a beginner or a grandmaster, ChessDuet provides the tools you need to enjoy and improve your game.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-none shadow-lg bg-accent/20 hover:bg-accent/30 transition-colors duration-300">
                <CardContent className="pt-8">
                  <div className="mb-4 bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                    <Smartphone className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Cross-Platform</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Seamlessly play on Android and Web. Your game state follows you wherever you go.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-lg bg-accent/20 hover:bg-accent/30 transition-colors duration-300">
                <CardContent className="pt-8">
                  <div className="mb-4 bg-secondary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Learning Mode</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    AI-powered move analysis and legality feedback. Perfect for students and casual players.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-lg bg-accent/20 hover:bg-accent/30 transition-colors duration-300">
                <CardContent className="pt-8">
                  <div className="mb-4 bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">AI Opponent</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Adjustable difficulty levels from beginner to expert. Practice your opening and endgames.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-lg bg-accent/20 hover:bg-accent/30 transition-colors duration-300">
                <CardContent className="pt-8">
                  <div className="mb-4 bg-secondary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Private Rooms</h3>
                  <h3 className="text-muted-foreground text-sm leading-relaxed">
                    Create private rooms and challenge your friends with a single click and shareable links.
                  </h3>
                </CardContent>
              </Card>
              <Card className="border-none shadow-lg bg-accent/20 hover:bg-accent/30 transition-colors duration-300">
                <CardContent className="pt-8">
                  <div className="mb-4 bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Secure Stats</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Every move is stored and analyzed. Get deep insights into your playstyle using PairChess backend.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-lg bg-accent/20 hover:bg-accent/30 transition-colors duration-300">
                <CardContent className="pt-8">
                  <div className="mb-4 bg-secondary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                    <Globe className="h-6 w-6 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Global Lobby</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Match with players from around the world in real-time ranked and casual games.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 border-4 border-white rotate-12 -translate-x-1/2 -translate-y-1/2 rounded-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 border-4 border-white -rotate-12 translate-x-1/2 translate-y-1/2 rounded-full" />
          </div>
          <div className="container px-4 md:px-6 mx-auto text-center relative z-10">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl mb-6 font-headline">Ready to Make Your Move?</h2>
            <p className="max-w-[600px] mx-auto text-primary-foreground/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mb-10">
              Join ChessDuet today and join a global community of players. Improve your rating and master the game.
            </p>
            <Button asChild size="lg" variant="secondary" className="rounded-full px-12 text-lg font-bold">
              <Link href="/play">Get Started Free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-background">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid gap-8 lg:grid-cols-4">
            <div className="space-y-4">
              <Link className="flex items-center" href="/">
                <Zap className="h-6 w-6 text-primary mr-2" />
                <span className="font-bold text-xl tracking-tight">ChessDuet</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                The world's most advanced cross-platform chess application.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/play">Play Now</Link></li>
                <li><Link href="#features">Features</Link></li>
                <li><Link href="/pricing">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/help">Help Center</Link></li>
                <li><Link href="/contact">Contact Us</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Stay Connected</h4>
              <div className="flex gap-4">
                {/* Social icons would go here */}
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center cursor-pointer hover:bg-primary hover:text-white transition-colors">
                  <Globe className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} ChessDuet. All rights reserved. Linked to PairChess project.
          </div>
        </div>
      </footer>
    </div>
  );
}
