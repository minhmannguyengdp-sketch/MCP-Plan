type SummaryPill = {
  label: string;
  value: string | number;
};

type TodaySummaryCardProps = {
  eyebrow: string;
  value: string | number;
  description: string;
  pills?: SummaryPill[];
  tone?: "dark" | "teal";
};

export function TodaySummaryCard({ eyebrow, value, description, pills = [], tone = "dark" }: TodaySummaryCardProps) {
  return (
    <section className={`today-summary-card today-summary-${tone}`}>
      <div className="today-summary-main">
        <span>{eyebrow}</span>
        <h2>{value}</h2>
        <p>{description}</p>
      </div>

      {pills.length > 0 ? (
        <div className="today-summary-pills">
          {pills.map((pill) => (
            <strong key={pill.label}>{pill.value} {pill.label}</strong>
          ))}
        </div>
      ) : null}
    </section>
  );
}
