import { KeyRound, Plus } from "lucide-react";

import { CreateSecretDialog } from "./components/CreateSecretDialog.jsx";
import { EditSecretDialog } from "./components/EditSecretDialog.jsx";
import { SecretCard } from "./components/SecretCard.jsx";
import { SecretValueDialog } from "./components/SecretValueDialog.jsx";
import { useSecretsView } from "./hooks/useSecretsView.js";

export function SecretsView({ actor }) {
  const {
    allowed,
    applicationNames,
    applications,
    archive,
    copiedSecretId,
    copyValue,
    creating,
    download,
    editing,
    error,
    finishCreation,
    finishEditing,
    finishVersioning,
    loading,
    permissions,
    reveal,
    revealed,
    secrets,
    setCreating,
    setEditing,
    setShowValue,
    setVersioning,
    showValue,
    versioning,
  } = useSecretsView(actor);

  return (
    <section className="securityView secretsView">
      <header className="securityHeader">
        <div>
          <h2>Segredos</h2>
          <p>Credenciais externas armazenadas no cofre criptografado.</p>
        </div>
        {permissions.create ? (
          <button
            className="primaryButton"
            onClick={() => setCreating(true)}
            type="button"
          >
            <Plus size={16} /> Novo segredo
          </button>
        ) : null}
      </header>
      {error ? <div className="authError">{error}</div> : null}
      {loading ? <p>Carregando segredos…</p> : null}
      {!loading && !secrets.length ? (
        <div className="securityPanel secretsEmptyState">
          <KeyRound size={28} />
          <strong>Nenhum segredo acessível</strong>
          <p>Crie o primeiro segredo para este workspace ou aplicação.</p>
        </div>
      ) : null}
      <div className="secretsGrid">
        {secrets.map((secret) => (
          <SecretCard
            applicationName={
              secret.applicationId
                ? applicationNames[secret.applicationId] || secret.applicationId
                : ""
            }
            canArchive={
              permissions.archive && allowed("secrets.archive", secret)
            }
            canReveal={
              permissions.reveal && allowed("secrets.value.reveal", secret)
            }
            canUpdate={permissions.update && allowed("secrets.update", secret)}
            canWrite={
              permissions.write && allowed("secrets.value.write", secret)
            }
            copied={copiedSecretId === secret.id}
            key={secret.id}
            onArchive={() => archive(secret)}
            onCopyValue={() => copyValue(secret)}
            onDownload={() => download(secret)}
            onEdit={() => setEditing(secret)}
            onReveal={() => reveal(secret)}
            onToggleValue={() => setShowValue((current) => !current)}
            onVersion={() => setVersioning(secret)}
            revealed={revealed?.secretId === secret.id ? revealed : null}
            secret={secret}
            showValue={showValue}
          />
        ))}
      </div>
      {creating ? (
        <CreateSecretDialog
          actor={actor}
          applications={applications}
          onClose={() => setCreating(false)}
          onCreated={finishCreation}
        />
      ) : null}
      {editing ? (
        <EditSecretDialog
          actor={actor}
          applications={applications}
          onClose={() => setEditing(null)}
          onSaved={finishEditing}
          secret={editing}
        />
      ) : null}
      {versioning ? (
        <SecretValueDialog
          onClose={() => setVersioning(null)}
          onSaved={finishVersioning}
          secret={versioning}
        />
      ) : null}
    </section>
  );
}
