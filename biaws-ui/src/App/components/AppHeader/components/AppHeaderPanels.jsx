import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Settings,
  SlidersHorizontal,
  Terminal,
  X,
} from "lucide-react";
import { buildLocalDevelopmentCommands } from "../../../model.js";
import { LocalCommandCard, NavigationButton } from "./AppHeaderUtilities.jsx";

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

export function NavigationMenuSection({
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

export function NavigationMenu({
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

export function WorkspaceList({ currentWorkspaceId, onSelect, workspaces }) {
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

export function LocalSetupTabs({ activeTab, onSelect }) {
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

export function LocalSetupPanel({
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

export function WorkspaceSwitcherFooter({
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
