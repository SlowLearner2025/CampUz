// js/polls.js — Poll System

// ---- Load all polls ------------------------------------------
async function loadPolls(currentUser) {
  const container = document.getElementById('polls-list');
  container.innerHTML = '<div class="spinner"></div>';

  const { data: polls, error } = await sb
    .from('polls')
    .select('*, users!user_id(name)')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Failed to load polls.</p></div>';
    return;
  }

  if (!polls.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>No polls yet. Create one!</p></div>';
    return;
  }

  container.innerHTML = '';

  // Get this user's existing votes
  const { data: myVotes } = await sb
    .from('votes')
    .select('poll_id, option')
    .eq('user_id', currentUser.id);

  const myVoteMap = {};
  (myVotes || []).forEach(v => { myVoteMap[v.poll_id] = v.option; });

  // Load all votes to count per poll
  const pollIds  = polls.map(p => p.id);
  const { data: allVotes } = await sb
    .from('votes')
    .select('poll_id, option')
    .in('poll_id', pollIds);

  for (const poll of polls) {
    const votes = (allVotes || []).filter(v => v.poll_id === poll.id);
    const myVote = myVoteMap[poll.id] || null;
    const el = buildPollCard(poll, votes, myVote, currentUser);
    container.appendChild(el);

    gsap.from(el, { duration: 0.4, y: 15, opacity: 0, ease: 'power2.out', delay: 0.04 });
  }
}

// ---- Build a poll card ----------------------------------------
function buildPollCard(poll, votes, myVote, currentUser) {
  const total = votes.length;
  const countA = votes.filter(v => v.option === 'a').length;
  const countB = votes.filter(v => v.option === 'b').length;
  const countC = votes.filter(v => v.option === 'c').length;

  const pct = (n) => total ? Math.round((n / total) * 100) : 0;
  const voted = !!myVote;

  const card = document.createElement('div');
  card.className = 'poll-card';
  card.dataset.id = poll.id;

  card.innerHTML = `
    <div class="poll-question">${escapeHtml(poll.question)}</div>
    <div class="poll-option ${myVote === 'a' ? 'selected' : ''} ${voted ? 'voted' : ''}"
         onclick="${voted ? '' : `castVote('${poll.id}','a',this)`}">
      <div class="poll-bar" style="width:${pct(countA)}%"></div>
      <span class="poll-option-label">${escapeHtml(poll.option_a)}</span>
      <span class="poll-count">${voted ? pct(countA) + '%' : ''}</span>
    </div>
    <div class="poll-option ${myVote === 'b' ? 'selected' : ''} ${voted ? 'voted' : ''}"
         onclick="${voted ? '' : `castVote('${poll.id}','b',this)`}">
      <div class="poll-bar" style="width:${pct(countB)}%"></div>
      <span class="poll-option-label">${escapeHtml(poll.option_b)}</span>
      <span class="poll-count">${voted ? pct(countB) + '%' : ''}</span>
    </div>
    <div class="poll-option ${myVote === 'c' ? 'selected' : ''} ${voted ? 'voted' : ''}"
         onclick="${voted ? '' : `castVote('${poll.id}','c',this)`}">
      <div class="poll-bar" style="width:${pct(countC)}%"></div>
      <span class="poll-option-label">${escapeHtml(poll.option_c)}</span>
      <span class="poll-count">${voted ? pct(countC) + '%' : ''}</span>
    </div>
    <div class="poll-meta">
      By ${poll.users?.name || 'Unknown'} · ${total} vote${total !== 1 ? 's' : ''}
      ${voted ? ' · <strong style="color:var(--accent3)">✓ Voted</strong>' : ''}
    </div>
  `;

  return card;
}

// ---- Cast a vote ----------------------------------------------
async function castVote(pollId, option, clickedEl) {
  const { data: { user } } = await sb.auth.getUser();

  const { error } = await sb.from('votes').insert({
    poll_id: pollId,
    user_id: user.id,
    option:  option
  });

  if (error) {
    if (error.code === '23505') { // unique constraint = already voted
      showModernAlert('You already voted in this poll.', 'ℹ️');
    } else {
      showModernAlert('Vote failed: ' + error.message, '❌');
    }
    return;
  }

  // Animate the selection then reload polls
  gsap.to(clickedEl, { duration: 0.2, scale: 0.97, yoyo: true, repeat: 1 });
  setTimeout(() => loadPolls({ id: user.id }), 300);
}

// ---- Create a new poll ----------------------------------------
async function createPoll(currentUser) {
  const question = document.getElementById('poll-question').value.trim();
  const optA     = document.getElementById('poll-opt-a').value.trim();
  const optB     = document.getElementById('poll-opt-b').value.trim();
  const optC     = document.getElementById('poll-opt-c').value.trim();

  if (!question || !optA || !optB || !optC) {
    showModernAlert('Please fill in the question and all 3 options.', '⚠️');
    return;
  }

  const { error } = await sb.from('polls').insert({
    user_id:  currentUser.id,
    question: question,
    option_a: optA,
    option_b: optB,
    option_c: optC
  });

  if (error) { 
    showModernAlert('Failed to create poll: ' + error.message, '❌'); 
    return; 
  }

  // Clear form
  ['poll-question','poll-opt-a','poll-opt-b','poll-opt-c'].forEach(id => {
    document.getElementById(id).value = '';
  });

  // Reload polls list
  loadPolls(currentUser);
}
