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
            $html .= '<img src="' . htmlspecialchars($imgUrl) . '" style="max-width:350px;max-height:350px;display:block;margin-bottom:8px;" />';
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
    if (isset($item['url'])) {
        if (is_string($item['url'])) return $item['url'];
        if (is_array($item['url'])) {
            // Array of links
            foreach ($item['url'] as $u) {
                if (is_array($u) && isset($u['href'])) return $u['href'];
                if (is_string($u)) return $u;
            }
            // Object (e.g., 'type'=>'Link')
            if (isset($item['url']['href'])) return $item['url']['href'];
        }
        // Object with href (not array)
        if (isset($item['url']['href'])) return $item['url']['href'];
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

?>
<!DOCTYPE html>
<html>
<head>
    <title>Subspace Web Reader</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Subspace Web Reader.">
    <style>
        body { font-family: sans-serif; background: #f7f7f7; color: #232323; }
        .feed-item, .collection { background: #fff; border-radius: 7px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); padding: 20px; margin-bottom: 18px; }
        .collection-items { margin-left: 20px; }
        pre { background: #f2f2f2; border-radius: 4px; padding: 8px; }
        h4, h3 { margin-bottom: 4px; }
        .markdown h1, .markdown h2, .markdown h3, .markdown h4 {
				    margin-top: 1.2em;
				    margin-bottom: 0.5em;
				}
				.markdown p, .markdown ul, .markdown ol, .markdown li {
				    margin-bottom: 0.5em;
				}
				.markdown code, .markdown pre {
				    background: #efefef;
				    border-radius: 3px;
				    padding: 2px 5px;
				}
    </style>
</head>
<body>
    <h1>Subspace Web Reader</h1>
    <form id="feed_form" action="./reader.php" method="post">
        <label for="feed_uri">Feed</label>
        <input id="feed_uri" name="feed_uri" type="text" value="<?php echo htmlspecialchars(urldecode($feedUri)); ?>" style="width:70%" />
        <input type="submit" value="Submit">
    </form>
    <hr />
<?php if (isset($data)) { ?>
    <h2><?php echo htmlspecialchars($data["summary"] ?? '[No summary]'); ?></h2>
    <hr/>
    <?php
    // Show latest posts first (reverse order)
    if (isset($data['items']) && is_array($data['items'])) {
        $items = $data['items'];
        foreach ($items as $item) {
            echo render_item($item);
        }
    }
    ?>
<?php } else if ($jsonError) { ?>
    <div style="color:red; font-weight:bold;">
        Error: Invalid JSON feed. <?= htmlspecialchars($jsonError) ?>
    </div>
<?php } else if (strlen($feedUri) > 0) { ?>
	<h2>Feed "<?php echo $feedUri; ?>" not found.</h2>
<?php } ?>
</body>
</html>
