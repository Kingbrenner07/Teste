# Publicação do painel e da API

O painel estático é publicado em
[`https://kingbrenner07.github.io/Teste/`](https://kingbrenner07.github.io/Teste/).
O build aponta para a API Node.js planejada em
`https://estetica-auto-api.onrender.com`, que só atende agenda e WhatsApp
depois que o Blueprint for provisionado no Render.

## API e PostgreSQL

Crie um **Blueprint** no Render a partir deste repositório. O arquivo
`render.yaml` provisiona:

* serviço Node.js em Docker, com health check em `/api/healthz`;
* PostgreSQL gerenciado, ligado à variável `DATABASE_URL`;
* disco persistente para a sessão autenticada do WhatsApp;
* CORS liberado exclusivamente para `https://kingbrenner07.github.io`.

O plano do serviço precisa manter um processo ativo e um disco persistente:
caso contrário o bot desconecta e exige leitura do QR code novamente.

## GitHub Pages

O frontend usa `VITE_API_URL=https://estetica-auto-api.onrender.com` durante o
build. Confirme que `https://estetica-auto-api.onrender.com/api/healthz`
responde `{"status":"ok"}` antes de publicar esta configuração. O valor é
incorporado nos arquivos estáticos, portanto alterações na URL da API exigem um
novo build e deploy do Pages.

Para publicar a pasta `docs/` manualmente:

```sh
BASE_PATH=/Teste/ \
VITE_API_URL=https://estetica-auto-api.onrender.com \
PORT=4173 NODE_ENV=production \
pnpm --filter @workspace/estetica-auto run build
```

Depois copie `artifacts/estetica-auto/dist/public` para `docs/`, duplique
`index.html` como `404.html` e mantenha `docs/.nojekyll`. Em **Settings →
Pages**, selecione a branch `main` e a pasta `/docs`.

O workflow `deploy-pages.yml` executa o mesmo build quando o GitHub Pages for
configurado para publicar via GitHub Actions.