export function StatWidget({ data }) {
  return (
    <div className="homeStatWidget">
      <strong>{data.value}</strong>
      <span>chamados recebidos</span>
    </div>
  );
}
