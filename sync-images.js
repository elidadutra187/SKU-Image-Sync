#!/usr/bin/env node
import 'dotenv/config';

import ImageSyncService from './services/imageSync.js';
import logger from './utils/logger.js';

function printHelp() {
  console.log(`
SKU Image Sync CLI

Usage:
  node sync-images.js [options]

Options:
  --images-root <folder>  Images root folder. Default: ./Fotos
  --mode <mode>           add, sync or replace. Default: sync
  --dry-run               Simulate without uploading or deleting images
  --concurrency <number>  Number of SKU folders processed in parallel. Default: 2
  --only-sku <sku>        Process only one SKU folder
  --max-skus <number>     Limit the number of SKU folders
  --report <file>         CSV report path
  --help, -h              Show this help

Expected folder structure:
  Fotos/
    1001/
      1.jpg
      2.jpg
    1002/
      1.jpg
      2.jpg
`);
}

function parseArgs(argv) {
  const args = {
    imagesRoot: process.env.IMAGES_ROOT || './Fotos',
    mode: 'sync',
    dryRun: false,
    concurrency: 2,
    onlySku: null,
    maxSkus: null,
    reportPath: `reports/sku-image-sync-${Date.now()}.csv`,
  };

  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--images-root':
        args.imagesRoot = next;
        index++;
        break;
      case '--mode':
        args.mode = next;
        index++;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--concurrency':
        args.concurrency = Number(next);
        index++;
        break;
      case '--only-sku':
        args.onlySku = next;
        index++;
        break;
      case '--max-skus':
        args.maxSkus = Number(next);
        index++;
        break;
      case '--report':
        args.reportPath = next;
        index++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function main() {
  try {
    const service = new ImageSyncService(parseArgs(process.argv));
    await service.run();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

main();
