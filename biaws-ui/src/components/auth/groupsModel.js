export function groupPermissionsBySection(permissions = []) {
  return Object.entries(
    permissions.reduce((sections, permission) => {
      const section = permission.section || "Geral";
      (sections[section] ||= []).push(permission);
      return sections;
    }, {}),
  );
}
