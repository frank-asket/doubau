#!/usr/bin/env bash
# Add Amazon SES DKIM + DMARC DNS records for a domain on Vercel DNS.
#
# Cannot be run from CI without your token — run locally after:
#   vercel login
# or:
#   export VERCEL_TOKEN="..."   # https://vercel.com/account/tokens
#
# Override domain if needed:
#   DOMAIN=doubau.vercel.app ./scripts/add-ses-dns-vercel.sh
#
set -euo pipefail

DOMAIN="${DOMAIN:-doubau.vercel.app}"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel" >&2
  exit 1
fi

echo "Adding SES DNS records on domain: ${DOMAIN}"
echo "(Ensure this domain is added to your Vercel team/project.)"
echo ""

# DKIM CNAMEs — values must match SES → Identities → domain → Publish DNS records
vercel dns add "$DOMAIN" "zgu43fajnhmajl3suw3pfronekbmpjso._domainkey" CNAME \
  "zgu43fajnhmajl3suw3pfronekbmpjso.dkim.amazonses.com"

vercel dns add "$DOMAIN" "6k6zryokwsnn6i2tjhk7imqivco6bej4._domainkey" CNAME \
  "6k6zryokwsnn6i2tjhk7imqivco6bej4.dkim.amazonses.com"

vercel dns add "$DOMAIN" "rtcxfg5gltc2skubdwkn4ceeetfhquqa._domainkey" CNAME \
  "rtcxfg5gltc2skubdwkn4ceeetfhquqa.dkim.amazonses.com"

# DMARC (monitoring only; tighten p= later if desired)
vercel dns add "$DOMAIN" "_dmarc" TXT "v=DMARC1; p=none;"

echo ""
echo "Done. Wait for DNS propagation, then confirm in AWS SES that DKIM shows Success."
echo "If SES still shows Pending, add the domain verification TXT (_amazonses) from the SES console."
