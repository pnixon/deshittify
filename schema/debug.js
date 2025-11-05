import { AnsyblValidator } from './validator.js';

const validator = new AnsyblValidator();

const testDoc = {
  "version": "https://ansybl.org/version/1.0",
  "title": "Test Feed",
  "home_page_url": "https://example.com",
  "feed_url": "https://example.com/feed.ansybl",
  "language": "en",
  "author": {
    "name": "Test Author",
    "public_key": "ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=="
  },
  "items": [
    {
      "id": "https://example.com/post/1",
      "url": "https://example.com/post/1",
      "content_text": "Hello world!",
      "date_published": "2025-11-04T10:00:00.000Z",
      "signature": "ed25519:dGVzdHNpZ25hdHVyZWRhdGE="
    }
  ],
  "_custom_field": "extension data"
};

const result = validator.validateDocument(testDoc);
console.log('Valid:', result.valid);
if (!result.valid) {
  console.log('Errors:', JSON.stringify(result.errors, null, 2));
}