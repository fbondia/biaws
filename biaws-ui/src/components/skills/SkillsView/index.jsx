import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Package,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import "../../../styles/features/skills.css";

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
import {
  SkillCards,
  SkillDialogs,
  SkillError,
} from "./components/SkillPanels.jsx";

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
