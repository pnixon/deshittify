/**
 * HTML template generators
 */

import { siteConfig } from '../data/config.js';

export function generatePageTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${siteConfig.title}</title>
    <link rel="alternate" type="application/json" title="Ansybl Feed" href="/feed.ansybl">
    <link rel="stylesheet" href="/css/content-editor.css">
    <link rel="stylesheet" href="/css/realtime.css">
    <link rel="stylesheet" href="/css/responsive.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .site-header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .site-header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .site-description {
            color: #6c757d;
            font-size: 1.1em;
            margin-bottom: 20px;
        }
        
        .feed-links {
            display: flex;
            gap: 15px;
            justify-content: center;
        }
        
        .feed-link, .api-link {
            padding: 8px 16px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
        }
        
        .feed-link:hover, .api-link:hover {
            background: #0056b3;
        }
        
        .post-preview {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .post-preview h2 {
            margin-bottom: 10px;
        }
        
        .post-preview h2 a {
            color: #2c3e50;
            text-decoration: none;
        }
        
        .post-preview h2 a:hover {
            color: #007bff;
        }
        
        .post-meta {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 15px;
        }
        
        .tags {
            margin-left: 15px;
        }
        
        .tag {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.8em;
            margin-right: 5px;
        }
        
        .read-more {
            color: #007bff;
            text-decoration: none;
            font-weight: 500;
        }
        
        .post-summary-preview {
            color: #6c757d;
            line-height: 1.6;
            margin: 15px 0;
        }
        
        .post-interactions-preview {
            display: flex;
            gap: 15px;
            margin: 15px 0;
            font-size: 0.9em;
        }
        
        .interaction-count {
            color: #6c757d;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        /* Post creation form styles */
        .create-post-section {
            margin-bottom: 40px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        
        #content-editor-container {
            margin: 20px 0;
        }
        
        .create-post-btn {
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        .create-post-btn:hover {
            background: #218838;
        }
        
        .create-post-form {
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #495057;
        }
        
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
        }
        
        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        .submit-button {
            background: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .submit-button:hover:not(:disabled) {
            background: #0056b3;
        }
        
        .submit-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }
        
        .cancel-button {
            background: #6c757d;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .cancel-button:hover {
            background: #5a6268;
        }
        
        .post-creation-status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        
        .post-creation-status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }
        
        .post-creation-status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }
        
        .post-creation-status.loading {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            display: block;
        }
        
        .api-demo {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e9ecef;
        }
        
        .api-endpoints {
            display: grid;
            gap: 20px;
            margin-top: 20px;
        }
        
        .endpoint {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        
        .endpoint h3 {
            margin-bottom: 5px;
            color: #2c3e50;
        }
        
        .endpoint code {
            background: #e9ecef;
            padding: 4px 8px;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
            color: #d63384;
        }
        
        .try-button {
            background: #28a745;
            color: white;
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            text-decoration: none;
            display: inline-block;
            margin-top: 10px;
            cursor: pointer;
        }
        
        .try-button:hover {
            background: #218838;
        }
        
        .breadcrumb {
            margin-bottom: 20px;
        }
        
        .breadcrumb a {
            color: #007bff;
            text-decoration: none;
        }
        
        .post {
            margin-bottom: 30px;
        }
        
        .post-header {
            margin-bottom: 30px;
        }
        
        .post-content {
            font-size: 1.1em;
            line-height: 1.7;
            margin-bottom: 30px;
        }
        
        .post-footer {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #17a2b8;
        }
        
        .error-page {
            text-align: center;
            padding: 60px 20px;
        }
        
        .modal {
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        
        .modal-content {
            background-color: white;
            margin: 5% auto;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .close:hover {
            color: black;
        }
        
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.9em;
        }
        
        /* Enhanced styles for Phase 2 features */
        .post-summary {
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #007bff;
            margin: 15px 0;
            font-style: italic;
            color: #6c757d;
        }
        
        .modified {
            color: #28a745;
            font-size: 0.85em;
            margin-left: 10px;
        }
        
        .post-interactions {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        
        .interaction-buttons {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .interaction-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 15px;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
        }
        
        .interaction-btn:hover {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        
        .interaction-btn.active {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }
        
        .interaction-btn .icon {
            font-size: 16px;
        }
        
        .interaction-btn .label {
            font-weight: 500;
        }
        
        .like-btn.active {
            background: #28a745;
            border-color: #28a745;
        }
        
        .share-btn.active {
            background: #17a2b8;
            border-color: #17a2b8;
        }
        
        .interaction-status {
            font-size: 0.9em;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        
        .interaction-status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }
        
        .interaction-status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }
        
        .post-metadata {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            font-size: 0.9em;
        }
        
        .post-metadata code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.85em;
        }
        
        /* Enhanced markdown content styles */
        .post-content h1, .post-content h2, .post-content h3 {
            margin-top: 25px;
            margin-bottom: 15px;
            color: #2c3e50;
        }
        
        .post-content h1 {
            font-size: 1.8em;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
        }
        
        .post-content h2 {
            font-size: 1.5em;
        }
        
        .post-content h3 {
            font-size: 1.3em;
        }
        
        .post-content blockquote {
            border-left: 4px solid #007bff;
            margin: 20px 0;
            padding: 15px 20px;
            background: #f8f9fa;
            font-style: italic;
        }
        
        .post-content pre {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 15px;
            overflow-x: auto;
            margin: 15px 0;
        }
        
        .post-content code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
            color: #e83e8c;
        }
        
        .post-content pre code {
            background: none;
            padding: 0;
            color: inherit;
        }
        
        .post-content ul, .post-content ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        .post-content li {
            margin: 8px 0;
        }
        
        /* Media attachments styles */
        .post-attachments {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        
        .post-attachments h3 {
            margin-bottom: 15px;
            color: #2c3e50;
        }
        
        .attachments-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .attachment {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .image-attachment img {
            width: 100%;
            height: auto;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .image-attachment img:hover {
            transform: scale(1.02);
        }
        
        .video-attachment video,
        .audio-attachment audio {
            width: 100%;
        }
        
        .attachment-info {
            padding: 10px;
            background: white;
        }
        
        .attachment-title {
            display: block;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .attachment-size,
        .attachment-dimensions,
        .attachment-duration,
        .attachment-type {
            display: inline-block;
            font-size: 0.8em;
            color: #6c757d;
            margin-right: 10px;
        }
        
        .file-attachment {
            padding: 15px;
        }
        
        .file-link {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: inherit;
        }
        
        .file-link:hover {
            color: #007bff;
        }
        
        .file-icon {
            font-size: 24px;
        }
        
        /* Media modal */
        .media-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
        }
        
        .media-modal img {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
        }
        
        .media-modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            color: white;
            font-size: 30px;
            cursor: pointer;
            background: rgba(0,0,0,0.5);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* Comments section styles */
        .comments-section {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e9ecef;
        }
        
        .comments-info {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 30px;
        }
        
        .comment-form {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .comment-form h3 {
            margin-bottom: 20px;
            color: #2c3e50;
        }
        
        .comment-status {
            margin-top: 15px;
        }
        
        .status-loading {
            color: #007bff;
            font-weight: 500;
        }
        
        .status-success {
            color: #28a745;
            font-weight: 500;
        }
        
        .status-error {
            color: #dc3545;
            font-weight: 500;
        }
        
        .comments-list {
            margin-top: 20px;
        }
        
        .comment {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 15px;
        }
        
        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f1f3f4;
        }
        
        .comment-author {
            color: #2c3e50;
        }
        
        .comment-author a {
            color: #007bff;
            text-decoration: none;
        }
        
        .comment-author a:hover {
            text-decoration: underline;
        }
        
        .comment-date {
            color: #6c757d;
            font-size: 0.85em;
        }
        
        .comment-content {
            margin-bottom: 10px;
            line-height: 1.6;
        }
        
        .comment-meta {
            color: #6c757d;
            font-size: 0.8em;
        }
        
        .comment-meta code {
            background: #f8f9fa;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 0.75em;
        }
        
        .no-comments {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 40px 20px;
        }
        
        .loading {
            text-align: center;
            color: #6c757d;
            padding: 20px;
        }
        
        .error {
            color: #dc3545;
            text-align: center;
            padding: 20px;
        }

        @media (max-width: 600px) {
            .container {
                padding: 20px;
                margin: 10px;
            }
            
            .feed-links {
                flex-direction: column;
                align-items: center;
            }
            
            .comment-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="/js/content-editor.js"></script>
    <script src="/js/realtime.js"></script>
    <script src="/js/accessibility.js"></script>
</body>
</html>`;
}