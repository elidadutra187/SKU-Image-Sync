#!/usr/bin/env node
/**
 * SKU Image Sync - CLI
 * Sincroniza imagens de produtos da Nuvemshop através do SKU via linha de comando
 */

import 'dotenv/config';
import ImageSyncService from './services/imageSync.js';
import logger from './utils/logger.js';

function parseArgs(argv) {
  const args = {
    imagesRoot: './Fotos',
    mode: 'sync',
    dryRun: false,
    concurrency: 2,
    onlySku: null,
    maxSkus: null,
    reportPath: `relatorio-sync-${Date.now()}.csv`,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--images-root':
        args.imagesRoot = next;
        i++;
        break;
      case '--mode':
        args.mode = next;
        i++;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--concurrency':
        args.concurrency = Number(next);
        i++;
        break;
      case '--only-sku':
        args.onlySku = next;
        i++;
        break;
      case '--max-skus':
        args.maxSkus = Number(next);
        i++;
        break;
      case '--report':
        args.reportPath = next;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Argumento desconhecido: ${arg}`);
        process.exit(1);
    }
  }

  if (!['sync', 'add', 'replace'].includes(args.mode)) {
    console.error('Modo inválido. Use: sync, add ou replace');
    process.exit(1);
  }

  return args;
}

function printHelp() {
  console.log(`
SKU Image Sync - CLI

Uso:
  node sync-images.js [opções]

Opções:
  --images-root <pasta>   Pasta raiz das imagens (padrão: ./Fotos)
  --mode <modo>           Modo de sincronização: sync, add, replace (padrão: sync)
  --dry-run               Simular sem fazer alterações
  --concurrency <n>       Processar N SKUs em paralelo (padrão: 2)
  --only-sku <sku>        Processar apenas um SKU específico
  --max-skus <n>          Limitar a N SKUs
  --report <arquivo>      Caminho do relatório CSV
  --help, -h              Mostrar esta ajuda

Modos:
  add      Adiciona apenas imagens novas, mantém as existentes
  sync     Adiciona novas e atualiza alteradas (detecta por hash)
  replace  Remove todas as imagens e reenvia as da pasta

Exemplos:
  node sync-images.js --dry-run
  node sync-images.js --mode add
  node sync-images.js --mode replace --only-sku 1001
  node sync-images.js --mode sync --max-skus 10 --concurrency 3

Estrutura esperada:
  Fotos/
  ├── 1001/
  │   ├── 1.jpg
  │   ├── 2.jpg
  ├── 1002/
  │   ├── 1.jpg
`);
}

async function main() {
  const args = parseArgs(process.argv);

  try {
    const service = new ImageSyncService(args);
    await service.run();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

main();
