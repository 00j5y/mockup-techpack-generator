# Constitue Studio
#
# Chromium est installe des maintenant, en Phase 0, alors que Puppeteer ne sert
# qu'en Phase 4. C'est delibere : le piege classique est un build qui passe en
# local (Puppeteer telecharge son propre Chromium) et casse en conteneur
# (dependances systeme absentes). On verifie l'infra avant d'en avoir besoin.
# Voir .claude/docs/12-pieges.md.
#
#   docker build -t constitue-studio .                    # image de production
#   docker build --target smoke -t cs-smoke . && \
#     docker run --rm cs-smoke                            # valide le pipeline PDF

# ---------------------------------------------------------------------------
# Socle Chromium, partage par l'execution et le test de fumee
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-debian AS chromium-base

# fonts-liberation et fonts-noto : polices de repli pour Chromium. La police du
# techpack (Source Sans 3) est servie par l'application elle-meme via next/font,
# pas par le systeme, mais Chromium a besoin d'un jeu de base.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-color-emoji \
      ca-certificates \
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ---------------------------------------------------------------------------
# 1. Dependances
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-debian AS deps
WORKDIR /app

# Puppeteer ne telecharge pas Chromium : l'image fournit celui du systeme.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-debian AS builder
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

# ---------------------------------------------------------------------------
# 3. Test de fumee du pipeline PDF
#
# Cible non construite par defaut. Valide le vrai chemin Puppeteer -> Chromium
# systeme, ce que l'image d'execution ne permet pas de tester : la sortie
# `standalone` n'embarque que les dependances atteintes par le code de l'app,
# et Puppeteer n'y entrera qu'en Phase 4.
# ---------------------------------------------------------------------------
FROM chromium-base AS smoke
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY scripts ./scripts

CMD ["bun", "run", "smoke:pdf"]

# ---------------------------------------------------------------------------
# 4. Execution
# ---------------------------------------------------------------------------
FROM chromium-base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Utilisateur non-root, avec un home reellement accessible en ecriture :
# sans ca Chromium echoue a creer son profil NSS et pollue les logs a chaque rendu.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nextjs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
ENV HOME=/home/nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["bun", "server.js"]
