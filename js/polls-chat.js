// js/polls-chat.js — Section Polls System

let pollsSubscription = null;
let currentView = 'messages'; // 'messages' or 'polls'

// ---- Switch between Messages and Polls view ------------------
function switchChatView(view) {
  currentView = view;
  
  const messagesView = document.getElementById('messages-view');
  const pollsView = document.getElementById('polls-view');
  const messagesTab = document.getElementById('messages-tab');
  const pollsTab = document.getElementById('polls-tab');
  
  if (view === 'messages') {
    messagesView.style.display = 'flex';
    pollsView.style.display = 'none';
    messagesTab.classList.add('active');
    pollsTab.classList.remove('active');
  } else {
    messagesView.style.display = 'none';
    pollsView.style.display = 'flex';
    pollsTab.classList.add('active');
    messagesTab.classList.remove('active');
    
    // Load polls when switching to polls view
    if (currentSection) {
      loadSectionPolls();
      subscribeToPolls();
    }
  }
}

// ---- Load polls for current section --------------------------
async function loadSectionPolls() {
  if (!currentSection || !currentCommunity) return;
  
  const container = document.getElementById('polls-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    const { data: polls, error } = await sb
      .from('polls')
      .select(`
        *,
        users!user_id(name, avatar_url),
        votes(id, user_id, option, users!user_id(name, avatar_url))
      `)
      .eq('community_id', currentCommunity)
      .eq('section_id', currentSection)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to load polls:', error);
      container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Could not load polls</p></div>';
      return;
    }
    
    container.innerHTML = '';
    
    if (!polls || polls.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>No polls yet. Create one to get opinions!</p></div>';
      return;
    }
    
    polls.forEach(poll => renderPoll(poll));
    
  } catch (err) {
    console.error('Error loading polls:', err);
    container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Error loading polls</p></div>';
  }
}

// ---- Render a single poll ------------------------------------
function renderPoll(poll) {
  const container = document.getElementById('polls-container');
  
  // Calculate votes
  const votes = poll.votes || [];
  const voteA = votes.filter(v => v.option === 'a');
  const voteB = votes.filter(v => v.option === 'b');
  const voteC = votes.filter(v => v.option === 'c');
  const voteD = votes.filter(v => v.option === 'd');
  const totalVotes = votes.length;
  
  const percentA = totalVotes > 0 ? Math.round((voteA.length / totalVotes) * 100) : 0;
  const percentB = totalVotes > 0 ? Math.round((voteB.length / totalVotes) * 100) : 0;
  const percentC = totalVotes > 0 ? Math.round((voteC.length / totalVotes) * 100) : 0;
  const percentD = totalVotes > 0 ? Math.round((voteD.length / totalVotes) * 100) : 0;
  
  // Check if current user voted
  const userVote = votes.find(v => v.user_id === chatCurrentUser.id);
  const hasVoted = !!userVote;
  
  // Check if current user created the poll
  const isCreator = poll.user_id === chatCurrentUser.id;
  
  const pollCard = document.createElement('div');
  pollCard.className = 'poll-card';
  pollCard.dataset.pollId = poll.id;
  
  const creatorName = poll.users?.name || 'Unknown';
  const timeAgo = formatTime(poll.created_at);
  
  pollCard.innerHTML = `
    <div class="poll-header">
      <div class="poll-creator">
        <span class="poll-creator-name">${creatorName}</span>
        <span class="poll-time">${timeAgo}</span>
      </div>
      ${isCreator ? `<button class="poll-delete-btn" onclick="deletePoll('${poll.id}')" title="Delete poll">🗑️</button>` : ''}
    </div>
    
    <div class="poll-question">${escapeHtml(poll.question)}</div>
    
    <div class="poll-options">
      <div class="poll-option ${hasVoted && userVote.option === 'a' ? 'voted' : ''}" onclick="${!hasVoted ? `voteOnPoll('${poll.id}', 'a')` : ''}">
        <div class="poll-option-bar" style="width: ${percentA}%"></div>
        <div class="poll-option-content">
          <span class="poll-option-text">${escapeHtml(poll.option_a)}</span>
          <span class="poll-option-percent">${percentA}%</span>
        </div>
        ${hasVoted ? `<button class="poll-voters-btn" onclick="showPollVoters('${poll.id}', 'a', event)" title="See voters">👥 ${voteA.length}</button>` : ''}
      </div>
      
      <div class="poll-option ${hasVoted && userVote.option === 'b' ? 'voted' : ''}" onclick="${!hasVoted ? `voteOnPoll('${poll.id}', 'b')` : ''}">
        <div class="poll-option-bar" style="width: ${percentB}%"></div>
        <div class="poll-option-content">
          <span class="poll-option-text">${escapeHtml(poll.option_b)}</span>
          <span class="poll-option-percent">${percentB}%</span>
        </div>
        ${hasVoted ? `<button class="poll-voters-btn" onclick="showPollVoters('${poll.id}', 'b', event)" title="See voters">👥 ${voteB.length}</button>` : ''}
      </div>
      
      <div class="poll-option ${hasVoted && userVote.option === 'c' ? 'voted' : ''}" onclick="${!hasVoted ? `voteOnPoll('${poll.id}', 'c')` : ''}">
        <div class="poll-option-bar" style="width: ${percentC}%"></div>
        <div class="poll-option-content">
          <span class="poll-option-text">${escapeHtml(poll.option_c)}</span>
          <span class="poll-option-percent">${percentC}%</span>
        </div>
        ${hasVoted ? `<button class="poll-voters-btn" onclick="showPollVoters('${poll.id}', 'c', event)" title="See voters">👥 ${voteC.length}</button>` : ''}
      </div>
      
      <div class="poll-option ${hasVoted && userVote.option === 'd' ? 'voted' : ''}" onclick="${!hasVoted ? `voteOnPoll('${poll.id}', 'd')` : ''}">
        <div class="poll-option-bar" style="width: ${percentD}%"></div>
        <div class="poll-option-content">
          <span class="poll-option-text">${escapeHtml(poll.option_d)}</span>
          <span class="poll-option-percent">${percentD}%</span>
        </div>
        ${hasVoted ? `<button class="poll-voters-btn" onclick="showPollVoters('${poll.id}', 'd', event)" title="See voters">👥 ${voteD.length}</button>` : ''}
      </div>
    </div>
    
    <div class="poll-footer">
      <span class="poll-total-votes">📊 ${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}</span>
      ${hasVoted ? `<span class="poll-voted-badge">✓ You voted</span>` : ''}
    </div>
  `;
  
  // Store votes data for later use
  pollCard.dataset.votes = JSON.stringify({
    a: voteA.map(v => ({ name: v.users?.name || 'Unknown', id: v.user_id })),
    b: voteB.map(v => ({ name: v.users?.name || 'Unknown', id: v.user_id })),
    c: voteC.map(v => ({ name: v.users?.name || 'Unknown', id: v.user_id })),
    d: voteD.map(v => ({ name: v.users?.name || 'Unknown', id: v.user_id }))
  });
  
  container.appendChild(pollCard);
  
  // Animation
  gsap.from(pollCard, {
    duration: 0.3,
    y: 20,
    opacity: 0,
    ease: 'power2.out'
  });
}

// ---- Show Create Poll Modal ----------------------------------
function showCreatePollModal() {
  if (!currentSection) {
    showToast('Please select a section first');
    return;
  }
  
  document.getElementById('poll-question-input').value = '';
  document.getElementById('poll-option-a-input').value = '';
  document.getElementById('poll-option-b-input').value = '';
  document.getElementById('poll-option-c-input').value = '';
  document.getElementById('poll-option-d-input').value = '';
  document.getElementById('create-poll-error').style.display = 'none';
  
  const modal = document.getElementById('create-poll-modal');
  modal.classList.add('show');
}

// ---- Create a poll in current section ------------------------
async function createSectionPoll() {
  const question = document.getElementById('poll-question-input').value.trim();
  const optionA = document.getElementById('poll-option-a-input').value.trim();
  const optionB = document.getElementById('poll-option-b-input').value.trim();
  const optionC = document.getElementById('poll-option-c-input').value.trim();
  const optionD = document.getElementById('poll-option-d-input').value.trim();
  const errorEl = document.getElementById('create-poll-error');
  
  if (!question || !optionA || !optionB || !optionC || !optionD) {
    errorEl.textContent = 'Please fill in all fields';
    errorEl.style.display = 'block';
    return;
  }
  
  if (!currentSection || !currentCommunity) {
    errorEl.textContent = 'No section selected';
    errorEl.style.display = 'block';
    return;
  }
  
  try {
    const { error } = await sb
      .from('polls')
      .insert({
        user_id: chatCurrentUser.id,
        community_id: currentCommunity,
        section_id: currentSection,
        question: question,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD
      });
    
    if (error) throw error;
    
    closeModal('create-poll-modal');
    showToast('Poll created successfully! 📊');
    
    // Reload polls
    await loadSectionPolls();
    
  } catch (err) {
    console.error('Error creating poll:', err);
    errorEl.textContent = 'Failed to create poll: ' + err.message;
    errorEl.style.display = 'block';
  }
}

// ---- Vote on a poll ------------------------------------------
async function voteOnPoll(pollId, option) {
  try {
    // Check if already voted
    const { data: existing } = await sb
      .from('votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('user_id', chatCurrentUser.id)
      .single();
    
    if (existing) {
      showToast('You have already voted on this poll');
      return;
    }
    
    const { error } = await sb
      .from('votes')
      .insert({
        poll_id: pollId,
        user_id: chatCurrentUser.id,
        option: option
      });
    
    if (error) throw error;
    
    showToast('Vote recorded! ✓');
    
    // Reload polls to show updated results
    await loadSectionPolls();
    
  } catch (err) {
    console.error('Error voting:', err);
    showToast('Failed to vote: ' + err.message);
  }
}

// ---- Delete a poll (creator only) ----------------------------
async function deletePoll(pollId) {
  showModernConfirm(
    'Delete this poll? All votes will be lost.',
    async () => {
      try {
        const { error } = await sb
          .from('polls')
          .delete()
          .eq('id', pollId)
          .eq('user_id', chatCurrentUser.id);
        
        if (error) throw error;
        
        // Remove from DOM
        const pollCard = document.querySelector(`[data-poll-id="${pollId}"]`);
        if (pollCard) {
          gsap.to(pollCard, {
            duration: 0.3,
            opacity: 0,
            x: -20,
            onComplete: () => pollCard.remove()
          });
        }
        
        showToast('Poll deleted successfully');
      } catch (err) {
        console.error('Failed to delete poll:', err);
        showModernAlert('Failed to delete poll: ' + err.message, '❌');
      }
    },
    'Delete',
    true
  );
}

// ---- Show who voted for an option ----------------------------
function showPollVoters(pollId, option, event) {
  event.stopPropagation();
  
  const pollCard = document.querySelector(`[data-poll-id="${pollId}"]`);
  if (!pollCard) return;
  
  const votesData = JSON.parse(pollCard.dataset.votes || '{}');
  const voters = votesData[option] || [];
  
  if (voters.length === 0) {
    showToast('No votes for this option yet');
    return;
  }
  
  const optionNames = {
    a: pollCard.querySelector('.poll-option:nth-child(1) .poll-option-text').textContent,
    b: pollCard.querySelector('.poll-option:nth-child(2) .poll-option-text').textContent,
    c: pollCard.querySelector('.poll-option:nth-child(3) .poll-option-text').textContent,
    d: pollCard.querySelector('.poll-option:nth-child(4) .poll-option-text').textContent
  };
  
  // Show modern voters modal
  showVotersModal(voters, optionNames[option]);
}

// ---- Subscribe to poll updates -------------------------------
function subscribeToPolls() {
  if (pollsSubscription) {
    sb.removeChannel(pollsSubscription);
  }
  
  pollsSubscription = sb
    .channel('section-polls-' + currentSection)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'polls' },
      (payload) => {
        if (payload.new.section_id === currentSection && currentView === 'polls') {
          loadSectionPolls();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'votes' },
      () => {
        if (currentView === 'polls') {
          loadSectionPolls();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'polls' },
      () => {
        if (currentView === 'polls') {
          loadSectionPolls();
        }
      }
    )
    .subscribe();
}

// ---- Expose functions to global scope for inline onclick -----
window.voteOnPoll = voteOnPoll;
window.deletePoll = deletePoll;
window.showPollVoters = showPollVoters;
window.switchChatView = switchChatView;
window.showCreatePollModal = showCreatePollModal;
window.createSectionPoll = createSectionPoll;
