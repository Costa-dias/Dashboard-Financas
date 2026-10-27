# Auditoria de segurança — 27/10/2026

Repositório: `Costa-dias/Dashboard-Financas`. Responsável: Codex. Base auditada: `b71c28fe34b74d0615f2e8f129cef06d33d70f10`.
Branch de trabalho: `security/audit-2026-10-27`. Este relatório acompanha o commit de correção/documentação desta branch; consulte seu SHA no histórico do arquivo.

## Escopo e critérios

Somente conteúdo deste repositório público e histórico alcançável pelas referências obtidas no clone. Nenhum repositório privado foi modificado. Avisos e versões foram consultados em 27/10/2026. Versão antiga, isoladamente, não confirma explorabilidade. Ausência de alerta não garante ausência de vulnerabilidade.

- **CORRIGIDO**: problema confirmado corrigido nesta branch; não implica implantação.
- **SEM IMPACTO**: aviso específico não alcança a versão ou funcionalidade verificada.
- **PENDENTE**: medida necessária ainda não aplicada no ambiente indicado.
- **NÃO VERIFICADO**: faltam código, credenciais, ambiente ou evidência suficiente.

## Histórico e segredos

Gitleaks 8.30.1, regras padrão, `git --log-opts=--all --redact`, sem exceções do repositório na varredura independente: código de saída 0, 0 achados. Escopo: 39 commits alcançáveis (o contador do scanner pode excluir merges/commits sem conteúdo examinável). Não foram detectadas credenciais pelas regras executadas. Objetos apagados, referências não obtidas e segredos sem padrão reconhecível não são cobertos.

## Dependências, runtime e código

Gerenciador original: npm, com `package-lock.json` preservado (blob `420fab623f9ced3b80f9f652d2a0b282e22e65c9`). `npm ci --no-fund` concluiu. A auditoria examinou dependências diretas e transitivas de produção e desenvolvimento: 308 entradas contabilizadas pelo npm; **zero alertas** em todas as gravidades. Versões e integridades vêm do lockfile, não apenas dos intervalos do manifesto.

| Tecnologia | Versão efetiva no lockfile/configuração | Decisão |
|---|---|---|
| Node.js | 24.22.1 em `.node-version` e CI | Manter LTS de segurança; testes locais executados com 24.22.1 |
| React / React DOM | 18.3.1 / 18.3.1 | Manter |
| Vite | 7.3.7 | Manter |
| TypeScript | 5.9.3 | Manter |

Consultas adicionais ao [GitHub Advisory Database](https://github.com/advisories) para as versões de React, Vite e TypeScript retornaram listas vazias. Isso significa ausência de avisos retornados para essas versões, não ausência universal de falhas. O [boletim oficial Node de outubro](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) e a [release 24.22.1](https://nodejs.org/en/blog/release/v24.22.1) justificam preservar a versão já corrigida. Não houve atualização de pacotes npm nem alteração de lockfile.

Não foram encontrados `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou `new Function` no código da aplicação revisado. As configurações Vite não habilitam exposição geral de hosts nem `allowedHosts: true`; mantenha o servidor de desenvolvimento fora da produção. Não foram identificados manifestos/lockfiles Bun no HEAD: Bun não se aplica a este repositório.

## GitHub Actions

Revisados todos os workflows versionados: permissões de conteúdo somente leitura, sem `pull_request_target`, sem checkout de código não confiável com token de escrita e sem interpolação direta de título/corpo de PR em scripts shell. Actions oficiais já estavam em tags atuais; foram fixadas nos SHAs resolvidos das mesmas tags. Checkout agora usa `persist-credentials: false`. A Action Gitleaks já estava fixada e foi preservada. Isto é endurecimento da cadeia de fornecimento, sem CVE confirmado nas Actions presentes. Nenhum workflow de deploy foi acrescentado.

`actionlint 1.7.12 -shellcheck= -pyflakes=` passou; valida sintaxe e expressões, sem análise ShellCheck/Pyflakes. As execuções remotas de CI não substituem os resultados locais e não são presumidas concluídas.

## Validação local

| Verificação | Resultado |
|---|---|
| Instalação com lockfile | Passou |
| `npm run typecheck` | Passou |
| `npm run lint` | Passou |
| `npm run build` | Passou |
| `npm test` | Passou |
| `npm audit --json` | Zero alertas conhecidos |
| `git diff --check` | Passou |
| Inicialização em navegador Chromium | Passou com preview local; viewport móvel 390×844 e desktop 1440×900 |
| Manifest e ícones PWA | Arquivo JSON e respostas dos ícones verificados |
| Service Worker | Registrado e controlando a página local |

Navegação de teste não usou dados reais. Não foram alterados layout, funcionalidades, armazenamento ou autenticação. Instalação efetiva em Android/iOS, diálogos nativos de instalação e todos os dispositivos físicos: **NÃO VERIFICADO**.

Criação do cofre de teste, persistência local e desbloqueio após reload passaram. Testes de domínio cobrem status legado, projeções, contas/transferências, XLSX, merge, backup protegido e parcelas. O Service Worker é apenas de ciclo de vida: não implementa cache de navegação offline; isso foi preservado.

## Resultado e integridade operacional

As mudanças desta branch são locais/de revisão. **Nenhum merge, deploy, alteração de credencial, escrita no banco/RLS/autenticação, exclusão ou modificação de produção foi realizado.** Verificações do Render, quando realizadas para FraudLens, foram somente leitura. Produção pode divergir do repositório; não foi declarada integralmente validada.

O diff foi revisado e `git diff --check` passou. Commits são separados por repositório. Para reproduzir a identificação: `git log -1 --format=%H -- SECURITY_AUDIT_2026-10-27.md`.
