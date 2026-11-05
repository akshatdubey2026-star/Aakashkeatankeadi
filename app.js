// THE CLASS FILES — Supabase client
// Paste your project's URL and anon/public key below. NEVER put the service_role key here.
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const MEDIA_BUCKET = "class-media";
const MAX_FILE_BYTES = 40 * 1024 * 1024;

const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && SUPABASE_ANON_KEY.length > 30 && !SUPABASE_ANON_KEY.includes("YOUR_");
const supabase = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
let currentUser = null;
let authMode = "login";
let activePage = "home";
let activeCommentPost = null;
let cachedPosts = [];

function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function initials(name = "?") { return name.slice(0, 2).toUpperCase(); }
function emailAlias(username) { return `${username.toLowerCase()}@users.classfiles.app`; }
function validUsername(name) { return /^[a-zA-Z0-9_]{3,20}$/.test(name); }
function avatarHTML(profile, large = false) {
  const cls = large ? "avatar large" : "avatar";
  return `<div class="${cls}">${profile?.avatar_url ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">` : escapeHTML(initials(profile?.username || "?"))}</div>`;
}
function showAuth() {
  $("auth-screen").classList.remove("hidden"); $("app").classList.add("hidden");
  $("email-label").classList.toggle("hidden", authMode !== "signup");
  $("auth-submit").textContent = authMode === "signup" ? "⚡ CREATE ACCOUNT" : "⚡ ENTER THE FILES";
  $("switch-copy").textContent = authMode === "signup" ? "Already registered?" : "New here?";
  $("auth-switch").textContent = authMode === "signup" ? "Log in" : "Create an account";
  $("config-warning").classList.toggle("hidden", configured);
}
function showApp() { $("auth-screen").classList.add("hidden"); $("app").classList.remove("hidden"); navigate("home"); }
$("auth-switch").addEventListener("click", () => { authMode = authMode === "login" ? "signup" : "login"; showAuth(); });
$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configured) return toast("First add your Supabase URL and anon key in app.js.");
  const username = $("username").value.trim();
  const password = $("password").value;
  const recoveryEmail = $("email").value.trim();
  if (!validUsername(username)) return toast("Username must be 3–20 characters: letters, numbers or _.");
  if (password.length < 8) return toast("Use a password with at least 8 characters.");
  const button = $("auth-submit"); button.disabled = true;
  try {
    if (authMode === "signup") {
      // This demo uses a generated email alias so the visible login can be username + password.
      // For password recovery, collect a real email and configure Supabase email delivery.
      const { data, error } = await supabase.auth.signUp({
        email: emailAlias(username), password,
        options: { data: { username, recovery_email: recoveryEmail || null } }
      });
      if (error) throw error;
      if (!data.session) {
        toast("Check your Supabase email-confirmation settings. Disable confirmations for this username-alias demo.");
        return;
      }
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id, username, recovery_email: recoveryEmail || null
      });
      if (profileError) throw profileError;
      currentUser = data.user; showApp(); toast("Account created. Welcome!");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailAlias(username), password });
      if (error) throw error;
      currentUser = data.user; showApp(); toast("Welcome back!");
    }
  } catch (error) { toast(error.message || "Something went wrong."); }
  finally { button.disabled = false; }
});
$("logout").addEventListener("click", async () => { await supabase.auth.signOut(); currentUser = null; showAuth(); });
document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
function navigate(page) {
  activePage = page;
  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden"));
  $(`page-${page}`).classList.remove("hidden");
  document.querySelectorAll(".nav-button").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  if (page === "home") loadFeed();
  if (page === "directory") loadDirectory();
  if (page === "profile") loadProfile(currentUser.id);
}
function fileIsAllowed(file) {
  const allowed = ["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"];
  return allowed.includes(file.type) && file.size <= MAX_FILE_BYTES;
}
$("post-file").addEventListener("change", e => { $("file-name").textContent = e.target.files[0]?.name || "No file selected"; });
$("post-form").addEventListener("submit", async event => {
  event.preventDefault();
  const content = $("post-content").value.trim();
  const file = $("post-file").files[0];
  if (!content && !file) return toast("Write something or select a photo/video.");
  if (file && !fileIsAllowed(file)) return toast("Choose JPG, PNG, WEBP, GIF, MP4 or WEBM under 40 MB.");
  const button = event.submitter; button.disabled = true;
  try {
    let mediaPath = null, mediaType = null;
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
      mediaPath = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(mediaPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      mediaType = file.type;
    }
    const { error } = await supabase.from("posts").insert({ user_id: currentUser.id, content, media_path: mediaPath, media_type: mediaType });
    if (error) {
      if (mediaPath) await supabase.storage.from(MEDIA_BUCKET).remove([mediaPath]);
      throw error;
    }
    $("post-content").value = ""; $("post-file").value = ""; $("file-name").textContent = "No file selected";
    toast("Your post is live!"); await loadFeed();
  } catch (error) { toast(error.message || "Could not publish post."); }
  finally { button.disabled = false; }
});
$("refresh-feed").addEventListener("click", loadFeed);

async function getMediaURL(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) { console.warn(error); return null; }
  return data.signedUrl;
}
async function loadFeed() {
  const feed = $("feed"); feed.innerHTML = `<div class="empty panel">Loading class stories…</div>`;
  try {
    const { data, error } = await supabase.from("posts")
      .select("id,user_id,content,media_path,media_type,created_at,profiles(username,avatar_path),post_likes(user_id),comments(id,user_id,content,created_at,profiles(username))")
      .order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    cachedPosts = data || [];
    const paths = [...new Set(cachedPosts.map(p => p.profiles?.avatar_path).filter(Boolean).concat(cachedPosts.map(p => p.media_path).filter(Boolean)))];
    const urls = {};
    await Promise.all(paths.map(async path => { urls[path] = await getMediaURL(path); }));
    feed.innerHTML = cachedPosts.length ? cachedPosts.map(post => postHTML(post, urls)).join("") : `<div class="empty panel">No class stories yet. Be the first to post ⚡</div>`;
    feed.onclick = handlePostAction;
  } catch (error) { feed.innerHTML = `<div class="empty panel">Could not load feed: ${escapeHTML(error.message)}</div>`; }
}
function postHTML(post, urls = {}) {
  const username = post.profiles?.username || "Classmate";
  const avatar = post.profiles?.avatar_path ? urls[post.profiles.avatar_path] : null;
  const liked = (post.post_likes || []).some(like => like.user_id === currentUser.id);
  const mediaURL = urls[post.media_path];
  let media = "";
  if (mediaURL && post.media_type?.startsWith("video/")) media = `<video class="post-media" controls preload="metadata" src="${escapeHTML(mediaURL)}"></video>`;
  else if (mediaURL) media = `<img class="post-media" src="${escapeHTML(mediaURL)}" alt="Post attachment">`;
  const comments = (post.comments || []).slice().sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
  return `<article class="post panel" data-post-id="${post.id}">
    <div class="post-head">${avatarHTML({username, avatar_url: avatar})}<div><div class="post-author">${escapeHTML(username)}</div><div class="post-date">${new Date(post.created_at).toLocaleString()}</div></div></div>
    ${post.content ? `<div class="post-text">${escapeHTML(post.content)}</div>` : ""}${media}
    <div class="post-actions">
      <button data-action="like" class="${liked ? "liked" : ""}">♥ ${(post.post_likes || []).length} Like</button>
      <button data-action="comments">▢ ${comments.length} Comments</button>
      <button data-action="share">↗ Share</button>
      ${post.user_id === currentUser.id ? `<button data-action="delete" class="post-menu">Delete</button>` : ""}
    </div></article>`;
}
async function handlePostAction(event) {
  const button = event.target.closest("[data-action]"); if (!button) return;
  const card = event.target.closest("[data-post-id]"); const post = cachedPosts.find(p => p.id === card?.dataset.postId);
  if (!post) return;
  const action = button.dataset.action; button.disabled = true;
  try {
    if (action === "like") {
      const existing = (post.post_likes || []).some(l => l.user_id === currentUser.id);
      if (existing) {
        const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUser.id });
        if (error) throw error;
      }
      await loadFeed();
    } else if (action === "comments") openComments(post);
    else if (action === "share") {
      const shareData = { title: "THE CLASS FILES", text: `A class memory shared by ${post.profiles?.username || "a classmate"}.`, url: location.href };
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(location.href); toast("Website link copied."); }
    } else if (action === "delete") {
      if (!confirm("Delete this post? This cannot be undone.")) return;
      const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", currentUser.id);
      if (error) throw error;
      if (post.media_path) await supabase.storage.from(MEDIA_BUCKET).remove([post.media_path]);
      toast("Post deleted."); await loadFeed();
    }
  } catch (error) { if (error.name !== "AbortError") toast(error.message || "Action failed."); }
  finally { button.disabled = false; }
}
async function openComments(post) {
  activeCommentPost = post;
  const dialog = $("comments-dialog"); const target = $("dialog-comments");
  target.innerHTML = (post.comments || []).length ? post.comments.map(c => `<div class="comment-item"><b>${escapeHTML(c.profiles?.username || "Classmate")}</b><div>${escapeHTML(c.content)}</div><span class="tiny muted">${new Date(c.created_at).toLocaleString()}</span></div>`).join("") : `<p class="muted">No comments yet. Start the conversation.</p>`;
  dialog.showModal();
}
$("close-comments").addEventListener("click", () => $("comments-dialog").close());
$("comment-form").addEventListener("submit", async event => {
  event.preventDefault(); if (!activeCommentPost) return;
  const content = $("comment-input").value.trim(); if (!content) return;
  const button = event.submitter; button.disabled = true;
  try {
    const { error } = await supabase.from("comments").insert({ post_id: activeCommentPost.id, user_id: currentUser.id, content });
    if (error) throw error;
    $("comment-input").value = ""; $("comments-dialog").close(); toast("Comment added."); await loadFeed();
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
});

async function loadDirectory() {
  const target = $("people"); target.innerHTML = `<div class="empty panel">Loading classmates…</div>`;
  try {
    const { data, error } = await supabase.from("profiles").select("id,username,avatar_path,bio,created_at").order("username").limit(200);
    if (error) throw error;
    const profiles = data || [];
    const withURLs = await Promise.all(profiles.map(async p => ({...p, avatar_url: p.avatar_path ? await getMediaURL(p.avatar_path) : null})));
    target.innerHTML = withURLs.map(p => `<article class="person-card panel">${avatarHTML(p)}<div class="person-info"><b>${escapeHTML(p.username)}</b><div class="tiny muted">${escapeHTML(p.bio || "Class member")}</div></div><button class="gold-button" data-user-id="${p.id}">View</button></article>`).join("") || `<div class="empty panel">No classmates have joined yet.</div>`;
    target.querySelectorAll("[data-user-id]").forEach(btn => btn.addEventListener("click", () => loadProfile(btn.dataset.userId)));
    $("people-search").oninput = e => { const q = e.target.value.toLowerCase(); target.querySelectorAll(".person-card").forEach(card => card.classList.toggle("hidden", !card.textContent.toLowerCase().includes(q))); };
  } catch (error) { target.innerHTML = `<div class="empty panel">${escapeHTML(error.message)}</div>`; }
}
async function loadProfile(userId) {
  activePage = "profile";
  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden")); $("page-profile").classList.remove("hidden");
  document.querySelectorAll(".nav-button").forEach(el => el.classList.toggle("active", el.dataset.page === "profile" && userId === currentUser.id));
  const target = $("profile-content"); target.innerHTML = `<div class="empty panel">Loading profile…</div>`;
  try {
    const { data: profile, error } = await supabase.from("profiles").select("id,username,bio,avatar_path,created_at").eq("id", userId).single();
    if (error) throw error;
    const { data: posts, error: postError } = await supabase.from("posts").select("id,user_id,content,media_path,media_type,created_at,profiles(username,avatar_path),post_likes(user_id),comments(id)").eq("user_id", userId).order("created_at", {ascending:false}).limit(40);
    if (postError) throw postError;
    const avatarURL = profile.avatar_path ? await getMediaURL(profile.avatar_path) : null;
    const mediaURLs = {};
    await Promise.all((posts || []).filter(p => p.media_path).map(async p => mediaURLs[p.media_path] = await getMediaURL(p.media_path)));
    const likes = (posts || []).reduce((sum,p) => sum + (p.post_likes || []).length, 0);
    target.innerHTML = `<section class="profile-card panel"><div class="profile-top">${avatarHTML({...profile,avatar_url:avatarURL},true)}<div><div class="eyebrow">CLASS MEMBER PROFILE</div><h2>${escapeHTML(profile.username)}</h2><p class="muted">${escapeHTML(profile.bio || "No bio added yet.")}</p></div></div><div class="profile-stats"><div><b>${posts.length}</b><span>Posts</span></div><div><b>${likes}</b><span>Likes received</span></div><div><b>${new Date(profile.created_at).toLocaleDateString()}</b><span>Joined</span></div></div>
      ${userId === currentUser.id ? `<div class="profile-edit"><div class="eyebrow">EDIT YOUR PROFILE</div><label class="field">ABOUT YOU<textarea id="bio-edit" maxlength="160">${escapeHTML(profile.bio || "")}</textarea></label><label class="field">PROFILE PHOTO<input id="avatar-edit" type="file" accept="image/jpeg,image/png,image/webp"></label><button id="save-profile" class="gold-button">Save profile</button></div>` : ""}</section>
      <div class="section-heading"><span class="eyebrow">POSTS BY ${escapeHTML(profile.username.toUpperCase())}</span></div>
      <div class="feed">${posts.length ? posts.map(p => postHTML(p, mediaURLs)).join("") : `<div class="empty panel">No posts yet.</div>`}</div>`;
    if (userId === currentUser.id) $("save-profile").addEventListener("click", saveProfile);
    target.querySelectorAll(".post").forEach(card => card.addEventListener("click", e => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "comments") { const p = posts.find(x => x.id === card.dataset.postId); if (p) openComments(p); }
      if (action === "share") { navigator.clipboard?.writeText(location.href).then(() => toast("Profile link copied.")); }
    }));
  } catch (error) { target.innerHTML = `<div class="empty panel">${escapeHTML(error.message)}</div>`; }
}
async function saveProfile() {
  const button = $("save-profile"); button.disabled = true;
  try {
    const bio = $("bio-edit").value.trim(); const file = $("avatar-edit").files[0];
    const update = { bio };
    if (file) {
      if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Choose JPG, PNG or WEBP under 5 MB.");
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${currentUser.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType:file.type });
      if (uploadError) throw uploadError;
      update.avatar_path = path;
    }
    const { error } = await supabase.from("profiles").update(update).eq("id", currentUser.id);
    if (error) throw error;
    toast("Profile saved."); await loadProfile(currentUser.id);
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}

async function init() {
  showAuth();
  if (!configured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) { currentUser = session.user; showApp(); }
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) showApp(); else { $("app").classList.add("hidden"); $("auth-screen").classList.remove("hidden"); }
  });
}
init();
