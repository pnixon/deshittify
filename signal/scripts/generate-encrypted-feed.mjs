/**
 * Generate an AES-256-GCM encrypted feed for demo purposes.
 * Outputs the encrypted feed JSON and the stream key (base64url).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── base64url helpers ────────────────────────────────────────────────────────
function toBase64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// ─── The plaintext content inside the encrypted stream ────────────────────────
const innerContent = {
  meta: {
    author: "Dana Reeves",
    handle: "@dana",
    bio: "Private research feed — subscribers only."
  },
  posts: [
    {
      guid: "enc-0001-4000-8000-000000000001",
      type: "short_text",
      content: "🔒 This is a private post visible only to subscribers with the stream key. Testing AES-256-GCM encryption end-to-end through the Ansybl protocol.",
      created_at: "2026-05-05T02:00:00Z",
      tags: ["encrypted", "private", "test"],
      reply_to: null,
      boost_of: null
    },
    {
      guid: "enc-0002-4000-8000-000000000002",
      type: "short_text",
      content: "Research update: The key distribution mechanism works flawlessly. Each subscriber gets a wrapped copy of the stream key encrypted to their X25519 public key. Revocation is instant.",
      created_at: "2026-05-05T01:45:00Z",
      tags: ["research", "keydist"],
      reply_to: null,
      boost_of: null
    },
    {
      guid: "enc-0003-4000-8000-000000000003",
      type: "link",
      content: "Draft paper on post-quantum considerations for the Ansybl key exchange. Comments welcome from inner circle only.",
      url: "https://danareeves.dev/drafts/pq-ansybl-v2",
      created_at: "2026-05-05T01:30:00Z",
      tags: ["postquantum", "draft", "research"],
      reply_to: null,
      boost_of: null
    }
  ]
};

// ─── Encrypt ──────────────────────────────────────────────────────────────────
const streamKey = crypto.randomBytes(32); // AES-256 key
const iv = crypto.randomBytes(12);        // 96-bit nonce for GCM
const plaintext = JSON.stringify(innerContent);

const cipher = crypto.createCipheriv('aes-256-gcm', streamKey, iv);
const ciphertextBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tagBuf = cipher.getAuthTag();

const ownerFingerprint = 'sha256:' + crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');

const encryptedFeed = {
  ansybl: "1.0",
  type: "signal-feed",
  encrypted: true,
  stream_id: "inner-circle",
  owner_fingerprint: ownerFingerprint,
  payload: {
    key_version: 1,
    algorithm: "aes-256-gcm",
    iv: toBase64url(iv),
    ciphertext: toBase64url(ciphertextBuf),
    tag: toBase64url(tagBuf)
  },
  sig: toBase64url(crypto.randomBytes(64)),
  sig_input: `inner-circle|${ownerFingerprint}|1|${toBase64url(iv)}|${toBase64url(ciphertextBuf)}|${toBase64url(tagBuf)}`
};

// ─── Write outputs ────────────────────────────────────────────────────────────
const feedPath = path.join(__dirname, '..', 'feeds', 'dana-inner-circle.json');
fs.writeFileSync(feedPath, JSON.stringify(encryptedFeed, null, 2));

const keyB64 = toBase64url(streamKey);

console.log('✅ Encrypted feed written to:', feedPath);
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  STREAM KEY (base64url) — save this for the demo:');
console.log('  ' + keyB64);
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('Key length:', streamKey.length, 'bytes');
console.log('IV length:', iv.length, 'bytes');
console.log('Ciphertext length:', ciphertextBuf.length, 'bytes');
console.log('Tag length:', tagBuf.length, 'bytes');
