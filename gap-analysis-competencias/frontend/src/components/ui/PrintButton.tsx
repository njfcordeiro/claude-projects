import { Printer } from 'lucide-react';
import { Button } from './form';

/** Botão de impressão/PDF reutilizável — usa window.print() + o print stylesheet global (ver index.css @media print). */
export function PrintButton({ label = 'Imprimir / PDF' }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <span className="flex items-center gap-1.5">
        <Printer size={14} /> {label}
      </span>
    </Button>
  );
}
