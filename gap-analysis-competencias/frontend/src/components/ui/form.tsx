import { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-fiori-text">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-fiori-border px-3 py-1.5 text-sm text-fiori-text outline-none focus:border-fiori-primary focus:ring-1 focus:ring-fiori-primary ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-fiori-border bg-fiori-surface px-3 py-1.5 text-sm text-fiori-text outline-none focus:border-fiori-primary focus:ring-1 focus:ring-fiori-primary ${props.className ?? ''}`}
    />
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled }: ButtonProps) {
  const base = 'rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-fiori-primary text-white hover:bg-fiori-primary-hover active:bg-fiori-primary-active'
      : 'border border-fiori-border bg-fiori-surface text-fiori-text hover:bg-fiori-canvas';
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
