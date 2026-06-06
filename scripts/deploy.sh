set -e

BRANCH_NAME=${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD)}
COMMIT_HASH=${COMMIT_HASH:-$(git rev-parse --short HEAD)}

DEPLOY_DATE=$(date -u +"%Y-%m-%d")

APP_VERSION="$BRANCH_NAME.$COMMIT_HASH.$DEPLOY_DATE"

export APP_VERSION

# APP_VERSION is baked into the client bundle via vite `define` at build time.
# @cloudflare/vite-plugin emits the deployable Worker (+ assets + resolved
# config) to dist/bear_fit; deploy that build rather than re-bundling from src.
pnpm exec vite build

BUILT_CONFIG="dist/bear_fit/wrangler.json"

if [ "$BRANCH_NAME" = "main" ]; then
  pnpm exec wrangler deploy --config "$BUILT_CONFIG"
  # workers.dev / custom domain origin for the production worker.
  HOST=$(pnpm exec wrangler deployments status --config "$BUILT_CONFIG" 2>/dev/null | grep -oE 'https://[^ ]+' | head -n1)
  HOST=${HOST:-bear-fit.hasparus.workers.dev}
else
  # Non-main branches: upload a preview version without promoting to prod.
  PREVIEW_OUTPUT=$(pnpm exec wrangler versions upload --config "$BUILT_CONFIG")
  echo "$PREVIEW_OUTPUT"
  HOST=$(echo "$PREVIEW_OUTPUT" | grep -oE 'https://[^ ]+' | head -n1)
  HOST=${HOST:-bear-fit.hasparus.workers.dev}
fi

# Strip protocol so callers can prefix with https:// consistently.
HOST=${HOST#https://}
HOST=${HOST#http://}

if [ -n "$GITHUB_ENV" ]; then
  echo "DEPLOYMENT_URL=$HOST" >> "$GITHUB_ENV"
  echo "$HOST $APP_VERSION deployed successfully!"
fi
