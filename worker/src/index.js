import { patchDocument, getDocument, batchGetDocuments, commitWrites, writeUpdate, writeDelete } from "./firestore.js";
import { criarPagamentoPixRifa, consultarPagamento } from "./mercadopago.js";

const TOTAL_NUMEROS = 200;
const EXPIRACAO_MS = 30 * 60 * 1000; // 30 minutos sem pagar libera o número de novo

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

function credenciaisFaltando(env) {
  const faltando = ["MP_ACCESS_TOKEN", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"].filter((k) => !env[k]);
  return faltando.length ? faltando : null;
}

function formatarNumero(n) {
  return String(n).padStart(3, "0");
}

async function handleCriarPix(request, env) {
  const faltando = credenciaisFaltando(env);
  if (faltando) {
    return json({ erro: "Worker ainda não configurado. Faltam os segredos: " + faltando.join(", ") }, 501);
  }

  const body = await request.json();
  const { pedidoId, valor, descricao } = body;

  if (!pedidoId || !valor || valor <= 0 || !descricao) {
    return json({ erro: "Campos obrigatórios: pedidoId, valor, descricao." }, 400);
  }

  const pedido = await getDocument(env, "rifaPedidos/" + pedidoId);
  if (!pedido) return json({ erro: "Pedido não encontrado." }, 404);
  if (pedido.status !== "pendente") return json({ erro: "Pedido já não está mais pendente." }, 409);

  const pagamento = await criarPagamentoPixRifa(env, { pedidoId, valor, descricao });

  await patchDocument(env, "rifaPedidos/" + pedidoId, {
    pixCopiaECola: pagamento.pixCopiaECola,
    pixQrCodeBase64: pagamento.pixQrCodeBase64,
    mpPaymentId: pagamento.id
  });

  return json({ ok: true, pixCopiaECola: pagamento.pixCopiaECola, pixQrCodeBase64: pagamento.pixQrCodeBase64 });
}

async function handleWebhookMercadoPago(request, env) {
  const faltando = credenciaisFaltando(env);
  if (faltando) return json({ erro: "Worker ainda não configurado." }, 501);

  const url = new URL(request.url);
  let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");

  if (!paymentId) {
    const body = await request.json().catch(() => ({}));
    paymentId = body?.data?.id;
  }

  if (!paymentId) return json({ ok: true }); // notificação que não é de pagamento; só confirma recebimento

  // Nunca confia no conteúdo da notificação em si — sempre confirma o status direto na API do Mercado Pago.
  const pagamento = await consultarPagamento(env, paymentId);
  if (pagamento.status !== "approved") return json({ ok: true });

  const pedidoId = pagamento.external_reference;
  if (!pedidoId) return json({ ok: true });

  const pedido = await getDocument(env, "rifaPedidos/" + pedidoId);
  if (!pedido || pedido.status === "pago") return json({ ok: true }); // já processado ou não existe (idempotência)

  const writes = [
    writeUpdate(env, "rifaPedidos/" + pedidoId, { status: "pago", pagoEm: new Date() }),
    ...(pedido.numeros || []).map((n) => writeUpdate(env, "rifaNumeros/" + formatarNumero(n), { status: "pago" }))
  ];
  await commitWrites(env, writes);

  return json({ ok: true });
}

// Roda a cada 10 min: varre os 200 números, libera reservas com mais de 30 min
// sem pagamento (o comprador não terminou/desistiu do Pix) e marca o pedido
// correspondente como expirado.
async function handleScheduled(env) {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return; // Worker ainda não configurado

  const paths = Array.from({ length: TOTAL_NUMEROS }, (_, i) => "rifaNumeros/" + formatarNumero(i + 1));
  const numeros = await batchGetDocuments(env, paths);

  const agora = Date.now();
  const writes = [];
  const pedidosExpirados = new Set();

  for (const [path, dados] of Object.entries(numeros)) {
    if (!dados || dados.status !== "reservado") continue;
    const reservadoEm = new Date(dados.reservadoEm).getTime();
    if (agora - reservadoEm < EXPIRACAO_MS) continue;

    writes.push(writeDelete(env, path));
    if (dados.pedidoId) pedidosExpirados.add(dados.pedidoId);
  }

  for (const pedidoId of pedidosExpirados) {
    const pedido = await getDocument(env, "rifaPedidos/" + pedidoId);
    if (pedido && pedido.status === "pendente") {
      writes.push(writeUpdate(env, "rifaPedidos/" + pedidoId, { status: "expirado" }));
    }
  }

  await commitWrites(env, writes);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);

    try {
      if (pathname === "/criar-pix" && request.method === "POST") {
        return await handleCriarPix(request, env);
      }
      if (pathname === "/webhook-mercadopago" && request.method === "POST") {
        return await handleWebhookMercadoPago(request, env);
      }
      if (pathname === "/" && request.method === "GET") {
        return json({ status: "ok", service: "hosjiujitsu-rifa" });
      }
      return json({ erro: "Rota não encontrada." }, 404);
    } catch (err) {
      return json({ erro: String(err.message || err) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  }
};
