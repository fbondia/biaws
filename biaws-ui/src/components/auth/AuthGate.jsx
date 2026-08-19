import { LockKeyhole } from "lucide-react";
import { useRef, useState } from "react";

import { useSession } from "../../infrastructure/session/SessionProvider.jsx";
import { SESSION_STATUS } from "../../infrastructure/session/service.js";
import "../../styles/features/auth/index.css";

function CredentialsFields({
  email,
  error,
  onEmailChange,
  onPasswordChange,
  password,
}) {
  return (
    <>
      <label>
        <span>E-mail</span>
        <input
          autoComplete="username"
          onChange={onEmailChange}
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
          onChange={onPasswordChange}
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
    </>
  );
}

function LoginPage({ credentials, onSubmit, submitting }) {
  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={onSubmit}>
        <div className="loginIcon">
          <LockKeyhole size={28} />
        </div>
        <div>
          <h1>Bondia Workspaces</h1>
          <p>Entre com sua identidade administrativa ou operacional.</p>
        </div>
        <CredentialsFields {...credentials} />
        <button className="primaryButton" disabled={submitting} type="submit">
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function SessionError({ error, onRetry }) {
  return (
    <main className="loginPage">
      <section className="loginCard" role="alert">
        <h1>Não foi possível validar a sessão</h1>
        <p>{error.message}</p>
        <button className="primaryButton" onClick={onRetry} type="button">
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

function WorkspaceChoice({ actor, onSelect }) {
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
              onClick={() => onSelect(workspace.id)}
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

function ReauthenticationDialog({ credentials, onSubmit, reason, submitting }) {
  return (
    <div className="dialogBackdrop sessionExpiredBackdrop">
      <form
        aria-labelledby="sessionExpiredDialogTitle"
        aria-modal="true"
        className="loginCard sessionExpiredDialog"
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="loginIcon">
          <LockKeyhole size={28} />
        </div>
        <div>
          <h1 id="sessionExpiredDialogTitle">Sua sessão expirou</h1>
          <p>
            Entre novamente para continuar sem perder as alterações desta tela.
          </p>
        </div>
        <div className="authError" role="alert">
          {reason || "Sua sessão expirou. Entre novamente."}
        </div>
        <CredentialsFields {...credentials} />
        <button className="primaryButton" disabled={submitting} type="submit">
          {submitting ? "Entrando…" : "Entrar novamente"}
        </button>
      </form>
    </div>
  );
}

export function AuthGate({ children }) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const authenticatedActor = useRef(null);
  const reauthenticationAttempt = useRef(false);

  if (session.status === SESSION_STATUS.AUTHENTICATED) {
    authenticatedActor.current = session.actor;
  }

  async function submit(event) {
    event.preventDefault();
    reauthenticationAttempt.current = session.status === SESSION_STATUS.EXPIRED;
    setSubmitting(true);
    setError("");
    try {
      await session.signIn({ email, password });
      setPassword("");
    } catch (loginError) {
      setError(loginError.message || "Não foi possível autenticar.");
    } finally {
      reauthenticationAttempt.current = false;
      setSubmitting(false);
    }
  }

  const reauthenticationVisible =
    Boolean(authenticatedActor.current) &&
    (session.status === SESSION_STATUS.EXPIRED ||
      (submitting && reauthenticationAttempt.current));
  const credentials = {
    email,
    error,
    onEmailChange: (event) => setEmail(event.target.value),
    onPasswordChange: (event) => setPassword(event.target.value),
    password,
  };

  if (
    session.status === SESSION_STATUS.INITIALIZING &&
    !reauthenticationVisible
  ) {
    return <div className="authLoading">Validando sessão…</div>;
  }

  if (session.status === SESSION_STATUS.ERROR) {
    return (
      <SessionError error={session.error} onRetry={() => session.refresh()} />
    );
  }

  if (session.status === SESSION_STATUS.ANONYMOUS) {
    return (
      <LoginPage
        credentials={credentials}
        onSubmit={submit}
        submitting={submitting}
      />
    );
  }

  const actor = session.actor || authenticatedActor.current;

  if (
    !actor.workspaceId &&
    actor.workspaces?.length > 1 &&
    !actor.platformPermissions?.includes("platform.workspaces.manage")
  ) {
    return <WorkspaceChoice actor={actor} onSelect={session.switchWorkspace} />;
  }

  return (
    <>
      {children({
        actor,
        onSignOut: () => session.signOut().catch(() => {}),
        onWorkspaceChange: session.switchWorkspace,
      })}
      {reauthenticationVisible ? (
        <ReauthenticationDialog
          credentials={credentials}
          onSubmit={submit}
          reason={session.reason}
          submitting={submitting}
        />
      ) : null}
    </>
  );
}
