const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Corpo completo da resposta de erro — em conflitos 409 (locking otimista) traz `current`, o estado atual no servidor. */
    public body?: unknown,
  ) {
    super(message);
  }
}

let authToken: string | null = null;

/** Chamado pelo AuthContext quando o token muda (login/logout). */
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Um handler do Nest que devolve `null`/`undefined` (ex.: "sem
  // avaliação ainda") manda um corpo HTTP genuinemente vazio (Content-Length: 0),
  // não a string "null" — res.json() rebenta nesse caso. Ler sempre como
  // texto primeiro e só fazer parse se houver alguma coisa evita um
  // SyntaxError não tratado que ficava a promise pendente para sempre do
  // lado de quem chamou (foi assim que apanhei isto — ver
  // docs/02-arquitetura-tecnica.md secção 4.5).
  const texto = await res.text();

  if (!res.ok) {
    const body = texto ? JSON.parse(texto) : {};
    throw new ApiError(res.status, body.message ?? `Erro ${res.status}`, body);
  }
  if (!texto) return null as T;
  return JSON.parse(texto) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
};
