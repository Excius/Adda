FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

# Copy the ENTIRE repository
COPY . .

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Build only the API
RUN pnpm --filter api build

WORKDIR /app/apps/api

EXPOSE 8080

CMD ["pnpm", "start"]
