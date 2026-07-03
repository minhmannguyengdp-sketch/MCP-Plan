import type { ReactNode } from "react";

type BottomSheetProps = {
  title: string;
  description?: string;
  open?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheet({ title, description, open = false, children, footer }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation">
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="sheet-close" type="button" aria-label="Dong">
            ×
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
