
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Zap, Github, Chrome, Loader2, AlertCircle } from 'lucide-react';
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

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSocialLogin = async (providerName: 'google' | 'github') => {
    if (!auth) return;
    setIsLoading(true);
    setConfigError(null);

    const provider = providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
    
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      router.push('/');
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Não foi possível realizar a autenticação.";
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = `O provedor ${providerName} não está habilitado no Console do Firebase. Vá em Auth > Sign-in method e ative-o.`;
        setConfigError(errorMessage);
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = "Este domínio não está autorizado no Console do Firebase. Vá em Auth > Settings > Authorized Domains e adicione este endereço.";
        setConfigError(errorMessage);
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "A janela de login foi fechada.";
      }
      
      toast({ 
        title: "Erro de Configuração", 
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
      let description = "Erro ao autenticar. Verifique seus dados.";
      if (error.code === 'auth/email-already-in-use') description = "Este e-mail já está em uso.";
      if (error.code === 'auth/weak-password') description = "A senha deve ter 6+ caracteres.";
      if (error.code === 'auth/invalid-credential') description = "E-mail ou senha incorretos.";

      toast({ 
        title: "Erro", 
        description,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="bg-primary p-2 rounded-xl">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold tracking-tight">ChessDuet</span>
          </Link>
          <h2 className="text-2xl font-bold">
            {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
          </h2>
        </div>

        {configError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Atenção (Configuração Necessária)</AlertTitle>
            <AlertDescription className="text-xs">
              {configError}
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
                <span className="bg-card px-4 text-muted-foreground">Ou e-mail</span>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleEmailAuth}>
            <CardContent className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input 
                    id="name" 
                    placeholder="Seu nome" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="exemplo@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
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
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isLogin ? "Entrar" : "Cadastrar")}
              </Button>
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary font-semibold hover:underline"
              >
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
