import { ChevronDown, CircleUserRound, Menu, Settings, X } from "lucide-react";

import companyLogo from "../../../assets/logo-company.png";

export function AppHeader({
  activeView,
  actor,
  availableSettingsViews,
  availableViews,
  mobileMenuOpen,
  onMobileMenuChange,
  onViewChange,
  onWorkspaceChange,
  settingsMenuRef,
}) {
  const settingsViewActive = availableSettingsViews.some(
    ({ key }) => key === activeView,
  );
  function selectView(view) {
    onViewChange(view);
    onMobileMenuChange(false);
  }
  return (
    <header className="topBar">
      <div className="topBarHeading">
        <div className="productBrand">
          <img
            alt=""
            aria-hidden="true"
            className="productBrandLogo"
            src={companyLogo}
          />
          <div className="productBrandName" aria-label="Bondia Workspaces">
            <span className="productBrandCompany">Bondia</span>
            <span className="productBrandProduct">Workspaces</span>
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
        {actor.workspaces?.length > 1 ? (
          <label className="workspaceSelector">
            <span>Workspace</span>
            <select
              aria-label="Workspace atual"
              onChange={(event) => onWorkspaceChange(event.target.value)}
              value={actor.workspaceId}
            >
              {actor.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
          {availableSettingsViews.length ? (
            <details className="settingsMenu" ref={settingsMenuRef}>
              <summary
                aria-current={settingsViewActive ? "page" : undefined}
                className={
                  settingsViewActive ? "viewTab activeViewTab" : "viewTab"
                }
              >
                <Settings size={16} /> Configurações
                <ChevronDown className="settingsMenuChevron" size={14} />
              </summary>
              <div className="settingsSubmenu">
                {availableSettingsViews.map((view) => (
                  <NavigationButton
                    active={activeView === view.key}
                    key={view.key}
                    menu
                    onClick={() => {
                      selectView(view.key);
                      settingsMenuRef.current?.removeAttribute("open");
                    }}
                    view={view}
                  />
                ))}
              </div>
            </details>
          ) : null}
          <NavigationButton
            active={activeView === "account"}
            onClick={() => selectView("account")}
            view={{ icon: CircleUserRound, label: "Conta" }}
          />
        </nav>
      </div>
    </header>
  );
}

function NavigationButton({ active, menu = false, onClick, view }) {
  const Icon = view.icon;
  const baseClass = menu ? "settingsSubmenuItem" : "viewTab";
  const activeClass = menu ? "activeSettingsSubmenuItem" : "activeViewTab";
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={active ? `${baseClass} ${activeClass}` : baseClass}
      onClick={onClick}
      type="button"
    >
      <Icon size={16} /> {view.label}
    </button>
  );
}
