import { LockKeyhole } from "lucide-react";
import { useState } from "react";

import { useSession } from "../../infrastructure/session/SessionProvider.jsx";
import { SESSION_STATUS } from "../../infrastructure/session/service.js";

export function AuthGate({ children }) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await session.signIn({ email, password });
      setPassword("");
    } catch (loginError) {
      setError(loginError.message || "Não foi possível autenticar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (session.status === SESSION_STATUS.INITIALIZING) {
    return <div className="authLoading">Validando sessão…</div>;
  }

  if (session.status === SESSION_STATUS.ERROR) {
    return (
      <main className="loginPage">
        <section className="loginCard" role="alert">
          <h1>Não foi possível validar a sessão</h1>
          <p>{session.error.message}</p>
          <button
            className="primaryButton"
            onClick={() => session.refresh()}
            type="button"
          >
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  if (
    [SESSION_STATUS.ANONYMOUS, SESSION_STATUS.EXPIRED].includes(session.status)
  ) {
    return (
      <main className="loginPage">
        <form className="loginCard" onSubmit={submit}>
          <div className="loginIcon">
            <LockKeyhole size={28} />
          </div>
          <div>
            <h1>Bondia Workspaces</h1>
            <p>Entre com sua identidade administrativa ou operacional.</p>
          </div>
          {session.status === SESSION_STATUS.EXPIRED ? (
            <div className="authError" role="alert">
              {session.reason || "Sua sessão expirou. Entre novamente."}
            </div>
          ) : null}
          <label>
            <span>E-mail</span>
            <input
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              autoComplete="current-password"
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <div className="authError" role="alert">
              {error}
            </div>
          ) : null}
          <button className="primaryButton" disabled={submitting} type="submit">
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const { actor } = session;

  if (
    !actor.workspaceId &&
    actor.workspaces?.length > 1 &&
    !actor.platformPermissions?.includes("platform.workspaces.manage")
  ) {
    return (
      <main className="loginPage">
        <section className="loginCard">
          <div>
            <h1>Escolha o workspace</h1>
            <p>Seu acesso está vinculado a mais de um workspace.</p>
          </div>
          <div className="workspaceChoiceList">
            {actor.workspaces.map((workspace) => (
              <button
                className="secondaryButton"
                key={workspace.id}
                onClick={async () => {
                  await session.switchWorkspace(workspace.id);
                }}
                type="button"
              >
                <strong>{workspace.name}</strong>
                <span>{workspace.key}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return children({
    actor,
    onSignOut: () => session.signOut().catch(() => {}),
    onWorkspaceChange: session.switchWorkspace,
  });
}
