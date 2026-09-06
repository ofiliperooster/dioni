import { apiError, getSupabaseConfig, supabaseRequest } from '@/lib/supabase-server';

type LoginResponse = {
  access_token: string;
  expires_in?: number;
  user: { id: string; email?: string; app_metadata?: { role?: string } };
};

async function ensureInitialAdmin(email: string, password: string) {
  const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialEmail || !initialPassword || email !== initialEmail || password !== initialPassword) return;
  try {
    await supabaseRequest('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role: 'admin' } }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message.includes('already') && !message.includes('registered') && !message.includes('exists')) throw error;
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!email || !password) throw new Error('Informe o e-mail e a senha.');
    await ensureInitialAdmin(email, password);

    const { serviceKey } = getSupabaseConfig();
    const response = await supabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, `Bearer ${serviceKey}`);
    const session = await response.json() as LoginResponse;
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const secure = forwardedProto === 'https' || new URL(request.url).protocol === 'https:';
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', `dioni_access_token=${session.access_token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${session.expires_in || 3600}${secure ? '; Secure' : ''}`);
    return new Response(JSON.stringify({ user: { id: session.user.id, email: session.user.email || email, role: session.user.app_metadata?.role || 'user' } }), { status: 200, headers });
  } catch (error) {
    const response = apiError(error);
    if (response.status === 400) return Response.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    return response;
  }
}
