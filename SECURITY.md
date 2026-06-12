# Politica de seguranca

## Credenciais

Nao publique credenciais reais neste repositorio.

Valores que devem ficar apenas no Render ou no ambiente local:

- `NUVEMSHOP_ACCESS_TOKEN`
- `NUVEMSHOP_CLIENT_SECRET`
- `DATABASE_URL`
- `SESSION_SECRET`
- Arquivos `.env`
- Arquivos `.nuvemshop-oauth-token.json`

O arquivo `.env.example` deve conter apenas exemplos sem valor real.

## Se uma credencial for exposta

1. Revogue ou regenere a credencial no provedor original.
2. Remova a credencial do repositorio.
3. Atualize o Render com a nova credencial.
4. Rode uma varredura no historico Git antes de publicar novamente.

## Auditoria local

Comandos uteis:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' "ACCESS_TOKEN|CLIENT_SECRET|DATABASE_URL|SESSION_SECRET|password|secret|token" .
git grep -n -I "ACCESS_TOKEN\\|CLIENT_SECRET\\|DATABASE_URL\\|SESSION_SECRET" $(git rev-list --all)
```
