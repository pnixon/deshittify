/**
 * Media Attachment Handler for Ansybl Protocol
 * Processes and validates media attachments
 */

export class MediaAttachmentHandler {
  /**
   * Process multiple attachments
   * @param {object[]} attachments - Array of attachment objects
   * @param {object} options - Processing options
   * @returns {Promise<object[]>} Processed attachments
   */
  async processAttachments(attachments, options = {}) {
    const processed = [];
    
    for (const attachment of attachments) {
      try {
        const processedAttachment = await this.processAttachment(attachment, options);
        processed.push(processedAttachment);
      } catch (error) {
        if (!options.skipInvalid) {
          throw error;
        }
        console.warn('Skipping invalid attachment:', error.message);
      }
    }
    
    return processed;
  }

  /**
   * Process a single attachment
   * @param {object} attachment - Attachment object
   * @param {object} options - Processing options
   * @returns {Promise<object>} Processed attachment
   */
  async processAttachment(attachment, options = {}) {
    // Validate required fields
    if (!attachment.url || !attachment.mime_type) {
      throw new Error('Attachment must have url and mime_type');
    }

    // Validate URL format
    if (options.validateUrls) {
      try {
        new URL(attachment.url);
      } catch (error) {
        throw new Error(`Invalid attachment URL: ${attachment.url}`);
      }
    }

    // Return processed attachment (in a real implementation, this might extract metadata)
    return { ...attachment };
  }
}