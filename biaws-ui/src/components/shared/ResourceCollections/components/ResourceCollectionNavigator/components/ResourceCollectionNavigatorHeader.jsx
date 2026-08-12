import { useRootCollectionDrop } from "../../ResourceCollectionsShell/hooks/useRootCollectionDrop.js";

import { NavigatorActions } from "./NavigatorActions.jsx";

export function ResourceCollectionNavigatorHeader({
  actionsInBar,
  itemLabel,
  navigator,
}) {
  const rootDrop = useRootCollectionDrop();

  return (
    <header
      {...rootDrop.dropProps}
      aria-label={
        rootDrop.enabled
          ? "Mover item ou coleção para a raiz"
          : "Navegador de coleções"
      }
      className={[
        rootDrop.enabled ? "resourceCollectionRootDropZone" : "",
        rootDrop.active ? "resourceCollectionDropTarget" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={rootDrop.enabled ? "Solte para mover para a raiz" : undefined}
    >
      {rootDrop.enabled ? (
        <div className="resourceCollectionRootDropPrompt">
          <strong>Mover para raiz</strong>
        </div>
      ) : (
        <div>
          <strong>Coleções</strong>
          <span>Arraste {itemLabel} e coleções para organizar.</span>
        </div>
      )}
      {actionsInBar ? null : <NavigatorActions navigator={navigator} />}
    </header>
  );
}
