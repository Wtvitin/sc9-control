"use strict";
// Leitura autenticada do Controle de Entregas no OneDrive/SharePoint via Microsoft Graph.
// Credenciais exclusivamente em variáveis de ambiente do servidor.
const ExcelJS = require("exceljs");
const MAX_BYTES = 25 * 1024 * 1024;
const normalize = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const asText = (v) => {
  if (v == null) return "";
  if (typeof v === "object" && !(v instanceof Date)) {
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
  }
  return String(v).trim().replace(/\.0$/, "");
};
function isConfigured(env = process.env) {
  return !!(env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET &&
    ((env.MS_DRIVE_ID && env.MS_ITEM_ID) || env.SHAREPOINT_ENTREGAS_URL));
}
async function requestToken(env = process.env) {
  const url = `https://login.microsoftonline.com/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID, client_secret: env.MS_CLIENT_SECRET,
    grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default"
  });
  const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},body });
  if (!res.ok) throw new Error(`Microsoft Entra token: HTTP ${res.status}. Verifique o consentimento do administrador e as credenciais.`);
  const json = await res.json();
  if (!json.access_token) throw new Error("Microsoft Entra não retornou access_token.");
  return json.access_token;
}
function graphFileUrl(env = process.env) {
  if (env.MS_DRIVE_ID && env.MS_ITEM_ID) {
    return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(env.MS_DRIVE_ID)}/items/${encodeURIComponent(env.MS_ITEM_ID)}/content`;
  }
  const shareId = "u!" + Buffer.from(env.SHAREPOINT_ENTREGAS_URL, "utf8").toString("base64url");
  return `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`;
}
async function downloadWorkbook(env = process.env) {
  if (!isConfigured(env)) throw new Error("Configuração Microsoft Graph incompleta.");
  const token = await requestToken(env);
  const res = await fetch(graphFileUrl(env), {headers:{Authorization:`Bearer ${token}`},redirect:"follow"});
  if (!res.ok) throw new Error(`Microsoft Graph: HTTP ${res.status} ao acessar a planilha; confirme permissões no arquivo.`);
  const length = Number(res.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("Planilha ultrapassa o limite de 25 MB.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("Planilha ultrapassa o limite de 25 MB.");
  return buf;
}
function parseWorkbook(wb) {
  const ws = wb.worksheets.find((sheet) => normalize(sheet.name).includes("ENTREGA")) ||
    (wb.worksheets.length === 1 ? wb.worksheets[0] : null);
  if (!ws) throw new Error('A planilha precisa ter uma aba contendo "Entrega" no nome.');
  let header = 0, pedidoCol = 0, dateCol = 0, transpCol = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 8); r++) {
    const row = ws.getRow(r);
    row.eachCell({includeEmpty:false}, (cell,col) => {
      const val = normalize(asText(cell.value));
      if ((val === "PEDIDO" || val === "PEDIDOS") && !pedidoCol) pedidoCol = col;
      if (val === "DATA" && !dateCol) dateCol = col;
      if (val === "TRANSPORTADORA" && !transpCol) transpCol = col;
    });
    if (pedidoCol) {header = r;break;}
    dateCol=0;transpCol=0;
  }
  // Compatibilidade com a exportação sem cabeçalho validada pelo painel.
  if (!pedidoCol) {
    let valid = 0, tested = 0;
    for (let r=1;r<=Math.min(ws.rowCount,20);r++) {
      const raw=asText(ws.getRow(r).getCell(5).value);
      if (!raw) continue;
      tested++;
      if (/^\d{4,8}$/.test(raw)) valid++;
    }
    if (tested<3 || valid/tested<0.7) throw new Error("Coluna Pedido(s) não encontrada.");
    pedidoCol=5;dateCol=1;transpCol=2;header=0;
  }
  const counts = new Map(), info = new Map();
  for (let r=header+1;r<=ws.rowCount;r++) {
    const row=ws.getRow(r), pedido=asText(row.getCell(pedidoCol).value);
    if (!pedido || (header===0 && !/^\d+$/.test(pedido))) continue;
    counts.set(pedido,(counts.get(pedido)||0)+1);
    if (!info.has(pedido)) {
      const rawDate=dateCol?row.getCell(dateCol).value:null;
      let date=null;
      if (rawDate instanceof Date && !isNaN(rawDate)) date=rawDate.toISOString().slice(0,10);
      else if (typeof rawDate === "number" && rawDate>10000 && rawDate<100000)
        date=new Date(Math.round((rawDate-25569)*86400000)).toISOString().slice(0,10);
      const transp=transpCol?asText(row.getCell(transpCol).value):"";
      info.set(pedido,{data:date,transportadora:transp||null});
    }
  }
  if (!counts.size) throw new Error("Nenhum pedido encontrado na aba Entrega.");
  return {entregaPresent:true,entregaCounts:[...counts],entregaInfo:[...info],
    entregueRegistros:[...counts.values()].reduce((a,b)=>a+b,0),entreguePedidos:counts.size,
    aba:ws.name,atualizadoEm:new Date().toISOString()};
}
async function fetchEntregas(env=process.env) {
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.load(await downloadWorkbook(env));
  return parseWorkbook(wb);
}
module.exports={isConfigured,graphFileUrl,parseWorkbook,fetchEntregas};
