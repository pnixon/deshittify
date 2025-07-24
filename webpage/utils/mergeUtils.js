// webpage/utils/mergeUtils.js
// Utilities for merging ActivityStreams feeds and comments

window.mergeItems = function(existingItems = [], newItems = []) {
  const existingIds = new Set(existingItems.map(item => item.id).filter(Boolean));
  const uniqueNewItems = newItems.filter(item => !item.id || !existingIds.has(item.id));
  return [...existingItems, ...uniqueNewItems];
};

window.mergeFeedData = function(existingFeed, newFeed) {
  if (!existingFeed) return newFeed;
  if (!newFeed) return existingFeed;

  const existingItems = existingFeed.items || existingFeed.orderedItems || [];
  const newItems = newFeed.items || newFeed.orderedItems || [];
  const mergedItems = window.mergeItems(existingItems, newItems);

  return {
    ...existingFeed,
    ...newFeed,
    items: newFeed.items ? mergedItems : undefined,
    orderedItems: newFeed.orderedItems ? mergedItems : undefined,
    totalItems: Math.max(
      existingFeed.totalItems || 0,
      newFeed.totalItems || 0,
      mergedItems.length
    ),
    name: newFeed.name || existingFeed.name,
    summary: newFeed.summary || existingFeed.summary
  };
};

window.mergeCommentsData = function(existingComments, newComments) {
  if (!existingComments) return newComments;
  if (!newComments) return existingComments;

  const existingItems = existingComments.items || existingComments.orderedItems || [];
  const newItems = newComments.items || newComments.orderedItems || [];
  const mergedItems = window.mergeItems(existingItems, newItems);

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