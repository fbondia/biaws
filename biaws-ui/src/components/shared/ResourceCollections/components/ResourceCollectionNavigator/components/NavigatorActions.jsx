import { CollectionFilterAction } from "./CollectionFilterAction.jsx";
import { ViewModeAction } from "./ViewModeAction.jsx";

export function NavigatorActions({ navigator }) {
  return (
    <div className="resourceCollectionNavigationActions">
      <ViewModeAction navigator={navigator} />
      <CollectionFilterAction navigator={navigator} />
    </div>
  );
}
