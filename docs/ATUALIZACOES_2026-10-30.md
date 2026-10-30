# Manutenção — 30/10/2026

## Dashboard Finanças — 2.0.0 → 2.0.1

Atualização das ferramentas e tipagens dentro das linhas compatíveis. Os testes continuam cobrindo saldo realizado/projetado, contas, transferências, parcelas, exportação XLSX, backup criptografado e troca atômica de PIN. Não foi alterado o formato do cofre nem feita migração de dados nesta publicação.

### Bibliotecas diretas alteradas

| Biblioteca | Antes | Depois | Para que serve |
|---|---|---|---|
| `@types/react` | 18.3.11 | 18.3.31 | Tipagem para desenvolvimento; não acrescenta recurso ao site. |
| `@types/react-dom` | 18.3.0 | 18.3.7 | Tipagem para desenvolvimento; não acrescenta recurso ao site. |
| `typescript-eslint` | 8.72.0 | 8.72.1 | Verifica código TypeScript e regras de qualidade. |

### Verificações

Testes financeiros e do armazenamento, TypeScript, lint e build.

Auditoria das dependências JavaScript: nenhuma vulnerabilidade conhecida reportada após as mudanças. Isso não substitui revisão de código nem significa risco zero.
