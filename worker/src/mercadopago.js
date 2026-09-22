// Cliente mínimo da API do Mercado Pago (Pix) — usado tanto pela rifa quanto pelas doações livres.

// Divide um nome completo em primeiro/último nome — o Mercado Pago pontua a
// qualidade da integração por enviar "payer.last_name" separado, mas nosso
// formulário só coleta o nome completo numa caixa só.
function dividirNome(nomeCompleto) {
  const partes = (nomeCompleto || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { primeiro: "", ultimo: "" };
  if (partes.length === 1) return { primeiro: partes[0], ultimo: partes[0] };
  return { primeiro: partes[0], ultimo: partes.slice(1).join(" ") };
}

async function criarPagamentoPix(env, { referenciaId, valor, descricao, deviceId, nomeComprador, statementDescriptor }) {
  const headers = {
    Authorization: "Bearer " + env.MP_ACCESS_TOKEN,
    "Content-Type": "application/json",
    // Evita cobrar duas vezes se o visitante clicar duas vezes sem querer.
    "X-Idempotency-Key": referenciaId
  };
  // ID do dispositivo (gerado pelo security.js do Mercado Pago no navegador do
  // comprador) — exigido pelo antifraude deles pra aprovar a criação do Pix;
  // sem isso o PolicyAgent bloqueia com PA_UNAUTHORIZED_RESULT_FROM_POLICIES.
  if (deviceId) headers["X-meli-session-id"] = deviceId;

  const { primeiro, ultimo } = dividirNome(nomeComprador);

  const resp = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers,
    body: JSON.stringify({
      transaction_amount: valor,
      description: descricao,
      payment_method_id: "pix",
      external_reference: referenciaId,
      statement_descriptor: statementDescriptor,
      // Campos abaixo não afetam o Pix em si, mas melhoram a "Qualidade da
      // integração" no painel do Mercado Pago (reduz risco de bloqueio antifraude).
      payer: {
        email: "hos+" + referenciaId + "@hosjiujitsu.vercel.app", // MP exige e-mail do pagador; não coletamos e-mail de quem compra/doa. ".invalid" (RFC 2606) é rejeitado pela validação deles, por isso usamos um domínio real que não recebe e-mail de verdade.
        first_name: primeiro || undefined,
        last_name: ultimo || undefined
      },
      additional_info: {
        items: [
          {
            id: referenciaId,
            title: descricao,
            description: descricao,
            quantity: 1,
            unit_price: valor
          }
        ]
      }
    })
  });

  if (!resp.ok) throw new Error("Falha ao criar pagamento Pix no Mercado Pago: " + (await resp.text()));

  const pagamento = await resp.json();
  const transactionData = pagamento.point_of_interaction?.transaction_data || {};

  return {
    id: String(pagamento.id),
    status: pagamento.status, // "pending" até ser pago
    pixCopiaECola: transactionData.qr_code || null,
    pixQrCodeBase64: transactionData.qr_code_base64 || null
  };
}

async function consultarPagamento(env, paymentId) {
  const resp = await fetch("https://api.mercadopago.com/v1/payments/" + paymentId, {
    headers: { Authorization: "Bearer " + env.MP_ACCESS_TOKEN }
  });

  if (!resp.ok) throw new Error("Falha ao consultar pagamento no Mercado Pago: " + (await resp.text()));
  return resp.json();
}

export { criarPagamentoPix, consultarPagamento };
