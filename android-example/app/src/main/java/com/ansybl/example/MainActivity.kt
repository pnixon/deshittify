package com.ansybl.example

import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import android.widget.EditText
import android.content.SharedPreferences
import androidx.preference.PreferenceManager

class MainActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var fabCreate: FloatingActionButton
    private lateinit var fabWalkthrough: FloatingActionButton
    private lateinit var postAdapter: PostAdapter
    private lateinit var walkthroughManager: WalkthroughManager
    private lateinit var preferences: SharedPreferences

    private val posts = mutableListOf<AnsyblPost>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize preferences
        preferences = PreferenceManager.getDefaultSharedPreferences(this)

        // Setup toolbar
        setSupportActionBar(findViewById(R.id.toolbar))
        supportActionBar?.title = "Ansybl Example"

        // Initialize views
        recyclerView = findViewById(R.id.recyclerView)
        fabCreate = findViewById(R.id.fabCreate)
        fabWalkthrough = findViewById(R.id.fabWalkthrough)

        // Setup RecyclerView
        postAdapter = PostAdapter(posts)
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = postAdapter

        // Setup FAB for creating posts
        fabCreate.setOnClickListener {
            showCreatePostDialog()
        }

        // Setup FAB for walkthrough
        fabWalkthrough.setOnClickListener {
            startWalkthrough()
        }

        // Initialize walkthrough manager
        walkthroughManager = WalkthroughManager(this)

        // Load sample posts
        loadSamplePosts()

        // Show walkthrough for first-time users
        if (!preferences.getBoolean("walkthrough_completed", false)) {
            // Delay to ensure UI is fully loaded
            fabWalkthrough.postDelayed({
                showWalkthroughPrompt()
            }, 2000)
        }
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_feed -> {
                showFeedInfo()
                true
            }
            R.id.action_api -> {
                showApiInfo()
                true
            }
            R.id.action_bridges -> {
                showBridgesInfo()
                true
            }
            R.id.action_about -> {
                showAboutDialog()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun showWalkthroughPrompt() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Welcome to Ansybl!")
            .setMessage("Would you like a quick tour of the features?")
            .setPositiveButton("Yes") { _, _ ->
                startWalkthrough()
            }
            .setNegativeButton("Not now") { _, _ ->
                // User declined
            }
            .setNeutralButton("Don't show again") { _, _ ->
                preferences.edit().putBoolean("walkthrough_dismissed", true).apply()
            }
            .show()
    }

    private fun startWalkthrough() {
        walkthroughManager.startWalkthrough(
            toolbar = findViewById(R.id.toolbar),
            fabCreate = fabCreate,
            fabWalkthrough = fabWalkthrough,
            recyclerView = recyclerView
        )
    }

    private fun loadSamplePosts() {
        posts.clear()
        posts.addAll(listOf(
            AnsyblPost(
                id = "1",
                title = "Welcome to Ansybl",
                content = "This is a decentralized specification for sharing media as an alternative to centralized social networks.",
                author = "Ansybl Team",
                timestamp = System.currentTimeMillis() - 3600000,
                likes = 42,
                shares = 12,
                tags = listOf("ansybl", "decentralized", "social")
            ),
            AnsyblPost(
                id = "2",
                title = "How Ansybl Works",
                content = "Ansybl uses cryptographic signatures to ensure content authenticity. All posts are signed with Ed25519 keys.",
                author = "Developer",
                timestamp = System.currentTimeMillis() - 7200000,
                likes = 28,
                shares = 8,
                tags = listOf("tutorial", "cryptography")
            ),
            AnsyblPost(
                id = "3",
                title = "Protocol Bridges",
                content = "Ansybl can convert feeds to RSS 2.0, JSON Feed, and ActivityPub for compatibility with existing platforms.",
                author = "Integration Team",
                timestamp = System.currentTimeMillis() - 10800000,
                likes = 35,
                shares = 15,
                tags = listOf("bridges", "rss", "activitypub")
            )
        ))
        postAdapter.notifyDataSetChanged()
    }

    private fun showCreatePostDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_post, null)
        val titleEdit = dialogView.findViewById<EditText>(R.id.editTitle)
        val contentEdit = dialogView.findViewById<EditText>(R.id.editContent)

        MaterialAlertDialogBuilder(this)
            .setTitle("Create New Post")
            .setView(dialogView)
            .setPositiveButton("Post") { _, _ ->
                val title = titleEdit.text.toString()
                val content = contentEdit.text.toString()

                if (title.isNotEmpty() && content.isNotEmpty()) {
                    createPost(title, content)
                } else {
                    Toast.makeText(this, "Title and content required", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun createPost(title: String, content: String) {
        val newPost = AnsyblPost(
            id = System.currentTimeMillis().toString(),
            title = title,
            content = content,
            author = "You",
            timestamp = System.currentTimeMillis(),
            likes = 0,
            shares = 0,
            tags = emptyList()
        )

        posts.add(0, newPost)
        postAdapter.notifyItemInserted(0)
        recyclerView.smoothScrollToPosition(0)

        Toast.makeText(this, "Post created successfully!", Toast.LENGTH_SHORT).show()
    }

    private fun showFeedInfo() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Ansybl Feed")
            .setMessage("The Ansybl feed endpoint provides all posts in the standard Ansybl JSON format with cryptographic signatures for authenticity verification.")
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showApiInfo() {
        MaterialAlertDialogBuilder(this)
            .setTitle("API Endpoints")
            .setMessage("""
                Available endpoints:
                • /api/ansybl/feed - Get feed
                • /api/ansybl/validate - Validate content
                • /api/posts - Manage posts
                • /api/comments - Handle comments
                • /api/interactions - Track likes/shares
                • /api/media - Upload media
            """.trimIndent())
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showBridgesInfo() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Protocol Bridges")
            .setMessage("""
                Ansybl supports conversion to:

                📡 RSS 2.0 - Classic feed format
                📄 JSON Feed - Modern JSON format
                🌐 ActivityPub - Federated social networks

                These bridges ensure compatibility with existing platforms and readers.
            """.trimIndent())
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showAboutDialog() {
        MaterialAlertDialogBuilder(this)
            .setTitle("About Ansybl")
            .setMessage("""
                Ansybl Example App
                Version 1.0

                A demonstration of the Ansybl decentralized social syndication protocol.

                Features:
                • Cryptographic content signing
                • Rich media support
                • Protocol bridges
                • Decentralized architecture

                Learn more at ansybl.org
            """.trimIndent())
            .setPositiveButton("OK", null)
            .show()
    }
}
