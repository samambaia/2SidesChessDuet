"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Github, Chrome, Loader2, AlertCircle, Copy } from 'lucide-react';
import { useAuth } from '@/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChessLogo } from '@/components/ChessLogo';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [currentDomain, setCurrentDomain] = useState('');
  
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentDomain(window.location.hostname);
    }
  }, []);

  const handleSocialLogin = async (providerName: 'google' | 'github') => {
    if (!auth) return;
    setIsLoading(true);
    setConfigError(null);

    const provider = providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
    
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Welcome!", description: "Login successful." });
      router.push('/');
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Authentication failed.";
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = `The ${providerName} provider is not enabled in Firebase Console. Go to Auth > Sign-in method to enable it.`;
        setConfigError(errorMessage);
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = `This domain (${currentDomain}) is not authorized in Firebase Console. Add it in Auth > Settings > Authorized Domains.`;
        setConfigError(errorMessage);
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Login popup was closed.";
      }
      
      toast({ 
        title: "Authentication Error", 
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password) return;
    
    setIsLoading(true);
    setConfigError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
      }
      router.push('/');
    } catch (error: any) {
      let description = "Error authenticating. Please check your credentials.";
      if (error.code === 'auth/email-already-in-use') description = "This email is already in use.";
      if (error.code === 'auth/weak-password') description = "Password must be 6+ characters.";
      if (error.code === 'auth/invalid-credential') description = "Incorrect email or password.";

      toast({ 
        title: "Error", 
        description,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyDomain = () => {
    navigator.clipboard.writeText(currentDomain);
    toast({ title: "Copied!", description: "Domain copied to clipboard." });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <ChessLogo className="scale-125" />
          </Link>
          <h2 className="text-2xl font-bold">
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
        </div>

        {configError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-bold uppercase tracking-wider">Action Required in Console</AlertTitle>
            <AlertDescription className="text-xs space-y-3 mt-2">
              <p>{configError}</p>
              <div className="flex items-center justify-between bg-destructive/10 p-3 rounded-xl border border-destructive/20 mt-2">
                <code className="text-[10px] break-all font-mono font-bold">{currentDomain}</code>
                <Button variant="ghost" size="sm" onClick={copyDomain} className="h-8 w-8 p-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="space-y-4 pt-8">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="w-full rounded-xl h-12" 
                onClick={() => handleSocialLogin('github')}
                disabled={isLoading}
              >
                <Github className="mr-2 h-4 w-4" />
                Github
              </Button>
              <Button 
                variant="outline" 
                className="w-full rounded-xl h-12" 
                onClick={() => handleSocialLogin('google')}
                disabled={isLoading}
              >
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-4 text-muted-foreground">Or email</span>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleEmailAuth}>
            <CardContent className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Your name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="example@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl h-11"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-8">
              <Button type="submit" className="w-full h-12 text-lg rounded-xl" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isLogin ? "Sign In" : "Sign Up")}
              </Button>
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary font-semibold hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
