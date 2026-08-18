import DemandTaskStatus from "./task-status.js";

export default class DemandCompleteTask extends DemandTaskStatus {
  static description = "Conclui uma tarefa de uma melhoria";
  static defaultStatus = "Concluído";
}
