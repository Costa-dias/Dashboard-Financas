# Alterações e validação — 26/10/2026

## Mudanças

- `src/types.ts`: status opcional de realizado/previsto, contas e transferências.
- `src/lib/finance.ts`: saldo realizado, projeção mensal e saldos por conta. A leitura dos registros antigos continua compatível.
- `AccountsPanel`: criação de contas e transferências internas, sem afetar receita/despesa global.
- Formulário permite escolher situação e conta; ocorrências seguintes de parcelas/recorrências começam previstas.
- Planilhas versão 3 preservam os novos campos e continuam aceitando backups antigos. Mesclagem é por ID.
- Backup JSON protegido por senha independente do PIN, usando AES-GCM/PBKDF2. Prévia da importação detalha novos registros e substituições antes de confirmar.

## Verificação

`npm test`, `npm run typecheck`, `npm run lint` e `npm run build`. Testes incluem saldos, transferências, compatibilidade, ida/volta de planilhas, mesclagem, senha incorreta e parcelas no fim do mês. No navegador local, criação de cofre e de conta com saldo inicial foi validada com dados fictícios.

## Limites

Saldo inicial deve ser anterior aos lançamentos existentes. O aplicativo não faz conciliação bancária. Dados antigos sem status usam a data para inferir realizado/previsto e precisam de revisão do usuário caso não representem pagamentos reais. Excel/CSV permanecem sem criptografia; somente o JSON protegido usa a nova senha de backup.
