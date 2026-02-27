// js/supabase.js
// ============================================================
//  CAMPUZ — Supabase Client Setup
//  ⚠️ WARNING: THESE CREDENTIALS ARE EXPOSED IN THE FRONTEND
//  You MUST rotate them immediately in Supabase Dashboard:
//  1. Go to Settings → API → Regenerate anon public key
//  2. Replace the values below
//  3. Deploy the updated version
//  These keys were exposed in git history - rotate ASAP!
// ============================================================

const SUPABASE_URL  = 'https://ekzpgpbqvzirbguqifzv.supabase.co';  // 🔧 REPLACE WITH YOUR URL
const SUPABASE_ANON_KEY = 'sb_publishable_oGhLvqFTa05REtKpdcskdA_lwNdbFk2';             // 🔧 REPLACE WITH NEW KEY

// Create the Supabase client using the CDN build
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Helper: get current logged-in user ----------------------
async function getCurrentUser() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Fetch extra profile data from our public.users table
  try {
    const { data: profile, error } = await sb.from('users').select('*').eq('id', user.id).single();
    if (error || !profile) return null;
    return profile;
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    return null;
  }
}

// ---- Helper: format timestamp --------------------------------
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
         ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ---- Helper: escape HTML to prevent XSS ----------------------
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
