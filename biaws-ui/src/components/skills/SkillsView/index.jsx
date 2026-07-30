import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchSkills } from "../../../api.js";
import { useLoading } from "../../shared/LoadingProvider.jsx";
import { PublishSkillDialog } from "./components/PublishSkillDialog.jsx";
import { SkillDetailsDialog } from "./components/SkillDetailsDialog.jsx";
import { formatDate } from "./utils.js";

export function SkillsView() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const { runWithLoading } = useLoading();

  async function loadSkills() {
    setLoading(true);
    setError("");
    try {
      setResult(
        await runWithLoading(
          () => fetchSkills({ includeDeprecated: true }),
          "Carregando catálogo de skills…",
        ),
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSkills();
  }, []);

  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return result?.items || [];
    return (result?.items || []).filter(
      (item) =>
        item.skillId.toLocaleLowerCase("pt-BR").includes(term) ||
        item.name.toLocaleLowerCase("pt-BR").includes(term) ||
        item.description.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [result, search]);

  return (
    <section className="skillsView">
      <header className="skillsToolbar">
        <div>
          <h2>Catálogo de skills</h2>
          <p>
            Versões publicadas para configuração dos ambientes Bondia
            Workspaces.
          </p>
        </div>
        <div className="skillsToolbarActions">
          <label className="skillsSearch">
            <Package size={16} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar skill..."
              value={search}
            />
          </label>
          <button
            className="iconButton"
            disabled={loading}
            onClick={loadSkills}
            title="Atualizar catálogo"
            type="button"
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="primaryButton"
            onClick={() => setPublishing(true)}
            type="button"
          >
            <Plus size={16} /> Publicar versão
          </button>
        </div>
      </header>
      {error ? (
        <div className="skillPageError">
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}
      {loading && !result ? (
        <div className="emptyState">Carregando catálogo...</div>
      ) : null}
      {!loading && !items.length ? (
        <div className="skillsEmptyState">
          <Package size={34} />
          <strong>Nenhuma skill encontrada</strong>
          <span>
            Publique uma versão pela interface ou pelo Bondia Workspaces CLI.
          </span>
        </div>
      ) : (
        <div className="skillCards">
          {items.map((skill) => (
            <article className="skillCard" key={skill.skillId}>
              <header>
                <div className="skillCardIcon">
                  <Package size={20} />
                </div>
                <div>
                  <h3>{skill.name}</h3>
                  <code>{skill.skillId}</code>
                </div>
              </header>
              <p>{skill.description}</p>
              <dl>
                <div>
                  <dt>Versão atual</dt>
                  <dd>{skill.latestVersion}</dd>
                </div>
                <div>
                  <dt>Versões</dt>
                  <dd>{skill.versions.length}</dd>
                </div>
                <div>
                  <dt>Atualizada</dt>
                  <dd>{formatDate(skill.updatedAt)}</dd>
                </div>
              </dl>
              <footer>
                <span
                  className={
                    skill.status === "published"
                      ? "skillStatus published"
                      : "skillStatus deprecated"
                  }
                >
                  {skill.status === "published" ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <Archive size={13} />
                  )}
                  {skill.status}
                </span>
                <button
                  className="secondaryButton"
                  onClick={() => setSelectedSkill(skill)}
                  type="button"
                >
                  Administrar
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {publishing ? (
        <PublishSkillDialog
          onClose={() => setPublishing(false)}
          onPublished={loadSkills}
        />
      ) : null}
      {selectedSkill ? (
        <SkillDetailsDialog
          onChanged={loadSkills}
          onClose={() => setSelectedSkill(null)}
          skill={selectedSkill}
        />
      ) : null}
    </section>
  );
}
