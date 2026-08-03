# HOS Jiu-Jitsu — Site institucional

Site de divulgação do projeto social **HOS Jiu-Jitsu (Hungria Old School)**, aulas gratuitas de jiu-jitsu para crianças e adolescentes no Distrito de Rechan, interior de São Paulo.

Site estático simples (HTML + CSS + JS puro), sem dependências de build — pode ser publicado direto no GitHub Pages ou na Vercel. A partir de 2026-08, tem também uma **Área do Aluno** com cadastro/login, usando **Firebase** (Authentication + Firestore) como backend — funciona igual em qualquer hospedagem, já que o Firebase é chamado direto do navegador.

## Estrutura

```
hosjiujitsu/
├── index.html      → estrutura e conteúdo do site institucional
├── style.css        → estilos (cores, tipografia, layout)
├── script.js        → menu mobile e ano do rodapé
├── assets/
│   ├── logo.png            → logo do projeto (fundo transparente)
│   └── instagram/          → fotos reais do @hosjiujitsu usadas no site
├── app/
│   ├── firebase-init.js    → config do Firebase (projeto: hosjiujitsu-app)
│   ├── cadastro.html       → cadastro do aluno
│   ├── login.html          → login (e-mail/senha)
│   ├── perfil.html         → área do aluno logado (dados do próprio cadastro)
│   └── app.css             → estilos do app
├── firestore.rules          → regras de segurança da coleção "alunos"
└── README.md
```

**Antes de usar a Área do Aluno**, é preciso habilitar o login por e-mail/senha
no Console do Firebase (Authentication > Sign-in method) — não existe comando
de CLI pra isso, é um passo manual único.

## Como publicar no GitHub

1. Crie um repositório novo no GitHub, por exemplo `hosjiujitsu-site`.
2. Envie estes arquivos para o repositório (pela interface do GitHub em "Add file → Upload files", ou via terminal):
   ```bash
   git init
   git add .
   git commit -m "Site HOS Jiu-Jitsu"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/hosjiujitsu-site.git
   git push -u origin main
   ```

## Como publicar na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub.
2. Clique em **Add New → Project**.
3. Selecione o repositório `hosjiujitsu-site`.
4. Como é um site estático (sem framework), a Vercel detecta automaticamente — não é preciso configurar comando de build. Basta clicar em **Deploy**.
5. Em poucos segundos o site estará no ar em um endereço tipo `hosjiujitsu-site.vercel.app`.

## Como ligar o domínio www.hosjiujitsu.com.br

1. No painel do projeto na Vercel, vá em **Settings → Domains**.
2. Adicione `www.hosjiujitsu.com.br` (e, se quiser, `hosjiujitsu.com.br` também, redirecionando para o www).
3. A Vercel vai mostrar os registros DNS que você precisa cadastrar no seu provedor de domínio (Registro.br, Hostgator, etc.), normalmente um registro `CNAME` para o `www` apontando para `cname.vercel-dns.com`.
4. Cadastre esse registro no painel DNS do seu provedor. A propagação pode levar de alguns minutos até 24h.
5. Quando o DNS propagar, a Vercel emite o certificado SSL automaticamente e o site passa a responder em `https://www.hosjiujitsu.com.br`.

## Editar conteúdo

- **Textos**: abra `index.html` e edite diretamente os textos entre as tags (ex: horários, bio, conquistas).
- **Cores**: no topo do arquivo `style.css`, dentro de `:root`, estão as variáveis de cor (`--purple`, `--steel` etc.) — alterá-las muda a cor em todo o site.
- **Logo**: para trocar a imagem, substitua o arquivo `assets/logo.png` mantendo o mesmo nome, ou atualize o caminho no `index.html`.
- **Instagram/links**: o link do Instagram aparece em três lugares no `index.html` — busque por `instagram.com/hosjiujitsu` para atualizar todos de uma vez, se o @ mudar.
