// Cliente mínimo do Firestore REST API pra rodar em Cloudflare Workers (sem Node/firebase-admin).
// Autentica como service account: monta um JWT, assina com a chave privada (RS256) via Web Crypto,
// troca por um access token OAuth2 no Google, e usa esse token pra chamar a REST API do Firestore.
// Esse token tem permissão de admin — é por isso que as Firestore Rules podem bloquear o cliente
// (`allow update, delete: if false`) e mesmo assim o Worker consegue escrever/apagar.

function base64url(bytes) {
  let str = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem) {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(env) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600
  };

  const unsigned = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claims));
  const key = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = unsigned + "." + base64url(signature);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(jwt)
  });

  if (!resp.ok) throw new Error("Falha ao obter access token do Google: " + (await resp.text()));
  const data = await resp.json();
  return data.access_token;
}

// Converte um objeto JS simples (sem aninhamento, sem array) pro formato de "fields" da REST API.
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === "string") {
      fields[key] = { stringValue: value };
    } else if (typeof value === "number") {
      fields[key] = { doubleValue: value };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    }
  }
  return fields;
}

function fromFirestoreValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in v) return fromFirestoreFields(v.mapValue.fields || {});
  return null;
}

function fromFirestoreFields(fields) {
  const obj = {};
  for (const [key, value] of Object.entries(fields || {})) obj[key] = fromFirestoreValue(value);
  return obj;
}

function documentsRoot(env) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

function docUrl(env, path) {
  return documentsRoot(env) + "/" + path;
}

// Nome de recurso "nu" (sem o https://.../v1 na frente) — é o formato que a
// REST API exige dentro do corpo JSON de :batchGet e :commit (campos
// `documents`, `name` de um Write.update, `delete`). É diferente da URL
// usada pra fazer a própria chamada HTTP (essa sim precisa do https://...).
function resourceName(env, path) {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
}

// PATCH com updateMask = upsert (cria se não existir, atualiza os campos informados se existir).
async function patchDocument(env, path, data) {
  const accessToken = await getAccessToken(env);
  const url = docUrl(env, path) + "?" + Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });

  if (!resp.ok) throw new Error("Falha ao gravar no Firestore (" + path + "): " + (await resp.text()));
  return resp.json();
}

// Retorna os campos do documento (já convertidos pra JS simples), ou null se não existir.
async function getDocument(env, path) {
  const accessToken = await getAccessToken(env);
  const resp = await fetch(docUrl(env, path), {
    headers: { Authorization: "Bearer " + accessToken }
  });

  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error("Falha ao ler do Firestore (" + path + "): " + (await resp.text()));
  const doc = await resp.json();
  return fromFirestoreFields(doc.fields || {});
}

async function deleteDocument(env, path) {
  const accessToken = await getAccessToken(env);
  const resp = await fetch(docUrl(env, path), {
    method: "DELETE",
    headers: { Authorization: "Bearer " + accessToken }
  });

  if (!resp.ok && resp.status !== 404) throw new Error("Falha ao apagar do Firestore (" + path + "): " + (await resp.text()));
}

// Lê vários documentos numa única chamada (usado pelo cron, que varre os 200
// números da rifa — uma chamada por número estouraria o limite de subrequests
// do Worker). Retorna um mapa path -> campos (ou null se o documento não existe).
async function batchGetDocuments(env, paths) {
  const accessToken = await getAccessToken(env);
  const resp = await fetch(documentsRoot(env) + ":batchGet", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ documents: paths.map((p) => resourceName(env, p)) })
  });

  if (!resp.ok) throw new Error("Falha ao ler em lote do Firestore: " + (await resp.text()));
  const results = await resp.json();

  const out = {};
  for (const item of results) {
    if (item.found) {
      out[item.found.name.split("/documents/")[1]] = fromFirestoreFields(item.found.fields || {});
    } else if (item.missing) {
      out[item.missing.split("/documents/")[1]] = null;
    }
  }
  return out;
}

// Grava/apaga vários documentos numa única chamada atômica. `writes` é uma lista
// de operações no formato da Firestore REST API — use os helpers `writeUpdate`
// e `writeDelete` abaixo pra montar cada item.
async function commitWrites(env, writes) {
  if (writes.length === 0) return;
  const accessToken = await getAccessToken(env);
  const resp = await fetch(documentsRoot(env) + ":commit", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ writes })
  });

  if (!resp.ok) throw new Error("Falha ao gravar em lote no Firestore: " + (await resp.text()));
}

function writeUpdate(env, path, data) {
  return {
    update: { name: resourceName(env, path), fields: toFirestoreFields(data) },
    updateMask: { fieldPaths: Object.keys(data) }
  };
}

function writeDelete(env, path) {
  return { delete: resourceName(env, path) };
}

export { patchDocument, getDocument, deleteDocument, batchGetDocuments, commitWrites, writeUpdate, writeDelete };
