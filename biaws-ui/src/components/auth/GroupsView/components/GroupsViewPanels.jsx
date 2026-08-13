import { ChevronDown, Plus } from "lucide-react";
import { groupPermissionsBySection } from "../model.js";

function PermissionOption({ canManage, draft, onToggle, permission }) {
  const disabled =
    !canManage ||
    (draft.scope?.type === "applications" && permission.scope === "workspace");
  return (
    <label className="permissionOption">
      <input
        checked={draft.permissions.includes(permission.id)}
        disabled={disabled}
        onChange={() => onToggle(permission.id)}
        type="checkbox"
      />
      <span>
        {permission.label}
        <small>{permission.id}</small>
      </span>
    </label>
  );
}

function PermissionSection({
  canManage,
  draft,
  onToggle,
  permissions,
  section,
}) {
  return (
    <section className="permissionSection">
      <h4>{section}</h4>
      <div className="permissionSectionOptions">
        {permissions.map((permission) => (
          <PermissionOption
            canManage={canManage}
            draft={draft}
            key={permission.id}
            onToggle={onToggle}
            permission={permission}
          />
        ))}
      </div>
    </section>
  );
}

function PermissionCategory({
  activeDomain,
  canManage,
  categoriesId,
  domain,
  draft,
  index,
  onToggleDomain,
  onTogglePermission,
  permissions,
}) {
  const selectedCount = permissions.filter(({ id }) =>
    draft.permissions.includes(id),
  ).length;
  const isExpanded = domain === activeDomain;
  const sections = groupPermissionsBySection(permissions);
  return (
    <article
      className={
        isExpanded ? "permissionCategory expanded" : "permissionCategory"
      }
    >
      <button
        aria-controls={`${categoriesId}-panel-${index}`}
        aria-expanded={isExpanded}
        className="permissionCategoryTrigger"
        id={`${categoriesId}-trigger-${index}`}
        onClick={() => onToggleDomain(isExpanded ? "" : domain)}
        type="button"
      >
        <span className="permissionCategoryTitle">
          <strong>{domain}</strong>
          <small>
            {permissions.length}{" "}
            {permissions.length === 1
              ? "permissão disponível"
              : "permissões disponíveis"}
          </small>
        </span>
        <span className="permissionCategorySummary">
          <span
            aria-label={`${selectedCount} de ${permissions.length} permissões selecionadas`}
            className="permissionCategoryBadge"
          >
            {selectedCount}/{permissions.length}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="permissionCategoryChevron"
            size={18}
          />
        </span>
      </button>
      {isExpanded ? (
        <div
          aria-labelledby={`${categoriesId}-trigger-${index}`}
          className="permissionCategoryPanel"
          id={`${categoriesId}-panel-${index}`}
          role="region"
        >
          {sections.map(([section, sectionPermissions]) => (
            <PermissionSection
              canManage={canManage}
              draft={draft}
              key={section}
              onToggle={onTogglePermission}
              permissions={sectionPermissions}
              section={section}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function PermissionCategories({
  activeDomain,
  canManage,
  categoriesId,
  domains,
  draft,
  onToggleDomain,
  onTogglePermission,
}) {
  return (
    <section
      aria-label="Categorias de permissões"
      className="permissionCategoriesSection"
    >
      <div className="permissionCategoriesHeader">
        <div>
          <h3>Permissões</h3>
          <p>Expanda uma categoria para configurar as permissões.</p>
        </div>
        <span>
          {draft.permissions.length}{" "}
          {draft.permissions.length === 1 ? "selecionada" : "selecionadas"}
        </span>
      </div>
      <div className="permissionCategoryList">
        {domains.map(([domain, permissions], index) => (
          <PermissionCategory
            activeDomain={activeDomain}
            canManage={canManage}
            categoriesId={categoriesId}
            domain={domain}
            draft={draft}
            index={index}
            key={domain}
            onToggleDomain={onToggleDomain}
            onTogglePermission={onTogglePermission}
            permissions={permissions}
          />
        ))}
      </div>
    </section>
  );
}

export function CreateGroupButton({ canManage, onCreate }) {
  if (!canManage) return null;
  return (
    <button className="primaryButton" onClick={onCreate} type="button">
      <Plus size={16} /> Novo grupo
    </button>
  );
}
