package com.ansybl.example

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.view.View
import android.view.Gravity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import android.content.SharedPreferences
import androidx.preference.PreferenceManager

/**
 * Manages the interactive walkthrough feature for the Ansybl Example app.
 * Similar to the web version's AnsyblWalkthrough class.
 */
class WalkthroughManager(private val activity: Activity) {

    private val preferences: SharedPreferences = PreferenceManager.getDefaultSharedPreferences(activity)
    private var currentStep = 0
    private val steps = defineSteps()

    data class WalkthroughStep(
        val title: String,
        val description: String,
        val targetView: (() -> View?)? = null,
        val onShow: (() -> Unit)? = null
    )

    private fun defineSteps(): List<WalkthroughStep> {
        return listOf(
            WalkthroughStep(
                title = "🎉 Welcome to Ansybl!",
                description = "This interactive tour will show you all the amazing features of the Ansybl decentralized social protocol. Let's get started!"
            ),
            WalkthroughStep(
                title = "📱 Main Feed",
                description = "This is your main feed where all Ansybl posts are displayed. Each post includes content, author info, timestamps, and social interactions."
            ),
            WalkthroughStep(
                title = "✍️ Create Posts",
                description = "Tap this button to create new posts. You can add titles, rich content, and the posts will be cryptographically signed for authenticity."
            ),
            WalkthroughStep(
                title = "🔐 Cryptographic Signing",
                description = "All Ansybl content is signed with Ed25519 cryptographic keys. This ensures that posts are authentic and haven't been tampered with."
            ),
            WalkthroughStep(
                title = "👍 Social Interactions",
                description = "Posts support likes, shares, and replies. All interactions are tracked and can be verified through the Ansybl protocol."
            ),
            WalkthroughStep(
                title = "🏷️ Tags & Discovery",
                description = "Posts can include tags for categorization and discovery. Tags help users find content they're interested in."
            ),
            WalkthroughStep(
                title = "📡 Ansybl Feed",
                description = "The feed endpoint provides all posts in standard Ansybl JSON format. This is accessible through the menu for API integration."
            ),
            WalkthroughStep(
                title = "✅ Content Validation",
                description = "Ansybl includes a validation API that checks content against the JSON schema and verifies cryptographic signatures."
            ),
            WalkthroughStep(
                title = "🔍 Parser & Verification",
                description = "The parser extracts and verifies all aspects of Ansybl documents, including signatures, metadata, and content structure."
            ),
            WalkthroughStep(
                title = "💬 Comments System",
                description = "Each post supports threaded comments with full cryptographic verification. Comments are first-class citizens in the protocol."
            ),
            WalkthroughStep(
                title = "📊 Interaction Tracking",
                description = "All social interactions (likes, shares, replies) are tracked with metadata including timestamps and user information."
            ),
            WalkthroughStep(
                title = "📸 Media Support",
                description = "Ansybl supports rich media including images, videos, and audio. Media is attached with proper metadata and checksums."
            ),
            WalkthroughStep(
                title = "🌉 Protocol Bridges",
                description = "Ansybl can convert to other formats: RSS 2.0 for traditional readers, JSON Feed for modern apps, and ActivityPub for federation."
            ),
            WalkthroughStep(
                title = "📡 RSS 2.0 Bridge",
                description = "Convert Ansybl feeds to classic RSS 2.0 format for compatibility with traditional feed readers and aggregators."
            ),
            WalkthroughStep(
                title = "📄 JSON Feed Bridge",
                description = "Export to JSON Feed format, a modern alternative to RSS that's easier to parse and more developer-friendly."
            ),
            WalkthroughStep(
                title = "🌐 ActivityPub Federation",
                description = "Connect with the fediverse! ActivityPub bridge enables federation with Mastodon, Pleroma, and other federated platforms."
            ),
            WalkthroughStep(
                title = "🔌 API Endpoints",
                description = "Full REST API available for all operations: feed access, validation, parsing, post management, and more."
            ),
            WalkthroughStep(
                title = "🎨 Rich Content",
                description = "Posts support multiple formats: plain text, HTML, and Markdown. Content is sanitized and rendered safely."
            ),
            WalkthroughStep(
                title = "🔒 Security Features",
                description = "Built-in security: content sanitization, signature verification, schema validation, and secure media handling."
            ),
            WalkthroughStep(
                title = "📱 Mobile-First Design",
                description = "This Android app demonstrates Ansybl's versatility. The protocol works seamlessly across web, mobile, and desktop platforms."
            ),
            WalkthroughStep(
                title = "🎓 Learn More",
                description = "Visit ansybl.org for full documentation, specifications, and additional client implementations. Thank you for exploring Ansybl!"
            )
        )
    }

    fun startWalkthrough(
        toolbar: Toolbar,
        fabCreate: FloatingActionButton,
        fabWalkthrough: FloatingActionButton,
        recyclerView: RecyclerView
    ) {
        currentStep = 0
        showNextStep()
    }

    private fun showNextStep() {
        if (currentStep >= steps.size) {
            completeWalkthrough()
            return
        }

        val step = steps[currentStep]
        val stepNumber = currentStep + 1
        val totalSteps = steps.size

        MaterialAlertDialogBuilder(activity)
            .setTitle("${step.title} ($stepNumber/$totalSteps)")
            .setMessage(step.description)
            .setPositiveButton("Next") { _, _ ->
                currentStep++
                showNextStep()
            }
            .setNegativeButton(if (currentStep > 0) "Back" else "Skip") { _, _ ->
                if (currentStep > 0) {
                    currentStep--
                    showNextStep()
                }
            }
            .setNeutralButton("Exit") { _, _ ->
                // User exited walkthrough
            }
            .setCancelable(false)
            .show()

        step.onShow?.invoke()
    }

    private fun completeWalkthrough() {
        preferences.edit().putBoolean("walkthrough_completed", true).apply()

        MaterialAlertDialogBuilder(activity)
            .setTitle("🎉 Walkthrough Complete!")
            .setMessage("""
                Congratulations! You've completed the Ansybl tour.

                You now know about:
                • Creating and viewing posts
                • Cryptographic signatures
                • Social interactions
                • Protocol bridges
                • API endpoints
                • And much more!

                Start exploring and creating your own content!
            """.trimIndent())
            .setPositiveButton("Get Started") { _, _ ->
                // Close dialog
            }
            .setNeutralButton("Restart Tour") { _, _ ->
                currentStep = 0
                showNextStep()
            }
            .show()
    }

    fun resetWalkthrough() {
        preferences.edit().putBoolean("walkthrough_completed", false).apply()
        preferences.edit().putBoolean("walkthrough_dismissed", false).apply()
        currentStep = 0
    }
}
