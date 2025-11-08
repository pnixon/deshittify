package com.ansybl.example

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.ImageButton
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView

/**
 * RecyclerView adapter for displaying Ansybl posts
 */
class PostAdapter(private val posts: List<AnsyblPost>) :
    RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

    class PostViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val cardView: MaterialCardView = view.findViewById(R.id.cardView)
        val titleText: TextView = view.findViewById(R.id.titleText)
        val authorText: TextView = view.findViewById(R.id.authorText)
        val contentText: TextView = view.findViewById(R.id.contentText)
        val timestampText: TextView = view.findViewById(R.id.timestampText)
        val tagsText: TextView = view.findViewById(R.id.tagsText)
        val likesButton: ImageButton = view.findViewById(R.id.likesButton)
        val likesCount: TextView = view.findViewById(R.id.likesCount)
        val sharesButton: ImageButton = view.findViewById(R.id.sharesButton)
        val sharesCount: TextView = view.findViewById(R.id.sharesCount)
        val commentsButton: ImageButton = view.findViewById(R.id.commentsButton)
        val commentsCount: TextView = view.findViewById(R.id.commentsCount)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        val post = posts[position]

        holder.titleText.text = post.title
        holder.authorText.text = "by ${post.author}"
        holder.contentText.text = post.content
        holder.timestampText.text = post.getFormattedTimestamp()

        // Show tags if available
        if (post.tags.isNotEmpty()) {
            holder.tagsText.visibility = View.VISIBLE
            holder.tagsText.text = post.getFormattedTags()
        } else {
            holder.tagsText.visibility = View.GONE
        }

        // Set interaction counts
        holder.likesCount.text = post.likes.toString()
        holder.sharesCount.text = post.shares.toString()
        holder.commentsCount.text = post.comments.toString()

        // Set click listeners for interactions
        holder.likesButton.setOnClickListener {
            // Handle like action
        }

        holder.sharesButton.setOnClickListener {
            // Handle share action
        }

        holder.commentsButton.setOnClickListener {
            // Handle comment action
        }
    }

    override fun getItemCount() = posts.size
}
