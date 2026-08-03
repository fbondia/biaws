import { Layers3, Plus, RefreshCw, Search } from "lucide-react";

import { hasPermission } from "../../../permissions.js";
import { CatalogEntityDialog } from "../CatalogEntityDialog.jsx";
import { HeaderActions } from "./components/CatalogComponents.jsx";
import { useCatalogView } from "./hooks/useCatalogView.jsx";
import { CatalogTabContent } from "./tabs/CatalogTabContent.jsx";

export function CatalogView({ actor }) {
  const {
    workspace,
    applications,
    selectedId,
    setSelectedId,
    context,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    includeArchived,
    setIncludeArchived,
    loading,
    error,
    dialog,
    setDialog,
    visibleTabs,
    applySearch,
    persistApplication,
    persistEntity,
    archiveSelectedApplication,
    editEntity,
    entityActions,
    runtimeByDeployment,
    runtimeLoadingByDeployment,
    runtimeErrorByDeployment,
    loadRuntimes,
    loadContext,
    loadWorkspaceAndApplications,
  } = useCatalogView(actor);
  return (
    <section className="catalogPage">
      <header className="catalogHero">
        <div>
          <span>{workspace?.name || "Workspace padrão"}</span>
          <h2>Catálogo de aplicações</h2>
          <p>
            Produtos, componentes, código e topologia operacional em um único
            contexto.
          </p>
        </div>
        {hasPermission(actor, "applications.create") && workspace ? (
          <button
            className="primaryButton"
            onClick={() => setDialog({ kind: "application", entity: null })}
            type="button"
          >
            <Plus size={16} /> Nova aplicação
          </button>
        ) : null}
      </header>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="catalogLayout">
        <aside className="catalogSidebar">
          <form className="catalogSearch" onSubmit={applySearch}>
            <label className="field">
              <span>Buscar aplicações</span>
              <div>
                <Search size={15} />
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, identificador ou descrição"
                  value={search}
                />
              </div>
            </label>
            <label className="checkItem compactCheckItem">
              <input
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                type="checkbox"
              />
              <span>Incluir arquivadas</span>
            </label>
            <button className="secondaryButton" type="submit">
              Aplicar
            </button>
          </form>
          <div className="catalogApplicationList">
            {applications.map((application) => (
              <button
                className={
                  selectedId === application.id
                    ? "catalogApplicationItem activeCatalogApplication"
                    : "catalogApplicationItem"
                }
                key={application.id}
                onClick={() => {
                  setSelectedId(application.id);
                  setActiveTab("overview");
                }}
                type="button"
              >
                <span>
                  <Layers3 size={16} />
                  {application.name}
                </span>
                <small>{application.key}</small>
              </button>
            ))}
            {!applications.length && !loading ? (
              <div className="emptyState compactEmpty">
                Nenhuma aplicação encontrada.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="catalogContent">
          {loading && !context ? (
            <div className="emptyState">Carregando catálogo…</div>
          ) : null}
          {!loading && !context ? (
            <div className="catalogWelcome">
              <Layers3 size={36} />
              <h3>Selecione uma aplicação</h3>
              <p>
                Consulte sua topologia, conhecimento relacionado e histórico.
              </p>
            </div>
          ) : null}
          {context ? (
            <>
              <header className="catalogDetailHeader">
                <div>
                  <span>{context.application.key}</span>
                  <h2>{context.application.name}</h2>
                  <p>{context.application.description || "Sem descrição."}</p>
                </div>
                <HeaderActions
                  actor={actor}
                  application={context.application}
                  onArchive={() => void archiveSelectedApplication()}
                  onEdit={() =>
                    setDialog({
                      kind: "application",
                      entity: context.application,
                    })
                  }
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
                      activeTab === tab.key
                        ? "detailTab activeDetailTab"
                        : "detailTab"
                    }
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
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
                editEntity={editEntity}
                entityActions={entityActions}
                runtimeByDeployment={runtimeByDeployment}
                runtimeErrorByDeployment={runtimeErrorByDeployment}
                runtimeLoadingByDeployment={runtimeLoadingByDeployment}
                loadRuntimes={loadRuntimes}
                setDialog={setDialog}
              />
            </>
          ) : null}
        </div>
      </div>

      {dialog ? (
        <CatalogEntityDialog
          entity={dialog.entity}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={
            dialog.kind === "application" ? persistApplication : persistEntity
          }
          options={{
            application: context?.application,
            applications: context?.availableApplications || [],
            canReadProcedures: hasPermission(actor, "procedures.read"),
            components: context?.components || [],
            deployments: context?.deployments || [],
            repositories: context?.repositories || [],
            servers: context?.servers || [],
            workspace,
          }}
        />
      ) : null}

      <button
        className="catalogFloatingRefresh iconButton"
        disabled={loading}
        onClick={() =>
          selectedId ? void loadContext() : void loadWorkspaceAndApplications()
        }
        title="Atualizar catálogo"
        type="button"
      >
        <RefreshCw className={loading ? "spinIcon" : undefined} size={18} />
      </button>
    </section>
  );
}
