# Integração SharePoint — Controle de Entregas 2026

## Situação
A integração foi implementada no backend, mas **não está ativa até que a TI autorize o acesso** à planilha e configure as variáveis no Render. A aplicação continua funcionando sem essa integração.

## Configuração da Microsoft (TI)
1. Registrar uma aplicação no Microsoft Entra ID no tenant da empresa.
2. Obter **Tenant ID**, **Application (Client) ID** e criar um **Client Secret** (não subir o segredo ao GitHub).
3. Conceder **somente a permissão de leitura necessária** ao arquivo/site e o consentimento administrativo. Para fluxo app-only, avaliar com a TI **Files.Read.All (Application)**, observando que concede escopo amplo; preferir permissões restritas ao site/drive quando disponíveis. Para a rota de link compartilhado, permissões app-only podem variar; o modo mais confiável é fornecer `MS_DRIVE_ID` e `MS_ITEM_ID` de um item ao qual o aplicativo tenha acesso.
4. No Render, adicionar:
   - `MS_TENANT_ID`
   - `MS_CLIENT_ID`
   - `MS_CLIENT_SECRET`
   - `MS_DRIVE_ID` e `MS_ITEM_ID` (recomendado), **ou** `SHAREPOINT_ENTREGAS_URL` com o link completo.
   - `ENTREGAS_SYNC_MINUTES` (opcional; padrão 30, mínimo 5).
5. Configurar o **Build Command do Render** como `npm install` para instalar a dependência `exceljs` e implantar a nova versão.

## Funcionamento
- A cada 30 minutos, enquanto o servidor estiver **ativo**, lê a aba com "Entrega" no nome.
- Reconhece colunas **Pedido(s)**, **Data**, **Transportadora** e o layout antigo sem cabeçalho, quando detectável.
- Preserva `entregaCounts` e `entregaInfo` esperados pelo painel e armazena os dados em um arquivo separado `entregas-sync.json` no Supabase Storage.
- Ao abrir/recarregar o painel, `GET /api/load` combina o SC9 carregado manualmente com a última base de entregas sincronizada.
- Se a sincronização falhar, a última base válida permanece disponível; o erro aparece no endpoint de status.
- Não altera a planilha de origem, não grava chaves no repositório e não expõe endpoints administrativos a operadores.

## Verificação (sessão de administrador)
- `GET /api/entregas-sync/status`: informa se há configuração, última tentativa, último sucesso e erro.
- `POST /api/entregas-sync/run`: dispara manualmente uma leitura e retorna contagem de pedidos/registros. Usar o cookie da sessão de admin.
- Recarregue o painel para visualizar os indicadores atualizados.

## Limitações
- Sem conexão autenticada com o SharePoint não é possível comprovar a leitura da planilha real.
- O serviço Render Free pode adormecer: as tarefas periódicas só funcionam enquanto o processo está ativo. Para atualização garantida em horários fixos, configurar um agendador externo confiável ou um serviço que permaneça ativo.
- A aba original ainda não foi inspecionada; pode ser necessário ajustar o mapeamento de colunas após o primeiro teste.
- A atualização não substitui a importação de SC9/SF2/SC5. Não há autenticação de usuário do Microsoft 365 pelo navegador.
- A interface não exibe ainda um botão específico para sincronização: os endpoints são administrativos e a atualização aparece ao recarregar o painel.
