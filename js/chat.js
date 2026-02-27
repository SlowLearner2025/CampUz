// js/chat.js — WhatsApp-like Communities Chat System

let chatSubscription = null;
let typingSubscription = null;
let chatCurrentUser = null;
let currentCommunity = null;
let currentSection = null;
let currentCommunityName = null;
let typingTimeout = null;
let chatReconnectAttempts = 0;
let chatReconnectTimer = null;

// ---- Initialize chat -----------------------------------------
async function initChat(user) {
  if (!user) {
    console.error('No user provided to initChat');
    return;
  }
  
  chatCurrentUser = user;
  console.log('Chat initialized for user:', user.email);
  
  await loadCommunities();
  // Don't subscribe yet - wait until a community/section is selected
}

// ---- Load all communities ------------------------------------
async function loadCommunities() {
  try {
    const list = document.getElementById('communities-list');
    list.innerHTML = '<div class="loading-text">⏳ Loading communities...</div>';

    console.log('Starting to load communities...');
    
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 5000)
    );

    const { data: communities, error } = await Promise.race([
      sb.from('communities').select('*').order('created_at', { ascending: false }),
      timeoutPromise
    ]);

    console.log('Communities loaded:', communities, 'Error:', error);

    if (error) {
      console.error('Failed to load communities:', error);
      list.innerHTML = `
        <div class="empty-state">
          <div style="text-align: center; padding: 1rem;">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
            <p style="font-size: 0.85rem; color: var(--muted);">Error loading communities</p>
            <p style="font-size: 0.75rem; color: #ff7777; margin-top: 0.5rem;">${error.message}</p>
            <button class="btn-small" onclick="loadCommunities()" style="margin-top: 0.75rem;">🔄 Retry</button>
          </div>
        </div>
      `;
      return;
    }

    if (!communities || communities.length === 0) {
      console.log('No communities found');
      list.innerHTML = `
        <div class="empty-communities">
          <div class="icon">🏘️</div>
          <p>No communities yet</p>
          <button class="btn-small" onclick="showCreateCommunityModal()">Create One</button>
        </div>
      `;
      return;
    }

    console.log(`Rendering ${communities.length} communities`);
    list.innerHTML = '';
    communities.forEach(community => {
      const item = document.createElement('div');
      item.className = 'community-item';
      item.onclick = () => selectCommunity(community.id, community.name);
      
      item.innerHTML = `
        <div class="community-avatar">🏘️</div>
        <div class="community-info">
          <div class="community-name">${community.name}</div>
          <div class="community-desc">${community.description || 'No description'}</div>
        </div>
      `;
      
      list.appendChild(item);
    });
    console.log('Communities rendered successfully');
  } catch (err) {
    console.error('Error loading communities:', err);
    const list = document.getElementById('communities-list');
    list.innerHTML = `
      <div class="empty-state">
        <div style="text-align: center; padding: 1rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
          <p style="font-size: 0.85rem; color: var(--muted);">Failed to load</p>
          <p style="font-size: 0.7rem; color: #ff7777;">${err.message}</p>
          <button class="btn-small" onclick="loadCommunities()" style="margin-top: 0.75rem;">🔄 Retry</button>
        </div>
      </div>
    `;
  }
}

// ---- Select a community and load its sections ----------------
async function selectCommunity(communityId, communityName) {
  currentCommunity = communityId;
  currentCommunityName = communityName;
  currentSection = null;

  // Show sections sidebar
  const communitiesSidebar = document.getElementById('communities-list').parentElement;
  const sectionsSidebar = document.getElementById('sections-sidebar');
  const membersSidebar = document.getElementById('members-sidebar');
  const chatEmpty = document.getElementById('chat-empty');
  const chatMain = document.getElementById('chat-main');

  communitiesSidebar.style.display = 'none';
  sectionsSidebar.style.display = 'flex';
  membersSidebar.style.display = window.innerWidth > 768 ? 'flex' : 'none'; // Hide members on mobile
  chatEmpty.style.display = 'flex';
  chatMain.style.display = 'none';
  
  // Update community title
  document.getElementById('community-title').textContent = communityName;

  await loadSections();
  await loadCommunityMembers();
  await checkCommunityMembership();
}

// ---- Load sections for current community ---------------------
async function loadSections() {
  try {
    const { data: sections, error } = await sb
      .from('sections')
      .select('*')
      .eq('community_id', currentCommunity)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load sections:', error);
      return;
    }

    const list = document.getElementById('sections-list');
    list.innerHTML = '';

    if (!sections || sections.length === 0) {
      list.innerHTML = `
        <div class="empty-sections">
          <div class="icon">📍</div>
          <p>No sections yet</p>
          <button class="btn-small" onclick="showAddSectionModal()">Create One</button>
        </div>
      `;
      return;
    }

    sections.forEach(section => {
      const item = document.createElement('div');
      item.className = 'section-item';
      item.onclick = () => selectSection(section.id, section.name, section.description);
      
      item.innerHTML = `
        <div class="section-icon">📍</div>
        <div class="section-name">${section.name}</div>
      `;
      
      list.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading sections:', err);
  }
}

// ---- Select a section and load messages ----------------------
async function selectSection(sectionId, sectionName, sectionDesc) {
  currentSection = sectionId;

  // Show chat main area
  document.getElementById('chat-empty').style.display = 'none';
  document.getElementById('chat-main').style.display = 'flex';

  // Update section header
  document.getElementById('section-title').textContent = sectionName;
  document.getElementById('section-desc').textContent = `${currentCommunityName} > ${sectionName}`;

  // Load messages and subscribe to updates
  await loadMessages();
  subscribeToChat();
  subscribeToTyping();
}

// ---- Load messages for current community/section ---------------
async function loadMessages() {
  const chatEl = document.getElementById('chat-messages');
  chatEl.innerHTML = '<div class="spinner"></div>';

  try {
    const { data: messages, error } = await sb
      .from('messages')
      .select('*, users!user_id(name, avatar_url)')
      .eq('community_id', currentCommunity)
      .eq('section_id', currentSection)
      .order('created_at', { ascending: true })
      .range(0, 99);  // Load last 100 messages

    if (error) {
      chatEl.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Could not load messages.</p></div>';
      return;
    }

    chatEl.innerHTML = '';

    if (!messages || messages.length === 0) {
      chatEl.innerHTML = '<div class="empty-state"><div class="icon">💬</div><p>No messages yet. Start a conversation! 👋</p></div>';
      return;
    }

    messages.forEach(msg => appendBubble(msg));
    scrollToBottom();
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

// ---- Subscribe to new messages -------------------------------
function subscribeToChat() {
  if (chatReconnectTimer) {
    clearTimeout(chatReconnectTimer);
    chatReconnectTimer = null;
  }

  // Unsubscribe from previous
  if (chatSubscription) {
    sb.removeChannel(chatSubscription);
  }

  chatSubscription = sb
    .channel('community-chat-' + currentCommunity + '-' + currentSection)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        console.log('Raw INSERT event:', payload.new);
        
        // Only show messages from current community/section
        if (payload.new.community_id !== currentCommunity || 
            payload.new.section_id !== currentSection) {
          console.log('Message filtered (wrong community/section):', payload.new.community_id, currentCommunity, payload.new.section_id, currentSection);
          return;
        }

        console.log('New message received for current section:', payload.new.id);

        try {
          const { data: msg, error } = await sb
            .from('messages')
            .select('*, users!user_id(name, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (error || !msg) {
            console.error('Error fetching message details:', error, 'msg:', msg);
            return;
          }

          // Check if message already exists in DOM
          if (document.querySelector(`[data-message-id="${msg.id}"]`)) {
            console.log('Message already in DOM, skipping duplicate');
            return;
          }

          console.log('Adding message to DOM:', msg.id, msg.content);
          const empty = document.querySelector('#chat-messages .empty-state');
          if (empty) empty.remove();

          appendBubble(msg);
          scrollToBottom();
        } catch (err) {
          console.error('Chat error:', err);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages' },
      (payload) => {
        console.log('🚨 DELETE EVENT - Message deleted from DB:', payload.old.id, 'Content was:', payload.old.content);
        console.log('Was it your message?', payload.old.user_id === chatCurrentUser.id);
        console.log('Current user:', chatCurrentUser.id);
        console.log('Deleted message user:', payload.old.user_id);
        console.log('Full payload:', payload.old);
        
        // Remove deleted message from DOM
        const msgEl = document.querySelector(`[data-message-id="${payload.old.id}"]`);
        if (msgEl) {
          gsap.to(msgEl, {
            duration: 0.3,
            opacity: 0,
            y: -10,
            onComplete: () => msgEl.remove()
          });
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        chatReconnectAttempts += 1;
        const retryDelay = Math.min(30000, 3000 * Math.pow(2, chatReconnectAttempts - 1));
        console.error('Chat subscription error - retrying in', retryDelay, 'ms');

        if (!chatReconnectTimer) {
          chatReconnectTimer = setTimeout(() => {
            chatReconnectTimer = null;
            subscribeToChat();
          }, retryDelay);
        }
      } else if (status === 'SUBSCRIBED') {
        chatReconnectAttempts = 0;
        console.log('Chat subscription active');
      }
    });
}

// ---- Subscribe to typing indicators --------------------------
function subscribeToTyping() {
  if (typingSubscription) {
    sb.removeChannel(typingSubscription);
  }

  typingSubscription = sb
    .channel('chat-typing')
    .on(
      'broadcast',
      { event: 'user_typing' },
      (payload) => {
        if (payload.payload.communityId !== currentCommunity || 
            payload.payload.sectionId !== currentSection) {
          return;
        }
        if (payload.payload.userId === chatCurrentUser.id) return;

       const typingEl = document.getElementById('typing-indicator');
        document.getElementById('typing-user').textContent = payload.payload.userName;
        typingEl.style.display = 'flex';

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          typingEl.style.display = 'none';
        }, 3000);
      }
    )
    .subscribe();
}

// ---- Notify others that user is typing -----------------------
function notifyTyping() {
  if (!typingSubscription || !currentSection) return;

  typingSubscription.send({
    type: 'broadcast',
    event: 'user_typing',
    payload: {
      userId: chatCurrentUser.id,
      userName: chatCurrentUser.name,
      communityId: currentCommunity,
      sectionId: currentSection
    }
  });
}

// ---- Append a message bubble --------------------------------
function appendBubble(msg) {
  const chatEl = document.getElementById('chat-messages');
  const isMine = chatCurrentUser && msg.user_id === chatCurrentUser.id;
  const senderName = msg.users?.name || 'Unknown';
  const senderAvatar = msg.users?.avatar_url;
  
  const initials = senderName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const bubble = document.createElement('div');
  bubble.className = 'chat-message' + (isMine ? ' mine' : ' theirs');
  bubble.dataset.messageId = msg.id;
  
  const avatarHtml = senderAvatar 
    ? `<img src="${senderAvatar}" class="message-avatar" />`
    : `<div class="message-avatar" style="background:linear-gradient(135deg,var(--accent),var(--accent2))">${initials}</div>`;

  bubble.innerHTML = `
    ${!isMine ? avatarHtml : ''}
    <div class="message-bubble">
      ${!isMine ? `<div class="message-sender">${senderName}</div>` : ''}
      <div class="message-content">${escapeHtml(msg.content)}</div>
      <div class="message-footer">
        <span class="message-time">${formatTime(msg.created_at)}</span>
        ${isMine ? '<span class="message-seen">✓✓</span>' : ''}
      </div>
    </div>
    ${isMine ? `<div class="message-actions">
      <button class="msg-btn msg-delete-btn" title="Delete" data-message-id="${msg.id}">🗑️</button>
    </div>` : ''}
  `;

  chatEl.appendChild(bubble);

  // Add delete event listener
  const deleteBtn = bubble.querySelector('.msg-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => deleteMessage(msg.id));
  }

  // Animation - use fromTo to ensure final state
  gsap.fromTo(bubble, 
    {
      y: 10,
      opacity: 0
    },
    {
      duration: 0.3,
      y: 0,
      opacity: 1,
      ease: 'power2.out'
    }
  );
  
  scrollToBottom();
}

// ---- Send a message ------------------------------------------
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !chatCurrentUser || !currentSection) return;

  console.log('Sending message:', {
    user_id: chatCurrentUser.id,
    community_id: currentCommunity,
    section_id: currentSection,
    content: content
  });

  input.value = '';
  document.getElementById('typing-indicator').style.display = 'none';

  try {
    const { data, error } = await sb.from('messages').insert({
      user_id: chatCurrentUser.id,
      community_id: currentCommunity,
      section_id: currentSection,
      content: content
    }).select();

    if (error) {
      console.error('Insert error:', error);
      input.value = content;
      showModernAlert('Failed to send: ' + error.message, '❌');
    } else {
      console.log('Message inserted successfully:', data);
    }
  } catch (err) {
    console.error('Error sending message:', err);
    showModernAlert('Failed to send message', '❌');
  }
}

// ---- Handle keyboard input -----------------------------------
function handleChatKeydown(event) {
  if (event.key === 'Enter') {
    if (!event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
}

// ---- Delete message ------------------------------------------
async function deleteMessage(messageId) {
  showModernConfirm(
    'Delete this message?',
    async () => {
      console.log('User manually deleting message:', messageId);
      
      try {
        const { error } = await sb
          .from('messages')
          .delete()
          .eq('id', messageId)
          .eq('user_id', chatCurrentUser.id);

        if (error) {
          console.error('Delete failed:', error);
          showModernAlert('Failed to delete: ' + error.message, '❌');
        } else {
          console.log('Message deleted successfully:', messageId);
          // Remove from DOM
          const bubble = document.querySelector(`[data-message-id="${messageId}"]`);
          if (bubble) {
            gsap.to(bubble, {
              duration: 0.3,
              opacity: 0,
              y: -10,
              onComplete: () => bubble.remove()
            });
          }
        }
      } catch (err) {
        console.error('Error deleting message:', err);
        showModernAlert('Failed to delete message', '❌');
      }
    },
    'Delete',
    true
  );
}

// ---- Toggle chat search ======================================
function toggleChatSearch() {
  const searchArea = document.getElementById('chat-search-area');
  searchArea.style.display = searchArea.style.display === 'none' ? 'flex' : 'none';
  if (searchArea.style.display === 'flex') {
    document.getElementById('chat-search-input').focus();
  }
}

// ---- Show emoji picker ========================================
function showEmojiPicker() {
  const emojis = ['😊', '😂', '❤️', '👍', '🔥', '💯', '✨', '🎉'];
  showModernAlert('Emoji picker coming soon! Quick emojis:\n\n' + emojis.join(' '), '😊');
}

// ---- Add emoji to input =======================================
function addEmojiToInput(emoji) {
  const input = document.getElementById('chat-input');
  input.value += emoji;
  input.focus();
}

// ---- Scroll to bottom -----------------------------------------
function scrollToBottom() {
  const chatEl = document.getElementById('chat-messages');
  setTimeout(() => {
    chatEl.scrollTop = chatEl.scrollHeight;
  }, 0);
}

// ---- Go back to communities -----------------------------------
function goBackToCommunities() {
  // Unsubscribe from chat
  if (chatSubscription) {
    sb.removeChannel(chatSubscription);
    chatSubscription = null;
  }
  if (typingSubscription) {
    sb.removeChannel(typingSubscription);
    typingSubscription = null;
  }

  currentCommunity = null;
  currentSection = null;

  document.getElementById('communities-list').parentElement.style.display = 'flex';
  document.getElementById('sections-sidebar').style.display = 'none';
  document.getElementById('members-sidebar').style.display = 'none';
  document.getElementById('chat-main').style.display = 'none';
  document.getElementById('chat-empty').style.display = 'flex';

  // Scroll to top on mobile
  if (window.innerWidth <= 768) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ---- Go back to sections --------------------------------------
function goBackToSections() {
  // Unsubscribe from chat
  if (chatSubscription) {
    sb.removeChannel(chatSubscription);
    chatSubscription = null;
  }
  if (typingSubscription) {
    sb.removeChannel(typingSubscription);
    typingSubscription = null;
  }

  currentSection = null;

  document.getElementById('chat-main').style.display = 'none';
  document.getElementById('chat-empty').style.display = 'flex';

  // Scroll to top on mobile
  if (window.innerWidth <= 768) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ---- Create Community Modal ===================================
function showCreateCommunityModal() {
  document.getElementById('community-name-input').value = '';
  document.getElementById('community-desc-input').value = '';
  document.getElementById('create-community-error').style.display = 'none';
  document.getElementById('create-community-modal').classList.add('show');
}

// ---- Add Section Modal ========================================
function showAddSectionModal() {
  document.getElementById('section-name-input').value = '';
  document.getElementById('section-desc-input').value = '';
  document.getElementById('add-section-error').style.display = 'none';
  document.getElementById('add-section-modal').classList.add('show');
}

// ---- Create Community =========================================
async function createCommunity() {
  const name = document.getElementById('community-name-input').value.trim();
  const desc = document.getElementById('community-desc-input').value.trim();
  const errorEl = document.getElementById('create-community-error');

  if (!name) {
    errorEl.textContent = 'Community name is required';
    errorEl.style.display = 'block';
    return;
  }

  if (name.length < 3) {
    errorEl.textContent = 'Community name must be at least 3 characters';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const { error } = await sb
      .from('communities')
      .insert({
        name: name,
        description: desc,
        created_by: chatCurrentUser.id
      });

    if (error) throw error;

    closeModal('create-community-modal');
    await loadCommunities();
    showToast('Community created successfully! 🎉');
  } catch (err) {
    console.error('Error creating community:', err);
    errorEl.textContent = 'Failed to create community: ' + err.message;
    errorEl.style.display = 'block';
  }
}

// ---- Add Section ==============================================
async function addSection() {
  const name = document.getElementById('section-name-input').value.trim();
  const desc = document.getElementById('section-desc-input').value.trim();
  const errorEl = document.getElementById('add-section-error');

  if (!name) {
    errorEl.textContent = 'Section name is required';
    errorEl.style.display = 'block';
    return;
  }

  if (name.length < 2) {
    errorEl.textContent = 'Section name must be at least 2 characters';
    errorEl.style.display = 'block';
    return;
  }

  if (!currentCommunity) {
    errorEl.textContent = 'No community selected';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const { error } = await sb
      .from('sections')
      .insert({
        community_id: currentCommunity,
        name: name,
        description: desc
      });

    if (error) throw error;

    closeModal('add-section-modal');
    await loadSections();
    showToast('Section added successfully! ✨');
  } catch (err) {
    console.error('Error adding section:', err);
    errorEl.textContent = 'Failed to add section: ' + err.message;
    errorEl.style.display = 'block';
  }
}

// ---- Load Community Members ===================================
async function loadCommunityMembers() {
  if (!currentCommunity) return;

  try {
    const { data: members, error } = await sb
      .from('community_members')
      .select(`
        user_id,
        users(id, name, avatar_url)
      `)
      .eq('community_id', currentCommunity)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Failed to load members:', error);
      return;
    }

    const list = document.getElementById('members-list');
    const badge = document.getElementById('member-count-badge');
    const count = document.getElementById('member-count');

    list.innerHTML = '';
    badge.textContent = members?.length || 0;
    count.textContent = `👥 ${members?.length || 0} members`;

    if (!members || members.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div style="text-align: center; padding: 1rem;">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">👥</div>
            <p style="font-size: 0.85rem; color: var(--muted);">No members yet</p>
          </div>
        </div>
      `;
      return;
    }

    members.forEach(member => {
      const userData = member.users;
      const item = document.createElement('div');
      item.className = 'member-item online';
      
      item.innerHTML = `
        <div class="member-avatar">
          ${userData?.avatar_url ? `<img src="${userData.avatar_url}" alt="${userData.name}">` : userData?.name?.charAt(0).toUpperCase() || '?'}
        </div>
        <div class="member-details">
          <div class="member-name">${userData?.name || 'Unknown'}</div>
          <div class="member-status">🟢 Online</div>
        </div>
      `;
      
      list.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading community members:', err);
  }
}

// ---- Check if user is member of community --------------------
async function checkCommunityMembership() {
  if (!currentCommunity) return;

  try {
    const { data, error } = await sb
      .from('community_members')
      .select('id')
      .eq('community_id', currentCommunity)
      .eq('user_id', chatCurrentUser.id)
      .single();

    const btn = document.getElementById('join-leave-btn');
    console.log('Membership check for community', currentCommunity, ':', data ? 'MEMBER' : 'NOT MEMBER', 'Error:', error?.message || 'none');
    
    if (data) {
      btn.classList.add('joined');
      btn.textContent = '✓ Joined';
    } else {
      btn.classList.remove('joined');
      btn.textContent = '👋 Join';
    }
  } catch (err) {
    console.error('Error checking membership:', err);
    const btn = document.getElementById('join-leave-btn');
    btn.classList.remove('joined');
    btn.textContent = '👋 Join';
  }
}

// ---- Toggle Community Membership ==============================
async function toggleCommunityMembership() {
  if (!currentCommunity) return;

  try {
    const { data: existing, error: checkError } = await sb
      .from('community_members')
      .select('id')
      .eq('community_id', currentCommunity)
      .eq('user_id', chatCurrentUser.id)
      .single();

    if (existing) {
      // User is a member, so leave
      const { error: deleteError } = await sb
        .from('community_members')
        .delete()
        .eq('community_id', currentCommunity)
        .eq('user_id', chatCurrentUser.id);

      if (deleteError) throw deleteError;
      showToast('Left community! 👋');
    } else {
      // User is not a member, so join
      const { error: insertError } = await sb
        .from('community_members')
        .insert({
          community_id: currentCommunity,
          user_id: chatCurrentUser.id
        });

      if (insertError) throw insertError;
      showToast('Joined community! 🎉');
    }

    await checkCommunityMembership();
    await loadCommunityMembers();
  } catch (err) {
    console.error('Error toggling membership:', err);
    showToast('Error updating membership');
  }
}

// ---- Modal Controls ===========================================
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
  }
});

// ---- Toast Notification =======================================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
