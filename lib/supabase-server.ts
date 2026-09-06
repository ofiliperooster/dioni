type SupabaseUser = {
  id: string;
  email?: string;
  app_metadata?: { role?: string; app_id?: string };
  created_at?: string;
};

export const DIONI_APP_ID = 'dioni';

export function getSupabaseConfig() {
  const url = (process.env.SUPABASE_INTERNAL_URL || process.env.SUPABASE_URL)?.replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error('Conexão com o Supabase ainda não configurada.');
  return { url, serviceKey };
}

export async function supabaseRequest(path: string, init: RequestInit = {}, authorization?: string) {
  const { url, serviceKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set('apikey', serviceKey);
  headers.set('Authorization', authorization || `Bearer ${serviceKey}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${url}${path}`, { ...init, headers });
  if (!response.ok) {
    const details = await response.json().catch(() => ({})) as { message?: string; msg?: string; error_description?: string; details?: string };
    throw new Error(details.message || details.msg || details.error_description || details.details || `Supabase respondeu com status ${response.status}.`);
  }
  return response;
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

export async function requireUser(request: Request) {
  const token = readCookie(request, 'dioni_access_token');
  if (!token) throw new Error('Sessão expirada. Entre novamente.');
  const response = await supabaseRequest('/auth/v1/user', { method: 'GET' }, `Bearer ${token}`);
  const user = await response.json() as SupabaseUser;
  if (user.app_metadata?.app_id !== DIONI_APP_ID) throw new Error('Este usuário não pertence ao sistema Dioni.');
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (user.app_metadata?.role !== 'admin') throw new Error('Apenas administradores podem gerenciar usuários.');
  return user;
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Erro inesperado.';
  const unauthorized = message.includes('Sessão expirada') || message.includes('não pertence') || message.includes('token') || message.includes('JWT');
  const forbidden = message.includes('Apenas administradores');
  const unavailable = message.includes('não configurada');
  return Response.json({ error: message }, { status: unauthorized ? 401 : forbidden ? 403 : unavailable ? 503 : 400 });
}

export type { SupabaseUser };
