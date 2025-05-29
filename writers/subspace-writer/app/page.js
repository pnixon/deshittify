'use client';
import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash2, Eye, Code, Save, Upload } from 'lucide-react';

const ActivityStreamsEditor = () => {
  const [editMode, setEditMode] = useState('form'); // 'form' or 'json'
  const [feedData, setFeedData] = useState({
    '@context': 'https://www.w3.org/ns/activitystreams',
    summary: '',
    type: 'Collection',
    id: '',
    totalItems: 0,
    items: []
  });
  const [rawJson, setRawJson] = useState('');
  const [currentItem, setCurrentItem] = useState({
    type: 'Note',
    id: '',
    name: '',
    content: '',
    mediaType: 'text/plain',
    url: '',
    duration: '',
    attributedTo: [{ type: 'Person', name: '' }],
    published: new Date().toISOString(),
    summary: '',
    inReplyTo: ''
  });

  // Sync raw JSON when feed data changes
  useEffect(() => {
    setRawJson(JSON.stringify(feedData, null, 2));
  }, [feedData]);

  // Update feed data from raw JSON
  const updateFromJson = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setFeedData(parsed);
    } catch (error) {
      alert('Invalid JSON: ' + error.message);
    }
  };

  // Add current item to feed
  const addItem = () => {
    if (!currentItem.type) return;
    
    const newItem = { ...currentItem };
    
    // Clean up empty fields
    Object.keys(newItem).forEach(key => {
      if (newItem[key] === '' || (Array.isArray(newItem[key]) && newItem[key].length === 1 && newItem[key][0].name === '')) {
        delete newItem[key];
      }
    });

    // Handle attributedTo properly
    if (newItem.attributedTo && newItem.attributedTo[0]?.name) {
      newItem.attributedTo = newItem.attributedTo.filter(author => author.name);
    } else {
      delete newItem.attributedTo;
    }

    const updatedFeed = {
      ...feedData,
      items: [...feedData.items, newItem],
      totalItems: feedData.items.length + 1
    };
    
    setFeedData(updatedFeed);
    
    // Reset current item
    setCurrentItem({
      type: 'Note',
      id: '',
      name: '',
      content: '',
      mediaType: 'text/plain',
      url: '',
      duration: '',
      attributedTo: [{ type: 'Person', name: '' }],
      published: new Date().toISOString(),
      summary: '',
      inReplyTo: ''
    });
  };

  // Remove item from feed
  const removeItem = (index) => {
    const updatedItems = feedData.items.filter((_, i) => i !== index);
    setFeedData({
      ...feedData,
      items: updatedItems,
      totalItems: updatedItems.length
    });
  };

  // Download feed as .ansybl file
  const downloadFeed = () => {
    const blob = new Blob([JSON.stringify(feedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${feedData.summary || 'feed'}.ansybl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load feed from file
  const loadFeed = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          setFeedData(parsed);
        } catch (error) {
          alert('Invalid JSON file: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const itemTypes = ['Note', 'Article', 'Image', 'Video', 'Audio', 'Collection'];
  const mediaTypes = ['text/plain', 'text/markdown', 'text/html'];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 text-blue-400">ActivityStreams Feed Editor</h1>
          
          {/* Mode Toggle */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setEditMode('form')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                editMode === 'form' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Eye size={16} />
              Form Editor
            </button>
            <button
              onClick={() => setEditMode('json')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                editMode === 'json' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Code size={16} />
              Raw JSON
            </button>
          </div>

          {/* File Operations */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={downloadFeed}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Download size={16} />
              Download .ansybl
            </button>
            <label className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors cursor-pointer">
              <Upload size={16} />
              Load Feed
              <input type="file" accept=".ansybl,.json" onChange={loadFeed} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Editor Panel */}
          <div className="space-y-6">
            {editMode === 'form' ? (
              <>
                {/* Feed Metadata */}
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h2 className="text-xl font-semibold mb-4 text-blue-300">Feed Metadata</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Feed Title/Summary</label>
                      <input
                        type="text"
                        value={feedData.summary}
                        onChange={(e) => setFeedData({...feedData, summary: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="My awesome feed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Feed ID (URL)</label>
                      <input
                        type="url"
                        value={feedData.id}
                        onChange={(e) => setFeedData({...feedData, id: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://example.com/feed"
                      />
                    </div>
                  </div>
                </div>

                {/* Add New Item */}
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h2 className="text-xl font-semibold mb-4 text-green-300">Add New Item</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Type</label>
                        <select
                          value={currentItem.type}
                          onChange={(e) => setCurrentItem({...currentItem, type: e.target.value})}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {itemTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Media Type</label>
                        <select
                          value={currentItem.mediaType}
                          onChange={(e) => setCurrentItem({...currentItem, mediaType: e.target.value})}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {mediaTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">ID (URL)</label>
                      <input
                        type="url"
                        value={currentItem.id}
                        onChange={(e) => setCurrentItem({...currentItem, id: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://example.com/post/123"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Name/Title</label>
                      <input
                        type="text"
                        value={currentItem.name}
                        onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Post title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Content</label>
                      <textarea
                        value={currentItem.content}
                        onChange={(e) => setCurrentItem({...currentItem, content: e.target.value})}
                        rows={4}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Post content..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">URL (for media)</label>
                        <input
                          type="url"
                          value={currentItem.url}
                          onChange={(e) => setCurrentItem({...currentItem, url: e.target.value})}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Duration (PT5M30S)</label>
                        <input
                          type="text"
                          value={currentItem.duration}
                          onChange={(e) => setCurrentItem({...currentItem, duration: e.target.value})}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="PT22M"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Author Name</label>
                        <input
                          type="text"
                          value={currentItem.attributedTo[0]?.name || ''}
                          onChange={(e) => setCurrentItem({
                            ...currentItem, 
                            attributedTo: [{type: 'Person', name: e.target.value}]
                          })}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Author name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">In Reply To (for comments)</label>
                        <input
                          type="text"
                          value={currentItem.inReplyTo}
                          onChange={(e) => setCurrentItem({...currentItem, inReplyTo: e.target.value})}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://example.com/post/123"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Summary</label>
                      <input
                        type="text"
                        value={currentItem.summary}
                        onChange={(e) => setCurrentItem({...currentItem, summary: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Brief summary..."
                      />
                    </div>

                    <button
                      onClick={addItem}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg transition-colors font-medium"
                    >
                      <Plus size={16} />
                      Add Item to Feed
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* JSON Editor */
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-yellow-300">Raw JSON Editor</h2>
                  <button
                    onClick={updateFromJson}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <Save size={14} />
                    Apply Changes
                  </button>
                </div>
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  className="w-full h-96 p-4 bg-gray-900 border border-gray-600 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Raw JSON..."
                />
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            {/* Current Items */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4 text-purple-300">Current Items ({feedData.items.length})</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {feedData.items.map((item, index) => (
                  <div key={index} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-blue-600 px-2 py-1 rounded">{item.type}</span>
                        {item.inReplyTo && <span className="text-xs bg-orange-600 px-2 py-1 rounded">Reply</span>}
                      </div>
                      <p className="text-sm font-medium truncate">{item.name || item.content || 'Untitled'}</p>
                      {item.summary && <p className="text-xs text-gray-400 truncate">{item.summary}</p>}
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="ml-3 text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {feedData.items.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No items yet. Add some content!</p>
                )}
              </div>
            </div>

            {/* JSON Preview */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4 text-green-300">JSON Preview</h2>
              <pre className="bg-gray-900 p-4 rounded-lg text-xs overflow-auto max-h-64 border border-gray-600">
                <code className="text-green-400">{JSON.stringify(feedData, null, 2)}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityStreamsEditor;