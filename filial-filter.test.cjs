const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/bundle.js', 'utf8');
function section(from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, from);
  return source.slice(start, end);
}
const context = vm.createContext({Date, Set, Map, Math, Number, String});
vm.runInContext(section('function co(', 'var pa=') + ';var pa=co,Ht=co;var ze=d=>d.toISOString().slice(0,10);' +
  section('function fi(', 'function gi(') +
  section('function xi(', 'function vi(') +
  section('function sc9FiltrarFilial(', 'var pt=') +
  section('function Vi(', 'function sc9FiltrarFilial(').split('function Ao(')[0] +
  ';var Rr=co,Nr=()=>"",Mo=d=>d.toISOString().slice(0,10);' + section('function An(', 'var Ki='), context);
const ao = (items, options) => context.Ao(items, options);
const row = (filial, produto, saldo, armazem='1') => ({filial, produto, produtoBase:produto, saldo, armazem, lote:'L123', dtValidade:new Date('2020-01-01'), dtFabricacao:null, dtEntrada:null});
const rows = [row('01','A',5),row('02','B',9),row(1,'C',0,'2'),row('','D',8)];
test('filial funciona sem armazém e normaliza 01 e 1', () => {
  assert.deepEqual(Array.from(ao(rows,{filial:'01'}), r=>r.produto), ['A','C']);
  assert.equal(ao(rows,{filial:'03'}).length,0);
});
test('sem filtro mantém a lista original', () => assert.equal(ao(rows,{}), rows));
test('selecionar filial não exige saldo positivo', () => assert.equal(ao(rows,{filial:'01'}).length,2));
test('somente com saldo funciona com filial sem armazém', () => {
  assert.deepEqual(Array.from(ao(rows,{filial:'01',soComSaldo:true}), r=>r.produto),['A']);
});
test('prioridade de armazém e checkbox continuam funcionando', () => {
  assert.equal(ao(rows,{armazem:'2',filial:'1',soComSaldo:true}).length,0);
  assert.deepEqual(Array.from(ao(rows,{armazem:'01',soComSaldo:true}),r=>r.produto),['A','B','D']);
});
test('duplicados detectados globalmente mostram só registros da filial', () => {
  const group = {lote:'L123',registros:rows,qtdProdutosDistintos:4,temSaldoAtivo:true};
  const result = ao([group],{filial:'01'});
  assert.equal(result.length,1);
  assert.deepEqual(Array.from(result[0].registros,r=>r.produto),['A','C']);
  assert.equal(result[0].qtdProdutosDistintos,2);
  assert.equal(group.registros.length,4);
  assert.equal(ao(result,{filial:'01'})[0].registros.length,2);
});
test('grupo de outra filial é excluído, e saldo ativo é recalculado', () => {
  const group = {registros:[row('02','B',9),row('01','A',0)],temSaldoAtivo:true};
  assert.equal(ao([group],{filial:'01'})[0].temSaldoAtivo,false);
  assert.equal(ao([group],{filial:'03'}).length,0);
});
test('vencidos e saldo negativo respeitam filial', () => {
  assert.deepEqual(Array.from(ao(context.Ei(rows),{filial:'01'}),r=>r.produto),['A']);
  const negatives=[row('01','A',-3),row('02','B',-8)];
  assert.deepEqual(Array.from(ao(context.xi(negatives),{filial:'01',soComSaldo:true,abs:true}),r=>r.produto),['A']);
});
test('achados salvos aceitam datas restauradas e registro individual', () => {
  const saved=JSON.parse(JSON.stringify(rows));
  saved.forEach(r=>r.dtValidade=new Date(r.dtValidade));
  assert.equal(ao(saved,{filial:'01'}).length,2);
  assert.equal(ao([{registros:saved,validadesDistintas:['2020-01-01']}],{filial:'01'})[0].validadesDistintas.length,1);
});
test('exportação recebe somente linhas filtradas e não altera a origem', () => {
  const original={lote:'L123',registros:rows};
  const exportRows=ao([original],{filial:'01'}).flatMap(group=>context.An('validadeVariavel',group,{}));
  assert.ok(exportRows.every(r=>context.pa(r.Filial)==='1'));
  assert.equal(exportRows.reduce((n,r)=>n+r.Saldo,0),5);
  assert.equal(original.registros.length,4);
});
test('controle de filial está habilitado e listas salvas alimentam suas opções', () => {
  assert.ok(source.includes('"Filial:",React.createElement("select",{value:T,onChange:u=>pe(u.target.value),className:'));
  assert.ok(source.includes('registros||[C.dados||{}]'));
  assert.ok(source.includes('for(let C of Ao(Ea,xa))'));
  assert.ok(source.includes('getTime()),[$,Eo,F,T]),Ca='));
  assert.ok(source.includes('getTime()),[$,Eo,T]),Ta='));
});
