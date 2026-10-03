import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MarkdownAttachmentLink({ attachment, children, onLoadAttachment }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);
  const activeRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  async function download() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setDownloading(true);
    setError(false);
    try {
      const blob = await onLoadAttachment(attachment);
      if (!activeRef.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = attachment.filename || "anexo";
        document.body.append(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      if (activeRef.current) setError(true);
    } finally {
      pendingRef.current = false;
      if (activeRef.current) setDownloading(false);
    }
  }

  return (
    <span>
      <button
        aria-busy={downloading}
        className="markdownAttachmentLink"
        disabled={downloading}
        onClick={download}
        title={`Baixar ${attachment.filename || "anexo"}`}
        type="button"
      >
        <Download aria-hidden="true" size={14} />
        {children || attachment.filename || "Anexo"}
      </button>
      {error ? (
        <span className="markdownAttachmentImageStatus" role="status">
          Não foi possível baixar {attachment.filename || "o anexo"}. Tente novamente.
        </span>
      ) : null}
    </span>
  );
}
