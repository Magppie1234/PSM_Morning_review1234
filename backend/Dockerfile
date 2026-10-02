# The persistent backend. ONE long-lived Node process, which is the whole point of this image:
# the in-memory caches, the in-flight request coalescing and the background warm-up only work when
# the process outlives a request, and the Vercel function model destroyed them between invocations.
#
# Node 24 to match the runtime the Vercel project already reports (nodeVersion 24.x), so behaviour
# does not change with the host.
FROM node:24-alpine

# dumb-init so SIGTERM reaches Node rather than being swallowed by PID 1. Without it the graceful
# shutdown in server.js never runs and every deploy cuts off in-flight requests - which on this API
# can be a 20-second Zoho read.
RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so a source change does not reinstall them.
COPY package*.json ./
RUN npm ci --omit=dev

# Source only. .dockerignore keeps .env, local caches, probes and downloaded CRM data out; nothing
# secret is baked into the image - every credential arrives from the host's environment at runtime.
COPY src ./src

# The host supplies PORT. Binding 0.0.0.0 is required: a container that listens on 127.0.0.1 is
# unreachable from outside itself, which fails the health check and looks like a crash.
ENV HOST=0.0.0.0
EXPOSE 8080

# A health check the host can use directly. It hits the API's own endpoint, which answers without
# touching Zoho, so a Zoho outage does not get reported as an unhealthy container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
