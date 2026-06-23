import Head from "next/head";
import { useRouter } from "next/router";
import { type FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function redirectAuthenticatedUser() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();

        if (data.session) {
          await router.replace("/");
        }
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : "Não foi possível iniciar o Supabase.");
      }
    }

    void redirectAuthenticatedUser();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      await router.push("/");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Entrar | Admin J&B</title>
        <meta name="description" content="Acesso privado dos noivos ao painel de presenças." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="login-page">
        <section className="login-panel" aria-labelledby="login-title">
          <p className="eyebrow">Painel dos noivos</p>
          <h1 id="login-title">J&B</h1>
          <p className="login-copy">Acompanhe em um só lugar quem confirmou presença para o grande dia.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
