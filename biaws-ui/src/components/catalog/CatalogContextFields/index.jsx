import { CatalogColumnSelector } from "./CatalogColumnSelector.jsx";

export {
  CatalogContextDialogField,
  CatalogFilterFields,
} from "./CatalogContextDialogs.jsx";
export { useCatalogOptions } from "./useCatalogOptions.js";

export function CatalogContextFields({
  affectedComponentIds = [],
  applicationId = "",
  applications,
  components,
  disabled = false,
  onChange,
  optional = false,
}) {
  return (
    <div className="catalogContextFields">
      <CatalogColumnSelector
        affectedComponentIds={affectedComponentIds}
        applicationId={applicationId}
        applications={applications}
        components={components}
        disabled={disabled}
        emptyApplicationLabel={
          optional ? "Conhecimento geral do workspace" : ""
        }
        multipleComponents
        onChange={onChange}
        optional={optional}
      />
    </div>
  );
}
