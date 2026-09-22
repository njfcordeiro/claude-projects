import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../../api/endpoints';
import { FiltrosOrganizacionais } from '../../types/api';
import { Field, Select } from '../ui/form';

interface Props {
  filtros: FiltrosOrganizacionais;
  onChange: (filtros: FiltrosOrganizacionais) => void;
}

/**
 * Filtros organizacionais (Direção/Área/Núcleo/Cargo) — mesmo padrão já
 * usado noutros ecrãs de colaboradores (Skill Matrix, Atribuição em Massa,
 * Colaboradores) — pedido do utilizador: "filtros que já são usados para
 * colaboradores noutros ecrãs".
 */
export function FiltrosOrganizacao({ filtros, onChange }: Props) {
  const { data: direcoes } = useQuery({ queryKey: ['catalogo', 'direcoes'], queryFn: () => endpoints.catalogoListar('direcoes') });
  const { data: areas } = useQuery({ queryKey: ['catalogo', 'areas'], queryFn: () => endpoints.catalogoListar('areas') });
  const { data: nucleos } = useQuery({ queryKey: ['catalogo', 'nucleos'], queryFn: () => endpoints.catalogoListar('nucleos') });
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="Direção">
        <Select
          value={filtros.direcaoId ? String(filtros.direcaoId) : ''}
          onChange={(e) => onChange({ ...filtros, direcaoId: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todas</option>
          {(direcoes ?? []).map((d) => (
            <option key={String(d.id)} value={String(d.id)}>
              {String(d.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Área">
        <Select
          value={filtros.areaId ? String(filtros.areaId) : ''}
          onChange={(e) => onChange({ ...filtros, areaId: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todas</option>
          {(areas ?? []).map((a) => (
            <option key={String(a.id)} value={String(a.id)}>
              {String(a.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Núcleo">
        <Select
          value={filtros.nucleoId ? String(filtros.nucleoId) : ''}
          onChange={(e) => onChange({ ...filtros, nucleoId: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todos</option>
          {(nucleos ?? []).map((n) => (
            <option key={String(n.id)} value={String(n.id)}>
              {String(n.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Cargo">
        <Select value={filtros.cargoId ?? ''} onChange={(e) => onChange({ ...filtros, cargoId: e.target.value || undefined })}>
          <option value="">Todos</option>
          {(cargos ?? []).map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {String(c.nome)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
