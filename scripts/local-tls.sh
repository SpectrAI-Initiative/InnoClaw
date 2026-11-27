#!/usr/bin/env bash
# Create a throwaway self-signed certificate for local HTTPS development only.
# Never use this, or these files, for a public deployment.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/deploy/tls-local"

if [[ -s "$dir/privkey.pem" && "${1:-}" != "--force" ]]; then
  echo "Already present: $dir (pass --force to regenerate)"
  exit 0
fi

mkdir -p "$dir"
chmod 700 "$dir"

# A config file is used because LibreSSL on macOS has no -addext flag.
cat > "$dir/localhost.cnf" <<'EOF'
[req]
distinguished_name = dn
x509_extensions = v3
prompt = no
[dn]
CN = localhost
[v3]
basicConstraints = critical, CA:TRUE
keyUsage = critical, digitalSignature, keyEncipherment, keyCertSign
extendedKeyUsage = serverAuth
subjectAltName = @alt
[alt]
DNS.1 = localhost
DNS.2 = host.docker.internal
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$dir/privkey.pem" -out "$dir/fullchain.pem" \
  -config "$dir/localhost.cnf" -extensions v3
chmod 600 "$dir/privkey.pem"
rm -f "$dir/localhost.cnf"

echo "Wrote $dir/fullchain.pem and $dir/privkey.pem"
echo "Trust it locally to silence the browser warning, e.g.:"
echo "  macOS:  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $dir/fullchain.pem"
echo "  Linux:  sudo cp $dir/fullchain.pem /usr/local/share/ca-certificates/innoscale-local.crt && sudo update-ca-certificates"
