import { useEffect, useState } from "react";
import { oauthContext, oauthDecision, scopeLabels } from "../../../api/oauth.js";

export function OAuthConnectPage({ actor }) {
  const query = window.location.search.slice(1);
  const [context, setContext] = useState(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    oauthContext(query)
      .then((value) => {
        if (active) setContext(value);
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [query]);
  async function decide(accept) {
    setBusy(true);
    setError("");
    try {
      const result = await oauthDecision(query, accept, workspaceId);
      window.location.assign(result.redirectUrl);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }
  return (
    <main className="loginPage">
      <section className="loginCard oauthConnectCard">
        <h1>Conectar ao BIAWS</h1>
        <p>{actor.email}</p>
        {error ? (
          <div className="authError" role="alert">
            {error} Reinicie a conexão no aplicativo para tentar novamente.
          </div>
        ) : null}
        {context ? (
          <>
            <p>
              <strong>{context.clientName}</strong> solicita os seguintes acessos:
            </p>
            <ul>
              {scopeLabels(context.scopes).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <p>
              O acesso permanece limitado às permissões atuais da sua conta. Você pode revogar esta conexão em Minha
              conta.
            </p>
            <label>
              <span>Workspace autorizado</span>
              <select value={workspaceId} disabled={busy} onChange={(event) => setWorkspaceId(event.target.value)}>
                <option value="">Escolha um workspace</option>
                {(actor.workspaces || []).map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
            {!actor.workspaces?.length ? <p role="alert">Sua conta não possui um workspace acessível.</p> : null}
            <button
              className="primaryButton"
              disabled={busy || !workspaceId}
              onClick={() => decide(true)}
              type="button"
            >
              {busy ? "Processando…" : "Autorizar conexão"}
            </button>
            <button className="secondaryButton" disabled={busy} onClick={() => decide(false)} type="button">
              Recusar
            </button>
          </>
        ) : !error ? (
          <p role="status">Carregando solicitação…</p>
        ) : null}
      </section>
    </main>
  );
}
