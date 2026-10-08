# Auto Performance — Interface v2

Projeto React + TypeScript + Vite. Interface responsiva premium com dashboard, gráficos e cadastros locais de clientes, veículos, produtos, serviços, fornecedores, orçamentos, OS, vendas, despesas, caixa e metas.

## Executar

```bash
npm install
npm run dev
npm run build
```

No Windows PowerShell com execução de scripts bloqueada, use `npm.cmd install`, `npm.cmd run dev` e `npm.cmd run build`.

## Limitações IMPORTANTES

- Esta é uma **prévia funcional local**, não uma versão SaaS pronta para produção.
- Os dados são gravados no `localStorage` do navegador. Não há sincronização entre dispositivos, login, backup remoto ou multi-tenant implementado no frontend.
- O dashboard reflete apenas lançamentos locais. A receita/lucro é uma estimativa simplificada, não contabilidade oficial.
- Orçamentos, OS e vendas ainda não têm fluxo transacional integrado; produtos não sofrem baixa automática ao registrar uma venda.
- Não inserir dados reais ou sensíveis antes de conectar Supabase Auth, validar RLS e integrar CRUD transacional ao schema real.
- Não adicionar `service_role` ao frontend. Usar apenas chave pública (`anon`/`publishable`) com RLS testada.

## Próxima etapa

Integrar Supabase Auth + organização ativa + membros e RLS; mapear as 20 tabelas existentes; implementar operações transacionais, itens, pagamentos e estoque com regras de negócio; adicionar testes automatizados e deploy seguro.
