import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** "Tile" Fiori: fundo branco, sombra subtil, cantos ligeiramente arredondados. */
export function Card({ title, action, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-md border border-fiori-border bg-fiori-surface shadow-fiori ${className}`}>
      {title && (
        <div className="flex flex-col gap-2 border-b border-fiori-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-fiori-text">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
