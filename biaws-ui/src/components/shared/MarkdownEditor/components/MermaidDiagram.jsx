import { useEffect, useId, useState } from "react";

let mermaidPromise;
let renderQueue = Promise.resolve();

export function MermaidDiagram({ definition }) {
  const reactId = useId();
  const [result, setResult] = useState({ loading: true, svg: "", error: "" });

  useEffect(() => {
    let cancelled = false;
    const diagramId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/gu, "")}`;

    setResult({ loading: true, svg: "", error: "" });

    renderDiagram(diagramId, definition)
      .then(({ svg }) => {
        if (!cancelled) setResult({ loading: false, svg, error: "" });
      })
      .catch((error) => {
        if (!cancelled) {
          setResult({
            loading: false,
            svg: "",
            error: readableMermaidError(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [definition, reactId]);

  if (result.loading) {
    return (
      <div aria-live="polite" className="mermaidDiagram mermaidDiagramLoading">
        Gerando diagrama…
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="mermaidDiagramError" role="alert">
        <strong>Não foi possível gerar o diagrama Mermaid.</strong>
        <span>{result.error}</span>
        <pre>
          <code>{definition}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      aria-label="Diagrama Mermaid"
      className="mermaidDiagram"
      dangerouslySetInnerHTML={{ __html: result.svg }}
      role="img"
    />
  );
}

function renderDiagram(id, definition) {
  const render = async () => {
    const mermaid = await loadMermaid();
    return mermaid.render(id, definition);
  };

  const result = renderQueue.then(render, render);
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        securityLevel: "strict",
        startOnLoad: false,
      });
      return mermaid;
    });
  }

  return mermaidPromise;
}

function readableMermaidError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  const firstLine = message.split("\n").find((line) => line.trim());
  return firstLine?.trim() || "Verifique a sintaxe do diagrama.";
}
