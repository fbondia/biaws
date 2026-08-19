import DemandTaskStatus from "./task-status.js";

export default class DemandCompleteTask extends DemandTaskStatus {
  static description = "conclui uma tarefa de uma melhoria";
  static defaultStatus = "Concluído";
}
