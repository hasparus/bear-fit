set -e

BRANCH_NAME=${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD)}
BRANCH_NAME=$(echo "$BRANCH_NAME" | tr '/' '-' | tr '[:upper:]' '[:lower:]')
COMMIT_HASH=${COMMIT_HASH:-$(git rev-parse --short HEAD)}

DEPLOY_DATE=$(date -u +"%Y-%m-%d")

APP_VERSION="$BRANCH_NAME.$COMMIT_HASH.$DEPLOY_DATE"

export APP_VERSION

preview_slots() {
  printf '%s\n' \
    status \
    fix-staging-deploy \
    screenshots \
    claude-adoring-darwi-5ddd \
    claude-availability--0cd2 \
    claude-pensive-bohr-pkc3s \
    claude-rolling-calen-f07c
}

preview_slot_count() {
  preview_slots | wc -l | tr -d ' '
}

preview_slot_at() {
  preview_slots | sed -n "$(( $1 + 1 ))p"
}

preview_start_index() {
  hash=$(printf '%s' "$BRANCH_NAME" | cksum | awk '{print $1}')
  count=$(preview_slot_count)
  echo $((hash % count))
}

deploy_preview() {
  preview_name=$1
  HOST="$preview_name.bear-fit.hasparus.partykit.dev"
  partykit deploy --preview "$preview_name" --var APP_VERSION="$APP_VERSION" -d APP_VERSION="'$APP_VERSION'"
}

if [ "$BRANCH_NAME" = "main" ]; then
  HOST="bear-fit.hasparus.partykit.dev"
  partykit deploy --var APP_VERSION="$APP_VERSION" -d APP_VERSION="'$APP_VERSION'"
  else
    if [ -n "$PARTYKIT_PREVIEW" ]; then
      deploy_preview "$PARTYKIT_PREVIEW"
    else
      preview_name=$(preview_slot_at "$(preview_start_index)")
      deploy_preview "$preview_name"
    fi
  fi

if [ ! -z "$GITHUB_ENV" ]; then
  echo "DEPLOYMENT_URL=$HOST" >> $GITHUB_ENV
  echo "$HOST $APP_VERSION deployed successfully!"
fi
