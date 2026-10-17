import { useEffect, useState } from "react";
import { listOAuthConnections, revokeOAuthConnection, scopeLabels } from "../../../api/oauth.js";

export function OAuthConnections({ actor }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    listOAuthConnections()
      .then((result) => {
        if (active) setPayload(result);
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function revoke(id) {
    setBusy(id);
    setError("");
    try {
      await revokeOAuthConnection(id);
      setPayload(await listOAuthConnections());
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  }
  if (payload && !payload.enabled) return null;
  return (
    <article className="securityPanel">
      <h3>Aplicativos conectados</h3>
      {error ? (
        <div className="authError" role="alert">
          {error}
        </div>
      ) : null}
      {!payload ? <p>Carregando conexões…</p> : null}
      {payload?.items.length === 0 ? <p>Nenhuma conexão autorizada.</p> : null}
      {payload?.items.map((item) => (
        <div className="oauthConnection" key={item.id}>
          <strong>{item.clientName || item.clientId}</strong>
          <span>
            {actor.workspaces?.find((workspace) => workspace.id === item.workspaceId)?.name || item.workspaceId}
          </span>
          <small>{scopeLabels(item.scopes).join(" · ")}</small>
          <button className="secondaryButton" disabled={Boolean(busy)} onClick={() => revoke(item.id)} type="button">
            {busy === item.id ? "Revogando…" : "Revogar conexão"}
          </button>
        </div>
      ))}
    </article>
  );
}
