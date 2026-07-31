import { ReactNode } from 'react';

/** Etiqueta neutra para atributos (não é um estado — usar Badge para isso). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-fiori-canvas px-1.5 py-0.5 text-xs font-medium text-fiori-text-secondary">
      {children}
    </span>
  );
}
