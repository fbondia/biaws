import { KeyRound, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { moveSecretToCollection } from "../../../api.js";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionSidebar,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { CreateSecretDialog } from "./components/CreateSecretDialog.jsx";
import { EditSecretDialog } from "./components/EditSecretDialog.jsx";
import { SecretCard } from "./components/SecretCard.jsx";
import { SecretValueDialog } from "./components/SecretValueDialog.jsx";
import { useSecretsView } from "./hooks/useSecretsView.js";

export function SecretsView({ actor }) {
  const [search, setSearch] = useState("");
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
    load,
    permissions,
    reveal,
    revealed,
    secrets,
    setCreating,
    setEditing,
    setError,
    setShowValue,
    setVersioning,
    showValue,
    versioning,
  } = useSecretsView(actor);
  const collectionState = useResourceCollections("secrets", {
    onError: setError,
    onMoved: load,
  });
  const visibleSecrets = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return secrets.filter((secret) => {
      if (
        String(secret.collectionId || "") !==
        collectionState.selectedCollectionId
      ) {
        return false;
      }
      if (!term) return true;
      return [secret.name, secret.identifier, secret.description, secret.type]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("pt-BR").includes(term),
        );
    });
  }, [secrets, search, collectionState.selectedCollectionId]);
  const selectedCollection = collectionState.collections.find(
    ({ id }) => id === collectionState.selectedCollectionId,
  );

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
      <ResourceCollectionsShell
        collections={collectionState.collections}
        collectionsVisible={collectionState.collectionsVisible}
        onShowCollections={() => collectionState.setCollectionsVisible(true)}
        selectedCollectionId={collectionState.selectedCollectionId}
        sidebar={
          <ResourceCollectionSidebar
            collections={collectionState.collections}
            draggedItem={collectionState.draggedItem}
            itemLabel="segredos"
            items={secrets}
            onCreate={
              permissions.update
                ? () => collectionState.setCollectionDialog({})
                : undefined
            }
            onDelete={collectionState.removeCollection}
            onClose={() => collectionState.setCollectionsVisible(false)}
            onDragCollection={
              permissions.update
                ? (collection) =>
                    collectionState.setDraggedItem({
                      type: "collection",
                      id: collection.id,
                    })
                : undefined
            }
            onDragEnd={() => collectionState.setDraggedItem(null)}
            onDrop={(collectionId) =>
              collectionState.dropItem(collectionId, moveSecretToCollection)
            }
            onRename={() =>
              collectionState.setCollectionDialog(selectedCollection)
            }
            onSelect={collectionState.setSelectedCollectionId}
            selectedCollectionId={collectionState.selectedCollectionId}
          />
        }
        toolbar={
          <ResourceCollectionSearch
            loading={loading}
            onRefresh={load}
            onSearch={load}
            onSearchChange={setSearch}
            placeholder="Buscar segredos"
            search={search}
          />
        }
      >
        <div className="secretsGrid">
          {visibleSecrets.map((secret) => (
            <SecretCard
              applicationName={
                secret.applicationId
                  ? applicationNames[secret.applicationId] ||
                    secret.applicationId
                  : ""
              }
              draggable={
                permissions.update && allowed("secrets.update", secret)
              }
              key={secret.id}
              onDragEnd={() => collectionState.setDraggedItem(null)}
              onDragStart={() =>
                collectionState.setDraggedItem({
                  type: "item",
                  id: secret.id,
                })
              }
              onArchive={() => archive(secret)}
              canArchive={
                permissions.archive && allowed("secrets.archive", secret)
              }
              canReveal={
                permissions.reveal && allowed("secrets.value.reveal", secret)
              }
              canUpdate={
                permissions.update && allowed("secrets.update", secret)
              }
              canWrite={
                permissions.write && allowed("secrets.value.write", secret)
              }
              copied={copiedSecretId === secret.id}
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
          {!loading && secrets.length && !visibleSecrets.length ? (
            <div className="emptyState">Nenhum segredo nesta coleção.</div>
          ) : null}
        </div>
      </ResourceCollectionsShell>
      {collectionState.collectionDialog ? (
        <ResourceCollectionDialog
          collection={
            collectionState.collectionDialog.id
              ? collectionState.collectionDialog
              : null
          }
          onClose={() => collectionState.setCollectionDialog(null)}
          onSave={collectionState.saveCollection}
          parentLabel={collectionPathLabel(
            collectionState.collections,
            collectionState.selectedCollectionId,
          )}
          resourceLabel="segredos"
        />
      ) : null}
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
