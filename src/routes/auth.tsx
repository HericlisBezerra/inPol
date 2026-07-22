import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Inpol" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/v2" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/v2" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha no login. Acesso é apenas por convite.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
    // On success, Supabase redirects the browser to Google — no further
    // action needed here. The root route ("/") redirects to /dashboard
    // once the session is established.
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-md bg-primary/15 grid place-items-center">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-display text-2xl leading-none">Inpol</div>
            <div className="label-mono mt-1">Inteligência política</div>
          </div>
        </div>

        <Card className="p-6 bg-surface border-border">
          <h1 className="font-display text-xl mb-1">Entrar</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Acesso restrito. Apenas usuários convidados.
          </p>

          <Button
            variant="outline"
            className="w-full mb-4"
            onClick={handleGoogle}
            disabled={loading}
          >
            Continuar com Google
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-border flex-1" />
            <span className="label-mono">ou</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Entrar
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Não tem acesso? Solicite um convite ao administrador.
          </p>
        </Card>
      </div>
    </div>
  );
}
