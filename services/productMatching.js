// Shared by the browser and server: suggestions never authorize an import.
export function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function imageGroupName(filename) {
  const stem = String(filename || '').replace(/\.(jpe?g|png|webp|gif)$/i, '').trim();
  if (/^(img|dsc|image|foto)[ _-]*\d+$/i.test(stem)) return stem;
  return stem.replace(/[ _-]+\d{1,2}$/, '').trim();
}

export function displayProductName(product) {
  return typeof product.name === 'string' ? product.name
    : product.name?.pt || product.name?.es || product.name?.en || Object.values(product.name || {})[0] || 'Produto sem nome';
}

function names(product) {
  return typeof product.name === 'string' ? [product.name] : Object.values(product.name || {});
}

export function matchProduct(source, catalog) {
  const stem = String(source || '').replace(/\.(jpe?g|png|webp|gif)$/i, '').trim();
  // SKU delimiters are checked without punctuation normalization to avoid collisions.
  const skuMatches = catalog.flatMap((product) => (product.variants || []).filter((variant) => {
    const sku = String(variant.sku || '').trim();
    if (!sku) return false;
    const value = stem.toLowerCase();
    const code = sku.toLowerCase();
    return value === code || (value.startsWith(code) && /^[ _-]/.test(value.slice(code.length, code.length + 1)));
  }).map((variant) => ({product, length: String(variant.sku).trim().length})));
  let candidates = [];
  let reason = 'name';
  if (skuMatches.length) {
    const longest = Math.max(...skuMatches.map((item) => item.length));
    candidates = skuMatches.filter((item) => item.length === longest).map((item) => item.product);
    reason = 'sku';
  } else {
    const keys = new Set([normalizeName(stem), normalizeName(imageGroupName(stem))]);
    candidates = catalog.filter((product) => names(product).some((name) => keys.has(normalizeName(name))));
  }
  candidates = [...new Map(candidates.map((product) => [String(product.id), product])).values()];
  if (candidates.length === 1) return {status:'matched', reason, product:candidates[0], suggestions:[]};
  if (candidates.length > 1) return {status:'ambiguous', reason, product:null, suggestions:candidates};
  const tokens = normalizeName(imageGroupName(stem)).split(' ').filter(Boolean);
  const suggestions = catalog.filter((product) => names(product).some((name) => {
    const words = new Set(normalizeName(name).split(' '));
    return tokens.length > 0 && tokens.every((token) => words.has(token));
  })).slice(0, 10);
  return {status:'unmatched', reason:null, product:null, suggestions};
}
