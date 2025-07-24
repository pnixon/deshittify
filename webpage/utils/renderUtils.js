// webpage/utils/renderUtils.js
// Shared rendering helpers for ActivityStreams content

// Extracts URL from various possible structures in ActivityStreams
export function extractUrl(urlField) {
  if (typeof urlField === 'string') return urlField;
  if (Array.isArray(urlField) && urlField.length > 0) {
    const linkObj = urlField[0];
    if (linkObj && typeof linkObj === 'object') {
      return linkObj.href || linkObj.url;
    }
    return typeof linkObj === 'string' ? linkObj : null;
  }
  if (urlField && typeof urlField === 'object') {
    return urlField.href || urlField.url;
  }
  return null;
}

// Formats ISO 8601 duration (e.g., PT1H2M3S)
export function formatDuration(duration) {
  if (!duration || typeof duration !== 'string') return '';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (match) {
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`;
    if (seconds > 0) return `${seconds}s`;
  }
  return duration;
}

// Formats timestamp to local string
export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleString();
}