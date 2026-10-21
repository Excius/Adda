# Adda

<!--toc:start-->

- [Adda](#adda)
  - [Repository Structure](#repository-structure)
  - [Quick Start](#quick-start)
    - [1. Install Dependencies](#1-install-dependencies)
    - [2. Run Development Servers](#2-run-development-servers)
    - [3. Build & Typecheck](#3-build-typecheck)
  - [Architecture & WebRTC Flow](#architecture-webrtc-flow)
  <!--toc:end-->

Adda is a multi-party WebRTC audio platform powered by **Mediasoup**, **Socket.IO**, **Next.js**, and **Redis** in a Turborepo monorepo.

---

## Repository Structure

- **`apps/web`**: Next.js 16 frontend with Mediasoup client-side audio rendering and room UI.
- **`apps/api`**: Node.js Express server + Socket.IO + Mediasoup SFU (Selective Forwarding Unit).
- **`packages/types`**: Shared TypeScript type definitions across frontend and backend.

---

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Development Servers

Start both web client and API server concurrently:

```bash
pnpm run dev
```

Or run individually:

```bash
pnpm run dev:api    # Start API server only (port 3000)
pnpm run dev:web    # Start Web frontend only
```

### 3. Build & Typecheck

```bash
pnpm run check-types    # Run TypeScript checks across all packages
pnpm run build          # Create production build
```

---

## Architecture & WebRTC Flow

For a deep dive into the Mediasoup SFU connection pipeline, Router/Worker management, and transport signaling steps, refer to [ARCHITECTURE.md](./ARCHITECTURE.md).
