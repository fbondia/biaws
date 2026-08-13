import { hasPermission } from "../permissions.js";

function allowedNavigationView(actor) {
  return ({ permission }) => !permission || hasPermission(actor, permission);
}

function navigationSection(actor, section) {
  return {
    ...section,
    views: section.views.filter(allowedNavigationView(actor)),
  };
}

export function navigationGroup(actor, group) {
  return {
    ...group,
    sections: group.sections
      .map((section) => navigationSection(actor, section))
      .filter(({ views }) => views.length),
  };
}
