import { apiError, requireUser, supabaseRequest } from '@/lib/supabase-server';

const BUCKET = 'dioni-documentos';
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const allowedTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type DocumentRow = {
  id: string;
  cliente_id: string;
  nome_original: string;
  caminho_storage: string;
  tipo_mime: string;
  tamanho: number;
  created_at: string;
};

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function serialize(row: DocumentRow) {
  return { id: row.id, clientId: row.cliente_id, name: row.nome_original, mimeType: row.tipo_mime, size: row.tamanho, createdAt: row.created_at };
}

async function findDocument(id: string) {
  const response = await supabaseRequest(`/rest/v1/dioni_documentos?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const rows = await response.json() as DocumentRow[];
  if (!rows[0]) throw new Error('Documento não encontrado.');
  return rows[0];
}

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || '';
    if (id) {
      if (!validUuid(id)) throw new Error('Documento inválido.');
      const document = await findDocument(id);
      const object = await supabaseRequest(`/storage/v1/object/authenticated/${BUCKET}/${document.caminho_storage}`);
      const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
      return new Response(object.body, {
        headers: {
          'Content-Type': document.tipo_mime,
          'Content-Length': String(document.tamanho),
          'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(document.nome_original)}`,
          'Cache-Control': 'private, max-age=60',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const clientId = url.searchParams.get('clienteId') || '';
    if (!validUuid(clientId)) throw new Error('Cliente inválido.');
    const response = await supabaseRequest(`/rest/v1/dioni_documentos?cliente_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`);
    const rows = await response.json() as DocumentRow[];
    return Response.json({ documents: rows.map(serialize) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  let storagePath = '';
  try {
    await requireUser(request);
    const form = await request.formData();
    const clientIdValue = form.get('clienteId');
    const clientId = typeof clientIdValue === 'string' ? clientIdValue : '';
    const file = form.get('file');
    if (!validUuid(clientId)) throw new Error('Cliente inválido.');
    if (!(file instanceof File) || file.size === 0) throw new Error('Selecione um documento.');
    if (file.size > MAX_FILE_SIZE) throw new Error('O arquivo deve ter no máximo 15 MB.');
    if (!allowedTypes.has(file.type)) throw new Error('Envie um arquivo PDF, imagem, DOC ou DOCX.');

    const clientResponse = await supabaseRequest(`/rest/v1/dioni_clientes?id=eq.${encodeURIComponent(clientId)}&select=id&limit=1`);
    const clients = await clientResponse.json() as Array<{ id: string }>;
    if (!clients[0]) throw new Error('Cliente não encontrado.');

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'documento';
    storagePath = `${clientId}/${crypto.randomUUID()}-${cleanName}`;
    await supabaseRequest(`/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
      body: await file.arrayBuffer(),
    });

    const metadataResponse = await supabaseRequest('/rest/v1/dioni_documentos', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ cliente_id: clientId, nome_original: file.name, caminho_storage: storagePath, tipo_mime: file.type, tamanho: file.size }),
    });
    const rows = await metadataResponse.json() as DocumentRow[];
    return Response.json({ document: serialize(rows[0]) }, { status: 201 });
  } catch (error) {
    if (storagePath) await supabaseRequest(`/storage/v1/object/${BUCKET}/${storagePath}`, { method: 'DELETE' }).catch(() => undefined);
    return apiError(error);
  }
}
