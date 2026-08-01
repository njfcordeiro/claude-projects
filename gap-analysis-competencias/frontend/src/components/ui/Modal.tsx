import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-md bg-fiori-surface shadow-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-fiori-border px-4 py-3">
          <h2 className="text-sm font-semibold text-fiori-text">{title}</h2>
          <button type="button" onClick={onClose} className="text-fiori-text-secondary hover:text-fiori-text" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
