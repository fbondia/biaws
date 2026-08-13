import { AlertTriangle, Archive, CheckCircle2, Package } from "lucide-react";
import { IllustratedEmptyState } from "../../../shared/IllustratedEmptyState.jsx";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
} from "../../../shared/ResourceCollections/index.jsx";
import { PublishSkillDialog } from "./PublishSkillDialog.jsx";
import { formatDate } from "../utils.js";

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
          <EntityIdentifier
            label="Identificador da skill"
            value={skill.skillId}
          />
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

export function SkillCards({
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

export function SkillDialogs({
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

export function SkillError({ error }) {
  if (!error) return null;
  return (
    <div className="skillPageError">
      <AlertTriangle size={17} />
      {error}
    </div>
  );
}
