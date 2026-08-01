import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { CatalogoCampoDef, CatalogoRegisto, CatalogoTabelaMeta } from '../../types/api';
import { Modal } from '../ui/Modal';
import { Button, Checkbox, Field, Input, Select } from '../ui/form';

interface Props {
  tabelaDef: CatalogoTabelaMeta;
  /** null = criar; caso contrário, edita este registo (campos de identidade ficam bloqueados). */
  registoInicial: CatalogoRegisto | null;
  onClose: () => void;
}

function valorInicial(campo: CatalogoCampoDef, registo: CatalogoRegisto | null): string | boolean {
  const bruto = registo?.[campo.key];
  if (campo.tipo === 'boolean') return bruto === true;
  return bruto === null || bruto === undefined ? '' : String(bruto);
}

/** Campo de relação: <select> com opções vindas de `catalogoListar(relatedTable)` — reutiliza o próprio endpoint genérico. */
function CampoRelacao({
  campo,
  valor,
  disabled,
  onChange,
}: {
  campo: CatalogoCampoDef;
  valor: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ['catalogo', campo.relatedTable],
    queryFn: () => endpoints.catalogoListar(campo.relatedTable!),
  });
  const identidade = data ?? [];

  return (
    <Select value={valor} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={campo.obrigatorio}>
      <option value="">— selecionar —</option>
      {identidade.map((opcao) => {
        const valorOpcao = String(opcao.id ?? '');
        const label = (opcao.nome as string | undefined) ?? valorOpcao;
        return (
          <option key={valorOpcao} value={valorOpcao}>
            {label} {valorOpcao !== label ? `(${valorOpcao})` : ''}
          </option>
        );
      })}
    </Select>
  );
}

export function CatalogoRecordModal({ tabelaDef, registoInicial, onClose }: Props) {
  const queryClient = useQueryClient();
  const aEditar = registoInicial !== null;
  const [valores, setValores] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(tabelaDef.campos.map((c) => [c.key, valorInicial(c, registoInicial)])),
  );
  const [erro, setErro] = useState<string | null>(null);

  const gravar = useMutation({
    mutationFn: () => {
      const dados: CatalogoRegisto = {};
      for (const c of tabelaDef.campos) {
        const v = valores[c.key];
        if (c.tipo === 'boolean') {
          dados[c.key] = Boolean(v);
        } else if (v === '') {
          dados[c.key] = null;
        } else {
          dados[c.key] = v as string;
        }
      }
      return aEditar ? endpoints.catalogoAtualizar(tabelaDef.tabela, dados) : endpoints.catalogoCriar(tabelaDef.tabela, dados);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', tabelaDef.tabela] });
      onClose();
    },
    onError: (err) => setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    gravar.mutate();
  }

  return (
    <Modal title={`${aEditar ? 'Editar' : 'Nova entrada'} — ${tabelaDef.label}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {tabelaDef.campos.map((c) => {
          const disabled = aEditar && tabelaDef.identityFields.includes(c.key);
          return (
            <Field key={c.key} label={c.label + (c.obrigatorio ? ' *' : '')}>
              {c.tipo === 'boolean' ? (
                <Checkbox checked={Boolean(valores[c.key])} onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.checked }))} disabled={disabled} />
              ) : c.tipo === 'relation' ? (
                <CampoRelacao
                  campo={c}
                  valor={String(valores[c.key] ?? '')}
                  disabled={disabled}
                  onChange={(val) => setValores((v) => ({ ...v, [c.key]: val }))}
                />
              ) : (
                <Input
                  type={c.tipo === 'int' ? 'number' : 'text'}
                  value={String(valores[c.key] ?? '')}
                  onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                  disabled={disabled}
                  required={c.obrigatorio}
                />
              )}
            </Field>
          );
        })}

        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={gravar.isPending}>
            {gravar.isPending ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
