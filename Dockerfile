# Proofseen web: the Next.js application of the monorepo, built and served by one image.
FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# The publishable Clerk and Stripe keys are inlined in the browser bundle at build time: they come in as build
# arguments. Both are public by design (`pk_…`); no secret key is ever a build argument.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RUN pnpm --filter @proofseen/web build
EXPOSE 3100
CMD ["pnpm", "--filter", "@proofseen/web", "start"]
