import { KeyboardEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../../api/endpoints';
import { CatalogoCampoDef, CatalogoRegisto } from '../../types/api';
import { Checkbox } from '../ui/form';

export function formatarValorCatalogo(campo: CatalogoCampoDef, registo: CatalogoRegisto): string {
  const bruto = registo[campo.key];
  if (campo.tipo === 'boolean') return bruto ? 'Sim' : 'Não';
  if (campo.tipo === 'relation') return String(registo[`${campo.key}Label`] ?? bruto ?? '—');
  return bruto === null || bruto === undefined || bruto === '' ? '—' : String(bruto);
}

function CampoRelacaoInline({
  campo,
  valorInicial,
  onSalvar,
  onCancelar,
}: {
  campo: CatalogoCampoDef;
  valorInicial: string;
  onSalvar: (v: string) => void;
  onCancelar: () => void;
}) {
  const { data } = useQuery({ queryKey: ['catalogo', campo.relatedTable], queryFn: () => endpoints.catalogoListar(campo.relatedTable!) });
  return (
    <select
      autoFocus
      defaultValue={valorInicial}
      onBlur={onCancelar}
      onChange={(e) => onSalvar(e.target.value)}
      className="w-full rounded border border-fiori-primary bg-fiori-surface px-1 py-0.5 text-sm text-fiori-text outline-none"
    >
      <option value="">— selecionar —</option>
      {(data ?? []).map((opcao) => {
        const v = String(opcao.id ?? '');
        const label = (opcao.nome as string | undefined) ?? v;
        return (
          <option key={v} value={v}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

interface Props {
  campo: CatalogoCampoDef;
  registo: CatalogoRegisto;
  /** Campos de identidade (id/código) ficam sempre só-leitura — mudá-los quebraria a chave usada para gravar a linha. */
  editavel: boolean;
  onSalvar: (novoValor: string | boolean) => Promise<void>;
}

/** Célula "estilo Excel": clique para editar, grava ao sair do campo/Enter, Esc cancela — ver pedido "tabelas editáveis inline". */
export function CatalogoCelula({ campo, registo, editavel, onSalvar }: Props) {
  const [aEditar, setAEditar] = useState(false);
  const [aGravar, setAGravar] = useState(false);

  if (!editavel) {
    return <span className="text-fiori-text-secondary">{formatarValorCatalogo(campo, registo)}</span>;
  }

  if (campo.tipo === 'boolean') {
    return (
      <Checkbox
        checked={Boolean(registo[campo.key])}
        disabled={aGravar}
        onChange={async (e) => {
          setAGravar(true);
          await onSalvar(e.target.checked);
          setAGravar(false);
        }}
      />
    );
  }

  if (!aEditar) {
    return (
      <button
        type="button"
        onClick={() => setAEditar(true)}
        className="block w-full rounded px-1.5 py-0.5 text-left hover:bg-fiori-primary-bg"
        title="Clique para editar"
      >
        {formatarValorCatalogo(campo, registo)}
      </button>
    );
  }

  if (campo.tipo === 'relation') {
    return (
      <CampoRelacaoInline
        campo={campo}
        valorInicial={String(registo[campo.key] ?? '')}
        onSalvar={async (v) => {
          setAEditar(false);
          await onSalvar(v);
        }}
        onCancelar={() => setAEditar(false)}
      />
    );
  }

  const valorAtual = registo[campo.key] === null || registo[campo.key] === undefined ? '' : String(registo[campo.key]);

  async function confirmar(e: React.FocusEvent<HTMLInputElement>) {
    const novoValor = e.target.value;
    setAEditar(false);
    if (novoValor !== valorAtual) await onSalvar(novoValor);
  }

  return (
    <input
      autoFocus
      defaultValue={valorAtual}
      type={campo.tipo === 'int' ? 'number' : 'text'}
      className="w-full rounded border border-fiori-primary px-1.5 py-0.5 text-sm text-fiori-text outline-none"
      onBlur={confirmar}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setAEditar(false);
      }}
    />
  );
}
