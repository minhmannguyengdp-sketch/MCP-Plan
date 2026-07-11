import type { ReactNode } from "react";

type OperationalAction = {
  label: string;
  tone?: "primary" | "secondary";
  onClick?: () => void;
  href?: string;
};

type OperationalListCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  leading?: ReactNode;
  meta?: string[];
  actions?: OperationalAction[];
  actionContent?: ReactNode;
};

export function OperationalListCard({ eyebrow, title, description, badge, leading, meta = [], actions = [], actionContent }: OperationalListCardProps) {
  return (
    <article className="operational-list-card">
      {leading ? <div className="operational-list-leading">{leading}</div> : null}
      <div className="operational-list-body">
        <div className="operational-list-head">
          <div className="operational-list-title-wrap">
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h3>{title}</h3>
          </div>
          {badge ? <div className="operational-list-badge">{badge}</div> : null}
        </div>
        {description ? <p>{description}</p> : null}
        {meta.length > 0 ? <div className="operational-list-meta">{meta.slice(0, 3).map((item) => <small key={item}>{item}</small>)}</div> : null}
      </div>
      {actions.length > 0 || actionContent ? <div className="operational-list-actions">{actions.map((action) => {
        const className = action.tone === "primary" ? "button primary" : "button";
        if (action.href) return <a className={className} href={action.href} key={action.label}>{action.label}</a>;
        return <button className={className} key={action.label} type="button" onClick={action.onClick}>{action.label}</button>;
      })}{actionContent}</div> : null}
    </article>
  );
}
