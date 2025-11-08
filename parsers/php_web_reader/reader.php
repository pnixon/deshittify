<?php

require_once('Parsedown.php');
$Parsedown = new Parsedown();

function url_exists($url) {
    $file_headers = @get_headers($url);
    if(!$file_headers || strpos($file_headers[0], '404') !== false) {
        return false;
    }
    return true;
}

function normalize_feed_uri($uri) {
    // If starts with http:// or https://, leave alone
    if (preg_match('#^https?://#', $uri)) {
        return $uri;
    }
    // If looks like www.example.com, add https://
    if (preg_match('#^www\.[a-z0-9\-\.]+\.[a-z]{2,}#i', $uri)) {
        return 'https://' . $uri;
    }
    // Otherwise, treat as local file
    return $uri;
}

function is_url($uri) {
    return preg_match('#^https?://#', $uri);
}

$feedUri = "";
$jsonError = null;
$fileContents = "";
$data = null;

if (isset($_POST['feed_uri'])) {
    $feedUri = $_POST['feed_uri'];
}

if (strlen($feedUri) > 0) {
    $feedUriNormalized = normalize_feed_uri($feedUri);

    if (is_url($feedUriNormalized)) {
        if (url_exists($feedUriNormalized)) {
            $fileContents = file_get_contents($feedUriNormalized);
        }
    } else {
        if (file_exists($feedUriNormalized)) {
            $fileContents = file_get_contents($feedUriNormalized);
        }
    }

    if ($fileContents !== "") {
        $data = json_decode($fileContents, true);
        if ($data === null) {
            $jsonError = json_last_error_msg();
        }
    }
}

// Recursive function to render items
function render_item($item) {
    global $Parsedown;
    $html = '';

    // Handle collections (nested feeds)
    if (isset($item['type']) && strtolower($item['type']) === 'collection' && isset($item['items'])) {
        $html .= '<div class="collection">';
        $html .= '<h3>' . htmlspecialchars($item['name'] ?? ($item['summary'] ?? '[Unnamed Collection]')) . '</h3>';
        if (isset($item['summary'])) {
            $html .= '<p><em>' . htmlspecialchars($item['summary']) . '</em></p>';
        }
        // Recursive call for sub-items (reverse order: latest first)
        $html .= '<div class="collection-items">';
        $items = $item['items'];
        foreach ($items as $subitem) {
            $html .= render_item($subitem);
        }
        $html .= '</div>';
        $html .= render_attribution($item);
        $html .= '</div>';
        return $html;
    }

    // Handle single posts (Note, Article, Audio, Video, Image, etc.)
    $html .= '<div class="feed-item">';
    if (isset($item['name'])) {
        $html .= '<h4>' . htmlspecialchars($item['name']) . '</h4>';
    }
    if (isset($item['content'])) {
        // If markdown, render in <pre> or use a parser
        if (($item['mediaType'] ?? '') === 'text/markdown') {
            $html .= '<div class="markdown">' . $Parsedown->text($item['content']) . '</div>';
        } else {
            $html .= '<div>' . nl2br(htmlspecialchars($item['content'])) . '</div>';
        }
    }
    // Media: Audio
    if (isset($item['type']) && strtolower($item['type']) === 'audio') {
        $audioUrl = get_media_url($item);
        if ($audioUrl) {
            $html .= '<audio controls src="' . htmlspecialchars($audioUrl) . '"></audio>';
        }
        if (isset($item['duration'])) {
            $html .= '<div><small>Duration: ' . htmlspecialchars($item['duration']) . '</small></div>';
        }
    }
    // Media: Video
    if (isset($item['type']) && strtolower($item['type']) === 'video') {
        $videoUrl = get_media_url($item);
        if ($videoUrl) {
            // If youtube, embed; else, use video tag
            if (strpos($videoUrl, 'youtube.com') !== false || strpos($videoUrl, 'youtu.be') !== false) {
                // Extract video id for embed
                parse_str(parse_url($videoUrl, PHP_URL_QUERY), $ytparams);
                $ytid = $ytparams['v'] ?? null;
                if ($ytid) {
                    $html .= '<iframe width="560" height="315" src="https://www.youtube.com/embed/' . htmlspecialchars($ytid) . '" frameborder="0" allowfullscreen></iframe>';
                } else {
                    $html .= '<a href="' . htmlspecialchars($videoUrl) . '">' . htmlspecialchars($videoUrl) . '</a>';
                }
            } else {
                $html .= '<video controls src="' . htmlspecialchars($videoUrl) . '"></video>';
            }
        }
        if (isset($item['duration'])) {
            $html .= '<div><small>Duration: ' . htmlspecialchars($item['duration']) . '</small></div>';
        }
    }
    // Media: Image (single or array)
    if (isset($item['type']) && strtolower($item['type']) === 'image') {
        $urls = get_media_urls($item);
        foreach ($urls as $imgUrl) {
            $html .= '<img src="' . htmlspecialchars($imgUrl) . '" alt="' . htmlspecialchars($item['name'] ?? 'Image') . '" />';
        }
    }
    // Generic "url" rendering for anything else
    if (isset($item['url']) && !in_array(strtolower($item['type'] ?? ''), ['audio', 'video', 'image'])) {
        $url = get_media_url($item);
        if ($url) {
            $html .= '<div><a href="' . htmlspecialchars($url) . '" target="_blank">' . htmlspecialchars($url) . '</a></div>';
        }
    }

    $html .= render_attribution($item);
    $html .= '</div>';
    return $html;
}

// Handle media url(s) in various structures
function get_media_url($item) {
    if (!isset($item['url'])) {
        return null;
    }

    $url = $item['url'];

    // If it's a string, return as-is
    if (is_string($url)) return $url;

    // If it's an associative array with 'href'
    if (is_array($url) && isset($url['href'])) {
        return $url['href'];
    }

    // If it's a numerically-indexed array (list of links/objects)
    if (is_array($url) && array_keys($url) === range(0, count($url) - 1)) {
        foreach ($url as $u) {
            if (is_array($u) && isset($u['href'])) return $u['href'];
            if (is_string($u)) return $u;
        }
    }

    return null;
}

function get_media_urls($item) {
    $urls = [];
    if (isset($item['url'])) {
        if (is_string($item['url'])) {
            $urls[] = $item['url'];
        } elseif (is_array($item['url'])) {
            foreach ($item['url'] as $u) {
                if (is_array($u) && isset($u['href'])) {
                    $urls[] = $u['href'];
                } elseif (is_string($u)) {
                    $urls[] = $u;
                }
            }
        } elseif (is_array($item['url']) && isset($item['url']['href'])) {
            $urls[] = $item['url']['href'];
        }
    }
    return $urls;
}

// Attribution rendering
function render_attribution($item) {
    $html = '';
    if (isset($item['attributedTo'])) {
        $authors = $item['attributedTo'];
        if (is_array($authors) && isset($authors[0]['name'])) {
            // List of people
            $names = array_map(function($a) {
                return htmlspecialchars($a['name']);
            }, $authors);
            $html .= '<div><small>By: ' . implode(', ', $names) . '</small></div>';
        } elseif (is_array($authors) && isset($authors['name'])) {
            // Single person as assoc array
            $html .= '<div><small>By: ' . htmlspecialchars($authors['name']) . '</small></div>';
        } elseif (is_string($authors)) {
            $html .= '<div><small>By: ' . htmlspecialchars($authors) . '</small></div>';
        }
    }
    return $html;
}

// Calculate feed statistics
function get_feed_stats($data) {
    $stats = [
        'total_items' => 0,
        'types' => []
    ];

    if (isset($data['items']) && is_array($data['items'])) {
        $stats['total_items'] = count($data['items']);
        foreach ($data['items'] as $item) {
            $type = strtolower($item['type'] ?? 'note');
            $stats['types'][$type] = ($stats['types'][$type] ?? 0) + 1;
        }
    }

    return $stats;
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Ansybl PHP Web Reader</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="A lightweight PHP-based reader for Ansybl social syndication feeds.">
    <link rel="stylesheet" href="walkthrough.css">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #232323;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .page-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .page-header h1 {
            margin: 0 0 10px 0;
            font-size: 2.2em;
            font-weight: 700;
        }
        .page-header p {
            margin: 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content-wrapper {
            padding: 30px;
        }
        .feed-form-section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        #feed_form {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        #feed_form label {
            font-weight: 600;
            color: #495057;
            font-size: 1.1em;
        }
        #feed_uri {
            flex: 1;
            min-width: 250px;
            padding: 12px 16px;
            border: 2px solid #dee2e6;
            border-radius: 6px;
            font-size: 1em;
            transition: border-color 0.2s;
        }
        #feed_uri:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background: #5a6268;
            transform: translateY(-1px);
        }
        .feed-header {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #667eea;
        }
        .feed-header h2 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 1.8em;
        }
        .feed-stats {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #dee2e6;
        }
        .stat-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #6c757d;
            font-size: 0.95em;
        }
        .stat-item strong {
            color: #495057;
            font-weight: 600;
        }
        .feed-item, .collection {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            padding: 25px;
            margin-bottom: 20px;
            transition: box-shadow 0.2s;
        }
        .feed-item:hover, .collection:hover {
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        .collection {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-left: 4px solid #764ba2;
        }
        .collection h3 {
            color: #764ba2;
            margin-top: 0;
        }
        .collection-items {
            margin-left: 20px;
            margin-top: 20px;
        }
        .feed-item h4 {
            margin: 0 0 12px 0;
            color: #2c3e50;
            font-size: 1.4em;
        }
        .feed-item img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 12px 0;
        }
        .feed-item audio, .feed-item video {
            width: 100%;
            max-width: 100%;
            border-radius: 6px;
            margin: 12px 0;
        }
        .feed-item iframe {
            max-width: 100%;
            border-radius: 6px;
            margin: 12px 0;
        }
        pre {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 12px;
            overflow-x: auto;
        }
        .markdown h1, .markdown h2, .markdown h3, .markdown h4 {
            margin-top: 1.2em;
            margin-bottom: 0.5em;
            color: #2c3e50;
        }
        .markdown p, .markdown ul, .markdown ol, .markdown li {
            margin-bottom: 0.8em;
        }
        .markdown code, .markdown pre {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 2px 6px;
            font-family: 'Courier New', monospace;
        }
        .markdown pre code {
            border: none;
            padding: 0;
        }
        .error-message {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 500;
        }
        .info-message {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .feed-info {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .page-footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 0.9em;
            border-top: 1px solid #dee2e6;
        }
        .page-footer a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
        }
        .page-footer a:hover {
            text-decoration: underline;
        }
        @media (max-width: 768px) {
            body { padding: 10px; }
            .page-header h1 { font-size: 1.8em; }
            .page-header p { font-size: 1em; }
            .content-wrapper { padding: 20px; }
            #feed_form { flex-direction: column; align-items: stretch; }
            #feed_uri { min-width: 100%; }
            .feed-stats { flex-direction: column; gap: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="page-header">
            <h1>Ansybl PHP Web Reader</h1>
            <p>A lightweight PHP implementation for reading Ansybl social syndication feeds</p>
        </header>

        <div class="content-wrapper">
            <section class="feed-form-section">
                <form id="feed_form" action="./reader.php" method="post">
                    <label for="feed_uri">Feed URI:</label>
                    <input id="feed_uri" name="feed_uri" type="text"
                           value="<?php echo htmlspecialchars(urldecode($feedUri)); ?>"
                           placeholder="https://example.com/feed.ansybl or local/path/feed.json" />
                    <input type="submit" value="Load Feed" class="btn btn-primary">
                    <button type="button" id="load-sample-btn" class="btn btn-secondary" onclick="loadSample()">Load Sample Feed</button>
                </form>
            </section>

            <script>
                function loadSample() {
                    document.getElementById('feed_uri').value = '../../example-website/data/feed.ansybl';
                    document.getElementById('feed_form').submit();
                }
                function viewRaw() {
                    const rawData = <?php echo isset($data) ? json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) : 'null'; ?>;
                    if (rawData) {
                        const win = window.open('', 'Raw Feed Data');
                        win.document.write('<html><head><title>Raw Ansybl Feed</title></head><body><pre>' +
                            JSON.stringify(rawData, null, 2) + '</pre></body></html>');
                    }
                }
            </script>

            <?php if (isset($data)) {
                $stats = get_feed_stats($data);
            ?>
                <section class="feed-header">
                    <h2><?php echo htmlspecialchars($data["summary"] ?? $data["name"] ?? '[No feed title]'); ?></h2>

                    <div class="feed-stats">
                        <div class="stat-item">
                            <strong><?php echo $stats['total_items']; ?></strong> items
                        </div>
                        <?php foreach ($stats['types'] as $type => $count) { ?>
                            <div class="stat-item">
                                <strong><?php echo $count; ?></strong> <?php echo htmlspecialchars($type); ?><?php echo $count > 1 ? 's' : ''; ?>
                            </div>
                        <?php } ?>
                    </div>
                </section>

                <div class="feed-info">
                    <button type="button" id="view-raw-btn" class="btn btn-secondary" onclick="viewRaw()">View Raw JSON</button>
                </div>

                <section class="feed-content">
                    <?php
                    // Show latest posts first
                    if (isset($data['items']) && is_array($data['items'])) {
                        $items = $data['items'];
                        foreach ($items as $item) {
                            echo render_item($item);
                        }
                    }
                    ?>
                </section>
            <?php } else if ($jsonError) { ?>
                <div class="error-message">
                    <strong>Error: Invalid JSON feed.</strong><br>
                    <?= htmlspecialchars($jsonError) ?>
                </div>
            <?php } else if (strlen($feedUri) > 0) { ?>
                <div class="error-message">
                    <strong>Feed not found:</strong> "<?php echo htmlspecialchars($feedUri); ?>"
                </div>
            <?php } else { ?>
                <div class="info-message">
                    <strong>Welcome!</strong> Enter a feed URI above to get started, or click "Load Sample Feed" to see the reader in action.
                </div>
            <?php } ?>
        </div>

        <footer class="page-footer">
            <p>
                Powered by <a href="https://github.com/pnixon/deshittify" target="_blank">Ansybl</a> -
                A decentralized social syndication protocol
            </p>
        </footer>
    </div>

    <script src="walkthrough.js"></script>
</body>
</html>
