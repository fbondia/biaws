import { homeCollection } from "../storage.js";
import { defaultHomeWidgets, widgetById } from "../widgets.js";
import { hasPermission } from "../support.js";
import { normalizeHomeWidgets } from "../normalization.js";

export async function getHomeConfiguration(actor) {
  const collection = await homeCollection();
  const document = await collection.findOne({
    workspaceId: actor.workspaceId,
    userId: actor.userId,
  });
  const source = document?.widgets || defaultHomeWidgets(actor);
  const available = source.filter((item) => {
    const widget = widgetById.get(item.widgetId);
    return widget && hasPermission(actor, widget.permission);
  });
  return {
    widgets: normalizeHomeWidgets(available, actor),
    customized: Boolean(document),
    updatedAt: document?.updatedAt || null,
  };
}
