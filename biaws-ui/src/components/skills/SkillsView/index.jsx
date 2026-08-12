import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Package,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchSkills,
  moveSkillToCollection,
  replicateSkill,
} from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import { BulkReplicationToolbar } from "../../shared/BulkReplicationToolbar.jsx";
import { IllustratedEmptyState } from "../../shared/IllustratedEmptyState.jsx";
import { ReplicationDialog } from "../../shared/ReplicationDialog.jsx";
import { replicateItemsInBulk } from "../../shared/replicationModel.js";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { useMessages } from "../../../infrastructure/messages/MessagesProvider.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { PublishSkillDialog } from "./components/PublishSkillDialog.jsx";
import { SkillDetailsDialog } from "./components/SkillDetailsDialog.jsx";
import { formatDate } from "./utils.js";

function SkillCard({
  canDrag,
  collectionState,
  onOpen,
  onToggleSelection,
  selected,
  skill,
}) {
  const published = skill.status === "published";
  return (
    <article
      className={selected ? "skillCard bulkSelectedCard" : "skillCard"}
      data-collection-browser-item-id={skill.skillId}
      draggable={canDrag && !selected}
      onDragEnd={() => collectionState.setDraggedItem(null)}
      onDragStart={() =>
        collectionState.setDraggedItem({ type: "item", id: skill.skillId })
      }
    >
      <button
        aria-label={`Abrir ${skill.name}`}
        className="skillCardOpenButton"
        onClick={() => onOpen(skill)}
        type="button"
      />
      <header>
        <input
          aria-label={`Selecionar ${skill.name} para replicação`}
          checked={selected}
          className="bulkSelectionCheckbox"
          onChange={() => onToggleSelection(skill.skillId)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          type="checkbox"
        />
        <div className="skillCardIcon">
          <Package size={20} />
        </div>
        <div>
          <h3>{skill.name}</h3>
          <code>{skill.skillId}</code>
        </div>
      </header>
      <p>{skill.description}</p>
      <dl>
        <div>
          <dt>Versão atual</dt>
          <dd>{skill.latestVersion}</dd>
        </div>
        <div>
          <dt>Versões</dt>
          <dd>{skill.versions.length}</dd>
        </div>
        <div>
          <dt>Atualizada</dt>
          <dd>{formatDate(skill.updatedAt)}</dd>
        </div>
      </dl>
      <footer>
        <span
          className={
            published ? "skillStatus published" : "skillStatus deprecated"
          }
        >
          {published ? <CheckCircle2 size={13} /> : <Archive size={13} />}
          {skill.status}
        </span>
      </footer>
    </article>
  );
}

function SkillCards({
  allItems,
  canDrag,
  collectionState,
  items,
  loading,
  onOpen,
  onToggleSelection,
  selectedSkillIds,
}) {
  if (!loading && !allItems.length)
    return (
      <IllustratedEmptyState
        description="Publique uma versão pela interface ou pelo Bondia Workspaces CLI."
        icon={Package}
        title="Nenhuma skill encontrada"
      />
    );
  return (
    <div className="skillCards">
      {items.map((skill) => (
        <SkillCard
          canDrag={canDrag}
          collectionState={collectionState}
          key={skill.skillId}
          onOpen={onOpen}
          onToggleSelection={onToggleSelection}
          selected={selectedSkillIds.includes(skill.skillId)}
          skill={skill}
        />
      ))}
      {!loading && allItems.length && !items.length ? (
        <div className="emptyState">Nenhuma skill nesta coleção.</div>
      ) : null}
    </div>
  );
}

function SkillDialogs({
  collectionState,
  onPublished,
  publishing,
  setPublishing,
}) {
  return (
    <>
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
          resourceLabel="skills"
        />
      ) : null}
      {publishing ? (
        <PublishSkillDialog
          onClose={() => setPublishing(false)}
          onPublished={onPublished}
        />
      ) : null}
    </>
  );
}

function SkillError({ error }) {
  if (!error) return null;
  return (
    <div className="skillPageError">
      <AlertTriangle size={17} />
      {error}
    </div>
  );
}

export function SkillsView({ actor }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  const [bulkReplicationOpen, setBulkReplicationOpen] = useState(false);
  const { run: runWithLoading } = useMessages();
  const collectionState = useResourceCollections("skills", {
    onError: setError,
    onMoved: loadSkills,
  });

  async function loadSkills() {
    setLoading(true);
    setError("");
    try {
      setResult(
        await runWithLoading(
          () => fetchSkills({ includeDeprecated: true }),
          "Carregando catálogo de skills…",
        ),
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSkills();
  }, []);

  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const collectionItems = (result?.items || []).filter(
      ({ collectionId }) =>
        String(collectionId || "") === collectionState.selectedCollectionId,
    );
    if (!term) return collectionItems;
    return collectionItems.filter(
      (item) =>
        item.skillId.toLocaleLowerCase("pt-BR").includes(term) ||
        item.name.toLocaleLowerCase("pt-BR").includes(term) ||
        item.description.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [result, search, collectionState.selectedCollectionId]);
  const selectedSkills = useMemo(
    () => items.filter(({ skillId }) => selectedSkillIds.includes(skillId)),
    [items, selectedSkillIds],
  );
  const canReplicate = (actor.workspaces || []).some(
    ({ id, status }) => id !== actor.workspaceId && status !== "archived",
  );
  const canManageCollections = hasPermission(actor, "skills.publish");

  useEffect(() => {
    const visibleIds = new Set(items.map(({ skillId }) => skillId));
    setSelectedSkillIds((current) => {
      const next = current.filter((skillId) => visibleIds.has(skillId));
      return next.length === current.length ? current : next;
    });
  }, [items]);

  function toggleSkillSelection(skillId) {
    setSelectedSkillIds((current) =>
      current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId],
    );
  }

  function completeBulkReplication() {
    setBulkReplicationOpen(false);
    setSelectedSkillIds([]);
  }

  return (
    <section className="skillsView">
      <header className="skillsToolbar">
        <div>
          <h2>Catálogo de skills</h2>
          <p>
            Versões publicadas para configuração dos ambientes Bondia
            Workspaces.
          </p>
        </div>
        <div className="skillsToolbarActions">
          <button
            className="primaryButton"
            onClick={() => setPublishing(true)}
            type="button"
          >
            <Plus size={16} /> Publicar versão
          </button>
        </div>
      </header>
      <SkillError error={error} />
      {loading && !result ? (
        <div className="emptyState">Carregando catálogo...</div>
      ) : null}
      {!loading || result ? (
        <ResourceCollectionsShell
          collections={collectionState.collections}
          detailVisible={Boolean(selectedSkill)}
          draggedItem={collectionState.draggedItem}
          onDropRoot={() => collectionState.dropItem("", moveSkillToCollection)}
          onNavigateBack={() => setSelectedSkill(null)}
          onSelectCollection={collectionState.setSelectedCollectionId}
          pathLabel={
            selectedSkill
              ? `${collectionPathLabel(
                  collectionState.collections,
                  selectedSkill.collectionId || "",
                )} / ${selectedSkill.name}`
              : undefined
          }
          selectedCollectionId={collectionState.selectedCollectionId}
          navigator={
            <ResourceCollectionNavigator
              canDragItem={() => canManageCollections}
              collections={collectionState.collections}
              draggedItem={collectionState.draggedItem}
              getItemId={(skill) => skill.skillId}
              itemLabel="skills"
              items={result?.items || []}
              preferenceKey="skills"
              workspaceId={actor.workspaceId}
              onCreate={
                canManageCollections
                  ? collectionState.createCollection
                  : undefined
              }
              onDelete={collectionState.removeCollection}
              onDragCollection={
                canManageCollections
                  ? (collection) =>
                      collectionState.setDraggedItem({
                        type: "collection",
                        id: collection.id,
                      })
                  : undefined
              }
              onDragEnd={() => collectionState.setDraggedItem(null)}
              onDragItem={(skill) =>
                collectionState.setDraggedItem({
                  type: "item",
                  id: skill.skillId,
                })
              }
              onDrop={(collectionId) =>
                collectionState.dropItem(collectionId, moveSkillToCollection)
              }
              onRename={(collection) =>
                collectionState.setCollectionDialog(collection)
              }
              onSelect={(collectionId) => {
                setSelectedSkill(null);
                collectionState.setSelectedCollectionId(collectionId);
              }}
              onSelectItem={(skill) => {
                setSearch("");
                setSelectedSkill(skill);
                collectionState.setSelectedCollectionId(
                  skill.collectionId || "",
                );
              }}
              renderItem={(skill) => (
                <>
                  <Package size={13} />
                  <span>{skill.name}</span>
                  <small>{skill.latestVersion}</small>
                </>
              )}
              selectedCollectionId={collectionState.selectedCollectionId}
              selectedItemId={selectedSkill?.skillId}
            />
          }
          toolbar={
            selectedSkill ? null : (
              <ResourceCollectionSearch
                loading={loading}
                onClearFilters={() => setSearch("")}
                onRefresh={loadSkills}
                onSearch={loadSkills}
                onSearchChange={setSearch}
                placeholder="Buscar skills"
                search={search}
              />
            )
          }
        >
          {selectedSkill ? (
            <SkillDetailsDialog
              currentWorkspaceId={actor.workspaceId}
              embedded
              onChanged={loadSkills}
              onClose={() => setSelectedSkill(null)}
              skill={selectedSkill}
              workspaces={actor.workspaces || []}
            />
          ) : (
            <>
              <BulkReplicationToolbar
                canReplicate={canReplicate}
                count={selectedSkills.length}
                onClear={() => setSelectedSkillIds([])}
                onReplicate={() => setBulkReplicationOpen(true)}
              />
              <SkillCards
                allItems={result?.items || []}
                canDrag={canManageCollections}
                collectionState={collectionState}
                items={items}
                loading={loading}
                onOpen={(skill) => {
                  setSelectedSkillIds([]);
                  setSelectedSkill(skill);
                  collectionState.setSelectedCollectionId(
                    skill.collectionId || "",
                  );
                }}
                onToggleSelection={toggleSkillSelection}
                selectedSkillIds={selectedSkillIds}
              />
            </>
          )}
        </ResourceCollectionsShell>
      ) : null}
      <SkillDialogs
        collectionState={collectionState}
        onPublished={loadSkills}
        publishing={publishing}
        setPublishing={setPublishing}
      />
      <ReplicationDialog
        currentWorkspaceId={actor.workspaceId}
        description={
          <p>
            A versão atual de cada skill selecionada e todos os seus arquivos
            serão publicados nos destinos. Versões já existentes não serão
            sobrescritas.
          </p>
        }
        eyebrow={`${selectedSkills.length} ${
          selectedSkills.length === 1
            ? "skill selecionada"
            : "skills selecionadas"
        }`}
        onClose={() => setBulkReplicationOpen(false)}
        onComplete={completeBulkReplication}
        onReplicate={(destinationWorkspaceIds) =>
          replicateItemsInBulk({
            destinationWorkspaceIds,
            getItemId: (skill) => skill.skillId,
            getItemLabel: (skill) => skill.name,
            items: selectedSkills,
            replicateItem: (skill, workspaceIds) =>
              replicateSkill(skill.skillId, skill.latestVersion, workspaceIds),
            workspaces: actor.workspaces || [],
          })
        }
        open={bulkReplicationOpen}
        resourceKey={`bulk-skills:${selectedSkills
          .map(({ skillId, latestVersion }) => `${skillId}@${latestVersion}`)
          .join("|")}`}
        retryFailed={false}
        title="Replicar skills"
        workspaces={actor.workspaces || []}
      />
    </section>
  );
}
