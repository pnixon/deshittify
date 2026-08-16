# Ansybl Chunked Feeds

**Specification ANSYBL-CHUNK, version 1.0-draft**
Status: Draft for review · Extends Ansybl 1.0 · Target: Ansybl 1.1

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT,
RECOMMENDED, MAY, and OPTIONAL are to be interpreted as described in RFC 2119.

---

## 1. Overview

Ansybl 1.0 defines a feed as one JSON document containing an `items` array. That
shape has a cost that grows with the feed: a reader checking for new content
must retrieve the whole document, and a reader scrolling backward retrieves
content it already holds.

This specification replaces the monolithic document with a **chunked feed**: a
small signed pointer, a sequence of append-only NDJSON chunks, and a manifest.
The properties it establishes:

- **Poll cost is constant.** Checking a feed costs one small conditional request
  regardless of how much the feed contains.
- **Historical content is fetched once, ever.** Sealed chunks are immutable and
  indefinitely cacheable.
- **New content costs its own size.** Byte-range retrieval against the open chunk
  transfers only what the reader lacks.
- **Omission is detectable.** A hash chain runs across the entire feed, so a
  dropped or reordered entry is visible.

Origin load becomes proportional to how much publishers write, not to how many
readers read. This is the property that makes reader count irrelevant to
capacity planning.

### 1.1 Applicability

All Ansybl feed types use this layout: `posts`, `replies`, `likes`, `boosts`,
and `private` (ANSYBL-PM). Implementations MUST NOT retain the monolithic form
for some types and the chunked form for others; uniformity is what allows one
retrieval implementation to serve every type.

---

## 2. Layout

```
{feed_root}/
  feed.ansybl                    manifest        long TTL
  keys.ansybl                    key bundle      short TTL   (ANSYBL-PM §2)
  posts/
    head.ansybl                  tip pointer     ≤60s TTL
    index.ansybl                 chunk directory medium TTL
    chunk/000000.ansybl          sealed          immutable
    chunk/000001.ansybl          sealed          immutable
    chunk/000002.ansybl          open            ≤60s TTL
  replies/  likes/  boosts/  private/    (identical structure)
```

`{feed_root}` MUST be anchored to the publisher's key fingerprint, not to a
handle. Handles are mutable display attributes and MUST NOT appear in stable
paths.

Chunk numbers are zero-padded decimal, minimum six digits, incrementing from
`000000`. Numbers beyond `999999` use additional digits without repadding
(`1000000`). Numbers MUST NOT be reused.

---

## 3. Manifest — `feed.ansybl`

Feed-level metadata has no home once entries are lines in chunks. It moves here.

```json
{
  "version": "https://ansybl.org/version/1.1",
  "type": "feed_manifest",
  "fingerprint": "b3:9f2a4c1e...",
  "title": "Field Notes",
  "description": "...",
  "home_page_url": "https://example.com",
  "feed_root": "https://example.com/feeds/b3:9f2a4c1e",
  "icon": "https://example.com/icon.png",
  "language": "en",
  "author": { "name": "A. Publisher", "url": "https://example.com/about" },
  "feeds": ["posts", "replies", "likes", "boosts", "private"],
  "updated_at": "2026-08-14T10:00:00Z",
  "signature": "ed25519:..."
}
```

The manifest MUST be signed by the identity key named in `keys.ansybl`. It
SHOULD be served with `Cache-Control: public, max-age=3600`. It carries no
content and changes rarely.

The 1.0 `author.public_key` field is deprecated. Identity material lives in the
key bundle, which supports multiple keys and validity windows.

---

## 4. Head — `head.ansybl`

The head is the only object a reader must fetch to learn whether anything
changed. It MUST remain small — a few hundred bytes — and MUST NOT contain
entries.

```json
{
  "type": "feed_head",
  "feed": "posts",
  "seq": 2,
  "open_bytes": 11482,
  "open_count": 7,
  "total_count": 1007,
  "tip": "b3:7c1d9a4f...",
  "index_tip": "b3:22e0bb91...",
  "updated_at": "2026-08-14T10:00:00Z",
  "signature": "ed25519:..."
}
```

| Field | Description |
|---|---|
| `seq` | Number of the currently open chunk. |
| `open_bytes` | Exact byte length of the open chunk. The reader's range offset target. |
| `open_count` | Entry lines in the open chunk, excluding the header line. |
| `total_count` | Entries across the whole feed. Monotonic. |
| `tip` | BLAKE3-256 of the last entry line's canonical bytes. |
| `index_tip` | BLAKE3-256 of the current `index.ansybl`. Lets a reader skip fetching an unchanged index. |

The head MUST be served with `Cache-Control: public, max-age=60` or less, and
MUST carry a strong `ETag`.

`seq` and `total_count` MUST be monotonically non-decreasing. A reader observing
either decrease MUST treat the feed as compromised and MUST surface this rather
than silently resynchronizing.

---

## 5. Chunks

A chunk is a UTF-8 NDJSON file: one JSON document per line, each line the RFC
8785 canonical serialization of that document, terminated by a single LF
(`0x0A`). Lines MUST NOT contain unescaped LF. The final line MUST be
LF-terminated.

Canonical line bytes for hashing purposes **exclude** the terminating LF.

A chunk consists of:

1. exactly one **header line**, first;
2. zero or more **entry lines**;
3. exactly one **seal line**, last, present only once the chunk is sealed.

### 5.1 Header line

Written once at chunk creation and never modified. Fixing it at creation is what
keeps every subsequent byte offset stable.

```json
{"type":"chunk_header","feed":"posts","seq":2,"prev_chunk_tip":"b3:5a10c8...","created_at":"2026-08-10T00:00:00Z","signature":"ed25519:..."}
```

For chunk `000000`, `prev_chunk_tip` MUST be `"b3:" + 64 zeros`.

### 5.2 Entry lines

Entry content is defined by the feed type. For `posts`, an entry is an Ansybl
1.0 item with two added fields:

```json
{"guid":"01J8XQ...","type":"short_text","content_text":"...","created_at":"...","prev":"b3:2f81ac...","signature":"ed25519:..."}
```

Every entry MUST carry:

- `guid` — unique within the feed, and sortable such that lexical order matches
  publication order.
- `prev` — BLAKE3-256 of the preceding line's canonical bytes (§6).
- `signature` — Ed25519 by the publisher's identity key over the entry's
  canonical form with `signature` removed.

Entries are appended in publication order, oldest first, within a chunk.

> Note: this reverses Ansybl 1.0, where items are newest-first. Append-only
> storage requires oldest-first. Clients reverse for display; the wire format
> optimizes for append, not for reading order.

### 5.3 Seal line

Appended when the chunk closes. Because it is appended rather than inserted, all
existing byte offsets remain valid.

```json
{"type":"chunk_seal","seq":2,"count":500,"bytes":68219,"first_guid":"01J8XA...","last_guid":"01J8XQ...","tip":"b3:7c1d9a...","first_ts":"2026-08-10T00:00:00Z","last_ts":"2026-08-14T09:12:00Z","sealed_at":"2026-08-14T09:12:03Z","signature":"ed25519:..."}
```

A chunk containing a valid seal line is **sealed**. Sealed chunks MUST NOT be
modified except under hard redaction (§9.2).

`bytes` counts the chunk length up to and including the last entry line's LF —
that is, excluding the seal line itself. This lets a reader that had been range
-fetching the chunk confirm its stored prefix without re-reading.

### 5.4 Sealing rules

A publisher MUST seal the open chunk when appending an entry would cause either:

- chunk size to exceed **65536 bytes**, or
- entry count to exceed **500**.

The triggering entry goes into the new chunk. Publishers MAY seal earlier
(inactivity, key rotation, an explicit boundary). Publishers MUST NOT seal an
empty chunk.

Size-and-count triggering is deliberate. Calendar bucketing produces
multi-megabyte chunks for prolific publishers and near-empty chunks for dormant
ones; both defeat the caching and delta properties. Date-range navigation is
served by the index (§7), which decouples addressing from calendar time.

---

## 6. Hash chain

Each entry line's `prev` is the BLAKE3-256 of the immediately preceding line's
canonical bytes, where "preceding" spans chunk boundaries: the first entry of
chunk *n* chains to the last entry of chunk *n−1*, whose hash also appears in
chunk *n*'s header as `prev_chunk_tip`.

The chain therefore covers the entire feed history, and the head's `tip` vouches
for it. A reader can detect a dropped, reordered, or altered entry anywhere in
the feed, including one removed by a hosting provider.

Chunks remain independently verifiable **given the previous chunk's tip**, which
is available from the chunk header, the index, or the preceding chunk itself.

Readers MUST verify the chain across every newly retrieved line and MUST verify
that the last retrieved line's hash equals the head's `tip`. A mismatch MUST be
surfaced as a possible integrity failure. Readers MUST NOT repair a broken chain
silently.

Readers are not required to verify from genesis. Trust is established on first
fetch of the signed head and extended forward from there (§10.4).

---

## 7. Index — `index.ansybl`

The index is the chunk directory. It makes historical navigation possible
without the layout depending on calendar time, and it lets a reader jump
directly to a date, a guid, or the beginning.

```json
{
  "type": "chunk_index",
  "feed": "posts",
  "chunks": [
    {"seq":0,"count":500,"bytes":66104,"first_ts":"2026-01-02T...","last_ts":"2026-04-11T...","first_guid":"01J...","last_guid":"01J...","tip":"b3:..."},
    {"seq":1,"count":500,"bytes":67330,"first_ts":"2026-04-11T...","last_ts":"2026-08-10T...","first_guid":"01J...","last_guid":"01J...","tip":"b3:..."}
  ],
  "updated_at": "2026-08-14T09:12:03Z",
  "signature": "ed25519:..."
}
```

The index lists sealed chunks only; the open chunk is described by the head. It
is rewritten at each seal — an infrequent event — and SHOULD be served with
`Cache-Control: public, max-age=600`.

A reader holding `index_tip` from the head MAY skip fetching the index entirely
when it matches its cached copy.

At roughly 200 bytes per sealed chunk, a feed of 500,000 entries has a ~200 KB
index. Publishers whose index exceeds 1 MB SHOULD shard it into
`index/{range}.ansybl` with a top-level directory; this is expected to be rare
and is not further specified in this version.

---

## 8. Compression and byte ranges

Byte ranges address the **encoded** representation. If an origin or CDN applies
`Content-Encoding: gzip` or `br`, a stored offset computed against identity
bytes does not correspond to the compressed representation, and a naive range
request splices corrupt data.

Therefore:

- Publishers and hosts MUST serve chunk objects with `Content-Encoding: identity`
  when a `Range` header is present.
- Readers MUST send `Accept-Encoding: identity` on range requests.
- Readers MUST send `If-Range` with the stored `ETag`. If the entity changed, the
  server returns the full object and the reader MUST discard its stored prefix
  and revalidate from the chunk header.
- `head.ansybl`, `index.ansybl`, and `feed.ansybl` are always fetched whole and
  SHOULD be compressed normally.

### 8.1 Delta threshold

Uncompressed range retrieval is not always cheaper than compressed full
retrieval. NDJSON typically compresses around 4×, so for a small open chunk a
compressed full fetch can transfer fewer bytes than an uncompressed delta.

Readers SHOULD apply a threshold: request a range only when the expected delta
is smaller than the estimated compressed size of the whole open chunk. A
reasonable default is to range-fetch when `open_bytes` exceeds **16384** and the
delta is under half of `open_bytes`, and to fetch whole otherwise.

This threshold is a performance heuristic, not a conformance requirement.
Implementations SHOULD measure against real traffic and tune.

---

## 9. Redaction

Two mechanisms, with materially different guarantees. Implementations MUST
present the difference accurately.

### 9.1 Soft redaction (tombstone)

The publisher appends a signed tombstone to the open chunk:

```json
{"guid":"01J8XS...","type":"redaction","target":"01J8XQ...","created_at":"...","prev":"b3:...","signature":"ed25519:..."}
```

The chain remains intact. Readers MUST suppress display of the target entry and
SHOULD delete their local copy. Readers MUST NOT treat a tombstone as evidence
of tampering.

What soft redaction does **not** do: the original line remains present in its
sealed chunk and remains retrievable by anyone who fetches that chunk directly.
A tombstone is a request honored by conforming clients, not an erasure.
Interfaces MUST NOT describe it as deletion.

Soft redaction is the RECOMMENDED default. It preserves the immutability of
sealed chunks, and therefore the caching and integrity properties the whole
layout depends on.

### 9.2 Hard redaction (chunk rewrite)

Where content must actually be removed from the origin, the publisher MAY
rewrite the containing chunk: remove the line, recompute `prev` for all
subsequent lines in that chunk and every later chunk, and re-sign.

This is expensive and disruptive by design:

- Every downstream chunk's chain changes, so all must be rewritten and re-signed.
- Cached copies at edges and in readers remain valid until TTL expiry and may
  retain the removed content indefinitely.
- Readers holding the old chain will observe a mismatch.

Publishers performing hard redaction MUST publish a signed `rewrite` record in
the index recording the affected sequence range and timestamp, so readers can
distinguish an intentional rewrite from an attack. Readers encountering a chain
divergence without a corresponding signed rewrite record MUST treat it as an
integrity failure.

Implementations MUST NOT present hard redaction as guaranteed erasure either.
Content already retrieved cannot be recalled.

---

## 10. Retrieval

### 10.1 First fetch

1. Fetch `feed.ansybl` and `keys.ansybl`; verify the bundle signature and record
   the identity key.
2. Fetch `head.ansybl`; verify its signature.
3. Fetch `index.ansybl` if history is wanted.
4. Fetch the open chunk whole; verify the header signature, every entry
   signature, the chain, and that the final hash equals `head.tip`.
5. Store: `seq`, `open_bytes`, `ETag`, `tip`, and the set of verified guids.

### 10.2 Incremental fetch

1. `GET head.ansybl` with `If-None-Match`. On **304**, stop. This is the common
   case and costs roughly 200 bytes.
2. If `head.seq` equals the stored seq and `head.open_bytes` is greater than the
   stored offset, fetch `Range: bytes={stored_offset}-` on the open chunk per §8.
3. If `head.seq` is greater than the stored seq: fetch the remainder of the
   previously open chunk (now sealed, including its seal line), verify the seal,
   then fetch each intervening sealed chunk whole, then the new open chunk.
4. Verify signatures and the chain across all newly retrieved lines; confirm the
   final hash equals `head.tip`.
5. Update stored offset, ETag, and tip.

Readers MUST NOT re-fetch or re-verify sealed chunks already verified.

### 10.3 Historical navigation

To reach a date or guid, consult the index, select the chunk whose
`first_ts`/`last_ts` or guid range contains the target, and fetch that chunk
whole. Sealed chunks are immutable, so this fetch happens once per reader per
chunk, ever.

### 10.4 Verification depth

Trust is established on first fetch of the signed head and extended forward.
Readers MUST verify every entry they retrieve and MUST verify chain continuity
across the range they hold. Readers are NOT required to retrieve history solely
in order to verify current content.

A reader that later fetches older chunks MUST verify that each chunk's
`prev_chunk_tip` matches the preceding chunk's tip, linking retrieved history to
already-trusted content.

### 10.5 Polling and aggregation

Readers SHOULD apply per-feed adaptive backoff based on observed publication
rate, resetting on any change.

Readers MAY use a digest or changelog service to identify changed feeds in one
request rather than polling each. Such services are untrusted: they can omit
updates but cannot forge them, because every entry is verified against the
publisher's key. Readers MUST fall back to direct polling when a digest is
unavailable, and MUST NOT treat digest silence as evidence that nothing changed.

---

## 11. Caching

| Object | Cache-Control | Mutable |
|---|---|---|
| `feed.ansybl` | `public, max-age=3600` | Rarely |
| `keys.ansybl` | `public, max-age=300` | Rarely |
| `head.ansybl` | `public, max-age=60` | Constantly |
| `index.ansybl` | `public, max-age=600` | At each seal |
| Open chunk | `public, max-age=60` | Appends |
| Sealed chunk | `public, max-age=31536000, immutable` | Never |

All objects MUST carry strong `ETag` values. Hosts MUST support `Range` and
`If-Range` on chunk objects.

Sealed chunks are the reason origin load decouples from reader count: each is
fetched from origin once per cache node and served from the edge thereafter.

---

## 12. Migration from Ansybl 1.0

A publisher migrating a monolithic `posts.ansybl`:

1. Sort all items oldest-first.
2. Emit chunks per §5.4, computing `prev` for each line and sealing on the size
   or count trigger.
3. Leave the final chunk open.
4. Write `index.ansybl`, `head.ansybl`, `feed.ansybl`, and `keys.ansybl` with
   `identity` equal to the former `author.public_key`, preserving verifiability
   of all existing signatures.
5. Retain the 1.0 document at its original URL for a transition period,
   regenerated from the newest entries.

Item signatures from 1.0 remain valid; `prev` is additive and is excluded from
the 1.0 canonical signing form. Publishers MUST NOT re-sign migrated content
under a different key.

Readers encountering a 1.0 monolithic feed with no `head.ansybl` SHOULD fall
back to whole-document retrieval.

---

## 13. Conformance

A conforming **publisher** MUST:

- Anchor feed paths to key fingerprint, not handle.
- Serve `feed.ansybl`, `keys.ansybl`, and per-type `head.ansybl` and chunks.
- Write chunks as canonical NDJSON, oldest-first, with a fixed header line.
- Maintain the hash chain across chunk boundaries.
- Seal per §5.4 and never modify a sealed chunk except under §9.2.
- Serve the caching and `Range` semantics of §8 and §11.
- Sign the manifest, head, index, chunk headers, seals, and every entry.

A conforming **reader** MUST:

- Verify the key bundle, then the head, before trusting any entry.
- Verify every retrieved entry signature and the chain across retrieved lines.
- Confirm the final retrieved hash equals `head.tip`.
- Surface chain breaks, `seq` regression, and `total_count` regression as
  integrity failures rather than resynchronizing silently.
- Honor tombstones and never present them as tampering.
- Send `Accept-Encoding: identity` and `If-Range` on range requests.
- Avoid re-fetching or re-verifying sealed chunks already verified.

A conforming reader MUST NOT:

- Present soft redaction as erasure (§9.1), or hard redaction as guaranteed
  erasure (§9.2).
- Treat a digest service as authoritative for absence (§10.5).

---

## 14. Open problems

1. **Index sharding.** Specified as SHOULD above 1 MB but not defined. Needs a
   directory format before any publisher reaches that scale.
2. **Delta threshold tuning.** §8.1 defaults are estimates, not measurements.
3. **Concurrent writers.** A single publisher writing from two devices can
   produce a forked chain. Requires either a compare-and-swap on the head or an
   explicit single-writer constraint; currently the latter is assumed and
   unstated.
4. **Chunk size versus padding.** ANSYBL-PM pads envelopes for privacy, which
   interacts with the 64 KB seal trigger; private chunks will seal on fewer
   entries. Whether private feeds want a different trigger is unmeasured.
5. **Backfill discovery.** A reader joining a feed with 10,000 chunks has no
   guidance on how much history to retrieve eagerly.

---

## Appendix A: Cost

500 followed feeds, 20 refreshes per day, each feed publishing once daily.
Actual new content is roughly 400 KB per day.

| Stage | Requests/day | Bytes/day |
|---|---|---|
| 1.0 monolithic, full refetch | 10,000 | ~160 MB |
| + conditional GET | 10,000 | ~11 MB |
| + head/chunk split | 10,000 | ~2.4 MB |
| + range deltas | 10,000 | ~900 KB |
| + digest or changelog | ~20 | ~500 KB |

Origin cost is unaffected by the number of readers. A sealed chunk is retrieved
from origin once per cache node and served from the edge indefinitely; the head
is a single small object revalidated at its TTL. Origin bandwidth scales with
publication volume.

---

## Appendix B: Changes to Ansybl 1.0

| Change | Type | Section |
|---|---|---|
| `feed.ansybl` manifest | Addition | §3 |
| `items` array replaced by NDJSON chunks | Breaking | §5 |
| Entry order reversed to oldest-first | Breaking | §5.2 |
| `prev` hash chain field on entries | Addition | §6 |
| `head.ansybl` and `index.ansybl` | Addition | §4, §7 |
| Feed paths anchored to fingerprint | Breaking | §2 |
| `author.public_key` deprecated for key bundle | Breaking | §3 |
| Tombstone redaction | Addition | §9.1 |
