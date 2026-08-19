#!/bin/sh
set -eu

auth_dir="${WHATSAPP_AUTH_DIR:-/tmp/wwebjs_auth}"
mkdir -p "$auth_dir"
chown -R app:app "$auth_dir"

exec gosu app "$@"