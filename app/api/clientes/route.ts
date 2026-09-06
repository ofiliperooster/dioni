type ClientStatus = 'Pagando' | 'Quitado' | 'Cancelado';

type ClientRow = {
  id: string;
  nome: string;
  documento: string;
  data_nascimento: string;
  endereco: string;
  dia_vencimento: number;
  status: ClientStatus;
};

const statuses = new Set<ClientStatus>(['Pagando', 'Quitado', 'Cancelado']);

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Conexão com o Supabase ainda não configurada.');
  return { url, key };
}

async function supabase(path: string, init: RequestInit = {}) {
  const { url, key } = getConfig();
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({})) as { message?: string; details?: string };
    throw new Error(details.message || details.details || `Supabase respondeu com status ${response.status}.`);
  }
  return response;
}

function serialize(row: ClientRow) {
  return { id: row.id, name: row.nome, document: row.documento, birthDate: row.data_nascimento, address: row.endereco, dueDay: String(row.dia_vencimento), status: row.status };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Erro inesperado ao acessar os cadastros.';
  return Response.json({ error: message }, { status: message.includes('não configurada') ? 503 : 400 });
}

export async function GET() {
  try {
    const response = await supabase('dioni_clientes?select=id,nome,documento,data_nascimento,endereco,dia_vencimento,status&order=created_at.desc');
    const rows = await response.json() as ClientRow[];
    return Response.json({ clients: rows.map(serialize) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    const name = text(input.name).trim();
    const address = text(input.address).trim();
    const birthDate = text(input.birthDate);
    const document = text(input.document).replace(/\D/g, '');
    const dueDay = Number(input.dueDay);
    const status = text(input.status) as ClientStatus;
    if (!name || !address || !birthDate) throw new Error('Preencha todos os campos obrigatórios.');
    if (document.length !== 11 && document.length !== 14) throw new Error('Informe um CPF ou CNPJ válido.');
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error('Informe um dia de vencimento entre 1 e 31.');
    if (!statuses.has(status)) throw new Error('Selecione um status válido.');

    const response = await supabase('dioni_clientes', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ nome: name, documento: document, data_nascimento: birthDate, endereco: address, dia_vencimento: dueDay, status }),
    });
    const rows = await response.json() as ClientRow[];
    return Response.json({ client: serialize(rows[0]) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const input = await request.json() as { id?: string };
    if (!input.id || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error('Cadastro inválido.');
    await supabase(`dioni_clientes?id=eq.${encodeURIComponent(input.id)}`, { method: 'DELETE' });
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
