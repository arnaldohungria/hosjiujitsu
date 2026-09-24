# CONTEXTO — HOS Jiu-Jitsu (site + Área do Aluno)

Arquivo vivo para o Claude (e para quem mais mexer aqui) saber o estado do projeto **antes** de
alterar qualquer coisa. Vale tanto para sessões neste computador quanto em outro.

## Regras de trabalho (combinado com o Arnaldo)

1. **Antes de qualquer alteração**: `git fetch origin`, ler este arquivo e o `git log` do que
   entrou desde a última vez (o Arnaldo pode ter mexido por outro computador). Se o clone local
   estiver atrás de `origin/main`, atualizar (ou trabalhar numa cópia limpa, `git worktree add <pasta> origin/main`)
   antes de editar.
2. **Depois de qualquer alteração**: acrescentar uma entrada no *Histórico* abaixo (data, o que mudou,
   por quê, arquivos, o que ficou pendente) e enviar junto no mesmo commit.
3. Nunca commitar segredos (tokens do Mercado Pago, chave de service account do Firebase) nem dados
   pessoais de alunos/diretoria (RG, CPF, endereço, telefone). A config web do Firebase em
   `app/firebase-init.js` é pública por design; a segurança está em `firestore.rules`.
4. Dados de alunos vindos do Firestore são sempre renderizados com `textContent`/`createElement`,
   **nunca `innerHTML`** (evita XSS armazenado).

## O que é

Site institucional + Área do Aluno do **HOS Jiu-Jitsu (Hungria Old School)**: projeto social
gratuito de jiu-jitsu para crianças, adolescentes e jovens do Distrito de Rechan, Itapetininga-SP
(fundado em 13/04/2022, ~70 alunos). Professor: Arnaldo Hungria. O projeto está sendo organizado
sob a associação **Trilhos do Rechan: Associação Comunitária Cultural** (formalização em andamento,
fora deste repositório). Aulas: quartas-feiras, 3 turmas por faixa etária (7–10, 11–13, 14+).

Estático (HTML + CSS + JS puro, sem build). Backend: Firebase (Auth + Firestore) chamado direto do
navegador + um Cloudflare Worker para o Pix.

## Onde vive cada coisa

| Peça | Onde |
|---|---|
| Código | GitHub `arnaldohungria/hosjiujitsu`, branch `main` |
| Site no ar | Vercel, deploy automático a cada push na `main` (sem CLI, sem pasta `.vercel`). `hosjiujitsu.vercel.app`; endereço oficial `www.hosjiujitsu.com.br` (domínio conectado e no ar, confirmado pelo Arnaldo em 24/09/2026) |
| Firebase | projeto `hosjiujitsu-app`, conta `arnaldo@live.jp` (Auth e-mail/senha + Firestore) |
| Worker do Pix | `worker/` → Cloudflare Worker `hosjiujitsu-rifa`, conta `tatamepass@gmail.com`; cron a cada 10 min libera reservas de rifa com +30 min sem pagamento |
| Segredos do Worker | `MP_ACCESS_TOKEN`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (via `wrangler secret put`, nunca no git) |

**Atenção — push não publica tudo.** O push na `main` publica só o site (Vercel). As regras do
Firestore e o Worker têm deploy separado:

```bash
npx firebase-tools deploy --only firestore:rules      # em hosjiujitsu-app, logado como arnaldo@live.jp
cd worker && npx wrangler deploy                      # logado como tatamepass@gmail.com
```

`gh` costuma estar logado em várias contas; para este repo a conta é `arnaldohungria`. Se der 403 no
push, conferir a conta ativa (`gh auth status`) antes de qualquer outra coisa.

## Páginas

Público: `index.html` (institucional), `rifa.html` (rifa solidária, 200 números, R$ 6,00 cada),
`doar.html` (doação livre via Pix), `cadastro-passo-a-passo.html/.pdf` (guia do cadastro).

Área do Aluno (`app/`): `cadastro.html`, `login.html`, `perfil.html` (Meus Dados: edição, foto,
peso/graus, total de presenças), `mural.html` (avisos do professor), `ranking.html` (ranking de
presenças), `conteudos.html` (placeholder "em breve" — vídeos de técnicas planejados, nada feito ainda).

Painel do professor (`app/admin*.html`): `admin.html` (alunos: lista, filtros, edição, relatório
impresso), `admin-chamada.html` (chamada manual por data), `admin-mural.html` (avisos),
`admin-rifa.html`, `admin-doacoes.html`. Acesso só para quem tem documento em `admins/{uid}`
(criado manualmente no Console do Firebase; as rules não permitem criar por código).

## Modelo de dados (Firestore)

- `alunos/{uid}` — cadastro completo (dados sensíveis do aluno e do responsável). Aluno lê/edita só o
  próprio; admin lê/edita/apaga todos. `totalPresencas` só o admin altera. Responsável (nome, doc, telefone)
  é opcional se o aluno tem 18+; endereço do responsável é sempre obrigatório. Foto em `fotoBase64`
  (JPEG 240×240 comprimido no navegador; não usa Firebase Storage porque exigiria plano Blaze).
- `admins/{uid}` — existência = é professor. Escrita bloqueada por código.
- `presencas/{alunoId}_{AAAA-MM-DD}` — existência = esteve presente. Só admin cria/apaga.
- `ranking/{uid}` — só `primeiroNome`, `faixa`, `totalPresencas`, legível por qualquer aluno logado
  (separado de `alunos` de propósito para não expor RG/CPF/telefone aos colegas). Mantido pelo admin na chamada.
- `avisos/{id}` — mural. Aluno logado lê; admin cria/edita/apaga.
- `rifaNumeros/{001..200}` — existência = reservado/pago (ausência = livre; reserva atômica via batch).
- `rifaPedidos/{id}` — 1 pedido = 1 cobrança Pix de N números. `get` público (o comprador acompanha o
  próprio pedido), `list` só admin.
- `doacoes/{id}` — mesma ideia da rifa, valor livre (R$ 1 a 50.000).
- Rifa, pedidos e doações: clientes só criam; **só o Worker** atualiza (service account, ignora as rules).

Faixas válidas: Branca, Cinza, Amarela, Laranja, Verde, Azul, Roxa, Marrom, Preta.

## Decisões que não são óbvias no código

- Muitas crianças não têm celular ⇒ **não existe check-in pelo aluno**; presença é chamada manual do professor.
- Rifa: 200 números, R$ 6,00, prêmio R$ 200,00 no Pix, sorteio em live; renda vai para kimonos de crianças sem condições.
- Cota de patrocínio (material de captação, fora do repo) é **única**, mensal ou anual, valor "sob consulta".
- Paleta redefinida em 16/09/2026 a partir do roxo real do logo (`#844c87`), com nav/footer **claros**.
  Isso substituiu a decisão anterior de nav/footer roxo-escuros. Tokens em `style.css` e `app/app.css`.
- Ranking: posições sequenciais mesmo em empate; desempate por ordem alfabética do primeiro nome.

## Armadilhas conhecidas

- **Mercado Pago (antifraude):** o score de "Qualidade da integração" precisa estar alto ou o Pix é
  recusado com `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`. O que sustenta o score: `X-meli-session-id`
  (device id via `security.js`), `payer.first_name/last_name`, `additional_info.items[].description`,
  `statement_descriptor` "HOSJIUJITSU". Se o Pix parar de gerar, olhar o painel de qualidade do app no
  Mercado Pago antes de suspeitar de regressão de código.
- **Firestore REST em lote (Worker):** os endpoints `:commit` e `:batchGet` exigem o nome do recurso
  *sem* o prefixo `https://firestore.googleapis.com/v1/` (helper `resourceName()` em `worker/src/firestore.js`).
  Esse erro já deixou pagamentos aprovados presos como "pendente" (corrigido em 05/08/2026).
- Logo depois de um deploy do Worker, a Cloudflare pode falhar 1–2 requisições por propagação de borda; não é bug.
- Página pública que carregue `app/firebase-init.js` precisa carregar também `firebase-auth-compat.js`.
- Docs de teste antigos em `alunos`/`rifaNumeros`/`rifaPedidos` não podem ser apagados por cliente
  (rules bloqueiam); só pelo Console ou pelo Worker.

## Histórico

Mais recente primeiro. Entradas anteriores a 24/09/2026 foram reconstruídas do `git log`.

### 2026-09-24 — Domínio confirmado
- Sem mudança de código. O Arnaldo confirmou que `www.hosjiujitsu.com.br` já está no ar; pendência de conferência removida.

### 2026-09-24 — Ranking com pódio
- `app/ranking.html`, `app/app.css`: os 3 primeiros viram um pódio (1º no centro com coroa, 2º à esquerda,
  3º à direita, círculo com a inicial do nome); do 4º em diante segue a lista numerada. Funciona com 1 ou 2
  alunos com presença. Desempate estável (presenças desc, depois nome). A linha "Sua colocação" (aluno fora
  do top 20) mostra o primeiro nome em vez de "Você (você)". Classes novas `.podio*`, sem tocar em `.avatar*`.
- Testado com Firebase simulado (10, 2, 1 e 0 alunos) e publicado; não visto ainda com dados reais.
- Não muda `firestore.rules`. Foto no pódio não foi feita: `ranking` não guarda foto; exigiria alterar o
  documento e as rules (exposição aos colegas — decisão do Arnaldo).
- Adicionado este `CONTEXTO.md`.

### 2026-09-22 — Antifraude do Mercado Pago (`150c877`)
- Envio de nome/sobrenome do pagador, `statement_descriptor` e `additional_info` no Worker; incluiu
  `cadastro-passo-a-passo.html/.pdf`, que estavam sem versionar.

### 2026-09-16 — Redesign e limpeza do site (`3e858f7`, `60c948f`, `6152eb3`)
- Nova paleta a partir do roxo real do logo, nav/footer claros; removida a seção "Conquistas do projeto"
  (e o link no menu); removidos o bloco de estatísticas do hero e a menção "comandadas pelo faixa-preta…".

### 2026-09-14 — Área do Aluno e painel do professor (`6d1cfbf`, `276b5a3`, `de0bcc8`, `7c78992`)
- Edição de dados, peso/graus, mural de avisos e filtros no relatório; filtro por graus; chamada manual +
  contador de presenças + ranking (coleções `presencas` e `ranking`); foto do aluno em `fotoBase64`.

### 2026-08-19 — Antifraude do Pix (`f742082`)
- Envia o ID do dispositivo ao criar Pix (rifa e doação).

### 2026-08-03 a 2026-08-14 — Base atual
- Redesign inicial com fotos reais; Área do Aluno (cadastro/login/perfil); painel do professor; campos do
  responsável opcionais para maiores de 18; rifa solidária e doações via Mercado Pago com Worker; correção
  do bug crítico de pagamentos aprovados presos como pendentes (`32d239a`); contador de alunos no painel.

## Pendências em aberto

- `app/conteudos.html` continua placeholder (vídeos de técnicas de jiu-jitsu: planejados, sem implementação).
- Endereço definitivo da sede da associação (aguarda numeração predial da Prefeitura) — afeta o texto do site
  se o endereço mudar.
