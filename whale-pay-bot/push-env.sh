#!/data/data/com.termux/files/usr/bin/bash
# Run once after filling in .env.local
# Pushes each variable into Vercel (production) automatically — no manual prompts.

set -e

if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Fill it in first."
  exit 1
fi

echo "🚀 Pushing env vars to Vercel..."

while IFS='=' read -r key value; do
  # skip empty lines/comments
  [ -z "$key" ] && continue
  [[ "$key" == \#* ]] && continue

  echo "→ Setting $key"
  printf "%s" "$value" | vercel env add "$key" production --force
done < .env.local

echo "✅ Done. Now run: vercel --prod"
