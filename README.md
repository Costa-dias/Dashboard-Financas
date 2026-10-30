# Dashboard Finanças

**Versão 2.0.0 · atualizado em 30/10/2026**

Novo modelo financeiro com realizado versus previsto, contas e transferências, migração do cofre local, backup protegido e importação revisada do TurnoExtra.

[Histórico e critérios da versão](RELEASES.md).

Controle financeiro pessoal com React, TypeScript e armazenamento local criptografado. [Abrir aplicação](https://dashboard-financas-rfv6.onrender.com/).

## Recursos

- Receitas e despesas com categorias, datas, forma de pagamento, parcelas e recorrências.
- Situação explícita: realizado ou previsto. Lançamentos antigos sem situação mantêm compatibilidade: datas até hoje são consideradas realizadas; datas futuras, previstas. Revise registros antigos para refletir pagamentos reais.
- Saldo realizado, receitas/despesas realizadas no mês e projeção até o fim do mês, incluindo pendências vencidas.
- Contas com saldo inicial e transferências internas. Transferências não são receitas/despesas nem alteram o saldo global. Lançamentos sem conta continuam no saldo global.
- Orçamentos por categoria, gráficos e temas claro/escuro.
- Backup protegido por senha independente do PIN (JSON), além de Excel e CSV sem criptografia.
- Importação de Excel/JSON com prévia de novos registros, substituições e duplicidades por ID. Contas e transferências também são preservadas e mescladas por ID.

## Contas e datas

Use o saldo anterior ao primeiro lançamento como saldo inicial da conta; cadastrar o saldo de hoje e também receitas antigas duplica valores. Transferências são registradas com a data atual e podem ser excluídas se lançadas por engano. A criação de uma conta não move lançamentos antigos automaticamente.

Nas recorrências/parcelas, as ocorrências seguintes começam como previstas. Para reconhecer um pagamento ou recebimento, edite a transação e escolha Realizado. Projeção é uma estimativa baseada nos lançamentos, sem conexão com bancos ou Open Finance.

## Privacidade e backups

Os dados ficam em `localStorage`, criptografados com AES-256-GCM; a chave deriva do PIN por PBKDF2/SHA-256. O bloqueio por inatividade permanece em dez minutos. Não há recuperação de PIN nem sincronização entre aparelhos.

O JSON de backup usa AES-GCM e uma senha de 8–128 caracteres, independente do PIN. Digite a senha de exportação antes de selecionar um JSON na importação. Não há recuperação da senha. Excel e CSV não são criptografados. Limpar os dados do site apaga o cofre local; mantenha backups.

## Executar e validar

Requer Node.js 24.

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Testes cobrem compatibilidade antiga, status explícito, projeções, saldos por conta, transferências, ida e volta do Excel, mesclagem, backup protegido/senha incorreta e arredondamento das parcelas. São verificações automatizadas, não conciliação bancária.

O aplicativo é estático: build gera `dist/`. Importe dados apenas de arquivos confiáveis de até 5 MB. Backups novos com contas/status exigem esta versão; versões anteriores podem perder os campos novos ao reexportar.

## Transferência TurnoExtra → Dashboard

No TurnoExtra: Configurações → Transferir recebimentos para o Dashboard. No Dashboard: Importar recebimentos do TurnoExtra → selecione o JSON → confira a prévia, conta e categoria → confirme. Somente recebimentos registrados são copiados, com identificadores estáveis. Repetidos são ignorados; alterações exigem seleção explícita e preservam conta/categoria existentes. Exclusões não se propagam automaticamente. Registros antigos sem data de pagamento usam a data do serviço e aparecem sinalizados para conferência. O arquivo é local e não criptografado, limitado a 5 MB; valores em BRL sem conversão. Não há sincronização automática.
