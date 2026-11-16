import { toBlob } from "html-to-image";

const PADDING = 24;
const MAX_SIDE = 8192;
const MAX_PIXELS = 12_000_000;

function diagramBounds(viewport) {
  const viewportRect = viewport.getBoundingClientRect();
  const { a: zoom } = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
  const rectangles = Array.from(
    viewport.querySelectorAll(".react-flow__node, .react-flow__edge-path, .react-flow__edge-textwrapper"),
    (element) => element.getBoundingClientRect(),
  );

  // Convert rendered bounds back to diagram coordinates, including edge paths and labels.
  const left = (Math.min(...rectangles.map((rect) => rect.left)) - viewportRect.left) / zoom;
  const top = (Math.min(...rectangles.map((rect) => rect.top)) - viewportRect.top) / zoom;
  const right = (Math.max(...rectangles.map((rect) => rect.right)) - viewportRect.left) / zoom;
  const bottom = (Math.max(...rectangles.map((rect) => rect.bottom)) - viewportRect.top) / zoom;
  return { x: left - PADDING, y: top - PADDING, width: right - left + 2 * PADDING, height: bottom - top + 2 * PADDING };
}

function pngFilename(name, environment) {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return `${slug || "topologia"}-${environment}.png`;
}

export async function downloadTopologyPng(flow, name, environment) {
  const viewport = flow?.querySelector(".react-flow__viewport");
  if (!viewport?.querySelector(".react-flow__node")) throw new Error("Diagrama vazio.");

  const { x, y, width, height } = diagramBounds(viewport);
  // Reduce the resolution of large diagrams to keep the whole image within canvas limits.
  const scale = Math.min(2, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  const png = await toBlob(viewport, {
    backgroundColor: getComputedStyle(flow).backgroundColor,
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
    pixelRatio: 1,
    style: { transform: `translate(${-x * scale}px, ${-y * scale}px) scale(${scale})` },
    filter: (node) => !node.matches?.(".react-flow__connection, .topologyNodeHandle"),
  });
  if (!png?.size) throw new Error("Imagem da topologia vazia.");

  const url = URL.createObjectURL(png);
  const link = document.createElement("a");
  link.href = url;
  link.download = pngFilename(name, environment);
  try {
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
