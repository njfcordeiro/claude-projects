import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Plus } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { PapelUtilizador, UsuarioResumo } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Button, Field, Input, Select } from '../components/ui/form';

const PAPEIS: PapelUtilizador[] = ['ADMIN_RH', 'MANAGER', 'EMPLOYEE', 'VIEWER'];

function papelBadgeStatus(role: PapelUtilizador) {
  return role === 'ADMIN_RH' ? 'info' : role === 'VIEWER' ? 'neutral' : 'success';
}

/** Gestão de utilizadores/permissões — ADMIN_RH only (backend RolesGuard reforça isto). */
export function AdminPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['users'], queryFn: endpoints.users });
  const [modalAberto, setModalAberto] = useState(false);
  const [senhaReinicializada, setSenhaReinicializada] = useState<{ email: string; senha: string } | null>(null);

  const atualizarPapel = useMutation({
    mutationFn: ({ id, role }: { id: number; role: PapelUtilizador }) => endpoints.updateUser(id, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => endpoints.updateUser(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const reinicializarPassword = useMutation({
    mutationFn: (u: UsuarioResumo) => endpoints.reinicializarPasswordUtilizador(u.id).then((r) => ({ email: u.email, senha: r.senhaTemporaria })),
    onSuccess: (resultado) => setSenhaReinicializada(resultado),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível reinicializar a password.'),
  });

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar os utilizadores.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Administração</h1>
          <p className="text-sm text-fiori-text-secondary">Gestão de utilizadores e permissões.</p>
        </div>
        <Button onClick={() => setModalAberto(true)}>
          <span className="flex items-center gap-1.5">
            <Plus size={15} /> Criar utilizador
          </span>
        </Button>
      </div>

      <Card>
        <DataTable
          data={data ?? []}
          getRowKey={(u) => u.id}
          searchPlaceholder="Pesquisar por email…"
          columns={[
            { key: 'email', header: 'Email', render: (u) => u.email, sortValue: (u) => u.email },
            {
              key: 'colaborador',
              header: 'Colaborador ligado',
              render: (u) => u.colaborador?.nome ?? '—',
            },
            {
              key: 'role',
              header: 'Papel',
              render: (u) => (
                <Select
                  value={u.role}
                  onChange={(e) => atualizarPapel.mutate({ id: u.id, role: e.target.value as PapelUtilizador })}
                  onClick={(e) => e.stopPropagation()}
                  className="!w-auto"
                >
                  {PAPEIS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              ),
              searchValue: (u) => u.role,
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (u) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    alternarAtivo.mutate({ id: u.id, isActive: !u.isActive });
                  }}
                >
                  {u.isActive ? <Badge status="success">Ativo</Badge> : <Badge status="neutral">Inativo</Badge>}
                </button>
              ),
            },
            {
              key: 'ultimoLogin',
              header: 'Último login',
              render: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pt-PT') : 'Nunca'),
            },
            {
              key: '__acoes',
              header: '',
              render: (u) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Reinicializar a password de ${u.email}? A password atual deixa de funcionar imediatamente.`)) {
                      reinicializarPassword.mutate(u);
                    }
                  }}
                  className="no-print flex items-center gap-1 text-xs font-medium text-fiori-text-secondary hover:text-fiori-primary"
                  title="Reinicializar password"
                >
                  <KeyRound size={14} /> Reinicializar password
                </button>
              ),
            },
          ]}
        />
      </Card>

      {modalAberto && <CriarUtilizadorModal onClose={() => setModalAberto(false)} />}
      {senhaReinicializada && (
        <SenhaReinicializadaModal
          email={senhaReinicializada.email}
          senha={senhaReinicializada.senha}
          onClose={() => setSenhaReinicializada(null)}
        />
      )}
    </div>
  );
}

function SenhaReinicializadaModal({ email, senha, onClose }: { email: string; senha: string; onClose: () => void }) {
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(senha);
    setCopiada(true);
    setTimeout(() => setCopiada(false), 2000);
  }

  return (
    <Modal title="Password reinicializada" onClose={onClose}>
      <p className="mb-3 text-sm text-fiori-text-secondary">
        Nova password temporária para <strong className="text-fiori-text">{email}</strong>. Esta password só é mostrada
        agora — copia-a e partilha-a com o utilizador por um canal seguro (não há envio automático de email nesta app).
      </p>
      <div className="mb-4 flex items-center gap-2 rounded border border-fiori-border bg-fiori-canvas p-3">
        <code className="flex-1 font-mono text-base font-semibold text-fiori-text">{senha}</code>
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1 rounded border border-fiori-border bg-fiori-surface px-2 py-1 text-xs font-medium text-fiori-text hover:bg-fiori-canvas"
        >
          {copiada ? <Check size={13} className="text-fiori-success" /> : <Copy size={13} />}
          {copiada ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  );
}

function CriarUtilizadorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PapelUtilizador>('EMPLOYEE');
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: () => endpoints.createUser({ email, password, role }),
    onSuccess: (novo: UsuarioResumo) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      // eslint-disable-next-line no-console
      console.info('Utilizador criado:', novo.email);
    },
    onError: (err) => setErro(err instanceof ApiError ? err.message : 'Não foi possível criar o utilizador.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    criar.mutate();
  }

  return (
    <Modal title="Criar utilizador" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password (mínimo 8 caracteres)">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </Field>
        <Field label="Papel">
          <Select value={role} onChange={(e) => setRole(e.target.value as PapelUtilizador)}>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? 'A criar…' : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
