import {
  ChangeEvent,
  Children,
  InputHTMLAttributes,
  isValidElement,
  KeyboardEvent,
  LabelHTMLAttributes,
  MouseEventHandler,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      {...props}
      className={`h-4 w-4 rounded border-fiori-border text-fiori-primary focus:ring-1 focus:ring-fiori-primary ${props.className ?? ''}`}
    />
  );
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Reduz acentos e caixa para uma comparação de texto tolerante ("Arch" encontra "Arquiteto"/"Architect"). */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase();
}

function textoDeChildren(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textoDeChildren).join('');
  if (isValidElement(node)) return textoDeChildren((node.props as { children?: ReactNode }).children);
  return '';
}

/** Lê as opções de uma lista de `<option>` filhas — a mesma API de children que um `<select>` nativo. */
function extrairOpcoes(children: ReactNode): SelectOption[] {
  const opcoes: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== 'option') return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    opcoes.push({
      value: props.value === undefined ? '' : String(props.value),
      label: textoDeChildren(props.children).trim().replace(/\s+/g, ' '),
      disabled: props.disabled,
    });
  });
  return opcoes;
}

interface SelectProps {
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  required?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  name?: string;
  id?: string;
  children?: ReactNode;
}

/**
 * Combobox pesquisável, com a mesma API de um `<select>` nativo (value/onChange/children
 * de `<option>`) — pedido do utilizador: em todos os campos de lista de opções, escrever
 * texto deve ir reduzindo as opções apresentadas (ex.: "Arch" mostra só as que contêm
 * "Architect"). Por ser um substituto direto de `Select`, nenhum dos ecrãs que o usam
 * precisou de ser alterado.
 */
export function Select({ value, onChange, disabled, autoFocus, className, onClick, name, id, children }: SelectProps) {
  const opcoes = useMemo(() => extrairOpcoes(children), [children]);
  const valorAtual = value === undefined || value === null ? '' : String(value);
  const selecionada = opcoes.find((o) => o.value === valorAtual);

  const [aberto, setAberto] = useState(false);
  const [query, setQuery] = useState('');
  const [destaque, setDestaque] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const filtradas = useMemo(() => {
    if (!query.trim()) return opcoes;
    const alvo = normalizar(query);
    return opcoes.filter((o) => normalizar(o.label).includes(alvo));
  }, [opcoes, query]);

  useEffect(() => {
    setDestaque(0);
  }, [filtradas.length, aberto]);

  function escolher(opcao: SelectOption) {
    if (opcao.disabled) return;
    setAberto(false);
    setQuery('');
    if (opcao.value !== valorAtual) {
      const evento = { target: { value: opcao.value } } as unknown as ChangeEvent<HTMLSelectElement>;
      onChange?.(evento);
    }
    inputRef.current?.blur();
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!aberto) setAberto(true);
      else setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberto) setAberto(true);
      else setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === 'Enter') {
      if (aberto) {
        e.preventDefault();
        const opcao = filtradas[destaque];
        if (opcao) escolher(opcao);
      }
    } else if (e.key === 'Escape') {
      if (aberto) {
        e.preventDefault();
        setAberto(false);
        setQuery('');
      }
    } else if (e.key === 'Tab') {
      setAberto(false);
      setQuery('');
    }
  }

  const textoMostrado = aberto ? query : (selecionada?.label ?? '');

  return (
    <div className={`relative ${className ?? ''}`} ref={containerRef} onClick={onClick}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        autoFocus={autoFocus}
        name={name}
        id={id}
        value={textoMostrado}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!aberto) setAberto(true);
        }}
        onKeyDown={aoTeclar}
        className="w-full rounded border border-fiori-border bg-fiori-surface px-3 py-1.5 text-sm text-fiori-text outline-none focus:border-fiori-primary focus:ring-1 focus:ring-fiori-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      {aberto && !disabled && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded border border-fiori-border bg-fiori-surface py-1 text-sm shadow-fiori"
        >
          {filtradas.length === 0 && <li className="px-3 py-1.5 text-fiori-text-secondary">Sem resultados.</li>}
          {filtradas.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === valorAtual}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(o)}
              onMouseEnter={() => setDestaque(i)}
              className={`cursor-pointer px-3 py-1.5 ${o.disabled ? 'cursor-not-allowed opacity-50' : ''} ${
                i === destaque ? 'bg-fiori-primary text-white' : 'text-fiori-text'
              } ${o.value === valorAtual && i !== destaque ? 'font-medium' : ''}`}
            >
              {o.label || ' '}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  title?: string;
}

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled, title }: ButtonProps) {
  const base = 'rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-fiori-primary text-white hover:bg-fiori-primary-hover active:bg-fiori-primary-active'
      : 'border border-fiori-border bg-fiori-surface text-fiori-text hover:bg-fiori-canvas';
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
