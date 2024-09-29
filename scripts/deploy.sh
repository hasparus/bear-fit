set -e

BRANCH_NAME=${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD)}
COMMIT_HASH=${COMMIT_HASH:-$(git rev-parse --short HEAD)}

APP_VERSION="$BRANCH_NAME.$COMMIT_HASH"

if [ "$BRANCH_NAME" = "main" ]; then
  HOST="bear-fit.hasparus.partykit.dev"
  partykit deploy --var APP_VERSION="$APP_VERSION"
else
  HOST="$BRANCH_NAME.bear-fit.hasparus.partykit.dev"
  partykit deploy --preview $BRANCH_NAME --var APP_VERSION="$APP_VERSION"
fi

if [ ! -z "$GITHUB_ENV" ]; then
  echo "DEPLOYMENT_URL=$HOST" >> $GITHUB_ENV
  echo "$HOST $APP_VERSION deployed successfully!"
fi

