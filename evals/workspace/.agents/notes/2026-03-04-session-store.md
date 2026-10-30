# Session store: signed cookies, not server-side sessions

Status: accepted
Date: 2026-03-04

## Decision

Cart session state stays in a signed cookie. We are not adding a Redis session store.

## Why

The cart is small (sku + quantity per line) and every read already loads it. A server-side
store would add a network hop and an availability dependency for no payload win, and it would
need its own eviction policy before we have evidence of pressure.

## Consequences

- Signed cookies must stay under the 4 KB header limit; the cart line cap is what enforces it.
- Revocation is limited to rotating the signing key, which logs everyone out. Acceptable now.
