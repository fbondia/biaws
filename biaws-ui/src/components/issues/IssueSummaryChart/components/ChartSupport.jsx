import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

export function SummaryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const value = payload[0]?.value ?? payload[0]?.payload?.count ?? 0;
  const name = payload[0]?.payload?.name || label;

  return (
    <div className="summaryTooltip">
      <strong>{name}</strong>
      <span>{value}</span>
    </div>
  );
}

async function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function copySvgToClipboard(svgElement) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard de imagem não disponível neste navegador.");
  }

  const bounds = svgElement.getBoundingClientRect();
  const width = Math.ceil(
    bounds.width || Number(svgElement.getAttribute("width")) || 800,
  );
  const height = Math.ceil(
    bounds.height || Number(svgElement.getAttribute("height")) || 320,
  );
  const clone = svgElement.cloneNode(true);

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImageFromUrl(url);
    const scale = Math.min(window.devicePixelRatio || 2, 2);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!pngBlob)
      throw new Error("Não foi possível gerar a imagem do gráfico.");

    const pngDataUrl = await blobToDataUrl(pngBlob);
    const htmlBlob = new Blob(
      [`<img src="${pngDataUrl}" alt="Gráfico do sumário de issues">`],
      { type: "text/html" },
    );
    const textBlob = new Blob(["Gráfico do sumário de issues"], {
      type: "text/plain",
    });

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": pngBlob,
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ]);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SummaryChartFrame({ children, className = "" }) {
  const chartRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState("idle");

  function findChartSvg() {
    const candidates = [...(chartRef.current?.querySelectorAll("svg") || [])]
      .filter((candidate) => !candidate.closest("button"))
      .map((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return {
          element: candidate,
          area: bounds.width * bounds.height,
        };
      })
      .filter((candidate) => candidate.area > 0);

    return (
      candidates.sort((left, right) => right.area - left.area)[0]?.element ||
      null
    );
  }

  async function handleCopy(event) {
    event.stopPropagation();
    const svgElement = findChartSvg();

    if (!svgElement) return;

    setCopyStatus("copying");

    try {
      await copySvgToClipboard(svgElement);
      setCopyStatus("copied");
    } catch (error) {
      console.error(error);
      setCopyStatus("failed");
    } finally {
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  }

  const statusLabel =
    copyStatus === "copied"
      ? "Copiado"
      : copyStatus === "failed"
        ? "Erro"
        : "Copiar";

  return (
    <div
      className={`summaryChartCard summaryCopyChartCard ${className}`.trim()}
      ref={chartRef}
    >
      <button
        className={`summaryChartCopyButton ${copyStatus === "failed" ? "summaryChartCopyError" : ""}`}
        disabled={copyStatus === "copying"}
        onClick={handleCopy}
        title="Copiar gráfico"
        type="button"
      >
        {copyStatus === "copied" ? <Check size={15} /> : <Copy size={15} />}
        <span>{statusLabel}</span>
      </button>
      {children}
    </div>
  );
}
