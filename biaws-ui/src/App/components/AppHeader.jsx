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

const LOCAL_SETUP_TABS = [
  { key: "setup", label: "Setup Agent" },
  { key: "cli", label: "CLI" },
  { key: "skills", label: "Skills" },
  { key: "doctor", label: "Diagnóstico" },
];

function navigationGroupIsActive(group, activeView) {
  return group.sections.some(({ views }) =>
    views.some(({ key }) => key === activeView),
  );
}

function NavigationMenuSection({
  activeView,
  groupKey,
  onSelectView,
  section,
}) {
  return (
    <section aria-label={section.label} className="navigationSubmenuSection">
      <span className="navigationSubmenuLabel">{section.label}</span>
      {section.views.map((view) => (
        <NavigationButton
          active={activeView === view.key}
          key={view.key}
          menu
          onClick={() => onSelectView(groupKey, view.key)}
          view={view}
        />
      ))}
    </section>
  );
}

function NavigationMenu({
  activeView,
  group,
  onMenuRef,
  onOpen,
  onSelectView,
}) {
  const GroupIcon = group.icon;
  const active = navigationGroupIsActive(group, activeView);
  return (
    <details
      className="navigationMenu"
      onToggle={(event) => event.currentTarget.open && onOpen(group.key)}
      ref={(menu) => onMenuRef(group.key, menu)}
    >
      <summary
        aria-current={active ? "page" : undefined}
        className={active ? "viewTab activeViewTab" : "viewTab"}
      >
        <GroupIcon size={16} /> {group.label}
        <ChevronDown className="navigationMenuChevron" size={14} />
      </summary>
      <div className="navigationSubmenu">
        {group.sections.map((section) => (
          <NavigationMenuSection
            activeView={activeView}
            groupKey={group.key}
            key={section.key}
            onSelectView={onSelectView}
            section={section}
          />
        ))}
      </div>
    </details>
  );
}

function WorkspaceList({ currentWorkspaceId, onSelect, workspaces }) {
  if (!workspaces.length) {
    return (
      <p className="workspaceSwitcherEmpty">
        Nenhum workspace associado à sua identidade.
      </p>
    );
  }
  return (
    <div className="workspaceSwitcherList">
      {workspaces.map((workspace) => {
        const selected = workspace.id === currentWorkspaceId;
        return (
          <button
            aria-current={selected ? "true" : undefined}
            className={
              selected
                ? "workspaceSwitcherItem selected"
                : "workspaceSwitcherItem"
            }
            key={workspace.id}
            onClick={() => onSelect(workspace.id)}
            type="button"
          >
            <span>
              <strong>{workspace.name}</strong>
              <small>{workspace.key}</small>
            </span>
            {selected ? <Check size={18} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function LocalSetupTabs({ activeTab, onSelect }) {
  return (
    <div
      aria-label="Formas de sincronizar o projeto"
      className="workspaceLocalTabs"
      role="tablist"
    >
      {LOCAL_SETUP_TABS.map((tab) => (
        <button
          aria-controls={`workspace-local-panel-${tab.key}`}
          aria-selected={activeTab === tab.key}
          className={activeTab === tab.key ? "active" : ""}
          id={`workspace-local-tab-${tab.key}`}
          key={tab.key}
          onClick={() => onSelect(tab.key)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LocalSetupPanel({
  commands,
  copyStatus,
  disabled,
  onCopy,
  tab,
  workspaceId,
}) {
  const common = { copyStatus, disabled, onCopy, workspaceId };
  if (tab === "setup")
    return (
      <LocalCommandCard
        {...common}
        command={commands.setup}
        commandKey="setup"
        description="Fluxo recomendado para uma instância já instalada. Reaplica a configuração MCP, instala as skills ausentes e executa o diagnóstico final."
        title="Sincronizar com Setup Agent"
      />
    );
  if (tab === "cli")
    return (
      <LocalCommandCard
        {...common}
        command={commands.configure}
        commandKey="configure"
        description="Configura diretamente o MCP e o catálogo de skills deste projeto usando o arquivo de ambiente da instância."
        title="Configurar pelo CLI"
      />
    );
  if (tab === "doctor")
    return (
      <LocalCommandCard
        {...common}
        command={commands.doctor}
        commandKey="doctor"
        description="Verifica Node.js, API, autenticação, workspace, handshake MCP, configuração local e skills."
        title="Validar ambiente"
      />
    );
  if (tab !== "skills") return null;
  return (
    <div className="workspaceLocalCommandStack">
      <LocalCommandCard
        {...common}
        command={commands.installSkills}
        commandKey="install-skills"
        description="Instala no projeto as skills do catálogo que ainda não estão disponíveis localmente."
        title="Instalar catálogo"
      />
      <LocalCommandCard
        {...common}
        command={commands.updateSkills}
        commandKey="update-skills"
        description="Atualiza as skills já instaladas para as versões publicadas no workspace."
        title="Atualizar skills"
      />
      <LocalCommandCard
        {...common}
        command={commands.publishSkill}
        commandKey="publish-skill"
        description="Publica uma nova versão de uma skill local no catálogo do workspace. Ajuste o diretório, a versão e, se necessário, acrescente --changelog. Requer a permissão skills.publish."
        title="Publicar uma skill"
      />
      <LocalCommandCard
        {...common}
        command={commands.publishAllSkills}
        commandKey="publish-all-skills"
        description="Publica as skills locais que possuem SKILL.md e ignora versões que já existem no catálogo. Ajuste a versão inicial antes de executar. Requer a permissão skills.publish."
        title="Publicar todas as skills"
      />
    </div>
  );
}

function WorkspaceSwitcherFooter({
  canManage,
  localSetupOpen,
  onBack,
  onClose,
  onManage,
  onOpenLocal,
  workspaceId,
}) {
  if (localSetupOpen) {
    return (
      <footer className="workspaceSwitcherActions">
        <button className="secondaryButton" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Voltar
        </button>
        <span className="workspaceSwitcherActionSpacer" />
      </footer>
    );
  }
  return (
    <footer className="workspaceSwitcherActions">
      <button
        className="secondaryButton workspaceLocalSetupButton"
        disabled={!workspaceId}
        onClick={onOpenLocal}
        type="button"
      >
        <Terminal size={16} /> Configurar localmente
      </button>
      <span className="workspaceSwitcherActionSpacer" />
      <button className="secondaryButton" onClick={onClose} type="button">
        Fechar
      </button>
      {canManage ? (
        <button className="primaryButton" onClick={onManage} type="button">
          <Settings size={16} /> Gerenciar
        </button>
      ) : null}
    </footer>
  );
}

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

function LocalCommandCard({
  command,
  commandKey,
  copyStatus,
  description,
  disabled,
  onCopy,
  title,
  workspaceId,
}) {
  const copied = copyStatus === `copied:${commandKey}`;
  const failed = copyStatus === `failed:${commandKey}`;
  return (
    <section className="workspaceLocalCommand">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button
          className="secondaryButton"
          disabled={disabled}
          onClick={() => onCopy(commandKey, command)}
          title={
            disabled
              ? "Informe a instância e o caminho do projeto"
              : "Copiar comando"
          }
          type="button"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </header>
      <small>Workspace: {workspaceId}</small>
      <pre>{command}</pre>
      {failed ? (
        <p className="workspaceLocalCopyError" role="alert">
          Não foi possível copiar. Selecione o comando manualmente.
        </p>
      ) : null}
    </section>
  );
}

async function copyPlainText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function NavigationButton({
  active,
  iconOnly = false,
  menu = false,
  onClick,
  view,
}) {
  const Icon = view.icon;
  const baseClass = menu ? "navigationSubmenuItem" : "viewTab";
  const activeClass = menu ? "activeNavigationSubmenuItem" : "activeViewTab";
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={iconOnly ? view.label : undefined}
      className={`${active ? `${baseClass} ${activeClass}` : baseClass}${
        iconOnly ? " accountNavigationButton" : ""
      }`}
      onClick={onClick}
      title={iconOnly ? view.label : undefined}
      type="button"
    >
      <Icon size={16} /> {iconOnly ? null : view.label}
    </button>
  );
}
