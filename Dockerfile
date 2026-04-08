# syntax=docker/dockerfile:1

# ====================
# Stage 1: Dependencies
# ====================
FROM node:20-bullseye AS deps

# Dépendances système
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier uniquement les manifests
COPY package.json package-lock.json* ./

# Installation de TOUTES les dépendances (dev nécessaires pour le build Next.js)
RUN npm ci && npm cache clean --force

# ====================
# Stage 2: Builder
# ====================
FROM node:20-bullseye AS builder

WORKDIR /app

# Copier les dépendances depuis le stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copier tout le code source
COPY . .

# Build arguments pour les variables d'environnement
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Dummy env vars for build time (real values injected at runtime via .env)
ENV DATABASE_URL="mongodb://placeholder:27017/placeholder"
ENV NEXTAUTH_SECRET="build-time-placeholder-secret"
ENV NEXTAUTH_URL="http://localhost:3001"

# Build de l'application Next.js
RUN npm run build

# ====================
# Stage 3: Runner (Production)
# ====================
FROM node:20-bullseye-slim AS runner

WORKDIR /app

# Créer un utilisateur non-root pour la sécurité
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Configuration de l'environnement
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Copier le standalone et les fichiers statiques
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Passer à l'utilisateur non-root
USER nextjs

# Exposer le port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))" || exit 1

# Démarrer l'application
CMD ["node", "server.js"]
