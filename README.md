# THE CLASS FILES ⚡

Dark black + gold class social website. Built with plain HTML/CSS/JavaScript and Supabase.

## Features
- Username + password registration/login (see important auth note below)
- Shared feed visible to signed-in members
- Photo/video uploads to a private Supabase Storage bucket
- Likes, comments, sharing
- Classmates directory and searchable profiles
- Profile bio and avatar editing
- Row Level Security policies for database and storage

## 1. Create your Supabase project
1. Go to https://supabase.com and create a free project.
2. Open **Project Settings → API** (or **Data API / API Keys**, depending on dashboard layout).
3. Copy the **Project URL** and the **anon/public key**. Never use the `service_role` key in browser code.

## 2. Create the database and private media bucket
1. In Supabase, open **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this repository.
3. Paste the whole SQL script and click **Run**.
4. It creates the tables, RLS policies and private `class-media` bucket.

## 3. Configure username login
This starter uses a generated email alias internally, so members type a username and password.
1. In Supabase Dashboard, open **Authentication → Sign In / Providers → Email**.
2. Turn **OFF Confirm email** for this demo.
3. The alias is `username@users.classfiles.app`; it is not a real mailbox.
4. Password reset by email will not work with this alias. For a public production launch, switch to real email authentication or implement a secure Edge Function for username lookup and recovery.

## 4. Connect the frontend
Open `app.js` and replace:
```js
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```
with your project's URL and anon/public key. Do not paste the service-role key.

## 5. Run locally
You can open `index.html` for a quick test, or use VS Code Live Server:
- Open this folder in VS Code.
- Install the **Live Server** extension.
- Right-click `index.html` → **Open with Live Server**.

## 6. Publish using GitHub Pages
1. Create a GitHub repository named `the-class-files`.
2. Upload `index.html`, `styles.css`, `app.js`, and the `supabase` folder.
3. Go to **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then Save.
6. Wait for GitHub Pages to publish your site.

## Important security and privacy notes
- The site is open for anyone to register, but only signed-in members can see the directory, posts and media.
- Anyone who can register can join; add invite codes/admin approval before using this with a real class.
- Users should only upload photos/videos they have permission to share. Do not post private, embarrassing or sensitive material.
- The frontend uses only the Supabase anon/public key. Database access is protected by RLS. Never expose a Supabase service-role key.
- This is a starter project, not a fully audited production social network. Add moderation, reporting, rate limits, backups and account recovery before public launch.
- Free-plan quotas and file bandwidth/storage limits apply. Keep uploads small and check current Supabase limits.
