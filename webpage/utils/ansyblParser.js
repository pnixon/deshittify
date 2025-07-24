// webpage/utils/ansyblParser.js
// Utility for parsing .ansybl and .json ActivityStreams files

window.parseAnsyblFile = function(fileContent) {
  try {
    const data = JSON.parse(fileContent);
    if (typeof data !== "object" || data === null) {
      throw new Error("File does not contain a valid JSON object.");
    }
    // Optionally, validate required ActivityStreams fields here
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};