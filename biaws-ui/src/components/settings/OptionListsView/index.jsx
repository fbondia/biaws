import { AlertTriangle, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";

import "../../../styles/features/settings.css";

import { fetchOptionLists } from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import { ListEditor } from "./components/ListEditor/index.jsx";
import { groupOptionLists, LIST_ICONS } from "./model.js";

function retainActiveGroup(groups, current) {
  return groups.some((group) => group.key === current)
    ? current
    : groups[0]?.key || "";
}

function retainSelectedLists(groups, current) {
  return Object.fromEntries(
    groups.map((group) => [
      group.key,
      group.lists.some((list) => list.key === current[group.key])
        ? current[group.key]
        : group.lists[0]?.key || "",
    ]),
  );
}

export function OptionListsView({ actor, onRuntimeChanged }) {
  const [lists, setLists] = useState([]);
  const [activeGroupKey, setActiveGroupKey] = useState("");
  const [selectedListByGroup, setSelectedListByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canManage = hasPermission(actor, "option_lists.manage");

  useEffect(() => {
    let active = true;
    async function loadLists() {
      try {
        const payload = await fetchOptionLists();
        if (!active) return;
        const items = payload.items || [];
        const groups = groupOptionLists(items);
        setLists(items);
        setActiveGroupKey((current) => retainActiveGroup(groups, current));
        setSelectedListByGroup((current) =>
          retainSelectedLists(groups, current),
        );
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadLists();
    return () => {
      active = false;
    };
  }, []);

  function saved(optionList) {
    setLists((current) =>
      current.map((list) => (list.key === optionList.key ? optionList : list)),
    );
    onRuntimeChanged?.();
  }

  const groupedLists = groupOptionLists(lists);
  const activeGroup =
    groupedLists.find((group) => group.key === activeGroupKey) ||
    groupedLists[0];
  const activeKey =
    selectedListByGroup[activeGroup?.key] || activeGroup?.lists[0]?.key || "";

  return (
    <section className="taxonomyPage optionListsView">
      <header className="taxonomyHero">
        <div>
          <span>Administração</span>
          <h2>Listas de Opções</h2>
          <p>
            Gerencie os valores disponíveis nos campos de configuração do
            workspace.
          </p>
        </div>
      </header>
      {loading ? <p>Carregando listas…</p> : null}
      {error ? (
        <div className="optionListError">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}
      {lists.length ? (
        <>
          <div
            aria-label="Contexto das listas de opções"
            className="detailTabs optionListCategoryTabs"
            role="tablist"
          >
            {groupedLists.map((group) => {
              const GroupIcon = group.icon;
              const selected = activeGroup?.key === group.key;

              return (
                <button
                  aria-controls={`option-list-group-panel-${group.key}`}
                  aria-selected={selected}
                  className={
                    selected
                      ? "detailTab optionListCategoryTab activeDetailTab"
                      : "detailTab optionListCategoryTab"
                  }
                  id={`option-list-group-tab-${group.key}`}
                  key={group.key}
                  onClick={() => setActiveGroupKey(group.key)}
                  role="tab"
                  type="button"
                >
                  <GroupIcon size={17} />
                  {group.label}
                </button>
              );
            })}
          </div>

          {activeGroup ? (
            <section
              aria-labelledby={`option-list-group-tab-${activeGroup.key}`}
              className="optionListGroupPanel"
              id={`option-list-group-panel-${activeGroup.key}`}
              role="tabpanel"
            >
              <header className="optionListGroupHeader">
                <div>
                  <h3>{activeGroup.label}</h3>
                  <p>{activeGroup.description}</p>
                </div>
              </header>
              <div
                aria-label={`Listas de opções de ${activeGroup.label}`}
                className="detailTabs taxonomyDefinitionTabs optionListTabs"
                role="tablist"
              >
                {activeGroup.lists.map((list) => {
                  const Icon = LIST_ICONS[list.key] || ListChecks;
                  return (
                    <button
                      aria-controls={`option-list-panel-${list.key}`}
                      aria-selected={activeKey === list.key}
                      className={
                        activeKey === list.key
                          ? "detailTab activeDetailTab"
                          : "detailTab"
                      }
                      id={`option-list-tab-${list.key}`}
                      key={list.key}
                      onClick={() =>
                        setSelectedListByGroup((current) => ({
                          ...current,
                          [activeGroup.key]: list.key,
                        }))
                      }
                      role="tab"
                      type="button"
                    >
                      <Icon size={16} />
                      {list.name}
                    </button>
                  );
                })}
              </div>

              {activeGroup.lists.map((list) => (
                <div
                  aria-labelledby={`option-list-tab-${list.key}`}
                  hidden={activeKey !== list.key}
                  id={`option-list-panel-${list.key}`}
                  key={list.key}
                  role="tabpanel"
                >
                  <ListEditor
                    canManage={canManage}
                    currentWorkspaceId={actor.workspaceId}
                    list={list}
                    onSaved={saved}
                    workspaces={actor.workspaces || []}
                  />
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
