import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Server,
  Trash2,
  X,
} from "lucide-react";

import { hasPermission } from "../../../../permissions.js";
import { AuditHistory } from "../../../shared/AuditHistory.jsx";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
} from "../../../shared/ResourceCollections/index.jsx";
import { CatalogEntityDialog } from "../../CatalogEntityDialog/index.jsx";

export function ServerList({
  canDrag,
  collectionState,
  loading,
  onOpen,
  servers,
}) {
  return (
    <div className="catalogCollectionItems">
      {servers.map((server) => (
        <button
          className="catalogCollectionItem"
          draggable={canDrag}
          key={server.id}
          onClick={() => onOpen(server)}
          onDragEnd={() => collectionState.setDraggedItem(null)}
          onDragStart={() =>
            collectionState.setDraggedItem({ type: "item", id: server.id })
          }
          type="button"
        >
          <span className="catalogCollectionItemIcon">
            <Server size={18} />
          </span>
          <span>
            <strong>{server.name}</strong>
            <small>{server.hostname || server.key}</small>
          </span>
          <span className={`catalogStatus catalogStatus-${server.status}`}>
            {server.status}
          </span>
        </button>
      ))}
      {!servers.length && !loading ? (
        <div className="emptyState compactEmpty">
          Nenhum servidor encontrado.
        </div>
      ) : null}
    </div>
  );
}

export function ServerDialogs({
  collectionState,
  dialog,
  onPersist,
  setDialog,
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
          resourceLabel="servidores"
        />
      ) : null}
      {dialog ? (
        <CatalogEntityDialog
          entity={dialog.id ? dialog : null}
          kind="server"
          onClose={() => setDialog(null)}
          onSave={onPersist}
        />
      ) : null}
    </>
  );
}

export function ServerHeader({ actor, onCreate, workspace }) {
  return (
    <header className="catalogHero">
      <div>
        <span>{workspace?.name || "Workspace padrão"}</span>
        <h2>Servidores</h2>
        <p>Ativos do workspace e suas referências operacionais.</p>
      </div>
      {hasPermission(actor, "servers.create") && workspace ? (
        <button className="primaryButton" onClick={onCreate} type="button">
          <Plus size={16} /> Novo servidor
        </button>
      ) : null}
    </header>
  );
}

export function ServerContent(props) {
  if (!props.selected) {
    return (
      <div className="catalogContent">
        <div className="catalogWelcome">
          <Server size={36} />
          <h3>Selecione um servidor</h3>
          <p>Consulte inventário e aplicações associadas.</p>
        </div>
      </div>
    );
  }
  return <ServerDetails {...props} />;
}

function ServerDetails({
  activeTab,
  actor,
  onArchive,
  onBack,
  onDelete,
  onEdit,
  onRestore,
  onSelectTab,
  serverApplications,
  selected,
}) {
  const tabs = [
    ["overview", "Visão geral"],
    ...(hasPermission(actor, "applications.read") &&
    hasPermission(actor, "components.read") &&
    hasPermission(actor, "runtimes.read") &&
    hasPermission(actor, "deployments.read")
      ? [["applications", "Aplicações"]]
      : []),
    ["history", "Histórico"],
  ];
  return (
    <div className="catalogCollectionPanel catalogContent">
      <header className="catalogDetailHeader">
        <div>
          <EntityIdentifier
            label="Identificador do servidor"
            value={selected.key}
            variant="eyebrow"
          />
          <h2>{selected.name}</h2>
          <p>{selected.description || selected.purpose || "Sem descrição."}</p>
        </div>
        <div className="catalogHeaderActions">
          {hasPermission(actor, "servers.update") ? (
            <button
              className="secondaryButton"
              onClick={() => onEdit(selected)}
              type="button"
            >
              <Pencil size={16} /> Editar
            </button>
          ) : null}
          {hasPermission(actor, "servers.archive") &&
          selected.status !== "archived" ? (
            <button className="dangerButton" onClick={onArchive} type="button">
              <Archive size={16} /> Arquivar
            </button>
          ) : null}
          {hasPermission(actor, "servers.archive") &&
          selected.status === "archived" ? (
            <>
              <button
                className="secondaryButton"
                onClick={onRestore}
                type="button"
              >
                <ArchiveRestore size={16} /> Desarquivar
              </button>
              <button className="dangerButton" onClick={onDelete} type="button">
                <Trash2 size={16} /> Excluir definitivamente
              </button>
            </>
          ) : null}
          <button
            aria-label="Fechar detalhes do servidor"
            className="secondaryButton catalogBackButton"
            onClick={onBack}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </header>
      <div className="detailTabs catalogTabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            aria-selected={activeTab === key}
            className={
              activeTab === key ? "detailTab activeDetailTab" : "detailTab"
            }
            key={key}
            onClick={() => onSelectTab(key)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <ServerTabPanel
        activeTab={activeTab}
        selected={selected}
        serverApplications={serverApplications}
      />
    </div>
  );
}

function ServerTabPanel({ activeTab, selected, serverApplications }) {
  if (activeTab === "overview") {
    return (
      <div className="catalogTabPanel">
        <div className="catalogOverviewCard">
          <h3>Inventário</h3>
          <dl>
            <div>
              <dt>Hostname</dt>
              <dd>{selected.hostname || "-"}</dd>
            </div>
            <div>
              <dt>Endereços</dt>
              <dd>
                {selected.addresses?.length ? (
                  <ul className="catalogAddressList">
                    {selected.addresses.map((address, index) => (
                      <li key={`${address}-${index}`}>{address}</li>
                    ))}
                  </ul>
                ) : (
                  "-"
                )}
              </dd>
            </div>
            <div>
              <dt>Provedor</dt>
              <dd>{selected.provider || "-"}</dd>
            </div>
            <div>
              <dt>Localização</dt>
              <dd>{selected.location || "-"}</dd>
            </div>
            <div>
              <dt>Sistema operacional</dt>
              <dd>{selected.operatingSystem || "-"}</dd>
            </div>
            <div>
              <dt>Finalidade</dt>
              <dd>{selected.purpose || "-"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }
  if (activeTab === "applications") {
    return (
      <div className="catalogTabPanel">
        <ServerApplications groups={serverApplications} />
      </div>
    );
  }
  return (
    <div className="catalogTabPanel">
      <AuditHistory
        entityId={selected.id}
        entityType="server"
        refreshKey={selected.updatedAt}
      />
    </div>
  );
}

function ServerApplications({ groups }) {
  return (
    <div className="serverApplicationList">
      {groups.map((application) => (
        <article className="serverApplicationCard" key={application.id}>
          <header>
            <span>Aplicação</span>
            <h3>{application.name}</h3>
          </header>
          <div>
            {application.components.map((component) => (
              <div className="serverApplicationComponent" key={component.id}>
                <strong>{component.name}</strong>
                <small>
                  {component.environments.join(", ") ||
                    "Ambiente não informado"}{" "}
                  · {component.deploymentCount} deployment(s) ·{" "}
                  {component.runtimeCount} runtime(s)
                </small>
              </div>
            ))}
          </div>
        </article>
      ))}
      {!groups.length ? (
        <div className="emptyState catalogEmptyState">
          Nenhuma aplicação utiliza este servidor.
        </div>
      ) : null}
    </div>
  );
}
