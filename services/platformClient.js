import NuvemshopClient from './nuvemshop.js';
import YampiClient from './yampi.js';
export function clientForStore(storeId){return String(storeId || '').startsWith('yampi:')
  ?new YampiClient({alias:storeId.slice(6)}):NuvemshopClient.fromStore(storeId);}
