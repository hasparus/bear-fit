set -e

BRANCH_NAME=${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD)}
# Sanitize branch name for partykit preview (must match /^[a-z0-9_-]+$/)
BRANCH_NAME=$(echo "$BRANCH_NAME" | tr '/' '-' | tr '[:upper:]' '[:lower:]')
COMMIT_HASH=${COMMIT_HASH:-$(git rev-parse --short HEAD)}

DEPLOY_DATE=$(date -u +"%Y-%m-%d")

APP_VERSION="$BRANCH_NAME.$COMMIT_HASH.$DEPLOY_DATE"

export APP_VERSION

if [ "$BRANCH_NAME" = "main" ]; then
  HOST="bear-fit.hasparus.partykit.dev"
  partykit deploy --var APP_VERSION="$APP_VERSION" -d APP_VERSION="'$APP_VERSION'"
else
  HOST="$BRANCH_NAME.bear-fit.hasparus.partykit.dev"
  partykit deploy --preview $BRANCH_NAME --var APP_VERSION="$APP_VERSION" -d APP_VERSION="'$APP_VERSION'"
fi

if [ ! -z "$GITHUB_ENV" ]; then
  echo "DEPLOYMENT_URL=$HOST" >> $GITHUB_ENV
  echo "$HOST $APP_VERSION deployed successfully!"
fi
