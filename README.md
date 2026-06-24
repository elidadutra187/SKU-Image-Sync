# SKU Image Sync

**Node.js application to synchronize product images in Nuvemshop using SKU as the operational key.**

This project solves a practical e-commerce operations problem: keeping product images organized and synchronized when each SKU has its own image folder.

Repository: [elidadutra187/SKU-Image-Sync](https://github.com/elidadutra187/SKU-Image-Sync)

---

## Business problem

Product image management becomes messy when an e-commerce catalog grows. Teams often have local folders, repeated images, inconsistent naming and no easy way to check whether the store already has the correct product photos.

The goal of this project is to reduce manual upload work and create a safer workflow to preview, compare and synchronize product images by SKU.

---

## What it does

SKU Image Sync reads local image folders, identifies the SKU from each folder name, searches the matching product in Nuvemshop and prepares a controlled image synchronization process.

The system supports:

- SKU-based folder reading;
- product lookup in Nuvemshop;
- local image preview;
- comparison with current store images;
- dry-run before sync;
- add, sync and replace modes;
- batch processing for large folders;
- Render deployment;
- basic OAuth structure for Nuvemshop app usage.

---

## Stack

- **Node.js** for backend logic
- **Nuvemshop API** for product and image operations
- **Render** for deployment
- **HTML/CSS/JS** for administrative interface
- **CSV support** for SKU filtering
- **OAuth / API tokens** for authentication flow

---

## Expected folder structure

```text
Fotos/
  1001 Produto Azul/
    1.jpg
    2.jpg
  ABC-123 - Camiseta/
    1.jpg
    2.jpg
```

The application extracts the SKU from the folder name and uses it to find the matching product in Nuvemshop.

---

## Sync modes

- **Dry-run** — simulates the operation without changing store images.
- **Add** — adds local images that are not yet synchronized.
- **Sync** — adds new images and updates changed local files.
- **Replace** — removes current product images and uploads the full local folder set.

---

## How it works

```text
Local image folder
→ Extract SKU
→ Find product in Nuvemshop
→ Fetch current product images
→ Generate preview
→ Select products
→ Simulate or sync
→ Log result
```

---

## Use cases

- E-commerce image migration
- Catalog image cleanup
- SKU-based product organization
- Nuvemshop catalog maintenance
- Internal tooling for product teams
- Operational support for stores with many SKUs

---

## Expected impact

- Less manual image upload work
- Fewer product/image mismatches
- More reliable catalog maintenance
- Safer synchronization with preview and dry-run
- Better operational control for e-commerce teams

---

## Status

Portfolio case / working operational tool.

This project represents practical **e-commerce operations engineering**, connecting catalog organization, product data and API workflows.

---

## Security notes

Real secrets must never be committed to the repository. Keep credentials such as access tokens, client secrets, database URLs and session secrets only in environment variables or deployment settings.

---

## Author

**Élida Dutra**  
E-commerce Ops · Automation · Catalog Management · Node.js · Nuvemshop

[LinkedIn](https://www.linkedin.com/in/elidadutra) · [GitHub](https://github.com/elidadutra187)
