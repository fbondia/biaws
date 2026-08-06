export const EMPTY_SECRET_FORM = {
  name: "",
  identifier: "",
  description: "",
  type: "generic",
  environment: "",
  applicationId: "",
  contentKind: "text",
  value: "",
  file: null,
};

export const SECRET_TYPE_OPTIONS = [
  { value: "generic", label: "Genérico" },
  { value: "password", label: "Senha externa" },
  { value: "api-key", label: "API key externa" },
  { value: "token", label: "Token" },
  { value: "private-key", label: "Chave privada" },
];

export const SECRET_ENVIRONMENT_OPTIONS = [
  { value: "", label: "Não informado" },
  { value: "development", label: "Desenvolvimento" },
  { value: "test", label: "Teste" },
  { value: "staging", label: "Homologação" },
  { value: "production", label: "Produção" },
  { value: "other", label: "Outro" },
];

export function suggestSecretIdentifier(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 100);
}

export function formatSecretBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function permissionApplicationIds(actor, ...permissions) {
  return [
    ...new Set(
      permissions.flatMap(
        (permission) =>
          actor.permissionScopes?.[permission]?.applicationIds || [],
      ),
    ),
  ];
}

export function canActOnSecret(actor, permission, secret) {
  const scope = actor.permissionScopes?.[permission];
  return Boolean(
    scope?.workspace ||
    (secret.applicationId &&
      scope?.applicationIds?.includes(secret.applicationId)),
  );
}
