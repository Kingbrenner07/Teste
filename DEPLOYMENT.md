# Publicação no GitHub Pages

O painel pode ser publicado gratuitamente como uma interface estática no
GitHub Pages. O build não exige Render, banco ou URL de API: sem
`VITE_API_URL`, o navegador tenta usar as rotas `/api` no próprio domínio.

## Publicar somente a interface

1. Gere o frontend com `BASE_PATH=/Teste/`, substituindo `Teste` pelo nome do
   repositório:

   ```sh
   BASE_PATH=/Teste/ PORT=4173 NODE_ENV=production \
     pnpm --filter @workspace/estetica-auto run build
   ```

2. Copie `artifacts/estetica-auto/dist/public` para a pasta `docs/`.
3. Duplique `docs/index.html` como `docs/404.html` e crie `docs/.nojekyll`.
4. Em **Settings → Pages**, selecione **Deploy from a branch**, branch `main`
   e pasta `/docs`.

O workflow `deploy-pages.yml` também pode ser usado quando estiver em
`.github/workflows`; ele aceita `VITE_API_URL` como variável opcional.

## Limitações do modo estático

O GitHub Pages não executa Node.js nem PostgreSQL. Portanto, sem um backend
publicado:

* a tela abre e a navegação funciona;
* dashboard, agenda, agendamentos e status do WhatsApp não têm dados;
* os botões que chamam `/api` falham até que uma API seja hospedada.

## Backend opcional

Para habilitar os dados e o WhatsApp futuramente, o repositório ainda inclui
`render.yaml`, `Dockerfile` e `docker-entrypoint.sh`. Depois de publicar uma
API, configure `VITE_API_URL` com a URL pública dela e reconstrua o frontend.