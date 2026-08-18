import {
  Boxes,
  ChevronRight,
  CloudCog,
  Folder,
  FolderOpen,
  Layers3,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchApplications,
  fetchComponents,
  fetchDeployments,
  fetchResourceCollections,
  fetchWorkspaces,
  updateDeployment,
} from "../../api.js";
import { hasPermission } from "../../permissions.js";
import "../../styles/features/catalog/index.css";
import "../../styles/features/monitoring-center.css";
import "../../styles/features/publications.css";
import { PUBLICATION_STATUSES } from "../catalog/CatalogEntityDialog/constants.js";
import {
  applicationsInCollection,
  collectionColumns,
  deploymentsForComponent,
} from "../monitoring/runtimes/model.js";

const EMPTY_PUBLICATION = {
  description: "",
  publishedAt: "",
  revision: "",
  status: "planned",
  version: "",
};

function formatDate(value) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function publicationHistory(deployment) {
  if (Array.isArray(deployment.publications)) return deployment.publications;
  if (
    !deployment.version &&
    !deployment.source?.revision &&
    !deployment.deployedAt
  ) {
    return [];
  }
  return [
    {
      id: `legacy-${deployment.id || "publication"}`,
      version: deployment.version || "Versão não informada",
      revision: deployment.source?.revision || "",
      repositoryId: deployment.source?.repositoryId || null,
      status: "deployed",
      publishedAt:
        deployment.deployedAt || deployment.updatedAt || deployment.createdAt,
      description: "",
    },
  ];
}

function NavigationColumn({
  empty,
  icon: Icon,
  items,
  onSelect,
  selectedId,
  title,
}) {
  return (
    <section className="monitoringNavigatorColumn">
      <header>
        <span>{title}</span>
        <small>{items.length}</small>
      </header>
      <div className="monitoringNavigatorItems">
        {!items.length ? (
          <div className="monitoringNavigatorEmpty">{empty}</div>
        ) : (
          items.map((item) => (
            <button
              aria-current={selectedId === item.id ? "true" : undefined}
              className={
                selectedId === item.id
                  ? "monitoringNavigatorItem selected"
                  : "monitoringNavigatorItem"
              }
              key={item.id}
              onClick={() => onSelect(item)}
              type="button"
            >
              <Icon size={16} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.environment || item.key}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function CollectionNavigation({ collections, onSelect, selectedId, showRoot }) {
  return collectionColumns(collections, selectedId).map((column, index) => (
    <section
      className="monitoringNavigatorColumn monitoringCollectionColumn"
      key={`${column.parentId || "root"}-${index}`}
    >
      <header>
        <span>{index ? "Subcoleções" : "Coleções"}</span>
        <small>{column.items.length}</small>
      </header>
      <div className="monitoringNavigatorItems">
        {index === 0 && showRoot ? (
          <button
            aria-current={!selectedId ? "true" : undefined}
            className={
              !selectedId
                ? "monitoringNavigatorItem selected"
                : "monitoringNavigatorItem"
            }
            onClick={() => onSelect("")}
            type="button"
          >
            <Folder size={16} />
            <span>
              <strong>Sem coleção</strong>
              <small>Raiz do catálogo</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ) : null}
        {column.items.map((collection) => (
          <button
            aria-current={
              column.selectedId === collection.id ? "true" : undefined
            }
            className={
              column.selectedId === collection.id
                ? "monitoringNavigatorItem selected"
                : "monitoringNavigatorItem"
            }
            key={collection.id}
            onClick={() => onSelect(collection.id)}
            type="button"
          >
            {column.selectedId === collection.id ? (
              <FolderOpen size={16} />
            ) : (
              <Folder size={16} />
            )}
            <span>
              <strong>{collection.name}</strong>
              <small>Coleção</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
    </section>
  ));
}

function PublicationPanel({ actor, deployment, onSaved }) {
  const [draft, setDraft] = useState(EMPTY_PUBLICATION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canUpdate = hasPermission(actor, "deployments.update");
  const publicationItems = publicationHistory(deployment);
  const publications = [...publicationItems].reverse();

  useEffect(() => {
    setDraft(EMPTY_PUBLICATION);
    setError("");
  }, [deployment.id]);

  async function addPublication(event) {
    event.preventDefault();
    if (!draft.version.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateDeployment(deployment.id, {
        publications: [
          ...publicationItems,
          {
            ...draft,
            publishedAt: draft.publishedAt
              ? new Date(draft.publishedAt).toISOString()
              : undefined,
          },
        ],
      });
      onSaved(result.deployment);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="publicationWorkspace">
      <header className="publicationWorkspaceHeader">
        <div>
          <span>{deployment.environment || "Ambiente não informado"}</span>
          <h2>{deployment.name}</h2>
          <p>
            {deployment.version
              ? `Versão implantada: ${deployment.version}`
              : "Nenhuma versão implantada."}
          </p>
        </div>
        <span className={`publicationDeploymentStatus ${deployment.status}`}>
          {deployment.status}
        </span>
      </header>
      <div className="publicationWorkspaceGrid">
        <section className="publicationHistory">
          <header>
            <div>
              <span>Histórico</span>
              <h3>Versões publicadas</h3>
            </div>
            <small>{publications.length}</small>
          </header>
          {!publications.length ? (
            <div className="monitoringCenterEmpty compact">
              <Send size={24} />
              <strong>Nenhuma publicação registrada</strong>
              <span>Registre a primeira versão ao lado.</span>
            </div>
          ) : (
            <ol>
              {publications.map((publication) => (
                <li key={publication.id}>
                  <div>
                    <strong>{publication.version}</strong>
                    <span
                      className={`publicationStatus ${publication.status || "deployed"}`}
                    >
                      {publication.status || "deployed"}
                    </span>
                  </div>
                  <small>
                    {formatDate(publication.publishedAt)}
                    {publication.revision ? ` · ${publication.revision}` : ""}
                  </small>
                  {publication.description ? (
                    <p>{publication.description}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
        <form className="publicationComposer" onSubmit={addPublication}>
          <header>
            <span>Nova publicação</span>
            <h3>Registrar no deployment</h3>
          </header>
          {!canUpdate ? (
            <p className="publicationReadOnly">
              Você tem acesso de leitura às publicações.
            </p>
          ) : null}
          {error ? (
            <div className="errorBox" role="alert">
              {error}
            </div>
          ) : null}
          <label className="field">
            <span>Versão</span>
            <input
              disabled={!canUpdate || saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  version: event.target.value,
                }))
              }
              required
              value={draft.version}
            />
          </label>
          <label className="field">
            <span>Revisão</span>
            <input
              disabled={!canUpdate || saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  revision: event.target.value,
                }))
              }
              value={draft.revision}
            />
          </label>
          <label className="field">
            <span>Publicado em</span>
            <input
              disabled={!canUpdate || saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  publishedAt: event.target.value,
                }))
              }
              type="datetime-local"
              value={draft.publishedAt}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              disabled={!canUpdate || saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              value={draft.status}
            >
              {PUBLICATION_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Descrição</span>
            <textarea
              disabled={!canUpdate || saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={4}
              value={draft.description}
            />
          </label>
          <button
            className="primaryButton"
            disabled={!canUpdate || saving || !draft.version.trim()}
            type="submit"
          >
            <Plus size={16} />
            {saving ? "Registrando…" : "Registrar publicação"}
          </button>
        </form>
      </div>
    </section>
  );
}

export function PublicationsView({ actor }) {
  const [workspace, setWorkspace] = useState(null);
  const [collections, setCollections] = useState([]);
  const [applications, setApplications] = useState([]);
  const [deploymentsByApplication, setDeploymentsByApplication] = useState(
    new Map(),
  );
  const [components, setComponents] = useState([]);
  const [collectionId, setCollectionId] = useState("");
  const [application, setApplication] = useState(null);
  const [component, setComponent] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const applicationsWithDeployments = useMemo(
    () =>
      applications.filter(
        ({ id }) => (deploymentsByApplication.get(id) || []).length,
      ),
    [applications, deploymentsByApplication],
  );
  const visibleApplications = useMemo(
    () => applicationsInCollection(applicationsWithDeployments, collectionId),
    [applicationsWithDeployments, collectionId],
  );
  const visibleComponents = useMemo(
    () =>
      components.filter(({ id }) =>
        (deploymentsByApplication.get(application?.id) || []).some(
          (item) => item.componentId === id,
        ),
      ),
    [application?.id, components, deploymentsByApplication],
  );
  const visibleDeployments = useMemo(
    () =>
      deploymentsForComponent(
        deploymentsByApplication.get(application?.id) || [],
        component?.id,
      ),
    [application?.id, component?.id, deploymentsByApplication],
  );
  const visibleCollectionIds = useMemo(() => {
    const byId = new Map(collections.map((item) => [item.id, item]));
    const ids = new Set();
    applicationsWithDeployments.forEach((item) => {
      let id = item.collectionId || "";
      while (id && !ids.has(id)) {
        ids.add(id);
        id = byId.get(id)?.parentId || "";
      }
    });
    return ids;
  }, [applicationsWithDeployments, collections]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const workspacePayload = await fetchWorkspaces();
      const current = (workspacePayload.items || []).find(
        ({ id }) => id === actor.workspaceId,
      );
      if (!current) throw new Error("Workspace atual não encontrado.");
      const [collectionPayload, applicationPayload] = await Promise.all([
        fetchResourceCollections("applications"),
        fetchApplications(current.id, { limit: 100 }),
      ]);
      const nextApplications = applicationPayload.items || [];
      const deploymentEntries = await Promise.all(
        nextApplications.map(async (item) => [
          item.id,
          (await fetchDeployments(item.id, { limit: 100 })).items || [],
        ]),
      );
      setWorkspace(current);
      setCollections(collectionPayload.items || []);
      setApplications(nextApplications);
      setDeploymentsByApplication(new Map(deploymentEntries));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [actor.workspaceId]);
  async function selectApplication(next) {
    setApplication(next);
    setComponent(null);
    setDeployment(null);
    setLoading(true);
    setError("");
    try {
      const payload = await fetchComponents(next.id, { limit: 100 });
      setComponents(payload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }
  function selectCollection(next) {
    setCollectionId(next);
    setApplication(null);
    setComponent(null);
    setDeployment(null);
    setComponents([]);
  }
  function saveDeployment(next) {
    setDeploymentsByApplication((current) => {
      const result = new Map(current);
      result.set(
        application.id,
        (result.get(application.id) || []).map((item) =>
          item.id === next.id ? next : item,
        ),
      );
      return result;
    });
    setDeployment(next);
  }
  return (
    <section className="monitoringCenterPage publicationsPage">
      <header className="monitoringCenterHero">
        <div>
          <span>{workspace?.name || "Ambiente"}</span>
          <h1>Publicações</h1>
          <p>
            Navegue pelas aplicações com deployment e registre versões
            diretamente no contexto de cada ambiente.
          </p>
        </div>
        <button
          aria-label="Atualizar publicações"
          className="iconButton"
          disabled={loading}
          onClick={load}
          type="button"
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      <div className="monitoringNavigator" aria-busy={loading}>
        <CollectionNavigation
          collections={collections.filter(({ id }) =>
            visibleCollectionIds.has(id),
          )}
          onSelect={selectCollection}
          selectedId={collectionId}
          showRoot={
            applicationsInCollection(applicationsWithDeployments, "").length > 0
          }
        />
        <NavigationColumn
          empty="Nenhuma aplicação com deployment nesta coleção."
          icon={Layers3}
          items={visibleApplications}
          onSelect={selectApplication}
          selectedId={application?.id}
          title="Aplicação"
        />
        {application ? (
          <NavigationColumn
            empty="Nenhum componente com deployment."
            icon={Boxes}
            items={visibleComponents}
            onSelect={(next) => {
              setComponent(next);
              setDeployment(null);
            }}
            selectedId={component?.id}
            title="Componente"
          />
        ) : null}
        {component ? (
          <NavigationColumn
            empty="Nenhum deployment."
            icon={CloudCog}
            items={visibleDeployments}
            onSelect={setDeployment}
            selectedId={deployment?.id}
            title="Deployment"
          />
        ) : null}
      </div>
      {loading ? (
        <div className="monitoringCenterLoading" role="status">
          Carregando contexto…
        </div>
      ) : null}
      {deployment ? (
        <PublicationPanel
          actor={actor}
          deployment={deployment}
          key={deployment.id}
          onSaved={saveDeployment}
        />
      ) : (
        <div className="monitoringCenterEmpty">
          <Send size={30} />
          <strong>Selecione um deployment</strong>
          <span>
            As versões, datas e status das publicações serão exibidos nesta
            área.
          </span>
        </div>
      )}
    </section>
  );
}
