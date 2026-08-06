import { SECRET_ENVIRONMENT_OPTIONS, SECRET_TYPE_OPTIONS } from "../model.js";

export function SecretTypeEnvironmentFields({ form, setForm }) {
  return (
    <div className="secretFormGrid">
      <label>
        Tipo
        <select
          onChange={(event) => setForm({ ...form, type: event.target.value })}
          value={form.type}
        >
          {SECRET_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ambiente
        <select
          onChange={(event) =>
            setForm({ ...form, environment: event.target.value })
          }
          value={form.environment}
        >
          {SECRET_ENVIRONMENT_OPTIONS.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function SecretScopeField({
  allowedApplicationIds,
  applications,
  form,
  setForm,
  workspaceAllowed,
}) {
  const availableApplications = applications.filter(({ id }) =>
    allowedApplicationIds.includes(id),
  );
  return (
    <label>
      Escopo
      <select
        onChange={(event) =>
          setForm({ ...form, applicationId: event.target.value })
        }
        required={!workspaceAllowed}
        value={form.applicationId}
      >
        {workspaceAllowed ? (
          <option value="">Workspace inteiro</option>
        ) : (
          <option value="">Selecione uma aplicação</option>
        )}
        {availableApplications.map((application) => (
          <option key={application.id} value={application.id}>
            {application.name}
          </option>
        ))}
        {allowedApplicationIds
          .filter(
            (id) =>
              !availableApplications.some(
                (application) => application.id === id,
              ),
          )
          .map((id) => (
            <option key={id} value={id}>
              Aplicação {id}
            </option>
          ))}
      </select>
    </label>
  );
}
