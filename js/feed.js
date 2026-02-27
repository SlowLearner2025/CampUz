// js/feed.js — Public Post Wall logic

// Track comment subscriptions per post
const commentSubscriptions = {};

// ---- Load all posts from Supabase ----------------------------
async function loadPosts(currentUser, offset = 0) {
  const postsContainer = document.getElementById('posts-list');
  if (offset === 0) {
    postsContainer.innerHTML = '<div class="spinner"></div>';
  }

  // Fetch posts with pagination
  const { data: posts, error } = await sb
    .from('posts')
    .select('*, users!user_id(name)')
    .order('created_at', { ascending: false })
    .range(offset, offset + 14);

  if (error) {
    postsContainer.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Failed to load posts.</p></div>';
    return;
  }

  if (!posts.length) {
    postsContainer.innerHTML = '<div class="empty-state"><div class="icon">📝</div><p>No posts yet. Be the first!</p></div>';
    return;
  }

  postsContainer.innerHTML = '';

  // Fetch which posts current user has liked
  const { data: myLikes } = await sb
    .from('post_likes')
    .select('post_id')
    .eq('user_id', currentUser.id);

  const likedSet = new Set((myLikes || []).map(l => l.post_id));

  posts.forEach(post => {
    const el = buildPostCard(post, currentUser, likedSet.has(post.id));
    postsContainer.appendChild(el);

    // GSAP stagger entrance animation
    gsap.from(el, {
      duration: 0.4,
      y: 20,
      opacity: 0,
      ease: 'power2.out',
      delay: 0.05
    });
  });
}

// ---- Build a single post card element -------------------------
function buildPostCard(post, currentUser, isLiked) {
  const displayName = post.anonymous ? 'Anonymous Student' : (post.users?.name || 'Unknown');
  const anonBadge   = post.anonymous ? '<span class="badge-anon">Anon</span>' : '';
  const initials    = displayName.charAt(0).toUpperCase();
  const isOwner     = post.user_id === currentUser.id; // Check if current user is the post owner

  const card = document.createElement('div');
  card.className = 'card post-card';
  card.dataset.id = post.id;

  card.innerHTML = `
    <div class="card-header">
      <div class="avatar" style="background: ${post.anonymous ? 'linear-gradient(135deg,#ff6584,#ff9a9e)' : 'linear-gradient(135deg,#6c63ff,#a855f7)'}">
        ${post.anonymous ? '?' : initials}
      </div>
      <div class="card-meta">
        <div class="card-author">${displayName}${anonBadge}</div>
        <div class="card-time">${formatTime(post.created_at)}</div>
      </div>
      ${isOwner ? `<button class="delete-btn" onclick="deletePost('${post.id}')" title="Delete post">🗑️</button>` : ''}
    </div>
    <div class="card-content">${escapeHtml(post.content)}</div>
    <div class="post-actions">
      <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}', this)">
        ${isLiked ? '❤️' : '🤍'} <span class="like-count">${post.likes || 0}</span>
      </button>
      <button class="action-btn" onclick="toggleComments('${post.id}', this)">
        💬 Comments
      </button>
    </div>
    <div class="comments-section" id="comments-${post.id}">
      <div class="comments-list"></div>
      <div class="comment-input-row">
        <input class="comment-input" type="text" placeholder="Write a comment…"
               onkeydown="if(event.key==='Enter') submitComment('${post.id}', this)"/>
        <button class="action-btn" onclick="submitComment('${post.id}', this.previousElementSibling)">Send</button>
      </div>
    </div>
  `;

  return card;
}

// ---- Create a new post ----------------------------------------
async function createPost(currentUser) {
  const textarea = document.getElementById('post-textarea');
  const anonCb   = document.getElementById('post-anon');
  const content  = textarea.value.trim();

  if (!content) return;

  const { data, error } = await sb.from('posts').insert({
    user_id:   currentUser.id,
    content:   content,
    anonymous: anonCb.checked,
    likes:     0
  }).select('*, users!user_id(name)').single();

  if (error) { 
    showModernAlert('Failed to post: ' + error.message, '❌'); 
    return; 
  }

  textarea.value = '';
  anonCb.checked = false;

  // Prepend the new post with animation
  const postsContainer = document.getElementById('posts-list');
  if (postsContainer.querySelector('.empty-state') || postsContainer.querySelector('.spinner')) {
    postsContainer.innerHTML = '';
  }

  const el = buildPostCard(data, currentUser, false);
  postsContainer.prepend(el);

  // GSAP pop-in animation for new post
  gsap.from(el, {
    duration: 0.5,
    scale: 0.95,
    y: -20,
    opacity: 0,
    ease: 'back.out(1.5)'
  });
}

// ---- Toggle like ----------------------------------------------
async function toggleLike(postId, btn) {
  const countEl = btn.querySelector('.like-count');
  const isLiked = btn.classList.contains('liked');

  // Optimistic UI update
  btn.classList.toggle('liked');
  btn.innerHTML = (isLiked ? '🤍' : '❤️') + ' <span class="like-count">' +
                  (parseInt(countEl.textContent) + (isLiked ? -1 : 1)) + '</span>';

  gsap.from(btn, { duration: 0.2, scale: 0.85, ease: 'back.out(2)' });

  const { data: { user } } = await sb.auth.getUser();

  try {
    if (isLiked) {
      // Un-like: remove row from post_likes
      await sb.from('post_likes').delete()
        .eq('post_id', postId).eq('user_id', user.id);
    } else {
      // Like: insert row
      await sb.from('post_likes').insert({ post_id: postId, user_id: user.id });
    }

    // Query actual count from post_likes table
    const { count } = await sb
      .from('post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    // Update posts table with accurate count
    if (count !== null) {
      await sb.from('posts').update({ likes: count }).eq('id', postId);
      countEl.textContent = count;
    }
  } catch (error) {
    console.error('Like toggle failed:', error);
    // Revert UI on failure
    btn.classList.toggle('liked');
    btn.innerHTML = (!isLiked ? '🤍' : '❤️') + ' <span class="like-count">' +
                    countEl.textContent + '</span>';
  }
}

// ---- Toggle comment section -----------------------------------
function toggleComments(postId, btn) {
  const section = document.getElementById('comments-' + postId);
  const isOpen  = section.classList.contains('open');

  if (!isOpen) {
    section.classList.add('open');
    loadComments(postId);
    gsap.from(section, { duration: 0.3, height: 0, opacity: 0, ease: 'power2.out' });
  } else {
    section.classList.remove('open');
  }
}

// ---- Load comments for a post --------------------------------
async function loadComments(postId) {
  const section = document.getElementById('comments-' + postId);
  const list    = section.querySelector('.comments-list');
  list.innerHTML = '<div style="font-size:0.8rem;color:var(--muted);padding:0.5rem">Loading…</div>';

  try {
    const { data: comments, error } = await sb
      .from('comments')
      .select('*, users!user_id(name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    list.innerHTML = '';

    if (!comments || !comments.length) {
      list.innerHTML = '<div style="font-size:0.8rem;color:var(--muted);padding:0.4rem 0">No comments yet.</div>';
    } else {
      comments.forEach(c => renderComment(c, list));
    }

    // Subscribe to new comments for this post
    subscribeToComments(postId, list);
  } catch (error) {
    console.error('Failed to load comments:', error);
    list.innerHTML = '<div style="font-size:0.8rem;color:var(--accent2)">Failed to load comments.</div>';
  }
}

// ---- Subscribe to comment updates ----------------------------
function subscribeToComments(postId, listEl) {
  // Unsubscribe from previous subscription for this post
  if (commentSubscriptions[postId]) {
    sb.removeChannel(commentSubscriptions[postId]);
  }

  commentSubscriptions[postId] = sb
    .channel(`comments-${postId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
      async (payload) => {
        try {
          const { data: c } = await sb
            .from('comments')
            .select('*, users!user_id(name)')
            .eq('id', payload.new.id)
            .single();

          if (c) {
            const emptyMsg = listEl.querySelector('div:only-child');
            if (emptyMsg) emptyMsg.remove();
            renderComment(c, listEl);
          }
        } catch (err) {
          console.error('Comment subscription error:', err);
        }
      }
    )
    .subscribe();
}

// ---- Render a comment element --------------------------------
function renderComment(c, listEl) {
  const name = c.anonymous ? 'Anonymous' : (c.users?.name || 'Unknown');
  const div  = document.createElement('div');
  div.className = 'comment';
  div.innerHTML = `
    <div class="avatar" style="width:28px;height:28px;font-size:0.7rem;flex-shrink:0;
         background:linear-gradient(135deg,#6c63ff,#a855f7)">${name.charAt(0)}</div>
    <div class="comment-body">
      <div class="comment-author">${name}</div>
      <div class="comment-text">${escapeHtml(c.content)}</div>
    </div>
  `;
  listEl.appendChild(div);

  // Subtle slide animation
  gsap.from(div, { duration: 0.3, y: 5, opacity: 0, ease: 'power2.out' });
}

// ---- Submit comment -------------------------------------------
async function submitComment(postId, input) {
  const content = input.value.trim();
  if (!content) return;

  try {
    const { data: { user } } = await sb.auth.getUser();

    const { error } = await sb.from('comments').insert({
      post_id:   postId,
      user_id:   user.id,
      content:   content,
      anonymous: false
    });

    if (error) throw error;

    input.value = '';
    // No need to reload - realtime subscription will handle it
  } catch (error) {
    console.error('Comment failed:', error);
    showModernAlert('Failed to post comment: ' + (error.message || 'Unknown error'), '❌');
  }
}

// ---- Delete a post -------------------------------------------
async function deletePost(postId) {
  showModernConfirm(
    'Are you sure you want to delete this post? This action cannot be undone.',
    async (confirmed) => {
      if (!confirmed) return;

      try {
        // Delete the post from Supabase
        const { error } = await sb.from('posts').delete().eq('id', postId);

        if (error) throw error;

        // Remove post from DOM with animation
        const postCard = document.querySelector(`[data-id="${postId}"]`);
        if (postCard) {
          gsap.to(postCard, {
            duration: 0.3,
            opacity: 0,
            y: -20,
            onComplete: () => {
              postCard.remove();
              showModernAlert('Post deleted successfully', '✅');
            }
          });
        }
      } catch (error) {
        console.error('Delete failed:', error);
        showModernAlert('Failed to delete post: ' + (error.message || 'Unknown error'), '❌');
      }
    },
    'Delete',
    true
  );
}

// ---- Utility: escape HTML ------------------------------------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
