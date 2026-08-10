export function BreakdownWidget({ data }) {
  const maximum = Math.max(1, ...(data.items || []).map(({ value }) => value));

  if (!data.items?.length) {
    return <div className="homeWidgetEmpty">Nenhum chamado aberto.</div>;
  }

  return (
    <div className="homeBreakdown">
      {data.items.map((item) => (
        <div className="homeBreakdownRow" key={item.key}>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <span className="homeBreakdownTrack">
            <span style={{ width: `${(item.value / maximum) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
