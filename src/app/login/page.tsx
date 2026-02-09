
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Zap, Github, Chrome } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent/30 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="bg-primary p-2 rounded-xl">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold tracking-tight">ChessDuet</span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-muted-foreground">
            {isLogin 
              ? "Enter your credentials to access your games" 
              : "Join the community and start mastering chess"}
          </p>
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader className="space-y-4 pt-8">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="w-full">
                <Github className="mr-2 h-4 w-4" />
                Github
              </Button>
              <Button variant="outline" className="w-full">
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Magnus Carlsen" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m.carlsen@chess.com" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <Link href="#" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input id="password" type="password" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button className="w-full h-11 text-lg rounded-xl">
              {isLogin ? "Sign In" : "Sign Up"}
            </Button>
            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </span>{" "}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-semibold hover:underline"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </div>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground px-8">
          By clicking continue, you agree to our{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-primary">Terms of Service</Link>{" "}
          and{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
