
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-chess');

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center" href="/">
          <Zap className="h-5 w-5 text-primary mr-2" />
          <span className="font-bold text-xl">ChessDuet</span>
        </Link>
        <nav className="ml-auto flex gap-6">
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/play">
            Play
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/login">
            Sign In
          </Link>
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
                <Button asChild size="lg" className="rounded-full px-8">
                  <Link href="/play">Play Now</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full px-8">
                  <Link href="/login">Join Us</Link>
                </Button>
              </div>
              {heroImage && (
                <div className="relative w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl mt-12">
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

      <footer className="py-8 border-t text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ChessDuet. Simple, Elegant, Precise.
      </footer>
    </div>
  );
}
