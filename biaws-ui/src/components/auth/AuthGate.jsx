import { LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";

import {
  fetchCurrentActor,
  getCurrentWorkspaceId,
  setCurrentWorkspaceId,
  signIn,
  signOut,
} from "../../api.js";

export function AuthGate({ children }) {
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadActor() {
    try {
      const payload = await fetchCurrentActor();
      setActor(payload.actor);
    } catch (loadError) {
      if (loadError.code === "WORKSPACE_FORBIDDEN" && getCurrentWorkspaceId()) {
        setCurrentWorkspaceId("");
        const payload = await fetchCurrentActor();
        setActor(payload.actor);
      } else {
        setActor(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActor();
    const handleUnauthenticated = () => setActor(null);
    window.addEventListener("biaws:unauthenticated", handleUnauthenticated);
    return () =>
      window.removeEventListener(
        "biaws:unauthenticated",
        handleUnauthenticated,
      );
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      await loadActor();
      setPassword("");
    } catch (loginError) {
      setError(loginError.message || "Não foi possível autenticar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    try {
      await signOut();
    } finally {
      setActor(null);
    }
  }

  async function changeWorkspace(workspaceId) {
    setCurrentWorkspaceId(workspaceId);
    setLoading(true);
    await loadActor();
  }

  if (loading) {
    return <div className="authLoading">Validando sessão…</div>;
  }

  if (!actor) {
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
          {error ? <div className="authError">{error}</div> : null}
          <button className="primaryButton" disabled={submitting} type="submit">
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  if (!actor.workspaceId && actor.workspaces?.length > 1) {
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
                  await changeWorkspace(workspace.id);
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
    onSignOut: logout,
    onWorkspaceChange: changeWorkspace,
  });
}
