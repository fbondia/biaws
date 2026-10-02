// Local visual fixture: real components, synthetic data, no API writes.
import { AlertCircle, FileText, Menu, X } from "lucide-react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import "@xyflow/react/dist/style.css";
import { MessagesProvider } from "../../src/infrastructure/messages/MessagesProvider.jsx";
import { IssueList } from "../../src/components/issues/IssueList/index.jsx";
import { CreateIssueDialog } from "../../src/components/issues/CreateIssueDialog.jsx";
import { IssueCommentDialog } from "../../src/components/issues/IssueCommentDialog.jsx";
import { IssueDetailsLayout } from "../../src/components/issues/IssueDetailsDialog/components/IssueDetailsLayout.jsx";
import { RequestList } from "../../src/components/requests/RequestList.jsx";
import { RequestDetails } from "../../src/components/requests/RequestDetails.jsx";
import { normalizeRequest } from "../../src/components/requests/requestUtils.js";
import {
  KnowledgeDocumentReading,
  KnowledgeRecordHeader,
  KnowledgeRecordTabs,
} from "../../src/components/knowledge/KnowledgeRecordsView/components/DocumentDetail/DocumentChrome.jsx";
import { TopologyDiagramToolbar } from "../../src/components/catalog/CatalogView/components/TopologyDiagramDialog/components/TopologyDiagramToolbar.jsx";
import { TopologyDialogHeader } from "../../src/components/catalog/CatalogView/components/TopologyDiagramDialog/components/TopologyDialogHeader.jsx";
import { TopologyDiagramCanvas } from "../../src/components/catalog/CatalogView/components/TopologyDiagramDialog/components/TopologyDiagramCanvas.jsx";
import { FilesPanel } from "../../src/components/shared/FilesPanel/index.jsx";
import { FilePreview } from "../../src/components/shared/FilePreview.jsx";
import { MarkdownEditor, MarkdownPreview } from "../../src/components/shared/MarkdownEditor/index.jsx";

const noop = () => {};
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (url, options = {}) => {
  if (!new URL(String(url), location.href).pathname.startsWith("/api/")) return nativeFetch(url, options);
  if (options.method && options.method !== "GET") throw new Error("Gravações da API desativadas neste cenário.");
  return Response.json({ events: [], taxonomy: { taxonomy: [], tagGroups: [] } });
};
const scene = new URLSearchParams(location.search).get("scene") || "issues";
const domain = { issues: "issues", requests: "requests", knowledge: "knowledge", topology: "catalog", files: "issues" }[
  scene
];
await import(`../../src/styles/features/${domain}/index.css`);
const longText = "identificador_muito_longo_sem_espacos_".repeat(5);
const markdown = `# Documentação de uso\n\nTexto com [endereço extenso](https://example.test/${longText}) e o identificador ${longText}.\n\n| Campo | Descrição |\n| --- | --- |\n| Identificador | ${longText} |\n\n\`\`\`js\nconst example = "${longText}";\n\`\`\`\n\n`;
const files = [
  { id: "file-1", filename: `${longText}.md`, contentType: "text/markdown", size: 2048, tags: [longText] },
];
const issues = [
  {
    id: "ISSUE-001",
    title: "Falha no processamento de solicitações em dispositivos móveis",
    type: "incident",
    status: "open",
    applicationId: "app-1",
    dates: { receivedEmailAt: "2026-10-02T12:00:00Z" },
    text: markdown,
    classification: { primaryTaxonomyId: "support", tags: { priority: ["alta", longText] } },
  },
];
const request = normalizeRequest({
  id: "request-1",
  clientCode: "MELHORIA-001",
  title: longText,
  status: "Desenvolvimento",
  description: longText,
  applicationId: "app-1",
  checklist: [{ id: "check-1", label: "Validar em celulares", checked: false }],
  notes: [],
  tasks: [
    {
      id: "task-1",
      code: "TAREFA-001",
      title: "Adaptar layouts para dispositivos móveis",
      description: markdown,
      specification: markdown,
      status: "Pendente",
    },
  ],
});
const applications = [{ id: "app-1", name: "Aplicação de atendimento e serviços" }];
const document = {
  id: "document-1",
  identifier: longText,
  title: "Documentação do processamento e das integrações em dispositivos móveis",
  markdown,
};
const config = { label: "Documentação", icon: FileText };
const topologyController = {
  actions: new Proxy({}, { get: () => noop }),
  canEdit: true,
  dirty: true,
  diagram: { id: "diagram-1", name: "Topologia principal", comments: "" },
  diagrams: [{ id: "diagram-1", name: "Topologia principal" }],
  selectedId: "diagram-1",
  environment: "production",
  hiddenIntegrationIds: [],
  hiddenServerIds: [],
  integrationOptions: [{ id: "app-1", label: "Integração principal" }],
  serverOptions: [{ id: "server-1", label: "Servidor de aplicação" }],
  nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: { label: "Aplicação" } }],
  visibleGraph: { nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: { label: "Aplicação" } }], edges: [] },
};

function Harness() {
  const [selectedIssue, setSelectedIssue] = useState(false);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState({ date: "", text: markdown });
  const [selectedRequest, setSelectedRequest] = useState(false);
  const [requestTab, setRequestTab] = useState("main");
  const [issueTab, setIssueTab] = useState("description");
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const [sort, setSort] = useState("-date");
  const [preview, setPreview] = useState(false);
  const [html, setHtml] = useState(false);
  const [value, setValue] = useState(markdown);
  function sortIssues(field) {
    setSort((current) => (current === field ? `-${field}` : field));
  }
  return (
    <div className="appShell">
      <header className="topBar">
        <div className="topBarHeading">
          <div className="productBrand">
            <strong>BIAWS · Validação</strong>
          </div>
          <button className="iconButton mobileMenuButton" aria-label="Menu">
            <Menu size={18} />
          </button>
        </div>
      </header>
      <nav
        className="contentBand"
        aria-label="Cenários de validação"
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        {["issues", "requests", "knowledge", "files", "topology"].map((item) => (
          <a key={item} href={`?scene=${item}`}>
            {item}
          </a>
        ))}
        <button className="secondaryButton" onClick={() => import("../../src/styles/features/requests/index.css")}>
          Carregar CSS de melhorias
        </button>
      </nav>
      {scene === "issues" && (
        <>
          <div className="contentBand issueViewControls">
            <div className="issueViewNavigation">
              <div className="issueSectionTabs">
                <button className="issueSectionTab">Resultados</button>
                <button className="issueSectionTab">Sumário</button>
              </div>
              <button className="iconButton">↻</button>
            </div>
            <button className="secondaryButton">Mostrar filtros</button>
          </div>
          <IssueList
            applications={applications}
            dateField="receivedEmailAt"
            items={issues}
            meta={{ page: 1 }}
            page={1}
            totalPages={31}
            onOpenIssue={() => setSelectedIssue(true)}
            onOpenCreate={() => setCreatingIssue(true)}
            onOpenImport={noop}
            onNextPage={noop}
            onPreviousPage={noop}
            onSort={sortIssues}
            onUpdateIssueField={noop}
            sort={sort}
            taxonomyPackage={{
              taxonomy: [{ id: "support", label: "Suporte e atendimento" }],
              tagGroups: [{ id: "priority", label: "Prioridade", tags: ["alta", longText] }],
            }}
          />
          {creatingIssue && (
            <CreateIssueDialog applications={applications} onClose={() => setCreatingIssue(false)} onCreated={noop} />
          )}
          {commentOpen && (
            <IssueCommentDialog
              draft={comment}
              mode="create"
              onChange={setComment}
              onClose={() => setCommentOpen(false)}
              onSave={noop}
            />
          )}
          {selectedIssue && (
            <IssueDetailsLayout
              issue={issues[0]}
              activeTab={issueTab}
              setActiveTab={setIssueTab}
              onClose={() => setSelectedIssue(false)}
              editableStatusOptions={[{ value: "open", label: "Aberto" }]}
              TypeIcon={AlertCircle}
              typeLabel="Incidente"
              persistedClassification={{ primaryTaxonomyId: "", secondaryTaxonomyIds: [] }}
              selectedTagEntries={[]}
              taxonomyById={{}}
            >
              {issueTab === "comments" ? (
                <button className="primaryButton" onClick={() => setCommentOpen(true)}>
                  Incluir comentário
                </button>
              ) : issueTab === "files" ? (
                <FilesPanel
                  files={files}
                  onPreview={async () => new Blob([markdown], { type: "text/markdown" })}
                  onDownload={noop}
                  onDelete={noop}
                  onUpdateTags={noop}
                  onUpload={noop}
                />
              ) : (
                <section className="detailSection">
                  <h3>Descrição completa</h3>
                  <MarkdownEditor ariaLabel="Descrição" value={value} onChange={setValue} />
                </section>
              )}
            </IssueDetailsLayout>
          )}
        </>
      )}
      {scene === "requests" && (
        <main className="requestsPage">
          <div className={`requestsLayout mobileRequestsList${selectedRequest ? " requestDetailSelected" : ""}`}>
            <RequestList
              filteredRequests={[request]}
              requestMeta={{ page: 1, total: 1, totalPages: 1 }}
              onSelectRequest={() => setSelectedRequest(true)}
              onNextPage={noop}
              onPreviousPage={noop}
              onRefresh={noop}
            />
            <div className="requestListResizer" />
            {selectedRequest && (
              <RequestDetails
                request={request}
                activeTab={requestTab}
                onTabChange={setRequestTab}
                isEditing={editing}
                onToggleEditMode={() => setEditing((current) => !current)}
                onClose={() => setSelectedRequest(false)}
                applications={applications}
                onFieldChange={noop}
                onReadDraftedNumber={(_, value) => value}
                onContextChange={noop}
                onChangeStatus={noop}
                onToggleChecklistItem={noop}
                onCreateNote={noop}
              />
            )}
          </div>
        </main>
      )}
      {scene === "knowledge" && (
        <main className="contentBand">
          <KnowledgeDocumentReading config={config} draft={document} onShowDetails={() => setDetails(true)} />
          {details && (
            <div className="dialogBackdrop knowledgeDetailsBackdrop">
              <section className="knowledgeDetailsDialog" role="dialog">
                <KnowledgeRecordHeader
                  config={config}
                  draft={document}
                  canUpdate
                  onSave={noop}
                  onExport={noop}
                  onReplicate={noop}
                  onClose={() => setDetails(false)}
                />
                <KnowledgeRecordTabs documentId={document.id} canReadAttachments tab="main" onSelect={noop} />
                <div className="knowledgeRecordPanel">
                  <MarkdownEditor value={value} onChange={setValue} />
                </div>
              </section>
            </div>
          )}
        </main>
      )}
      {scene === "files" && (
        <main className="contentBand">
          <FilesPanel
            files={files}
            onPreview={async () => new Blob([markdown], { type: "text/markdown" })}
            onDownload={noop}
            onDelete={noop}
            onUpdateTags={noop}
            onUpload={noop}
          />
          <button
            className="secondaryButton"
            onClick={() => {
              setHtml(true);
              setPreview(true);
            }}
          >
            Visualizar HTML
          </button>
          <button
            className="secondaryButton"
            onClick={() => {
              setHtml(false);
              setPreview(true);
            }}
          >
            Visualizar texto
          </button>
          {preview && (
            <FilePreview
              file={{
                filename: `${longText}.${html ? "html" : "txt"}`,
                contentType: html ? "text/html" : "text/plain",
              }}
              blob={
                new Blob([html ? `<h1>Documento HTML</h1><p>${longText}</p>` : longText], {
                  type: html ? "text/html" : "text/plain",
                })
              }
              onClose={() => setPreview(false)}
              onDownload={noop}
            />
          )}
        </main>
      )}
      {scene === "topology" && (
        <div className="dialogBackdrop topologyDiagramBackdrop">
          <section className="topologyDiagramDialog" role="dialog">
            <TopologyDialogHeader applicationName="Aplicação de atendimento e serviços" onClose={noop} />
            <TopologyDiagramToolbar controller={topologyController} />
            <TopologyDiagramCanvas controller={topologyController} />
          </section>
        </div>
      )}
    </div>
  );
}
const root = createRoot(globalThis.document.getElementById("app"));
root.render(
  <MessagesProvider>
    <Harness />
  </MessagesProvider>,
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount();
    globalThis.fetch = nativeFetch;
  });
}
