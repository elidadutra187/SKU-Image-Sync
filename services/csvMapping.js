// Shared by the browser and server: the browser splits the CSV into batches with the same rules
// the server uses to validate each batch.
const invalidCsv=message=>Object.assign(new Error(message),{status:400,public:true});
const normalizeHeader=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

export function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if(quoted)throw invalidCsv('CSV inválido: feche as aspas do campo.');
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export const fileKey=value=>String(value||'').replaceAll('\\','/').replace(/^\.\//,'').normalize('NFC').toLowerCase();

export function parseCsvAssignments(text) {
  const rows=parseCsv(String(text||'').replace(/^\uFEFF/,''));
  const headers=(rows.shift()||[]).map(normalizeHeader);
  const skuIndex=headers.indexOf('sku'),fileIndex=headers.findIndex(x=>['arquivo','filename','file','foto','imagem'].includes(x));
  if(skuIndex<0||fileIndex<0)throw invalidCsv('O CSV precisa das colunas sku e arquivo. Baixe o modelo e preencha uma linha por foto.');
  if(!rows.length)throw invalidCsv('O CSV não contém fotos. Preencha uma linha por foto.');
  const mapping=new Map();
  for(const [i,row] of rows.entries()) {
    const sku=row[skuIndex]?.trim(),filename=row[fileIndex]?.trim();
    if(!sku||!filename)throw invalidCsv(`CSV: preencha SKU e arquivo na linha ${i+2}.`);
    const key=fileKey(filename);
    if(mapping.has(key)&&mapping.get(key).sku!==sku)throw invalidCsv(`O arquivo ${filename} está associado a mais de um SKU no CSV.`);
    mapping.set(key,{sku,filename});
  }
  return mapping;
}

// A selected file belongs to a CSV row by full relative path, or by bare filename when the row has no folder.
export const csvRowMatchesFile=(key,path,name)=>fileKey(path)===key || !key.includes('/')&&fileKey(name)===key;

export function buildCsv(rows) {
  const cell=value=>/[;"\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value;
  return ['sku;arquivo',...rows.map(row=>`${cell(row.sku)};${cell(row.filename)}`)].join('\n');
}
