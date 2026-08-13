import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleUserRound,
  Copy,
  Menu,
  Settings,
  SlidersHorizontal,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import companyLogo from "../../../assets/logo-company.png";
import {
  buildLocalDevelopmentCommands,
  canOpenWorkspaceSwitcher,
  currentWorkspaceName,
} from "../model.js";
import {
  LocalSetupPanel,
  NavigationMenu,
  WorkspaceList,
  WorkspaceSwitcherFooter,
} from "./AppHeaderPanels.jsx";
import { copyPlainText, NavigationButton } from "./AppHeaderUtilities.jsx";

export function AppHeader({
  activeView,
  actor,
  availableNavigationGroups,
  availableViews,
  mobileMenuOpen,
  onMobileMenuChange,
  onViewChange,
  onWorkspaceChange,
}) {
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [localSetupOpen, setLocalSetupOpen] = useState(false);
  const [localSetupTab, setLocalSetupTab] = useState("setup");
  const [localSetupClient, setLocalSetupClient] = useState("codex");
  const [localInstance, setLocalInstance] = useState("");
  const [localProject, setLocalProject] = useState("");
  const [copyStatus, setCopyStatus] = useState("idle");
  const navigationMenuRefs = useRef({});
  const canManageWorkspaces = actor.platformPermissions?.includes(
    "platform.workspaces.manage",
  );
  const workspaces = actor.workspaces || [];
  const workspaceName = currentWorkspaceName(actor);
  const selectedWorkspace = workspaces.find(
    ({ id }) => id === actor.workspaceId,
  );
  const localCommands = buildLocalDevelopmentCommands({
    client: localSetupClient,
    instance: localInstance,
    projectDirectory: localProject,
    workspaceId: actor.workspaceId,
  });
  const showWorkspaceControl = canOpenWorkspaceSwitcher(actor);
  function closeNavigationMenus(exceptKey) {
    Object.entries(navigationMenuRefs.current).forEach(([key, menu]) => {
      if (key !== exceptKey) menu?.removeAttribute("open");
    });
  }
  function selectView(view) {
    onViewChange(view);
    onMobileMenuChange(false);
  }
  function selectGroupedView(groupKey, view) {
    selectView(view);
    navigationMenuRefs.current[groupKey]?.removeAttribute("open");
  }
  function setNavigationMenuRef(groupKey, menu) {
    navigationMenuRefs.current[groupKey] = menu;
  }
  function closeWorkspaceDialog() {
    setWorkspaceDialogOpen(false);
    setLocalSetupOpen(false);
    setCopyStatus("idle");
  }
  useEffect(() => {
    if (!workspaceDialogOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") closeWorkspaceDialog();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [workspaceDialogOpen]);

  async function selectWorkspace(workspaceId) {
    closeWorkspaceDialog();
    onMobileMenuChange(false);
    if (workspaceId !== actor.workspaceId) {
      await onWorkspaceChange(workspaceId);
    }
  }

  function manageWorkspaces() {
    closeWorkspaceDialog();
    selectView("workspace-admin");
  }

  async function copyLocalCommand(commandKey, command) {
    try {
      await copyPlainText(command);
      setCopyStatus(`copied:${commandKey}`);
    } catch {
      setCopyStatus(`failed:${commandKey}`);
    }
  }

  return (
    <>
      <header className="topBar">
        <div className="topBarHeading">
          <div className="productBrand">
            <img
              alt=""
              aria-hidden="true"
              className="productBrandLogo"
              src={companyLogo}
            />
            <div className="productBrandName" aria-label="BIAWS">
              <span className="productBrandCompany">BIAWS</span>
              <span className="workspaceBrandContext">
                <span className="productBrandProduct">{workspaceName}</span>
                {showWorkspaceControl ? (
                  <button
                    aria-label="Selecionar ou gerenciar workspaces"
                    className="workspaceContextButton"
                    onClick={() => {
                      setLocalSetupOpen(false);
                      setWorkspaceDialogOpen(true);
                    }}
                    type="button"
                  >
                    <SlidersHorizontal size={15} />
                  </button>
                ) : null}
              </span>
            </div>
          </div>
          <button
            aria-controls="application-navigation"
            aria-expanded={mobileMenuOpen}
            aria-label={
              mobileMenuOpen ? "Fechar menu principal" : "Abrir menu principal"
            }
            className="mobileMenuButton iconButton"
            onClick={() => onMobileMenuChange(!mobileMenuOpen)}
            type="button"
          >
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        <div
          className={
            mobileMenuOpen ? "topBarActions mobileMenuOpen" : "topBarActions"
          }
        >
          <nav
            className="viewTabs"
            id="application-navigation"
            aria-label="Telas da aplicação"
          >
            {availableViews.map((view) => (
              <NavigationButton
                active={activeView === view.key}
                key={view.key}
                onClick={() => selectView(view.key)}
                view={view}
              />
            ))}
            {availableNavigationGroups.map((group) => (
              <NavigationMenu
                activeView={activeView}
                group={group}
                key={group.key}
                onMenuRef={setNavigationMenuRef}
                onOpen={closeNavigationMenus}
                onSelectView={selectGroupedView}
              />
            ))}
            <NavigationButton
              active={activeView === "account"}
              onClick={() => selectView("account")}
              view={{ icon: CircleUserRound, label: "Conta" }}
            />
          </nav>
        </div>
      </header>
      {workspaceDialogOpen ? (
        <div
          className="dialogBackdrop workspaceSwitcherBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeWorkspaceDialog();
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="workspace-switcher-title"
            aria-modal="true"
            className={
              localSetupOpen
                ? "workspaceSwitcherDialog localSetupOpen"
                : "workspaceSwitcherDialog"
            }
            role="dialog"
          >
            <header className="workspaceSwitcherHeader">
              <div>
                <span>
                  {localSetupOpen ? "Integração MCP" : "Contexto atual"}
                </span>
                <h2 id="workspace-switcher-title">
                  {localSetupOpen ? "Configuração local" : "Workspaces"}
                </h2>
              </div>
              <button
                aria-label="Fechar"
                className="iconButton"
                onClick={closeWorkspaceDialog}
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            {localSetupOpen ? (
              <div className="workspaceLocalSetup">
                <div className="workspaceLocalSetupIntro">
                  <Terminal size={20} />
                  <div>
                    <strong>{selectedWorkspace?.name || workspaceName}</strong>
                    <p>
                      Execute o comando na raiz do clone do BIAWS. Ele reutiliza
                      a instância existente e configura este workspace no
                      projeto local informado. A identidade técnica da instância
                      precisa ser membro ativo deste workspace.
                    </p>
                  </div>
                </div>
                <div className="workspaceLocalSetupFields">
                  <div className="workspaceLocalFieldsHeader">
                    <strong>Ambiente local</strong>
                    <small>
                      Esses valores são compartilhados por todos os comandos.
                    </small>
                  </div>
                  <label>
                    <span>Cliente</span>
                    <select
                      onChange={(event) => {
                        setLocalSetupClient(event.target.value);
                        setCopyStatus("idle");
                      }}
                      value={localSetupClient}
                    >
                      <option value="codex">Codex</option>
                      <option value="claude">Claude Code</option>
                    </select>
                  </label>
                  <label>
                    <span>Instância local</span>
                    <input
                      onChange={(event) => {
                        setLocalInstance(event.target.value);
                        setCopyStatus("idle");
                      }}
                      placeholder="nome usado em instances/<nome>"
                      required
                      value={localInstance}
                    />
                  </label>
                  <label className="workspaceLocalProjectField">
                    <span>Caminho absoluto do projeto</span>
                    <input
                      onChange={(event) => {
                        setLocalProject(event.target.value);
                        setCopyStatus("idle");
                      }}
                      placeholder="/caminho/absoluto/do/projeto"
                      required
                      value={localProject}
                    />
                  </label>
                </div>

                <LocalSetupTabs
                  activeTab={localSetupTab}
                  onSelect={(tab) => {
                    setLocalSetupTab(tab);
                    setCopyStatus("idle");
                  }}
                />

                <div
                  aria-labelledby={`workspace-local-tab-${localSetupTab}`}
                  className="workspaceLocalTabPanel"
                  id={`workspace-local-panel-${localSetupTab}`}
                  role="tabpanel"
                >
                  <LocalSetupPanel
                    commands={localCommands}
                    copyStatus={copyStatus}
                    disabled={!localInstance.trim() || !localProject.trim()}
                    onCopy={copyLocalCommand}
                    tab={localSetupTab}
                    workspaceId={actor.workspaceId}
                  />
                </div>
              </div>
            ) : (
              <WorkspaceList
                currentWorkspaceId={actor.workspaceId}
                onSelect={selectWorkspace}
                workspaces={workspaces}
              />
            )}
            <WorkspaceSwitcherFooter
              canManage={canManageWorkspaces}
              localSetupOpen={localSetupOpen}
              onBack={() => {
                setLocalSetupOpen(false);
                setCopyStatus("idle");
              }}
              onClose={closeWorkspaceDialog}
              onManage={manageWorkspaces}
              onOpenLocal={() => {
                setLocalSetupTab("setup");
                setCopyStatus("idle");
                setLocalSetupOpen(true);
              }}
              workspaceId={actor.workspaceId}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
