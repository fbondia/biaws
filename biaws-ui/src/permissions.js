export function hasPermission(actor, permission) {
  return (
    Array.isArray(actor?.permissions) && actor.permissions.includes(permission)
  );
}

export function hasEveryPermission(actor, ...permissions) {
  return permissions.every((permission) => hasPermission(actor, permission));
}
