function FeedViewer() {
    const [feed, setFeed] = React.useState(null);
    const [comments, setComments] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [fileUrl, setFileUrl] = React.useState("");
    const [loadedStreams, setLoadedStreams] = React.useState([]); // Track loaded streams

    // Merges items from multiple sources, avoiding duplicates based on ID
    const mergeItems = (existingItems = [], newItems = []) => {
        const existingIds = new Set(existingItems.map(item => item.id).filter(id => id));
        const uniqueNewItems = newItems.filter(item => !item.id || !existingIds.has(item.id));
        return [...existingItems, ...uniqueNewItems];
    };

    // Merges feed data, preserving existing data
    const mergeFeedData = (existingFeed, newFeed) => {
        if (!existingFeed) return newFeed;
        if (!newFeed) return existingFeed;

        const existingItems = existingFeed.items || existingFeed.orderedItems || [];
        const newItems = newFeed.items || newFeed.orderedItems || [];
        const mergedItems = mergeItems(existingItems, newItems);

        return {
            ...existingFeed,
            ...newFeed, // New feed properties take precedence
            items: newFeed.items ? mergedItems : undefined,
            orderedItems: newFeed.orderedItems ? mergedItems : undefined,
            totalItems: Math.max(
                existingFeed.totalItems || 0, 
                newFeed.totalItems || 0,
                mergedItems.length
            ),
            // Preserve name if existing feed has one and new one doesn't
            name: newFeed.name || existingFeed.name,
            summary: newFeed.summary || existingFeed.summary
        };
    };

    // Merges comment data, preserving existing comments
    const mergeCommentsData = (existingComments, newComments) => {
        if (!existingComments) return newComments;
        if (!newComments) return existingComments;

        const existingItems = existingComments.items || existingComments.orderedItems || [];
        const newItems = newComments.items || newComments.orderedItems || [];
        const mergedItems = mergeItems(existingItems, newItems);

        return {
            ...existingComments,
            ...newComments,
            items: newComments.items ? mergedItems : undefined,
            orderedItems: newComments.orderedItems ? mergedItems : undefined,
            totalItems: Math.max(
                existingComments.totalItems || 0,
                newComments.totalItems || 0,
                mergedItems.length
            )
        };
    };

    // Processes loaded JSON data and merges it with existing data
    const processLoadedData = (jsonData, sourceInfo = "") => {
        if (!jsonData || typeof jsonData !== 'object') {
            setError("Invalid data: Expected an object.");
            console.error("Invalid data:", jsonData);
            return;
        }

        let isExclusivelyComments = false;
        const items = jsonData.items || jsonData.orderedItems;

        if (items && Array.isArray(items)) {
            if (items.length > 0) {
                const contentItems = items.filter(item => item && typeof item === 'object' && item.type);
                if (contentItems.length > 0) {
                    isExclusivelyComments = contentItems.every(item => typeof item.inReplyTo !== 'undefined');
                    
                    // Debug logging
                    console.log(`Processing ${sourceInfo}:`);
                    console.log(`Total items: ${items.length}`);
                    console.log(`Content items: ${contentItems.length}`);
                    console.log(`Items with inReplyTo: ${contentItems.filter(item => typeof item.inReplyTo !== 'undefined').length}`);
                    console.log(`Detected as comments: ${isExclusivelyComments}`);
                }
            }
        }

        // Track this loaded stream
        const streamInfo = {
            source: sourceInfo,
            type: isExclusivelyComments ? 'comments' : 'feed',
            itemCount: items ? items.length : 0,
            loadedAt: new Date().toLocaleString()
        };

        setLoadedStreams(prev => [...prev, streamInfo]);

        if (isExclusivelyComments) {
            console.log('Merging as comments');
            setComments(prev => mergeCommentsData(prev, jsonData));
            setError(null);
        } else {
            console.log('Merging as feed');
            setFeed(prev => mergeFeedData(prev, jsonData));
            setError(null);
        }
    };
    
    // Fetches data from the provided URL
    const loadFromUrlHandler = () => {
        if (!fileUrl) {
            setError("Please enter a feed URL");
            return;
        }
        setError(null);
        axios.get(fileUrl)
            .then(response => processLoadedData(response.data, `URL: ${fileUrl}`))
            .catch(err => {
                console.error("Failed to load from URL:", err);
                setError(`Failed to load from URL: ${err.message}`);
            });
    };

    // Handles file loading from the file input
    const loadFileHandler = (event) => {
        const file = event.target.files[0];
        if (file) {
            setError(null);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    processLoadedData(json, `File: ${file.name}`);
                } catch (parseError) {
                    console.error("Invalid JSON file:", parseError);
                    setError(`Invalid JSON file: ${parseError.message}`);
                }
            };
            reader.onerror = () => {
                setError("Failed to read file.");
            }
            reader.readAsText(file);
        }
    };

    // Clears all loaded data
    const clearAllData = () => {
        setFeed(null);
        setComments(null);
        setLoadedStreams([]);
        setError(null);
    };

    // Extracts URL from various possible structures in ActivityStreams
    const extractUrl = (urlField) => {
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
    };

    // Formats ISO 8601 duration
    const formatDuration = (duration) => {
        if (!duration || typeof duration !== 'string') return '';
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (match) {
            const hours = parseInt(match[1]) || 0;
            const minutes = parseInt(match[2]) || 0;
            const seconds = parseInt(match[3]) || 0;
            if (hours > 0) return `${hours}h ${minutes}m`;
            if (minutes > 0) return `${minutes}m ${seconds > 0 ? ` ${seconds}s` : ''}`;
            if (seconds > 0) return `${seconds}s`;
        }
        return duration;
    };

    // Extracts YouTube video ID
    const getYouTubeVideoId = (url) => {
        if (!url || typeof url !== 'string') return null;
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
        const match = regex.exec(url);
        return match ? match[1] : null;
    };

    // Renders content, handling markdown
    const renderContent = (content, mediaType) => {
        if (!content) return null;
        if (mediaType === 'text/markdown' && typeof marked !== 'undefined') {
            return React.createElement('div', { 
                dangerouslySetInnerHTML: { __html: marked.parse(content) } 
            });
        }
        if (typeof content === 'string' || typeof content === 'number') {
            // Process hashtags and mentions
            const processedContent = String(content)
                .replace(/(#\w+)/g, '<span class="hashtag">$1</span>')
                .replace(/(@\w+)/g, '<span class="mention">$1</span>');
            return React.createElement('div', { 
                dangerouslySetInnerHTML: { __html: processedContent } 
            });
        }
        if (typeof content === 'object' && content !== null) {
            return React.createElement('div', null, JSON.stringify(content));
        }
        return null;
    };

    // Formats timestamp
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleString();
    };
    
    // Renders a media item (Image, Audio, Video)
    const renderMediaItem = (item) => {
        if (typeof item === 'string') {
            return React.createElement('div', { className: "media-container" },
                React.createElement('a', { 
                    href: item, 
                    target: "_blank", 
                    rel: "noopener noreferrer" 
                }, item)
            );
        }
        if (!item || typeof item !== 'object' || !item.type) return null;

        const url = extractUrl(item.url);

        switch (item.type) {
            case 'Image':
                return url ? React.createElement('div', { className: "media-container" },
                    React.createElement('img', { 
                        src: url, 
                        alt: item.name || 'Image', 
                        onError: (e) => e.target.style.display='none' 
                    })
                ) : null;
            
            case 'Audio':
                return url ? React.createElement('div', { className: "media-container" },
                    React.createElement('audio', { controls: true, className: "audio-player" },
                        React.createElement('source', { 
                            src: url, 
                            type: item.mediaType || 'audio/mpeg' 
                        }),
                        "Your browser does not support the audio element."
                    ),
                    item.duration && React.createElement('span', { className: "duration" },
                        `Duration: ${formatDuration(item.duration)}`
                    )
                ) : null;
            
            case 'Video':
                const videoId = getYouTubeVideoId(url);
                if (videoId) {
                    return React.createElement('div', { className: "media-container" },
                        React.createElement('div', { className: "youtube-embed" },
                            React.createElement('iframe', {
                                src: `https://www.youtube.com/embed/${videoId}`,
                                frameBorder: "0",
                                allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                                allowFullScreen: true,
                                title: item.name || 'Video'
                            })
                        ),
                        item.duration && React.createElement('span', { className: "duration" },
                            `Duration: ${formatDuration(item.duration)}`
                        )
                    );
                } else if (url) {
                     return React.createElement('div', { className: "media-container" },
                        React.createElement('video', { 
                            controls: true, 
                            style: {maxWidth: '100%', borderRadius: '8px'}
                        },
                            React.createElement('source', { 
                                src: url, 
                                type: item.mediaType || 'video/mp4' 
                            }),
                            "Your browser does not support the video element."
                        ),
                        item.duration && React.createElement('span', { className: "duration" },
                            `Duration: ${formatDuration(item.duration)}`
                        )
                    );
                }
                return null;
            
            default:
                if (url) {
                     return React.createElement('div', { className: "media-container" },
                        React.createElement('a', { 
                            href: url, 
                            target: "_blank", 
                            rel: "noopener noreferrer" 
                        }, item.name || url)
                    );
                }
                return null;
        }
    };

    // Enhanced function to render multiple images in a grid
    const renderImageCollection = (items) => {
        const imageItems = items.filter(item => item && item.type === 'Image');
        if (imageItems.length === 0) return null;

        if (imageItems.length === 1) {
            return renderMediaItem(imageItems[0]);
        }

        return React.createElement('div', { className: "image-grid" },
            imageItems.map((item, index) => {
                const url = extractUrl(item.url);
                return url ? React.createElement('img', {
                    key: index,
                    src: url, 
                    alt: item.name || `Image ${index + 1}`, 
                    onError: (e) => e.target.style.display='none'
                }) : null;
            })
        );
    };

    // Gets comments related to a specific post ID
    const getCommentsForPost = (postId) => {
        if (!comments || !comments.items || !Array.isArray(comments.items)) return [];
        const matchingComments = comments.items.filter(comment => comment && comment.inReplyTo === postId);
        
        // Debug logging
        if (postId && comments.items.length > 0) {
            console.log(`Looking for comments for post: ${postId}`);
            console.log(`Found ${matchingComments.length} matching comments`);
            console.log('Available comment inReplyTo values:', comments.items.map(c => c.inReplyTo).filter(Boolean));
        }
        
        return matchingComments;
    };

    // Gets replies to a specific comment ID
    const getRepliesToComment = (commentId) => {
        if (!comments || !comments.items || !Array.isArray(comments.items)) return [];
        return comments.items.filter(comment => comment && comment.inReplyTo === commentId);
    };

    // Renders hashtags
    const renderTags = (tags) => {
        if (!tags || !Array.isArray(tags) || tags.length === 0) return null;
        
        return React.createElement('div', { className: "comment-tags" },
            tags.map((tag, index) => 
                React.createElement('span', { 
                    key: index, 
                    className: "comment-tag" 
                }, tag.name || (typeof tag === 'string' ? tag : ''))
            )
        );
    };

    // Renders a single comment and its replies recursively
    const renderComment = (comment, depth = 0) => {
        if (!comment || !comment.id) return null;
        const replies = getRepliesToComment(comment.id);
        const maxDepth = 3;
        const indentLevel = Math.min(depth, maxDepth);
        
        return React.createElement('div', {
            key: comment.id,
            className: `comment depth-${indentLevel}`,
            style: { marginLeft: `${indentLevel * 15}px` }
        },
            React.createElement('div', { className: "comment-header" },
                React.createElement('span', { className: "comment-author" },
                    (comment.attributedTo && (typeof comment.attributedTo === 'string' 
                        ? comment.attributedTo 
                        : comment.attributedTo.name || comment.attributedTo.preferredUsername)) || 'Anonymous'
                ),
                React.createElement('span', { className: "comment-timestamp" },
                    formatTimestamp(comment.published)
                )
            ),
            React.createElement('div', { className: "comment-content" },
                renderContent(comment.content, comment.mediaType)
            ),
            comment.attachment && (Array.isArray(comment.attachment) ? comment.attachment : [comment.attachment]).map((att, idx) => 
                React.createElement('div', { key: idx }, renderMediaItem(att))
            ),
            renderTags(comment.tag),
            replies.length > 0 && depth < maxDepth && React.createElement('div', { className: "comment-replies" },
                replies.map(reply => renderComment(reply, depth + 1))
            )
        );
    };
    
    // Renders the comments section for a given post ID
    const renderCommentsSection = (postId) => {
        const postComments = getCommentsForPost(postId);
        if (postComments.length === 0) return null;
        
        return React.createElement('div', { className: "comments-section" },
            React.createElement('h3', { className: "comments-title" }, 
                `Comments (${postComments.length})`
            ),
            React.createElement('div', { className: "comments-list" },
                postComments.map(comment => renderComment(comment, 0))
            )
        );
    };
    
    // Renders the author information
    const renderAttributedTo = (attributedTo) => {
        if (!attributedTo) return null;
        let authorsArray = [];
        if (Array.isArray(attributedTo)) {
            authorsArray = attributedTo;
        } else if (typeof attributedTo === 'object') {
            authorsArray = [attributedTo];
        } else if (typeof attributedTo === 'string') {
             return React.createElement('div', { className: "author" }, `By: ${attributedTo}`);
        }

        const authorInfo = authorsArray
            .map(person => {
                if (!person) return null;
                const name = person.name || person.preferredUsername || (typeof person === 'string' ? person : null);
                const summary = person.summary;
                return { name, summary };
            })
            .filter(author => author && author.name);

        if (authorInfo.length === 0) return null;
        
        return React.createElement('div', { className: "author" },
            `By: ${authorInfo.map(author => author.name).join(', ')}`,
            authorInfo.length === 1 && authorInfo[0].summary && 
                React.createElement('span', { className: "author-summary" }, 
                    ` - ${authorInfo[0].summary}`
                )
        );
    };

    // Renders a single item from the main feed or a collection
    const renderItem = (item, index) => {
        if (!item || !item.type) {
            return React.createElement('div', {
                key: `error-${index}`,
                className: "post error"
            }, `Invalid item data at index ${index}.`);
        }

        const getPostTypeClass = (type) => type ? type.toLowerCase().replace(/\s+/g, '-') : 'unknown';

        if (item.type === 'Collection' || item.type === 'OrderedCollection') {
            const collectionItems = item.items || item.orderedItems || [];
            const isImageCollection = collectionItems.every(subItem => subItem && subItem.type === 'Image');
            
            return React.createElement('div', {
                key: item.id || `collection-${index}`,
                className: "post"
            },
                React.createElement('div', { className: "post-header" },
                    React.createElement('h2', { className: "post-title" },
                        item.name || item.summary || 'Collection'
                    ),
                    React.createElement('span', {
                        className: `post-type ${getPostTypeClass(item.type)}`
                    }, `${item.type} (${item.totalItems || collectionItems.length || 0})`)
                ),
                item.summary && item.name && React.createElement('div', { className: "collection-summary" },
                    item.summary
                ),
                
                // Special handling for image collections
                isImageCollection ? 
                    renderImageCollection(collectionItems) :
                    React.createElement('div', { className: "collection-items" },
                        collectionItems.map((subItem, subIndex) =>
                            React.createElement('div', {
                                key: subItem.id || `subitem-${index}-${subIndex}`,
                                className: "collection-item",
                                style: { marginBottom: '20px', padding:'10px', border:'1px solid #21262d', borderRadius:'4px' }
                            },
                                subItem.type && React.createElement('span', {
                                    className: `post-type ${getPostTypeClass(subItem.type)}`,
                                    style: { marginBottom: '10px', display: 'inline-block' }
                                }, subItem.type),
                                subItem.name && React.createElement('h3', {
                                    style: { margin: '10px 0', color: '#f0f6fc' }
                                }, subItem.name),
                                subItem.summary && React.createElement('p', {
                                    style: {fontSize:'0.9em', color:'#8b949e'}
                                }, subItem.summary),
                                subItem.content && React.createElement('div', { className: "post-content" },
                                    renderContent(subItem.content, subItem.mediaType)
                                ),
                                renderMediaItem(subItem),
                                subItem.attachment && (Array.isArray(subItem.attachment) ? subItem.attachment : [subItem.attachment])
                                    .map((att, attIdx) => React.createElement('div', { key: attIdx }, 
                                        renderMediaItem(typeof att === 'string' ? {type: 'Image', url: att} : att)
                                    )),
                                subItem.image && renderMediaItem(typeof subItem.image === 'string' ? {type:'Image', url: subItem.image} : subItem.image),
                                subItem.icon && renderMediaItem(typeof subItem.icon === 'string' ? {type:'Image', url: subItem.icon} : subItem.icon),
                                renderAttributedTo(subItem.attributedTo),
                                subItem.published && React.createElement('div', { className: "post-timestamp" },
                                    `Published: ${formatTimestamp(subItem.published)}`
                                ),
                                subItem.id && renderCommentsSection(subItem.id)
                            )
                        )
                    ),
                renderAttributedTo(item.attributedTo),
                item.published && React.createElement('div', { className: "post-timestamp" },
                    `Published: ${formatTimestamp(item.published)}`
                ),
                item.id && renderCommentsSection(item.id)
            );
        }

        // Default rendering for other item types
        return React.createElement('div', {
            key: item.id || `item-${index}`,
            className: "post"
        },
            React.createElement('div', { className: "post-header" },
                React.createElement('h2', { className: "post-title" },
                    item.name || item.summary || `${item.type} Post`
                ),
                React.createElement('span', {
                    className: `post-type ${getPostTypeClass(item.type)}`
                }, item.type)
            ),
            item.published && React.createElement('div', { className: "post-timestamp" },
                `Published: ${formatTimestamp(item.published)}`
            ),
            item.summary && item.name && React.createElement('p', {
                style: {
                    fontSize:'0.9em', 
                    color:'#8b949e', 
                    backgroundColor: 'rgba(139, 148, 158, 0.1)', 
                    padding: '10px', 
                    borderRadius: '6px'
                }
            }, item.summary),
            
            item.content && React.createElement('div', { className: "post-content" },
                renderContent(item.content, item.mediaType)
            ),
            
            renderMediaItem(item),
            item.attachment && (Array.isArray(item.attachment) ? item.attachment : [item.attachment]).map((att, idx) => 
                React.createElement('div', { key: idx }, renderMediaItem(att))
            ),
            item.image && renderMediaItem(typeof item.image === 'string' ? {type:'Image', url: item.image} : item.image),
            item.icon && renderMediaItem(typeof item.icon === 'string' ? {type:'Image', url: item.icon} : item.icon),

            renderTags(item.tag),
            renderAttributedTo(item.attributedTo),
            item.id && renderCommentsSection(item.id)
        );
    };

    return React.createElement('div', null,
        React.createElement('div', { className: "input-container" },
            React.createElement('input', {
                type: "text",
                placeholder: "Enter Feed or Comments URL",
                value: fileUrl,
                onChange: (e) => setFileUrl(e.target.value)
            }),
            React.createElement('button', {
                onClick: loadFromUrlHandler
            }, "Add from URL")
        ),
        
        React.createElement('div', { className: "input-container" },
            React.createElement('input', {
                type: "file",
                accept: ".ansybl,.json,application/json",
                onChange: loadFileHandler,
                title: "Add Feed or Comments File"
            }),
            React.createElement('label', null, "Add Feed or Comments File (.ansybl, .json)"),
            loadedStreams.length > 0 && React.createElement('button', {
                onClick: clearAllData,
                style: { 
                    backgroundColor: '#f85149', 
                    marginLeft: '10px',
                    background: 'linear-gradient(135deg, #f85149 0%, #da3633 100%)'
                }
            }, "Clear All")
        ),

        // Show loaded streams info
        loadedStreams.length > 0 && React.createElement('div', { 
            className: "loaded-streams-info",
            style: {
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                border: '1px solid rgba(88, 166, 255, 0.3)',
                borderRadius: '6px',
                padding: '15px',
                marginBottom: '20px'
            }
        },
            React.createElement('h3', { 
                style: { color: '#58a6ff', marginTop: 0, marginBottom: '10px' }
            }, `Loaded Streams (${loadedStreams.length})`),
            React.createElement('div', { style: { fontSize: '0.9em', color: '#8b949e' } },
                loadedStreams.map((stream, idx) => 
                    React.createElement('div', { key: idx, style: { marginBottom: '5px' } },
                        `${idx + 1}. ${stream.source} - ${stream.type} (${stream.itemCount} items) - ${stream.loadedAt}`
                    )
                )
            )
        ),
        
        error && React.createElement('div', { className: "error" }, error),
        
        feed && React.createElement('div', null,
            React.createElement('div', { className: "feed-header" },
                React.createElement('h1', { className: "feed-title" },
                    feed.name || feed.summary || "Merged ActivityStreams Feed"
                ),
                React.createElement('div', { className: "feed-stats" },
                    `Total Items in Main Feed: ${feed.totalItems || (feed.items && feed.items.length) || (feed.orderedItems && feed.orderedItems.length) || 0}`,
                    comments && React.createElement('span', { className: "comments-stats" },
                        ` | Total Comments Loaded: ${comments.totalItems || (comments.items && comments.items.length) || (comments.orderedItems && comments.orderedItems.length) || 0}`
                    )
                )
            ),
            
            (feed.items || feed.orderedItems || []).map((item, index) => renderItem(item, index))
        ),
        
        !feed && comments && comments.items && comments.items.length > 0 && 
            React.createElement('div', { className: "comments-section" },
                React.createElement('h3', { className: "comments-title" },
                    `Standalone Comments (${comments.items.length})`
                ),
                React.createElement('div', { className: "comments-list" },
                    comments.items.map(comment => renderComment(comment, 0))
                )
            )
    );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(FeedViewer));