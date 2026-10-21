#!/bin/sh
# Private preview of a branch on the VPS, for design reviews before a GO DEPLOY. The image is built from the source
# tree copied to /root/proofseen/preview-src and runs beside production: same environment file, the uploads volume
# mounted read-only, and a port bound to 127.0.0.1 only. Nothing is public; reach it through an SSH tunnel:
#   ssh -N -L 3200:127.0.0.1:3200 root@<vps>
# Stop it with: docker rm -f proofseen-preview
set -eu

SRC=/root/proofseen/preview-src
ENV_FILE=/root/proofseen/app/.env.production

cd "$SRC"
# Build arguments are read from the production file without printing them.
clerk=$(grep -E '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=' "$ENV_FILE" | cut -d= -f2- || true)
stripe=$(grep -E '^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=' "$ENV_FILE" | cut -d= -f2- || true)
docker build -q -t proofseen-preview \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$clerk" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$stripe" \
  . >/dev/null

docker rm -f proofseen-preview >/dev/null 2>&1 || true
docker run -d --name proofseen-preview \
  --env-file "$ENV_FILE" \
  -e PROOFSEEN_UPLOADS_DIR=/data/uploads \
  -v vps_proofseen-uploads:/data/uploads:ro \
  -p 127.0.0.1:3200:3100 \
  proofseen-preview >/dev/null
echo "preview: http://127.0.0.1:3200 (through the SSH tunnel)"
