# Ansybl Private Messaging

**Specification ANSYBL-PM, version 1.0-draft**
Status: Draft for review · Extends Ansybl 1.0 · Target: Ansybl 1.1

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT,
RECOMMENDED, MAY, and OPTIONAL are to be interpreted as described in RFC 2119.

---

## 1. Overview

This document specifies encrypted messaging for Ansybl. It defines a single
mechanism — the **sealed envelope** — that serves both direct messages and
encrypted broadcast to a subscriber set. A direct message is an envelope with
one recipient; a subscriber-only post is an envelope with many. There is no
separate direct-message subsystem.

### 1.1 Design principle

Envelopes are published by the **sender**, in the sender's own feed, as ordinary
static files. Recipients retrieve them by polling feeds they already follow.

This preserves Ansybl's core property: no participant is required to operate a
server that accepts writes, and no server is trusted with plaintext, key
material, or access control. Access control is enforced cryptographically. A
recipient can decrypt because they hold a key, not because a server permitted it.

One exception is defined in §9 (cold contact), and it is optional.

### 1.2 Relationship to other sections

This specification depends on:

- **Key bundles** (§2), a new feed document type.
- **Chunked feeds** (ANSYBL-CHUNK), which private feeds reuse without modification.

It introduces no new transport, no new discovery mechanism, and no new trust
anchor. An implementation that already fetches, verifies, and caches public
Ansybl feeds needs approximately one additional primitive — X25519 — to support
this specification.

---

## 2. Key bundles

### 2.1 Rationale

Ansybl 1.0 places a single `public_key` in the feed author object. That is
insufficient for encryption for three reasons: signature keys and key-agreement
keys are different algorithms with different lifetimes; there is no way to
express validity windows, so rotation destroys the verifiability of history; and
there is no way to publish encryption material at all.

A **key bundle** replaces the bare key. It is a signed document, so it is
self-authenticating: a reader who trusts the identity key trusts the bundle.

### 2.2 Location

A conforming publisher MUST serve a key bundle at:

```
{feed_root}/keys.ansybl
```

The bundle MUST be served with `Cache-Control: public, max-age=300` or less.

### 2.3 Format

```json
{
  "version": "https://ansybl.org/version/1.1",
  "type": "key_bundle",
  "identity": "ed25519:MCowBQYDK2VwAyEA...",
  "fingerprint": "b3:9f2a4c1e...",
  "kem_keys": [
    {
      "id": "k12",
      "key": "x25519:d4Kj9...",
      "valid_from": "2026-08-01T00:00:00Z",
      "valid_until": "2026-11-01T00:00:00Z"
    },
    {
      "id": "k11",
      "key": "x25519:Ba7Qm...",
      "valid_from": "2026-05-01T00:00:00Z",
      "valid_until": "2026-08-01T00:00:00Z"
    }
  ],
  "drop": "https://drop.example.com/v1/9f2a4c1e...",
  "drop_difficulty": 20,
  "superseded_by": null,
  "issued_at": "2026-08-01T00:00:00Z",
  "signature": "ed25519:..."
}
```

| Field | Req | Description |
|---|---|---|
| `identity` | MUST | Long-lived Ed25519 public key. The identity anchor. |
| `fingerprint` | MUST | BLAKE3-256 of the raw identity key bytes, `b3:` prefixed, lowercase hex. |
| `kem_keys` | MUST | Array of X25519 keys, newest first. At least one MUST be currently valid. |
| `drop` | MAY | Cold-contact endpoint (§9). Absence means the publisher accepts no cold contact. |
| `drop_difficulty` | MAY | Required proof-of-work difficulty in leading zero bits. Default 20. |
| `superseded_by` | MAY | Identity rotation pointer (§2.6). |
| `signature` | MUST | Ed25519 over the RFC 8785 canonical form of the document with `signature` removed, signed by `identity`. |

### 2.4 Medium-term KEM keys

This specification deliberately does **not** use one-time prekeys.

One-time prekeys require consumption tracking: each key must be handed to exactly
one sender. A static file cannot enforce this — two senders fetching the same
bundle would both take the same prekey, silently losing the forward-secrecy
property the prekey existed to provide.

Instead, KEM keys are **medium-term** and rotate on a schedule. Publishers SHOULD
rotate every 90 days. This yields coarse-grained forward secrecy — compromise of
a current KEM private key exposes at most one rotation window — with no
consumption semantics and no state.

Senders MUST select the KEM key whose validity window contains the send time. If
several are valid, senders MUST select the newest. Senders MUST NOT use a key
whose `valid_until` has passed.

### 2.5 KEM key retirement and history

Recipients need old messages and forward secrecy, which are in tension. Resolve
it at rotation time:

1. Generate the new KEM keypair and publish the updated bundle.
2. Decrypt retained history under the outgoing key.
3. Re-encrypt that history to the new key in the local archive (§10).
4. Securely delete the outgoing KEM private key.

A client that completes step 4 achieves genuine forward secrecy for windows
older than the current one while retaining readable history. Clients SHOULD do
this. Clients that retain old KEM private keys MUST NOT claim forward secrecy in
their user interface.

### 2.6 Identity rotation

The identity key is long-lived and SHOULD NOT rotate. When it must:

1. The old bundle is republished with `superseded_by` set to the new
   fingerprint, still signed by the **old** identity key.
2. The new bundle is published with a `rotated_from` field naming the old
   fingerprint, signed by the **new** key.

A client that sees both MUST treat the new identity as continuous with the old.
Content signed under the old key remains verifiable under the old key. Clients
MUST surface identity rotation to the user; it is exactly the event an attacker
would forge if they could.

---

## 3. Cryptographic construction

### 3.1 Primitives

| Purpose | Algorithm |
|---|---|
| Signatures | Ed25519 (RFC 8032) |
| Key agreement | X25519 (RFC 7748) |
| Key derivation | HKDF-SHA-256 (RFC 5869) |
| Content encryption | AES-256-GCM, 96-bit nonce |
| Hashing / fingerprints | BLAKE3-256 |

All are available in WebCrypto or in a small audited library on every target
platform. Implementations MUST NOT substitute alternatives.

### 3.2 Why not reuse the Ed25519 key

Ed25519 keys can be converted to X25519. This specification does not do so.
Using one keypair across a signature scheme and a key-agreement scheme
invalidates the security proofs of both, and the failure modes are subtle. The
cost of a second key is a few dozen bytes in a document that is fetched rarely
and cached. Publish both.

### 3.3 Sender key derivation

Per envelope, the sender:

1. Generates a fresh ephemeral X25519 keypair `(esk, epk)`. This keypair MUST
   NOT be reused across envelopes.
2. Generates a random 32-byte content encryption key `CEK`.
3. Encrypts the inner plaintext (§5) once under `CEK`.
4. For each recipient `i` with KEM public key `K_i`:

```
shared_i = X25519(esk, K_i)
prk_i    = HKDF-Extract(salt = epk_bytes, ikm = shared_i)
tag_i    = HKDF-Expand(prk_i, "ansybl-pm-v1 tag",  16)
wk_i     = HKDF-Expand(prk_i, "ansybl-pm-v1 wrap", 32)
```

5. Wraps `CEK` under `wk_i` using AES-256-GCM with a fresh 96-bit nonce.
6. Securely erases `esk` and `CEK`.

The message body is encrypted **once**, regardless of recipient count. Only the
wrapped key is per-recipient, at 48 bytes each.

### 3.4 Recipient scanning

For each envelope, the recipient computes:

```
shared = X25519(kem_private, envelope.epk)
prk    = HKDF-Extract(salt = envelope.epk, ikm = shared)
tag    = HKDF-Expand(prk, "ansybl-pm-v1 tag", 16)
```

and looks up `tag` in the envelope's recipient table. On a hit, it derives `wk`
identically, unwraps `CEK`, and decrypts the body.

This is one X25519 operation per envelope — approximately 60 μs — followed by a
hash-map lookup. Clients MUST perform the lookup in constant time with respect
to recipient position, and MUST scan only newly retrieved entries (§8).

If the recipient holds multiple unretired KEM private keys, it MUST attempt each
whose validity window contains the envelope's `created_at`.

### 3.5 Unlinkability

Because `epk` is fresh per envelope, `tag_i` is unlinkable across envelopes: the
same recipient produces an unrelated tag every time. An observer holding the
complete feed cannot determine whether two envelopes share a recipient, cannot
identify recipients, and cannot construct the social graph.

Recipient **count** is observable from the table length. §7 specifies padding.

---

## 4. Envelope format

Envelopes are NDJSON lines in a private chunked feed (§6). One line, one
envelope.

```json
{
  "guid": "01J8XQ...",
  "type": "envelope",
  "created_at": "2026-08-14T10:00:00Z",
  "prev": "b3:7c1d9a...",
  "epk": "x25519:Ap9Km...",
  "recipients": [
    { "tag": "9f2a4c1e8b3d5f70", "wk": "BASE64", "wn": "BASE64" }
  ],
  "n": "BASE64",
  "ct": "BASE64",
  "signature": "ed25519:..."
}
```

| Field | Description |
|---|---|
| `guid` | Unique, sortable, monotonic per feed. |
| `prev` | BLAKE3-256 of the preceding line's canonical bytes. Chains the chunk. |
| `epk` | Ephemeral X25519 public key for this envelope. |
| `recipients` | Table of `{tag, wrapped_key, wrap_nonce}`. Order MUST be randomized. |
| `n` | AES-GCM nonce for the body. |
| `ct` | Body ciphertext with appended GCM authentication tag. |
| `signature` | See §4.1. |

Recipient order MUST be randomized per envelope. Stable ordering would leak
recipient identity across messages even though the tags themselves are
unlinkable.

### 4.1 Outer signature and sender exposure

Two delivery modes differ in where the sender's signature sits, and this is
security-relevant, not cosmetic.

**Outbox mode (§6, normal case).** The envelope is published in the sender's own
feed. Sender identity is already public — it is their feed. The envelope MUST
carry an outer `signature`: Ed25519 by the sender's identity key over the RFC
8785 canonical form of the envelope with `signature` removed. This makes the
private feed verifiable by exactly the same machinery as a public feed, and
prevents a host from injecting or altering envelopes.

**Drop mode (§9, cold contact).** The envelope is delivered to a third-party
endpoint. An outer signature would disclose the sender to the drop operator,
defeating the purpose. In drop mode the outer `signature` field MUST be omitted,
and the sender's signature MUST instead appear inside the encrypted plaintext
(§5). The drop operator then learns nothing about who sent what.

Clients MUST reject an outbox-mode envelope lacking an outer signature. Clients
MUST reject a drop-mode envelope whose decrypted plaintext lacks a valid inner
signature.

---

## 5. Inner plaintext

The plaintext encrypted under `CEK` is an RFC 8785 canonical JSON document:

```json
{
  "sender": "ed25519:MCowBQ...",
  "sender_fingerprint": "b3:9f2a4c1e...",
  "sent_at": "2026-08-14T10:00:00Z",
  "thread": "01J8XQ...",
  "in_reply_to": "01J8XP...",
  "content_text": "...",
  "content_markdown": "...",
  "attachments": [ ... ],
  "pad": "AAAAAAAA...",
  "inner_signature": "ed25519:..."
}
```

`sender` and `sender_fingerprint` are REQUIRED and bind the message to an
identity that the recipient can independently resolve.

`inner_signature` is REQUIRED in drop mode and OPTIONAL in outbox mode, per §4.1.
When present it is Ed25519 over the canonical plaintext with `inner_signature`
and `pad` removed.

`pad` is a base64 run of zero bytes used to reach a size class (§7). Clients MUST
ignore its contents.

Attachments follow the Ansybl 1.0 attachment schema with one addition: media for
private messages MUST be encrypted client-side under an independent key carried
in the plaintext, and the `url` MUST point at an opaque, non-enumerable object
key. Publishing private-message media unencrypted at a guessable URL is a
non-conformance.

### 5.1 Deniability

The inner signature makes messages **non-repudiable**: a recipient can prove to a
third party who sent a message. This is consistent with Ansybl's
signature-everywhere model, and it is the correct default for a protocol whose
premise is verifiable authorship.

Implementations wanting deniability may substitute an HMAC under a derived key in
place of the inner signature, which authenticates to the recipient without
proving anything to third parties. This is left for a future revision; it is not
specified here, and clients MUST NOT claim deniability under this version.

---

## 6. Private feeds

Private feeds reuse the chunked feed layout without modification:

```
feeds/{fingerprint}/private/head.ansybl
feeds/{fingerprint}/private/chunk/000042.ansybl
```

Paths are anchored to the **key fingerprint**, not the handle. Handles are
mutable display attributes and MUST NOT appear in stable paths.

The head is a signed pointer:

```json
{
  "type": "private_head",
  "seq": 42,
  "count": 7,
  "last_guid": "01J8XQ...",
  "updated_at": "2026-08-14T10:00:00Z",
  "signature": "ed25519:..."
}
```

Sealed chunks are immutable and MUST be served with
`Cache-Control: public, max-age=31536000, immutable`. The head MUST be served
with a TTL of 60 seconds or less.

A private feed is world-readable. Confidentiality comes from encryption, not
access control. Implementations MUST NOT rely on hosting-level access rules for
confidentiality; they may be added as defense in depth but MUST NOT be assumed.

### 6.1 Following and decryption are independent

- **Following determines retrieval.** A client polls private feeds belonging to
  identities it follows.
- **The recipient table determines decryption.** Access is cryptographic.

Consequences implementations MUST handle correctly:

- Unfollowing does not revoke access to messages already retrieved. It cannot;
  the recipient holds the plaintext. Clients MUST NOT present unfollowing as
  revocation.
- Addressing an envelope to an identity that does not follow the sender produces
  a message that is never retrieved. Clients SHOULD warn the sender.
- Removing a recipient from future envelopes is sufficient for one-to-one and
  small-group messaging. Channels require epoch rotation (§7.2).

---

## 7. Scaling the recipient set

### 7.1 Padding

Recipient count and ciphertext length are observable. Both MUST be padded.

Recipient tables MUST be padded to the next size class in
`{1, 2, 4, 8, 16, 32, 64, 128, 256, 512}` using **decoy entries**: a decoy has a
random 16-byte `tag` and random `wk`/`wn` of correct length, and is
computationally indistinguishable from a real entry.

Plaintext MUST be padded via the `pad` field to the next size class in
`{256, 1024, 4096, 16384, 65536}` bytes, and above 64 KiB to the next multiple
of 65536.

Padding is applied per envelope. It MUST NOT be applied at chunk granularity, as
chunk-level padding is defeated by byte-range retrieval (§8).

### 7.2 Channel mode

Above 512 recipients, per-envelope wrapping becomes the dominant cost — 50,000
recipients is roughly 2.4 MB of key material per message. Senders MAY instead
use a **channel key**.

A channel is identified by `channel_id` and versioned by a monotonic `epoch`. The
channel key for an epoch is distributed as an ordinary envelope (§4) with inner
type `channel_key`. Subsequent messages are:

```json
{
  "guid": "01J8XR...",
  "type": "channel_message",
  "channel": "c:4f2a9b...",
  "epoch": 7,
  "created_at": "2026-08-14T10:05:00Z",
  "prev": "b3:...",
  "n": "BASE64",
  "ct": "BASE64",
  "signature": "ed25519:..."
}
```

Channels above 1024 members MUST distribute the channel key through a key tree
(§7.3) rather than wrapping it per member.

Epoch rules:

- Adding a recipient requires **no** rotation. Send them the current epoch key.
  They gain access to history from that epoch forward.
- Removing a recipient REQUIRES incrementing the epoch and distributing a fresh
  key to the remaining set.
- Senders SHOULD batch removals. Rotation cost is one envelope with the full
  remaining recipient table.

Channel mode trades unlinkability for scale: `channel_id` is a stable public
identifier, so an observer can see that a channel exists and how often it is
used, though not who belongs to it. Clients MUST make this trade visible to the
user rather than silently switching modes.

---

### 7.3 Key trees

Linear distribution — one wrapped key per member — makes rotation cost
proportional to audience size. At 10,000 members a rotation is roughly 480 KB; at
one million it is approximately 48 MB, which is not viable at any useful
frequency.

Channels with more than **1024** members MUST use a key tree. Smaller channels
MAY.

#### 7.3.1 Structure

Members occupy the leaves of a left-balanced binary tree. Every node, internal
and leaf, holds a 32-byte key. A member holds exactly the keys on the path from
its own leaf to the root — `⌈log₂ n⌉ + 1` keys — and no others.

The **root key is the channel key** for the current epoch. Content encryption is
unchanged: messages are encrypted once under the root key, exactly as in §7.2.

```
                  root  (= epoch key)
                 /    \
              n1        n2
             /  \      /  \
           L0   L1   L2   L3
        (alice)(bob)(carol)(dave)

   bob holds:  L1, n1, root
```

Unoccupied leaves are **blank**: they hold no key and are skipped in rekey
computation. Publishers SHOULD fill blank leaves before growing the tree.

#### 7.3.2 Rekey on departure

To remove a member, the publisher replaces every key on the departing member's
path — its leaf, each ancestor, and the root — and publishes a **rekey entry**
containing, for each replaced node, the new key wrapped under:

- the key of that node's **sibling** subtree (unchanged, known to everyone in it), and
- the **new** key of the node's child on the departing path.

The departing member holds none of these wrapping keys and learns nothing.
Everyone else derives the new root by unwrapping upward from whichever wrapping
key they hold.

Rekey size is approximately `2 · ⌈log₂ n⌉` wrapped keys, at 48 bytes each.

| Members | Linear rotation | Key tree |
|---|---|---|
| 1,000 | 48 KB | ~1.0 KB |
| 10,000 | 480 KB | ~1.3 KB |
| 100,000 | 4.8 MB | ~1.6 KB |
| 1,000,000 | 48 MB | ~1.9 KB |

#### 7.3.3 Batch departure

Removing several members at once MUST be performed as a single rekey. The
publisher computes the union of the affected paths, deduplicates shared
ancestors, and replaces each affected node once. Cost is sublinear in the number
of departures because paths converge near the root.

Publishers MUST NOT emit one rekey per departure when departures are known
together.

#### 7.3.4 Enrollment

The publisher assigns the new member a blank leaf, generates its leaf key, and
sends that member the keys on its path in a `channel_key` envelope (§7.2).

Enrollment MAY proceed without rotation, which costs one envelope. This grants
the new member the current root key, and therefore the ability to decrypt any
ciphertext from the current epoch that they may have already retrieved.

Publishers requiring that new members cannot read content published before their
enrollment MUST rekey the new member's path, at the cost of §7.3.2. Publishers
MUST disclose which behavior they implement.

#### 7.3.5 Tree state

The publisher holds the complete tree and MUST treat it as secret; it is
equivalent to holding every member's access. Members hold only their own path and
their leaf index.

Rekey entries reference nodes by **level-order index**, so a member can determine
which wrapped key applies to it from its own leaf index without knowing the rest
of the tree. Rekey entries MUST NOT disclose which leaf was vacated.

Members MUST retain their path keys across epochs until superseded by a rekey.
A member that misses a rekey entry — through a retrieval gap — MUST detect this
via the epoch counter and request re-enrollment rather than silently failing to
decrypt.

#### 7.3.6 Rekey entry format

```json
{
  "guid": "01J8XV...",
  "type": "channel_rekey",
  "channel": "c:4f2a9b...",
  "epoch": 8,
  "nodes": [
    { "idx": 1,    "wrapped": ["BASE64", "BASE64"], "nonces": ["BASE64", "BASE64"] },
    { "idx": 4,    "wrapped": ["BASE64"],           "nonces": ["BASE64"] }
  ],
  "created_at": "...",
  "prev": "b3:...",
  "signature": "ed25519:..."
}
```

Each node entry carries the new key wrapped once per applicable wrapping key.
Node ordering MUST be randomized, and publishers MUST pad `nodes` to the next
power of two with decoy entries, so that rekey size does not disclose tree depth
or the position of the vacated leaf.

#### 7.3.7 Relationship to MLS

RFC 9420 (Messaging Layer Security) specifies TreeKEM, a more capable
construction supporting decentralized group state where any member may propose
changes.

This specification does not use TreeKEM. Ansybl channels are
publisher-controlled broadcast: one writer determines membership, and members are
passive recipients who never propose changes. Classical Logical Key Hierarchy
(RFC 2627) matches that shape, requires no ordered group state, no commit
sequencing, and no member participation in rekey — all of which suit static
hosting, where members may be offline for arbitrary periods and retrieve out of
order.

Implementations needing symmetric group membership SHOULD use MLS directly rather
than extending this construction.

## 8. Retrieval

A conforming client, per followed identity:

1. Fetch `private/head.ansybl` with `If-None-Match`. On 304, stop.
2. Compare `seq` and `count` against local state to identify new lines.
3. Fetch only new content: sealed chunks by number, the open chunk by
   `Range: bytes={offset}-` with `If-Range` set to the stored ETag. If the ETag
   has changed, fall back to a full chunk fetch.
4. Verify the outer signature and the `prev` hash chain across new lines. A break
   in the chain MUST be surfaced as tampering, not silently repaired.
5. For each new envelope, derive `tag` (§3.4) and look it up.
6. On a hit, unwrap and decrypt. On a miss, discard the envelope. Clients MUST
   NOT retain undecryptable envelopes beyond the current scan.
7. Append plaintext to the local store and the encrypted archive (§10).

Clients MUST NOT rescan sealed chunks already scanned. Scanning cost is
proportional to new envelopes, not to feed size.

Clients SHOULD apply adaptive poll backoff per feed, and MAY use a digest or
changelog service to identify changed feeds in a single request. Any such service
is untrusted: it can omit updates but cannot forge them, because every envelope
is verified against the sender's identity key. Clients MUST fall back to direct
polling when a digest is unavailable, and MUST NOT treat digest absence as
absence of messages.

---

## 9. Cold contact (optional)

Outbox delivery requires the recipient to already follow the sender. This is
strong spam resistance — unsolicited messages are self-hosted and never
retrieved — but it makes first contact impossible.

Publishers MAY declare a `drop` in their key bundle. A drop is a minimal endpoint
that accepts opaque blobs addressed to a blinded identifier derived from the
recipient's fingerprint. It is not a message store and holds nothing long-term.

```
POST {drop}
  X-Ansybl-Stamp: {proof-of-work}
  Content-Type: application/ansybl-envelope+json
  → 202 Accepted

GET {drop}
  Authorization: Ansybl-Sig {signature over challenge by identity key}
  → envelopes, deleted after retrieval or TTL
```

Requirements:

- Drop-mode envelopes MUST omit the outer signature and carry an inner signature
  (§4.1).
- Drops MUST NOT be able to decrypt, MUST NOT log sender network identifiers, and
  MUST apply a TTL not exceeding 30 days.
- Recipients MUST verify the inner signature before display and MUST present
  cold-contact messages as unverified-relationship until the user responds.
- Once either party replies, the conversation MUST migrate to outbox delivery.
  Drops carry first contact only.

### 9.1 Proof of work

A stamp is a nonce satisfying:

```
BLAKE3-256(blinded_address || YYYY-MM-DD || nonce)
```

having at least `drop_difficulty` leading zero bits. Default difficulty 20 —
roughly one second of client CPU, negligible for a human, prohibitive in bulk.
Drops MUST reject stamps whose date is not within one day of the current date,
and MUST reject duplicate nonces within that window.

Drops are the only component in this specification that accepts writes, and they
are optional. A publisher that omits `drop` is unreachable by strangers by
choice, and all other functionality is unaffected.

---

## 10. Retention and archives

Envelopes are sender-managed. A sender MAY withdraw an envelope by appending a
signed tombstone per ANSYBL-CHUNK §9.1, referencing the envelope's `guid`. The
hash chain remains intact, so withdrawal is never confused with tampering.
Conforming clients suppress and delete the target.

Because a tombstone leaves the original line in its sealed chunk, the ciphertext
remains retrievable. For private feeds this is weaker than it sounds only in one
respect: the ciphertext is useless without a wrapped key, so a recipient who was
never addressed learns nothing. A recipient who *was* addressed already holds the
plaintext. Senders requiring removal of the ciphertext itself MAY perform a hard
redaction (ANSYBL-CHUNK §9.2), with the cache and chain-rewrite costs described
there.

**Clients MUST archive on retrieval.** On successful decryption, the plaintext is
written to the recipient's own storage:

```
feeds/{fingerprint}/dm-archive/YYYY-MM.enc
```

encrypted under a key derived from the recipient's own current KEM key.

This is a requirement, not an optimization. Without it, a sender could silently
erase the recipient's side of a conversation, which reintroduces exactly the
asymmetry this protocol exists to remove.

Interfaces MUST accurately describe deletion: a sender can stop distributing a
message; a sender cannot recall a message already retrieved. Implementations MUST
NOT present unpublishing as guaranteed deletion.

---

## 11. Restricted-audience feeds

### 11.1 Scope

A restricted-audience feed is one whose content is readable only by a membership
set the publisher maintains: paid subscribers, a patronage tier, an invite list,
a circle of friends. This section specifies membership lifecycle. It introduces
no new cryptography — a restricted audience is a channel (§7.2) whose membership
changes over time.

Retrieval is unchanged. Restricted content is published in ordinary public
chunks, fetched by anyone, and cached at the edge like all other content.

### 11.2 No retrieval handshake

Implementations MUST NOT gate retrieval of restricted content on authentication,
entitlement checks, signed URLs, or any other server-side authorization.

Gating retrieval would require an origin that observes every read, which
identifies readers, destroys the cacheability of sealed chunks, and makes the
publisher's audience dependent on that origin remaining available and honest.
Because the content is already encrypted, gating buys no confidentiality it does
not already have.

Access control is the possession of a key. A host that serves restricted feeds
learns nothing beyond object sizes and request timing.

### 11.3 Membership lifecycle

Each restricted audience is a channel identified by `channel_id` and versioned by
a monotonic `epoch`.

**Enrollment.** The publisher wraps the current epoch key to the new member's
KEM key (§2.3) and publishes a `channel_key` envelope. Enrollment requires **no**
epoch change. The member gains access to content from the current epoch forward.

**Departure.** The publisher increments the epoch, generates a new channel key,
and distributes it to the remaining membership in a single envelope.

**Batching.** Publishers MUST batch departures into a single rekey rather than
rekeying per departure (§7.3.3). With a key tree, rotation cost is approximately
`2 · ⌈log₂ n⌉` wrapped keys — under 2 KB even for an audience of one million —
and batched departures share ancestors, making a batch cheaper than the sum of
its parts.

Publishers SHOULD align rotation to a natural period such as a billing cycle.
This produces a grace period as a side effect: a departed member retains access
until the next rotation. Publishers MUST disclose the effective grace period to
members.

### 11.4 Revocation is forward-only

**Epoch rotation removes access to future content only.** A member who decrypted
content while enrolled retains it permanently. No mechanism in this
specification, or available to it, recovers content already delivered.

Implementations MUST NOT describe epoch rotation as revoking, withdrawing, or
expiring past access, and MUST NOT present restricted content as unreadable after
a membership lapses.

This differs from a hosted paywall, which can withhold retroactively because it
never delivered the content, only a rented view of it. The protocol trades that
capability for the property that a member genuinely holds what they were given.
Implementations SHOULD present this to members as a feature, because it is one.

### 11.5 Enrollment and identity

Membership is keyed to an Ansybl identity. The publisher requires the member's
fingerprint in order to fetch their key bundle and wrap the epoch key.

A prospective member therefore MUST possess an Ansybl identity before they can
read restricted content. Implementations SHOULD generate a keypair transparently
during enrollment rather than requiring the member to obtain one first, subject
to the client-side custody requirement of §12.1.

Payment, eligibility, and membership determination are **out of scope**. The
protocol consumes one input: the publisher's current membership set. How that set
is computed — payment processor, patronage platform, invitation, manual list — is
an application concern. This keeps the protocol payment-agnostic and makes paid
subscription and a private friends list the same mechanism with different
membership logic.

### 11.6 Preview entries

Restricted content is undiscoverable by non-members, which suppresses growth.
Publishers MAY publish a public preview entry alongside restricted content:

```json
{
  "guid": "01J8XT...",
  "type": "short_text",
  "content_text": "Teaser text, freely readable.",
  "restricted": {
    "channel": "c:4f2a9b...",
    "full_guid": "01J8XU...",
    "enroll_url": "https://example.com/subscribe"
  },
  "created_at": "...",
  "prev": "b3:...",
  "signature": "ed25519:..."
}
```

Clients holding the channel key SHOULD retrieve the referenced envelope and
present the full content in place of the preview. Clients without the key SHOULD
present the preview and surface `enroll_url`.

Publishers MUST NOT place content in a preview that they intend to restrict.
Previews are public permanently.

### 11.7 Tiers

Each tier is a separate channel. A member of a higher tier SHOULD be given the
lower tiers' current epoch keys rather than having content encrypted separately
to multiple channels; this keeps publication cost independent of tier count.

Tier structure is public to the extent that `channel_id` values appear in
`channel_message` entries. Membership is not.

### 11.8 Leakage and attribution

The default posture of this specification is that members are good actors.
Restricted-audience support is designed for the ordinary case — a publisher
serving people who paid to read them — and provides proportionate handling of
the exceptional case rather than architecture aimed at it.

**What is not detectable, and cannot be made so.** Restricted content is fetched
from public objects with no per-reader identity, so the access telemetry that
conventional platforms use to detect credential sharing — concurrent sessions,
address geography, device fingerprints — does not exist here. This is a direct
consequence of readers not being surveilled, and implementations MUST NOT
reintroduce per-reader access logging to recover it (§11.2).

Plaintext redistribution — screenshots, copy-paste, re-publication — is outside
the reach of any cryptographic measure.

**Identity coupling (normative).** Channel keys MUST be wrapped to the member's
identity KEM key as published in their key bundle (§2.3). Implementations MUST
NOT issue separate, disposable subscription-only keys.

This is the primary and sufficient measure for the expected case. Sharing a
subscription then means sharing the key that controls the member's posting
identity, private messages, and account — not a viewing credential. The
disincentive is structural and costs nothing to implement.

**Rotation as containment.** Regular epoch rotation (§11.3) bounds the value of a
shared key to a single rotation window. This is the RECOMMENDED mitigation and is
already required by the membership lifecycle.

**Watermarking (OPTIONAL).** Publishers with small, high-value audiences MAY
apply per-recipient plaintext variation to attribute a leaked copy. Publishers
doing so MUST understand:

- It defeats encrypt-once. Ciphertext count becomes proportional to audience
  size, which is impractical above roughly 500 recipients.
- Two colluding members can compare copies and remove naive marks. Collusion
  resistance requires fingerprinting codes sized against an assumed collusion
  bound, which is not specified here.
- Attribution identifies a source only once a leaked copy has been found.

Implementations offering watermarking MUST NOT describe it as preventing
redistribution.

**Traitor tracing.** Broadcast-encryption schemes providing revocation with
tracing exist and are deployed at scale elsewhere. They are out of scope for this
version. Their operational history indicates the limiting factor is endpoint
compromise rather than the tracing construction, and the complexity is not
proportionate to the threat this specification targets.

**Residual leakage is accepted.** Publishers SHOULD treat some redistribution as
a cost of operation rather than a defect. Implementations MUST NOT present any
measure in this section as making restricted content unshareable.

### 11.9 Membership privacy

Wrapping keys per member necessarily discloses the membership set to the
publisher. This is inherent and expected.

Publicly, recipient tags remain unlinkable (§3.5), so membership does not leak to
observers of the feed. In channel mode, `channel_id` is a stable public
identifier: an observer learns that a restricted audience exists and how often it
receives content, but not who belongs to it (§7.2).

---

## 12. Conformance

### 12.1 Key custody (normative)

**A conforming implementation MUST generate identity and KEM private keys on the
client, and MUST NOT transmit them to any server in a form that server can
decrypt.** All signing and all decryption MUST occur client-side.

An implementation that holds user private keys server-side is **non-conforming**,
regardless of its other properties, and MUST NOT display verification or
encryption indicators.

This requirement is stated normatively because it is the property the rest of the
protocol rests on. A signature proves authorship only if the author is the sole
party able to produce it, and encryption protects a recipient only if the
recipient is the sole party able to open it. Where a server holds the key, both
guarantees collapse into a promise, and a user who wishes to leave cannot take
their identity with them.

Ansybl 1.0 left key custody to implementers. Making it explicit here removes the
ambiguity and gives implementations a clear line to build toward.

Servers MAY store a private key **wrapped** under a key derived from a user
passphrase via Argon2id, for multi-device sync, provided the server cannot derive
the wrapping key. Parameters SHOULD be at least 64 MiB memory, 3 iterations,
parallelism 4.

### 12.2 Client requirements

A conforming client MUST:

- Generate and hold keys client-side (§12.1).
- Publish a signed key bundle (§2) and select KEM keys by validity window.
- Use a fresh ephemeral keypair per envelope and erase it after use.
- Randomize recipient order and pad both recipient tables and plaintext (§7.1).
- Use a key tree for channels above 1024 members, and pad rekey entries (§7.3).
- Verify outer signatures and hash chains before decryption (§8).
- Verify inner signatures on drop-mode envelopes (§9).
- Archive decrypted messages to recipient-controlled storage (§10).
- Present verification state truthfully, and never display a verified indicator
  for a check that was not performed.

A conforming client MUST NOT:

- Reuse the Ed25519 identity key for key agreement (§3.2).
- Claim forward secrecy while retaining retired KEM private keys (§2.5).
- Claim deniability under this version (§5.1).
- Present unfollowing as revocation (§6.1) or unpublishing as deletion (§10).
- Present epoch rotation as revoking past access (§11.4).
- Gate retrieval of restricted content on server-side authorization (§11.2).
- Issue disposable subscription-only keys in place of identity KEM keys (§11.8).
- Describe watermarking as preventing redistribution (§11.8).

### 12.3 Server requirements

A server hosting private feeds MUST serve them as opaque static objects with the
caching semantics of §6, MUST NOT be required for confidentiality or access
control, MUST NOT log per-reader access to restricted content (§11.8), and MUST support a user's export and migration of the full feed
prefix. A user MUST be able to relocate to different hosting by republishing
their files and issuing a signed move record, without cooperation from the
previous host.

---

## 13. Threat model

### 13.1 What this protects

| Adversary | Protection |
|---|---|
| Hosting provider | Cannot read content or identify recipients. |
| Passive network observer | Sees TLS-protected static fetches. |
| Other feed subscribers | Cannot decrypt; cannot link recipients across envelopes. |
| Compromise of sender's key, later | Past envelopes stay confidential; ephemerals are erased. |
| Compromise of recipient's retired KEM key | Bounded to that rotation window (§2.5). |
| Malicious index or digest service | Can omit, cannot forge. Signatures verified client-side. |

### 13.2 What this does not protect

| Exposure | Detail |
|---|---|
| Sender identity | **Public** in outbox mode. The feed owner is the sender. |
| Timing and volume | **Public.** "This identity published 14 envelopes on Tuesday." |
| Recipient count | Padded to size classes; the class is observable. |
| Current KEM key compromise | Exposes messages in the current window. No per-message ratchet. |
| Endpoint compromise | Full plaintext access. Out of scope. |
| Recipient behavior | A recipient can screenshot, forward, or publish. |
| Channel membership churn | `channel_id` is a stable public identifier (§7.2). |
| Publisher's key tree | Holding it is equivalent to holding all member access (§7.3.5). |
| Departed members | Retain all content decrypted while enrolled. Forward-only revocation (§11.4). |
| Credential sharing | Not detectable by access telemetry, by design (§11.8). Mitigated by identity coupling and rotation. |

### 13.3 The metadata trade, stated plainly

Outbox delivery publishes sender identity, timing, and volume to anyone. A
relay-based design hides this from the public but discloses it to a relay
operator, who is a single subpoenable party and a single point of correlation.

This specification takes the outbox trade deliberately: the leak is symmetric and
known to everyone, with no privileged observer, and it requires no participant to
operate infrastructure. Implementations MUST NOT describe this protocol as
metadata-private. Users whose threat model includes exposure of *who they talk
to, when* are adequately served; users whose threat model includes exposure of
*that they sent anything at all* are not.

---

## 14. Open problems

1. **Per-message forward secrecy.** Medium-term KEM keys bound exposure to a
   rotation window. A Double Ratchet would bound it per message but requires
   per-conversation state, which fits poorly with static hosting and multi-device
   fan-out. The envelope format reserves space for a ratchet header so this can
   be added without a breaking change.
2. **Deniability.** §5.1. Requires an HMAC-based authenticator alternative.
3. **Padding versus differential retrieval.** Per-envelope padding costs
   bandwidth that byte-range deltas would otherwise save. The current size
   classes are a guess; they need measurement against real traffic.
4. **Multi-device.** Wrapped-key sync (§12.1) gets keys onto a second device but
   does not solve message-history convergence across devices with different
   retrieval histories.
5. **Group membership discovery.** A recipient cannot enumerate a channel's other
   members. Sometimes desirable, sometimes not; there is currently no way to opt
   into a visible member list.
6. **Collusion-resistant fingerprinting.** §11.8 permits watermarking but does not
   specify a code construction, so naive implementations are defeated by two
   colluding members. Specifying one requires choosing a collusion bound.
7. **Tree rebalancing.** §7.3 leaves leaf assignment and rebalancing to the
   publisher. A tree that accumulates blank leaves through churn degrades toward
   linear rekey cost; no compaction procedure is specified.
8. **Cold contact without a drop.** The drop is the one write-accepting component.
   A fully drop-free first-contact mechanism remains unsolved.

---

## Appendix A: Changes to Ansybl 1.0

| Change | Type | Section |
|---|---|---|
| `keys.ansybl` key bundle document | Addition | §2 |
| `author.public_key` deprecated in favor of bundle | Breaking | §2.1 |
| X25519, HKDF, AES-GCM, BLAKE3 added to primitives | Addition | §3.1 |
| `private/` feed type | Addition | §6 |
| Feed paths anchored to fingerprint, not handle | Breaking | §6 |
| Client-side key custody made normative | Clarifying | §12.1 |
| Optional drop endpoint | Addition | §9 |
| Key trees for large channels | Addition | §7.3 |
| Restricted-audience feeds and membership lifecycle | Addition | §11 |
| `restricted` preview field on public entries | Addition | §11.6 |

Publishers migrating from 1.0 SHOULD publish a key bundle whose `identity`
matches the existing `author.public_key`, preserving verifiability of all
existing signed content.
