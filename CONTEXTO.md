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

Público: `index.html` (institucional), `rifa.html` (rifa solidária, 600 números, R$ 6,00 cada; prêmio: camisa de goleiro do Palmeiras autografada),
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
- `rifaNumeros/{001..600}` — existência = reservado/pago (ausência = livre; reserva atômica via batch).
- `rifaPedidos/{id}` — 1 pedido = 1 cobrança Pix de N números. `get` público (o comprador acompanha o
  próprio pedido), `list` só admin.
- `doacoes/{id}` — mesma ideia da rifa, valor livre (R$ 1 a 50.000).
- Rifa, pedidos e doações: clientes só criam; **só o Worker** atualiza (service account, ignora as rules).

Faixas válidas: Branca, Cinza, Amarela, Laranja, Verde, Azul, Roxa, Marrom, Preta.

## Decisões que não são óbvias no código

- Muitas crianças não têm celular ⇒ **não existe check-in pelo aluno**; presença é chamada manual do professor.
- Rifa: 600 números (eram 200 até 26/09/2026), R$ 6,00, prêmio: camisa oficial de goleiro do Palmeiras autografada
  pelo ex-goleiro Sérgio (antes era R$ 200,00 no Pix), sorteio em live; renda vai para kimonos de crianças sem
  condições. Quem comprou antes da troca manteve o mesmo número. O nome do deputado que intermediou a camisa
  **não** aparece na página de propósito (período eleitoral).
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
- **Deploy do Worker só de clone atualizado.** O `wrangler deploy` publica o que está no disco: de um clone
  atrás de `origin/main` ele desfaz mudanças já feitas (em 26/09/2026 isso derrubou por alguns minutos o
  antifraude de 22/09 em produção; refeito em seguida). Sempre `git fetch` + atualizar antes.
- `wrangler login` reaproveita a sessão da Cloudflare já aberta no navegador e pode entrar na conta errada
  (`arnaldo@live.jp` em vez de `tatamepass@gmail.com`). Conferir com `wrangler whoami` (conta certa = ID
  `40b925804bbffd00cddcfa4dc2a31096`); se errada: `wrangler logout` e `wrangler login --browser=false`, abrindo
  o link numa janela anônima.
- Logo depois de um deploy do Worker, a Cloudflare pode falhar 1–2 requisições por propagação de borda; não é bug.
- Página pública que carregue `app/firebase-init.js` precisa carregar também `firebase-auth-compat.js`.
- Docs de teste antigos em `alunos`/`rifaNumeros`/`rifaPedidos` não podem ser apagados por cliente
  (rules bloqueiam); só pelo Console ou pelo Worker.

## Histórico

Mais recente primeiro. Entradas anteriores a 24/09/2026 foram reconstruídas do `git log`.

### 2026-09-26 (4) — Mesmo visual na Área do Aluno e no painel do professor
- Pedido do Arnaldo depois de aprovar o redesign do site público. `app/app.css` reescrito com as mesmas classes
  (o JS das páginas depende delas): cabeçalho fixo translúcido, abas do aluno em pílula, cartões arredondados,
  campos com foco roxo, botões em pílula com degradê, tabelas com cabeçalho preto, avisos do mural em cartões,
  pódio/ranking e avatares com degradê; regras de impressão do relatório mantidas iguais. Nenhum HTML de `app/`
  mudou, exceto `admin-rifa.html`: agora carrega `../style.css` **antes** do `app.css` (só pela cartela), então o
  visual do app prevalece lá; com isso saiu do `style.css` o `.card` antigo (cantos cortados) que só servia ao painel.
- Fileiras só de botões de navegação do painel (sem `h2`) ficam alinhadas à esquerda via `:has()`; navegador
  antigo sem `:has()` só volta ao espaçamento anterior.
- Testado com página de prévia temporária (não versionada) + login/cadastro reais. Só front-end.

### 2026-09-26 (3) — Redesign visual do site público (só estética)
- Pedido do Arnaldo: "deixar mais bonito" sem mexer em textos, fotos, rifa nem Área do Aluno. Mantidos a paleta
  do logo e o nav/rodapé claros (decisão de 16/09).
- `style.css` reescrito: botões em pílula, sombras/cantos arredondados, hero em duas colunas com as fotos
  `turma-04` e `conquistas-01` (reaproveitadas, decorativas), galeria em mosaico, seção do Professor escura
  (`.section-dark`) com faixa preta com ponteira vermelha, horários em cartões, contato com hover roxo,
  cartela da rifa com estados mais claros (reservado listrado, vendido preto), resumo flutuante e formulário em cartão.
- `index.html`: só estrutura (wrapper `.hero-grid` + `.hero-media`, classe `manifesto-foto` no lugar do style
  inline, `#professor` vira `section-dark`). `script.js`: animação de entrada ao rolar (desliga sem JS ou com
  "reduzir movimento"). `rifa.html`/`doar.html`: sem alteração de HTML nem de lógica.
- `app/admin-rifa.html` carrega `style.css` depois do `app.css`: tokens antigos mantidos com o mesmo valor e
  `.card` intocado; lá só mudou o visual da cartela/legenda. Demais páginas `app/` não usam `style.css`.
- Só front-end (push na `main`), sem deploy de rules/Worker.

### 2026-09-26 (2) — Rifa: ajuste de título e remoção do aviso "Rifa ampliada"
- `rifa.html`: título agora é só "Camisa Oficial / autografada pelo Goleiro Sérgio" (sai o "600 NÚMEROS" e o
  "Camisa de goleiro do Palmeiras"); removido o parágrafo "Rifa ampliada! Agora são 600 números. Quem já comprou
  continua concorrendo com o mesmo número." (decisão do Arnaldo). A rifa continua com 600 números; só deixou de
  ser anunciado na página. Só front-end (push na `main`), sem deploy de rules/Worker.

### 2026-09-26 — Rifa: prêmio vira camisa autografada e sobe de 200 para 600 números
- Pedido do Arnaldo: prêmio passa a ser uma camisa oficial de goleiro do Palmeiras (loja oficial, Allianz Parque)
  autografada pelo ex-goleiro Sérgio; número continua R$ 6,00; rifa de 200 → 600 números; quem já comprou continua
  concorrendo com o mesmo número (1–200 não mudam; 201–600 entram livres, pois ausência de documento = livre).
- `firestore.rules`: `numeroRifaValido` aceita 1..600 (limite de 200 é *por pedido*, batch do cliente aceita
  no máx. 500 operações). `worker/src/index.js`: `TOTAL_NUMEROS` 600 e o cron lê em lotes de 300 (`:batchGet`)
  e grava em lotes de 400 (`:commit`, máx. 500). `rifa.html`: título/prêmio, aviso "rifa ampliada", 600 tiles.
  `app/admin-rifa.html`: cartela de 600.
- Deploys: rules (`arnaldo@live.jp`) e Worker (`tatamepass@gmail.com`) feitos à parte do push. O Worker foi
  publicado uma primeira vez de um clone atrasado (sem o antifraude de 22/09) e republicado logo depois do
  rebase — ver armadilha acima.
- Pendente/decisões do Arnaldo: avisar quem já comprou (o prêmio mudou) e oferecer devolução a quem quiser;
  confirmar se a rifa exige autorização (SPA/Ministério da Fazenda); foto da camisa pra página; nome do
  candidato que intermediou fica fora do site.

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
