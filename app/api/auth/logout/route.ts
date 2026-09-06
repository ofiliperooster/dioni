export async function POST(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const secure = forwardedProto === 'https' || new URL(request.url).protocol === 'https:';
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', `dioni_access_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}
