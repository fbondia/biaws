import { Layers3 } from "lucide-react";

import { hasPermission } from "../../../../permissions.js";
import { IllustratedEmptyState } from "../../../shared/IllustratedEmptyState.jsx";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
} from "../../../shared/ResourceCollections/index.jsx";
import { CatalogEntityDialog } from "../../CatalogEntityDialog/index.jsx";
import { CatalogTabContent } from "../tabs/CatalogTabContent.jsx";
import { HeaderActions } from "./CatalogComponents.jsx";

export function CatalogSelectedDetail({
  activeTab,
  actor,
  context,
  loading,
  onArchive,
  onBack,
  onDelete,
  onEdit,
  onRestore,
  onSelectTab,
  tabProps,
  visibleTabs,
}) {
  if (loading && !context) {
    return (
      <div className="catalogCollectionPanel catalogContent">
        <div className="emptyState">Carregando catálogo…</div>
      </div>
    );
  }
  if (!context) {
    return (
      <div className="catalogCollectionPanel catalogContent">
        <div className="catalogWelcome">
          <Layers3 size={36} />
          <h3>Selecione uma aplicação</h3>
          <p>Consulte sua topologia, conhecimento relacionado e histórico.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="catalogCollectionPanel catalogContent">
      <header className="catalogDetailHeader">
        <div>
          <EntityIdentifier
            label="Identificador da aplicação"
            value={context.application.key}
            variant="eyebrow"
          />
          <h2>{context.application.name}</h2>
          <p>{context.application.description || "Sem descrição."}</p>
        </div>
        <HeaderActions
          actor={actor}
          application={context.application}
          onArchive={onArchive}
          onBack={onBack}
          onDelete={onDelete}
          onEdit={onEdit}
          onRestore={onRestore}
        />
      </header>
      <div
        className="detailTabs catalogTabs"
        role="tablist"
        aria-label="Detalhes da aplicação"
      >
        {visibleTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={
              activeTab === tab.key ? "detailTab activeDetailTab" : "detailTab"
            }
            key={tab.key}
            onClick={() => onSelectTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <CatalogTabContent
        activeTab={activeTab}
        actor={actor}
        context={context}
        {...tabProps}
      />
    </div>
  );
}

export function CatalogApplicationItems({
  allApplications,
  applications,
  canMove,
  collectionState,
  loading,
  onSelect,
}) {
  return (
    <div className="catalogCollectionItems">
      {applications.map((application) => (
        <button
          className="catalogCollectionItem"
          key={application.id}
          draggable={canMove(application)}
          onDragEnd={() => collectionState.setDraggedItem(null)}
          onDragStart={() =>
            collectionState.setDraggedItem({ type: "item", id: application.id })
          }
          onClick={() => onSelect(application.id)}
          type="button"
        >
          <span className="catalogCollectionItemIcon">
            <Layers3 size={18} />
          </span>
          <span>
            <strong>{application.name}</strong>
            <small>{application.key}</small>
          </span>
        </button>
      ))}
      {!applications.length && !loading ? (
        <IllustratedEmptyState
          description={
            allApplications.length
              ? "Escolha outra coleção ou ajuste os critérios da busca."
              : "Cadastre a primeira aplicação para começar a organizar o catálogo."
          }
          icon={Layers3}
          title="Nenhuma aplicação encontrada"
        />
      ) : null}
    </div>
  );
}

export function CatalogDialogs({
  actor,
  collectionState,
  context,
  dialog,
  onPersistApplication,
  onPersistEntity,
  setDialog,
  workspace,
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
          resourceLabel="aplicações"
        />
      ) : null}
      {dialog ? (
        <CatalogEntityDialog
          entity={dialog.entity}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={
            dialog.kind === "application"
              ? onPersistApplication
              : onPersistEntity
          }
          options={{
            application: context?.application,
            applications: context?.availableApplications || [],
            canReadDocuments: hasPermission(actor, "documents.read"),
            components: context?.components || [],
            deployments: context?.deployments || [],
            repositories: context?.repositories || [],
            servers: context?.servers || [],
            workspace,
          }}
        />
      ) : null}
    </>
  );
}
