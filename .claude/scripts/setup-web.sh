#!/usr/bin/env bash
# Session setup for the /watch skill on Claude Code on the web.
#
# Runs at SessionStart. Two jobs:
#   1. Install the runtime binaries /watch needs (ffmpeg, ffprobe, yt-dlp) —
#      these are NOT pre-installed in cloud sessions and do not persist between
#      them.
#   2. Point yt-dlp's CA bundle (certifi) at the system trust store, which
#      already contains this environment's egress-proxy CA. Without this,
#      yt-dlp rejects the proxy's TLS interception with
#      "CERTIFICATE_VERIFY_FAILED: self-signed certificate in certificate chain".
#
# Requires network access to package registries (PyPI + apt). If the
# environment's Network access is "Custom", tick "Also include default list of
# common package managers" so pip/apt can reach their registries.
set -uo pipefail

# 1. yt-dlp via pip (fast, no apt round-trip). Pulls certifi as a dependency.
if ! command -v yt-dlp >/dev/null 2>&1; then
  pip install -q --no-input yt-dlp >/dev/null 2>&1 || true
fi

# 2. ffmpeg + ffprobe via apt. --no-install-recommends skips optional GPU
#    driver packages that can 404 on stale mirrors.
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y --no-install-recommends ffmpeg >/dev/null 2>&1 || true
fi

# 3. CA fix: copy the system bundle (includes the egress proxy CA) over
#    certifi's bundle so yt-dlp's HTTPS verifies against video hosts.
SYS_CA=/etc/ssl/certs/ca-certificates.crt
if [ -f "$SYS_CA" ]; then
  CERTIFI_PEM="$(python3 -c 'import certifi; print(certifi.where())' 2>/dev/null || true)"
  if [ -n "${CERTIFI_PEM:-}" ] && [ -f "$CERTIFI_PEM" ]; then
    cp "$SYS_CA" "$CERTIFI_PEM" 2>/dev/null || true
  fi
fi

echo "[watch-setup] ffmpeg=$(command -v ffmpeg || echo MISSING) ffprobe=$(command -v ffprobe || echo MISSING) yt-dlp=$(command -v yt-dlp || echo MISSING)"
