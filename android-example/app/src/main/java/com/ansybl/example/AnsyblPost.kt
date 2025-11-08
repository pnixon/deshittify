package com.ansybl.example

/**
 * Data model representing an Ansybl post.
 * Mirrors the structure from the Ansybl specification.
 */
data class AnsyblPost(
    val id: String,
    val title: String,
    val content: String,
    val author: String,
    val timestamp: Long,
    val likes: Int = 0,
    val shares: Int = 0,
    val comments: Int = 0,
    val tags: List<String> = emptyList(),
    val contentFormat: String = "text/plain",
    val signature: String? = null,
    val mediaAttachments: List<MediaAttachment> = emptyList()
) {
    data class MediaAttachment(
        val url: String,
        val type: String,
        val mimeType: String,
        val size: Long,
        val checksum: String? = null
    )

    /**
     * Returns a formatted timestamp string
     */
    fun getFormattedTimestamp(): String {
        val diff = System.currentTimeMillis() - timestamp
        val seconds = diff / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        val days = hours / 24

        return when {
            days > 0 -> "$days day${if (days > 1) "s" else ""} ago"
            hours > 0 -> "$hours hour${if (hours > 1) "s" else ""} ago"
            minutes > 0 -> "$minutes minute${if (minutes > 1) "s" else ""} ago"
            else -> "Just now"
        }
    }

    /**
     * Returns formatted tags string
     */
    fun getFormattedTags(): String {
        return tags.joinToString(" ") { "#$it" }
    }
}
