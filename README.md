# 💰 Dashboard Finanças

Painel de controle financeiro pessoal, privado e criptografado — feito para substituir o controle em papel e caneta por algo simples de usar no celular ou no computador.


## ✨ Funcionalidades

- **Lançamentos** de receitas e despesas, com categoria, forma de pagamento, data e observações
- **Transações recorrentes e parceladas** (ex: assinaturas mensais, compras em N vezes)
- **Orçamentos por categoria** com acompanhamento de limite mensal
- **Dashboard** com KPIs, resumo por categoria e gráficos (rosca e barras, via Recharts)
- **Exportação e importação** dos dados em Excel (.xlsx) e exportação em CSV
- **Tema claro/escuro**
- **Acesso protegido por PIN**, com bloqueio automático após 10 minutos de inatividade

## 🔒 Segurança e privacidade

Este projeto **não usa backend nem banco de dados externo** — todos os dados ficam armazenados apenas no navegador (`localStorage`), criptografados:

- PIN nunca é salvo em texto puro (apenas um hash salgado com SHA-256)
- Dados financeiros são criptografados com **AES-256-GCM**
- Chave de criptografia derivada do PIN via **PBKDF2** (310.000 iterações)

**Importante:**
- Os dados ficam presos ao navegador/dispositivo onde o PIN foi criado. Trocar de navegador, limpar o cache ou usar outro computador **não mostra os dados salvos anteriormente**.
- **Não existe recuperação de PIN.** Se o PIN for perdido, os dados não podem ser descriptografados.
- **Faça backups periódicos** exportando para Excel (.xlsx) pela própria interface do app, e guarde o arquivo em um lugar seguro (Google Drive, e-mail, etc).

## 🚀 Rodando localmente

\`\`\`bash
npm install
npm run dev
\`\`\`

Acesse \`(https://dashboard-financas-rfv6.onrender.com/)\` (porta padrão do Vite).

Outros comandos úteis:

\`\`\`bash
npm run build      # gera a versão de produção na pasta dist/
npm run preview    # visualiza a versão de produção localmente
npm run lint        # checagem de lint
npm run typecheck   # checagem de tipos TypeScript
\`\`\`

## 🌐 Deploy

Este é um projeto **100% estático** (Vite + React), sem servidor — pode ser publicado em qualquer serviço de hospedagem de sites estáticos, como **Render**, **Vercel** ou **Netlify**.

Configuração de build (válida para qualquer uma dessas plataformas):

| Campo | Valor |
|---|---|
| Build Command | \`npm install && npm run build\` |
| Publish/Output Directory | \`dist\` |

## 🛠️ Stack técnica

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) para estilização
- [Recharts](https://recharts.org/) para os gráficos
- [xlsx (SheetJS)](https://www.npmjs.com/package/xlsx) para exportação/importação de planilhas
- [lucide-react](https://lucide.dev/) para ícones
- Web Crypto API (nativa do navegador) para criptografia

> **Nota:** a dependência \`@supabase/supabase-js\` está listada no \`package.json\` mas não é utilizada em nenhum lugar do código atualmente — pode ser removida com segurança caso queira reduzir o tamanho do build.

## 📁 Estrutura do projeto

\`\`\`
src/
├── components/       # Telas e componentes (Dashboard, formulários, gráficos, etc)
├── hooks/             # Hooks customizados (auto-lock, tema)
├── lib/               # Lógica principal (criptografia, storage, cálculos financeiros, sanitização)
├── types.ts           # Tipos TypeScript compartilhados
└── main.tsx           # Ponto de entrada da aplicação
\`\`\`

## 📌 Uso

Este projeto é de uso pessoal e privado. Ao acessar pela primeira vez, será necessário criar um PIN mestre — guarde-o em um lugar seguro, pois não há forma de recuperá-lo.
