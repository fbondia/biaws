import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Package,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchSkills, moveSkillToCollection } from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { useLoading } from "../../shared/LoadingProvider.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { PublishSkillDialog } from "./components/PublishSkillDialog.jsx";
import { SkillDetailsDialog } from "./components/SkillDetailsDialog.jsx";
import { formatDate } from "./utils.js";

export function SkillsView({ actor }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const { runWithLoading } = useLoading();
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
  const canManageCollections = hasPermission(actor, "skills.publish");

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
      {error ? (
        <div className="skillPageError">
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}
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
              embedded
              onChanged={loadSkills}
              onClose={() => setSelectedSkill(null)}
              skill={selectedSkill}
            />
          ) : (
            <div className="skillCards">
              {!loading && !(result?.items || []).length ? (
                <div className="skillsEmptyState">
                  <Package size={34} />
                  <strong>Nenhuma skill encontrada</strong>
                  <span>
                    Publique uma versão pela interface ou pelo Bondia Workspaces
                    CLI.
                  </span>
                </div>
              ) : null}
              {items.map((skill) => (
                <article
                  className="skillCard"
                  data-collection-browser-item-id={skill.skillId}
                  draggable={canManageCollections}
                  key={skill.skillId}
                  onDragEnd={() => collectionState.setDraggedItem(null)}
                  onDragStart={() =>
                    collectionState.setDraggedItem({
                      type: "item",
                      id: skill.skillId,
                    })
                  }
                >
                  <header>
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
                        skill.status === "published"
                          ? "skillStatus published"
                          : "skillStatus deprecated"
                      }
                    >
                      {skill.status === "published" ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <Archive size={13} />
                      )}
                      {skill.status}
                    </span>
                    <button
                      className="secondaryButton"
                      onClick={() => {
                        setSelectedSkill(skill);
                        collectionState.setSelectedCollectionId(
                          skill.collectionId || "",
                        );
                      }}
                      type="button"
                    >
                      Abrir
                    </button>
                  </footer>
                </article>
              ))}
              {!loading && (result?.items || []).length && !items.length ? (
                <div className="emptyState">Nenhuma skill nesta coleção.</div>
              ) : null}
            </div>
          )}
        </ResourceCollectionsShell>
      ) : null}
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
          onPublished={loadSkills}
        />
      ) : null}
    </section>
  );
}
