// Cliente mínimo da API do Mercado Pago (Pix) — só o necessário pra rifa.

async function criarPagamentoPixRifa(env, { pedidoId, valor, descricao }) {
  const resp = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.MP_ACCESS_TOKEN,
      "Content-Type": "application/json",
      // Evita cobrar duas vezes se o visitante clicar duas vezes sem querer.
      "X-Idempotency-Key": pedidoId
    },
    body: JSON.stringify({
      transaction_amount: valor,
      description: descricao,
      payment_method_id: "pix",
      external_reference: pedidoId,
      payer: { email: "rifa+" + pedidoId + "@hosjiujitsu.vercel.app" } // MP exige e-mail do pagador; não coletamos e-mail do comprador da rifa. ".invalid" (RFC 2606) é rejeitado pela validação deles, por isso usamos um domínio real que não recebe e-mail de verdade.
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

export { criarPagamentoPixRifa, consultarPagamento };
