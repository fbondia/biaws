import { KeyRound, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { moveSecretToCollection } from "../../../api.js";
import { IllustratedEmptyState } from "../../shared/IllustratedEmptyState.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { CreateSecretDialog } from "./components/CreateSecretDialog.jsx";
import { EditSecretDialog } from "./components/EditSecretDialog.jsx";
import { SecretCard } from "./components/SecretCard.jsx";
import { SecretValueDialog } from "./components/SecretValueDialog.jsx";
import { useSecretsView } from "./hooks/useSecretsView.js";

function SecretsStatus({ error, loading, secrets }) {
  if (error) return <div className="authError">{error}</div>;
  if (loading) return <p>Carregando segredos…</p>;
  if (!secrets.length) {
    return (
      <IllustratedEmptyState
        description="Crie o primeiro segredo para este workspace ou aplicação."
        icon={KeyRound}
        title="Nenhum segredo acessível"
      />
    );
  }
  return null;
}

function SecretsGrid({
  canDrag,
  cardProps,
  collectionState,
  loading,
  onOpen,
  secrets,
  visibleSecrets,
}) {
  return (
    <div className="secretsGrid">
      {visibleSecrets.map((secret) => (
        <SecretCard
          {...cardProps(secret)}
          draggable={canDrag(secret)}
          key={secret.id}
          onDragEnd={() => collectionState.setDraggedItem(null)}
          onDragStart={() =>
            collectionState.setDraggedItem({ type: "item", id: secret.id })
          }
          onOpen={() => onOpen(secret)}
        />
      ))}
      {!loading && secrets.length && !visibleSecrets.length ? (
        <IllustratedEmptyState
          description="Escolha outra coleção ou mova um segredo para esta pasta."
          icon={KeyRound}
          title="Nenhum segredo nesta coleção"
        />
      ) : null}
    </div>
  );
}

function SecretDialogs({
  actor,
  applications,
  creating,
  editing,
  finishCreation,
  finishEditing,
  finishVersioning,
  setCreating,
  setEditing,
  setVersioning,
  versioning,
}) {
  return (
    <>
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
    </>
  );
}

export function SecretsView({ actor }) {
  const [search, setSearch] = useState("");
  const [selectedSecretId, setSelectedSecretId] = useState("");
  const {
    allowed,
    applicationNames,
    applications,
    archive,
    clearRevealed,
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
    onMoved: async () => {
      setSelectedSecretId("");
      clearRevealed();
      await load();
    },
  });
  const selectedSecret = useMemo(
    () => secrets.find(({ id }) => id === selectedSecretId) || null,
    [secrets, selectedSecretId],
  );
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

  function closeSecret() {
    setSelectedSecretId("");
    clearRevealed();
  }

  function openSecret(secret) {
    setSearch("");
    clearRevealed();
    setSelectedSecretId(secret.id);
    collectionState.setSelectedCollectionId(secret.collectionId || "");
  }

  function secretCardProps(secret) {
    return {
      applicationName: secret.applicationId
        ? applicationNames[secret.applicationId] || secret.applicationId
        : "",
      canArchive: permissions.archive && allowed("secrets.archive", secret),
      canReveal:
        secret.provisioningStatus === "ready" &&
        permissions.reveal &&
        allowed("secrets.value.reveal", secret),
      canUpdate: permissions.update && allowed("secrets.update", secret),
      canWrite: permissions.write && allowed("secrets.value.write", secret),
      copied: copiedSecretId === secret.id,
      onArchive: async () => {
        if (await archive(secret)) closeSecret();
      },
      onCopyValue: () => copyValue(secret),
      onDownload: () => download(secret),
      onEdit: () => setEditing(secret),
      onReveal: () => reveal(secret),
      onToggleValue: () => setShowValue((current) => !current),
      onVersion: () => setVersioning(secret),
      revealed: revealed?.secretId === secret.id ? revealed : null,
      secret,
      showValue,
    };
  }
  return (
    <section className="securityView secretsView">
      <header className="securityHeader">
        <div>
          <h2>Segredos</h2>
          <p>
            Credenciais armazenadas e necessidades aguardando provisionamento.
          </p>
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
      <SecretsStatus error={error} loading={loading} secrets={secrets} />
      <ResourceCollectionsShell
        collections={collectionState.collections}
        detailVisible={Boolean(selectedSecret)}
        draggedItem={collectionState.draggedItem}
        onDropRoot={() => collectionState.dropItem("", moveSecretToCollection)}
        onNavigateBack={closeSecret}
        onSelectCollection={collectionState.setSelectedCollectionId}
        pathLabel={
          selectedSecret
            ? `${collectionPathLabel(
                collectionState.collections,
                selectedSecret.collectionId || "",
              )} / ${selectedSecret.name}`
            : undefined
        }
        selectedCollectionId={collectionState.selectedCollectionId}
        navigator={
          <ResourceCollectionNavigator
            canDragItem={(secret) =>
              permissions.update && allowed("secrets.update", secret)
            }
            collections={collectionState.collections}
            draggedItem={collectionState.draggedItem}
            itemLabel="segredos"
            items={secrets}
            preferenceKey="secrets"
            onCreate={
              permissions.update ? collectionState.createCollection : undefined
            }
            onDelete={collectionState.removeCollection}
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
            onDragItem={(secret) =>
              collectionState.setDraggedItem({ type: "item", id: secret.id })
            }
            onDrop={(collectionId) =>
              collectionState.dropItem(collectionId, moveSecretToCollection)
            }
            onRename={(collection) =>
              collectionState.setCollectionDialog(collection)
            }
            onSelect={(collectionId) => {
              closeSecret();
              collectionState.setSelectedCollectionId(collectionId);
            }}
            onSelectItem={openSecret}
            renderItem={(secret) => (
              <>
                <KeyRound size={13} />
                <span>{secret.name}</span>
                {/*<small>{secret.environment || secret.type}</small>*/}
              </>
            )}
            selectedCollectionId={collectionState.selectedCollectionId}
            selectedItemId={selectedSecretId}
          />
        }
        toolbar={
          selectedSecret ? null : (
            <ResourceCollectionSearch
              loading={loading}
              onClearFilters={() => setSearch("")}
              onRefresh={load}
              onSearch={load}
              onSearchChange={setSearch}
              placeholder="Buscar segredos"
              search={search}
            />
          )
        }
      >
        {selectedSecret ? (
          <SecretCard
            {...secretCardProps(selectedSecret)}
            detail
            onBack={closeSecret}
          />
        ) : (
          <SecretsGrid
            canDrag={(secret) =>
              permissions.update && allowed("secrets.update", secret)
            }
            cardProps={secretCardProps}
            collectionState={collectionState}
            loading={loading}
            onOpen={openSecret}
            secrets={secrets}
            visibleSecrets={visibleSecrets}
          />
        )}
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
      <SecretDialogs
        actor={actor}
        applications={applications}
        creating={creating}
        editing={editing}
        finishCreation={finishCreation}
        finishEditing={finishEditing}
        finishVersioning={finishVersioning}
        setCreating={setCreating}
        setEditing={setEditing}
        setVersioning={setVersioning}
        versioning={versioning}
      />
    </section>
  );
}
