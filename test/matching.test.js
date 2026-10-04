import assert from 'node:assert/strict';
import test from 'node:test';
const matching = await import('../services/productMatching.js').catch(() => ({}));
const catalog = [
  { id: 1, name: { pt: 'Camiseta Azul' }, variants: [{ sku: 'AZ-123' }] },
  { id: 2, name: { pt: 'Camiseta Verde' }, variants: [{ sku: 'VD-123' }] },
  { id: 3, name: { pt: 'Tênis Branco' }, variants: [{ sku: 'TEN-001' }] },
];
test('filename matching supports names, accents, sequence and SKU priority', () => {
  assert.equal(typeof matching.matchProduct, 'function', 'filename matching is missing');
  assert.equal(matching.matchProduct('camiseta_azul_01.jpg', catalog).product.id, 1);
  assert.equal(matching.matchProduct('tenis-branco-02.png', catalog).product.id, 3);
  assert.equal(matching.matchProduct('AZ-123 - Foto 02.jpg', catalog).product.id, 1);
  assert.equal(matching.matchProduct('TEN-001.jpg', catalog).product.id, 3);
  assert.equal(matching.matchProduct('Camiseta Verde', catalog).reason, 'name');
});
test('duplicate names and approximate matches require manual choice', () => {
  assert.equal(typeof matching.matchProduct, 'function');
  const duplicate = matching.matchProduct('Camiseta Azul.jpg', [...catalog, {id:4, name:'Camiseta Azul'}]);
  assert.equal(duplicate.product, null);
  assert.equal(duplicate.status, 'ambiguous');
  assert.equal(matching.matchProduct('Camiseta.jpg', catalog).product, null);
  assert.equal(matching.matchProduct('IMG_1234.jpg', catalog).product, null);
  assert.equal(matching.matchProduct('AZ-1234.jpg', catalog).product, null);
});
test('flat filenames retain whole names while grouping numbered photos', () => {
  assert.equal(typeof matching.imageGroupName, 'function');
  assert.equal(matching.imageGroupName('Camiseta azul_01.jpg'), 'Camiseta azul');
  assert.equal(matching.imageGroupName('Camiseta azul_02.jpg'), 'Camiseta azul');
  assert.equal(matching.imageGroupName('AZ-123.jpg'), 'AZ-123');
  assert.equal(matching.imageGroupName('IMG_1234.jpg'), 'IMG_1234');
});
