# 🎓 Campuz — Student Social Web App

A modern college social platform combining the best of a class feed, realtime chat, anonymous confessions, and live polls.

---

## 📁 Folder Structure

```
campuz/
├── index.html              ← Main app (dashboard)
├── login.html              ← Auth page (login + signup)
├── supabase_schema.sql     ← Run this in Supabase SQL Editor
├── css/
│   └── app.css             ← All styles
└── js/
    ├── supabase.js         ← Supabase client + helpers
    ├── feed.js             ← Posts, likes, comments
    ├── chat.js             ← Realtime class chat
    └── polls.js            ← Poll creation + voting
```

---
# Campuz

Campuz is a student social web app that merges a public class feed with real-time chat and live polls, wrapped in a clean, animated UI. It is designed for fast daily use: post a thought, drop an anonymous comment, catch up in a channel, or vote in a class poll in seconds.

## What the app is

Campuz blends three experiences into one space:

- A public feed for posts, reactions, and comments
- A Discord-inspired class chat with channels and presence
- Quick polls that show results in real time

The interface is mobile-first and animated, with a focus on clarity and speed.

## How it works (conceptually)

1. **Sign up and login**
   Users create an account, verify their email, and log in.

2. **Home feed**
   Users create posts, like them, and discuss in threaded comments.

3. **Class chat**
   Users join channels, send messages instantly, and see live updates.

4. **Polls**
   Users create quick polls and vote once, with live results.

5. **Profile**
   Users customize their display name and avatar, and manage their account.

## Key features

- **Public post wall** with reactions and comments
- **Anonymous mode** for posts and comments
- **Real-time chat** with channels and presence cues
- **Live polls** with instant results
- **Profile customization** (name, avatar, password)
- **Smooth animations** and responsive layout

## Design highlights

- Clean, high-contrast UI built for readability
- Consistent micro-interactions and feedback states
- Lightweight structure for fast load and navigation

## Tech at a glance

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Animations**: GSAP
- **Visuals**: Three.js particles on the auth screen
- **Data layer**: Real-time database and auth services

4. Realtime must be explicitly enabled for each table in your Supabase dashboard

---

Built with ❤️ for college classrooms.
