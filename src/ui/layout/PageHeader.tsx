type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div>{children}</div> : null}
    </header>
  );
}
