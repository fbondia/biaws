import { useEffect, useState } from "react";

export function MarkdownAttachmentImage({ alt, attachment, onLoadAttachment }) {
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    Promise.resolve()
      .then(() => onLoadAttachment(attachment))
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ attachment, objectUrl });
      })
      .catch(() => {
        if (active) setLoaded({ attachment, error: true });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, onLoadAttachment]);

  const current = loaded?.attachment === attachment ? loaded : null;
  return (
    <span className="markdownAttachmentImage">
      {current?.error ? (
        <span className="markdownAttachmentImageStatus" role="status">
          Imagem indisponível: {attachment.filename}
        </span>
      ) : current?.objectUrl ? (
        <img
          alt={alt || attachment.filename || "Imagem"}
          loading="lazy"
          onError={() => setLoaded({ attachment, error: true })}
          src={current.objectUrl}
        />
      ) : (
        <span className="markdownAttachmentImageStatus" role="status">
          Carregando imagem: {attachment.filename}
        </span>
      )}
    </span>
  );
}
