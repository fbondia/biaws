import { replicateSkill } from "../../../../api.js";
import { ReplicationDialog } from "../../../shared/ReplicationDialog.jsx";

export function SkillReplicationDialog({
  currentWorkspaceId,
  onClose,
  open,
  skillId,
  version,
  workspaces,
}) {
  return (
    <ReplicationDialog
      currentWorkspaceId={currentWorkspaceId}
      description={
        <p>
          A versão e todos os arquivos serão publicados nos destinos. Cada cópia
          será criada na raiz, sem coleção, status ou datas da origem. Uma
          versão já existente não será sobrescrita.
        </p>
      }
      eyebrow={`${skillId}@${version}`}
      onClose={onClose}
      onReplicate={(destinationWorkspaceIds) =>
        replicateSkill(skillId, version, destinationWorkspaceIds)
      }
      open={open}
      resourceKey={`${skillId}@${version}`}
      title="Replicar skill"
      workspaces={workspaces}
    />
  );
}
