
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Zap, Github, Chrome, Loader2 } from 'lucide-react';
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

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSocialLogin = async (providerName: 'google' | 'github') => {
    if (!auth) return;
    setIsLoading(true);
    const provider = providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      router.push('/');
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Não foi possível realizar a autenticação social.";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "A janela de login foi fechada antes da conclusão.";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = `O provedor ${providerName} não está habilitado no Console do Firebase.`;
      }
      
      toast({ 
        title: "Erro no Login", 
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
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Bem-vindo de volta!", description: "Login realizado com sucesso." });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        toast({ title: "Conta criada!", description: "Seja bem-vindo ao ChessDuet." });
      }
      router.push('/');
    } catch (error: any) {
      console.error("Email auth error:", error);
      let description = "Ocorreu um erro ao tentar autenticar.";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        description = "E-mail ou senha inválidos.";
      } else if (error.code === 'auth/email-already-in-use') {
        description = "Este e-mail já está sendo utilizado.";
      } else if (error.code === 'auth/weak-password') {
        description = "A senha deve ter pelo menos 6 caracteres.";
      }

      toast({ 
        title: "Erro na Autenticação", 
        description,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
          </h2>
          <p className="text-muted-foreground">
            {isLogin 
              ? "Entre com suas credenciais para acessar seus jogos" 
              : "Junte-se à comunidade e comece a dominar o xadrez"}
          </p>
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader className="space-y-4 pt-8">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleSocialLogin('github')}
                disabled={isLoading}
              >
                <Github className="mr-2 h-4 w-4" />
                Github
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
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
                <span className="bg-card px-2 text-muted-foreground">Ou continue com e-mail</span>
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
                    placeholder="Magnus Carlsen" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m.carlsen@chess.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {isLogin && (
                    <Link href="#" className="text-xs text-primary hover:underline">
                      Esqueceu a senha?
                    </Link>
                  )}
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-8">
              <Button type="submit" className="w-full h-11 text-lg rounded-xl" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  isLogin ? "Entrar" : "Criar Conta"
                )}
              </Button>
              <div className="text-center text-sm">
                <span className="text-muted-foreground">
                  {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
                </span>{" "}
                <button 
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary font-semibold hover:underline"
                >
                  {isLogin ? "Cadastre-se" : "Entrar"}
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground px-8">
          Ao continuar, você concorda com nossos{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-primary">Termos de Serviço</Link>{" "}
          e{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-primary">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
