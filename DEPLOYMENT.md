# Publicação fora do Replit

O painel é estático no GitHub Pages, mas a agenda e o WhatsApp precisam de um
processo Node.js contínuo e de PostgreSQL. Este repositório inclui
`render.yaml` e `Dockerfile` para publicar esses componentes no Render.

## 1. Criar o backend e banco

1. No Render, crie um **Blueprint** a partir deste repositório.
2. Confirme a criação do serviço `estetica-auto-api`, do PostgreSQL
   `estetica-auto-db` e do disco persistente.
3. No serviço, defina `ALLOWED_ORIGIN` como a origem exata do Pages:
   `https://<usuario-ou-organizacao>.github.io`.
   Não inclua o nome do repositório nesse valor.
4. Faça o deploy e copie a URL pública do serviço, por exemplo
   `https://estetica-auto-api.onrender.com`.

O container aplica o schema e cadastra os dez serviços padrão antes de iniciar
a API. O disco em
`/var/data/whatsapp-auth` conserva a sessão do WhatsApp entre reinicializações,
e o bot se reconecta automaticamente ao iniciar. Não remova esse disco enquanto
quiser manter o login do bot.

## 2. Conectar o GitHub Pages

Em **GitHub → Settings → Secrets and variables → Actions → Variables**, crie:

| Nome | Valor |
| --- | --- |
| `VITE_API_URL` | A URL pública do backend, sem barra final |

Depois faça novo push na branch publicada ou execute o workflow **Deploy
Estética Auto to GitHub Pages** manualmente. O workflow falha de propósito se
essa variável estiver ausente, evitando publicar um painel que procure uma API
local inexistente.

## 3. Verificação

* Abra `<URL_DO_BACKEND>/api/healthz`: deve responder com o health check.
* Abra o GitHub Pages e crie/edite um agendamento.
* Em **WhatsApp Bot**, gere o QR code e leia-o no celular. O status deve mudar
  para **Conectado & Pronto**.

O backend aceita requisições de navegador somente da origem em
`ALLOWED_ORIGIN`; verifique que ela corresponde exatamente ao domínio do
GitHub Pages antes de publicar.