document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL      = "https://klxtstltmqwsaqccekfm.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9RkYRGEhC9VyU2AuF8Z-NQ_C529J20s";

  const { createClient } = window.supabase;
  const supabaseClient   = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const overlay            = document.getElementById("overlay");
  const menuBtn            = document.getElementById("menuBtn");
  const menuPanel          = document.getElementById("menuPanel");
  const closeMenu          = document.getElementById("closeMenu");
  const accountBtn         = document.getElementById("accountBtn");
  const accountPanel       = document.getElementById("accountPanel");
  const closePanel         = document.getElementById("closePanel");
  const logoutItem         = document.querySelector(".logout-item");
  const personalInfoBtn    = document.getElementById("personalInfoBtn");

  const personalModalOverlay = document.getElementById("personalModalOverlay");
  const closePersonalModal   = document.getElementById("closePersonalModal");
  const piName               = document.getElementById("piName");
  const piEmail              = document.getElementById("piEmail");
  const piPassword           = document.getElementById("piPassword");
  const piAvatar             = document.getElementById("piAvatar");
  const piSave               = document.getElementById("piSave");
  const piLogout             = document.getElementById("piLogout");

  const welcomeAvatar  = document.getElementById("welcomeAvatar");
  const accountAvatar  = document.getElementById("accountAvatar");
  const accountName    = document.getElementById("accountName");
  const accountEmail   = document.getElementById("accountEmail");
  const welcomeTitle   = document.getElementById("welcomeTitle");

  const topicsList          = document.getElementById("topics-list");
  const topicDetailPanel    = document.getElementById("topic-detail-panel");
  const topicsSection       = document.getElementById("topics-section");
  const topicDetailContent  = document.getElementById("topic-detail-content");
  const backBtn             = document.getElementById("back-to-topics");
  const postTopicBtn        = document.getElementById("post-topic-btn");
  const postReplyBtn        = document.getElementById("post-reply-btn");
  const replyInput          = document.getElementById("reply-content");
  const titleInput          = document.getElementById("title");
  const contentInput        = document.getElementById("content");
  const createTopicPanel    = document.getElementById("create-topic-panel");
  const forumLink           = document.getElementById("forumLink");

  let currentUser    = null;
  let currentProfile = null;
  let currentTopicId = null;
  let isAdmin        = false;

  const pageRole    = document.documentElement.getAttribute("data-page-role");
  const isAdminPage = pageRole === "forum-admin";

  // ── Helpers ──────────────────────────────────────────────────
  function getInitials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function getFallbackName(email = "") {
    return email ? email.split("@")[0] : "User";
  }

  function escapeHtml(text = "") {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function setAvatar(el, name, avatarUrl) {
    if (!el) return;
    if (avatarUrl) {
      el.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(name)}">`;
    } else {
      el.textContent = getInitials(name);
    }
  }

  function avatarHTML(name, avatarUrl, small = false) {
    const cls = small ? "avatar-circle small" : "avatar-circle";
    if (avatarUrl) {
      return `<div class="${cls}"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}"></div>`;
    }
    return `<div class="${cls}">${escapeHtml(getInitials(name))}</div>`;
  }

  // ── Load user & profile ───────────────────────────────────────
  async function loadCurrentUserInfo() {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      window.location.href = "Sign.html";
      return false;
    }

    currentUser = userData.user;

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("display_name, email, role, avatar_url")
      .eq("id", currentUser.id)
      .single();

    if (profileError || !profile) {
      alert("Unable to verify your profile.");
      window.location.href = "home.html";
      return false;
    }

    currentProfile = profile;
    isAdmin        = profile.role === "admin";

    if (isAdminPage && !isAdmin) {
      window.location.href = "forum.html";
      return false;
    }

    const displayName = profile.display_name || getFallbackName(currentUser.email);
    const email       = profile.email        || currentUser.email;
    const avatarUrl   = profile.avatar_url   || currentUser.user_metadata?.avatar_url || "";

    if (welcomeTitle)  welcomeTitle.textContent  = isAdminPage ? "Admin Forum" : "Community Forum";
    if (accountName)   accountName.textContent   = displayName;
    if (accountEmail)  accountEmail.textContent  = email;

    setAvatar(welcomeAvatar, displayName, avatarUrl);
    setAvatar(accountAvatar, displayName, avatarUrl);

    if (piName)     piName.value     = displayName;
    if (piEmail)    piEmail.value    = email;
    if (piPassword) piPassword.value = "";

    if (forumLink) {
      forumLink.href = isAdmin ? "forum-admin.html" : "forum.html";
    }

    return true;
  }

  // ── Personal info modal ───────────────────────────────────────
  function openPersonalModal() {
    personalModalOverlay?.classList.add("show");
    closeAllPanels();
  }

  function closePersonalInfoModal() {
    personalModalOverlay?.classList.remove("show");
  }

  async function savePersonalInfo() {
    const newName     = piName?.value.trim();
    const newEmail    = piEmail?.value.trim();
    const newPassword = piPassword?.value.trim();
    const file        = piAvatar?.files?.[0];

    if (!newName || !newEmail) { alert("Please fill in name and email."); return; }

    if (piSave) { piSave.disabled = true; piSave.textContent = "Saving…"; }

    try {
      let avatarUrl = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || "";

      if (file) {
        const fileExt  = file.name.split(".").pop();
        const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage
          .from("avatars")
          .upload(filePath, file, { upsert: true, contentType: file.type });
        if (uploadError) { alert(uploadError.message); return; }
        const { data: publicUrlData } = supabaseClient.storage.from("avatars").getPublicUrl(filePath);
        avatarUrl = publicUrlData.publicUrl;
      }

      const updatePayload = { email: newEmail, data: { display_name: newName, avatar_url: avatarUrl } };
      if (newPassword) updatePayload.password = newPassword;

      const { error: authUpdateError } = await supabaseClient.auth.updateUser(updatePayload);
      if (authUpdateError) { alert(authUpdateError.message); return; }

      const { error: profileUpdateError } = await supabaseClient
        .from("profiles")
        .update({ display_name: newName, email: newEmail, avatar_url: avatarUrl })
        .eq("id", currentUser.id);
      if (profileUpdateError) { alert(profileUpdateError.message); return; }

      await loadCurrentUserInfo();
      closePersonalInfoModal();
      alert("Information updated successfully.");
    } catch (err) {
      console.error(err);
      alert("Error while updating information.");
    } finally {
      if (piSave) { piSave.disabled = false; piSave.textContent = "Save changes"; }
    }
  }

  async function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
      await supabaseClient.auth.signOut();
      window.location.href = "Sign.html";
    }
  }

  function closeAllPanels() {
    menuPanel?.classList.remove("active");
    accountPanel?.classList.remove("active");
    overlay?.classList.remove("active");
  }

  // ── Load topics ───────────────────────────────────────────────
  async function loadTopics() {
    if (!topicsList) return;

    const { data, error } = await supabaseClient
      .from("forum_topics")
      .select("id, title, content, created_at, author_name_snapshot, author_avatar_snapshot")
      .order("created_at", { ascending: false });

    if (error) {
      topicsList.innerHTML = `<p class="admin-only-hint">Failed to load topics.</p>`;
      return;
    }

    if (!data || data.length === 0) {
      topicsList.innerHTML = `<p class="admin-only-hint">No topics yet.</p>`;
      return;
    }

    topicsList.innerHTML = "";

    data.forEach((topic) => {
      const card = document.createElement("div");
      card.className    = "topic-card";
      card.dataset.id   = topic.id;

      // Delete button only rendered for admins
      const deleteBtn = isAdmin
        ? `<button class="delete-topic-btn" data-id="${topic.id}" title="Delete topic">
             <i data-feather="trash-2"></i>
           </button>`
        : "";

      card.innerHTML = `
        <div class="topic-card-inner">
          <div class="forum-top-row">
            ${avatarHTML(topic.author_name_snapshot, topic.author_avatar_snapshot, false)}
            <div class="topic-text">
              <h3>${escapeHtml(topic.title)}</h3>
              <div class="author-meta">
                ${escapeHtml(topic.author_name_snapshot)} • ${escapeHtml(formatDate(topic.created_at))}
              </div>
            </div>
          </div>
          <div class="topic-preview">
            ${escapeHtml(topic.content.substring(0, 150))}${topic.content.length > 150 ? "…" : ""}
          </div>
        </div>
        ${deleteBtn}
      `;

      // Open topic on card click (but not on the delete button)
      card.querySelector(".topic-card-inner").addEventListener("click", () => openTopic(topic.id));

      // Delete button handler
      if (isAdmin) {
        card.querySelector(".delete-topic-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          deleteTopic(topic.id, topic.title, card);
        });
      }

      topicsList.appendChild(card);
    });

    if (window.feather) feather.replace();
  }

  // ── Delete topic ──────────────────────────────────────────────
  async function deleteTopic(topicId, topicTitle, cardEl) {
    if (!confirm(`Delete "${topicTitle}"?\n\nThis will also delete all replies. This cannot be undone.`)) return;

    // Optimistically remove card from UI immediately
    cardEl.style.opacity    = "0.4";
    cardEl.style.pointerEvents = "none";

    // Delete replies first (foreign key), then the topic
    const { error: repliesError } = await supabaseClient
      .from("forum_replies")
      .delete()
      .eq("topic_id", topicId);

    if (repliesError) {
      alert("Failed to delete replies: " + repliesError.message);
      cardEl.style.opacity       = "1";
      cardEl.style.pointerEvents = "auto";
      return;
    }

    const { error: topicError } = await supabaseClient
      .from("forum_topics")
      .delete()
      .eq("id", topicId);

    if (topicError) {
      alert("Failed to delete topic: " + topicError.message);
      cardEl.style.opacity       = "1";
      cardEl.style.pointerEvents = "auto";
      return;
    }

    // Remove card from DOM cleanly
    cardEl.remove();

    // If we were viewing the deleted topic, go back to list
    if (currentTopicId === topicId) backToTopics();

    // Show empty state if no topics left
    if (topicsList && topicsList.children.length === 0) {
      topicsList.innerHTML = `<p class="admin-only-hint">No topics yet.</p>`;
    }
  }

  // ── Open topic detail ─────────────────────────────────────────
  async function openTopic(topicId) {
    currentTopicId = topicId;

    const { data: topic, error: topicError } = await supabaseClient
      .from("forum_topics")
      .select("id, title, content, created_at, author_name_snapshot, author_avatar_snapshot")
      .eq("id", topicId)
      .single();

    if (topicError || !topic) return;

    const { data: replies, error: repliesError } = await supabaseClient
      .from("forum_replies")
      .select("id, content, created_at, author_name_snapshot, author_avatar_snapshot")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true });

    if (repliesError) return;

    const repliesHtml = replies && replies.length > 0
      ? replies.map((reply) => `
          <div class="reply-item">
            <div class="reply-author-row">
              ${avatarHTML(reply.author_name_snapshot, reply.author_avatar_snapshot, true)}
              <div>
                <div class="author-name">${escapeHtml(reply.author_name_snapshot)}</div>
                <div class="author-meta">${escapeHtml(formatDate(reply.created_at))}</div>
              </div>
            </div>
            <div class="reply-text">${escapeHtml(reply.content)}</div>
          </div>
        `).join("")
      : `<p class="admin-only-hint">No replies yet. Be the first to respond.</p>`;

    // Admin gets a delete button in the detail header too
    const detailDeleteBtn = isAdmin
      ? `<button class="delete-topic-btn detail-delete-btn" data-id="${topic.id}" title="Delete this topic">
           <i data-feather="trash-2"></i> Delete Topic
         </button>`
      : "";

    if (topicDetailContent) {
      topicDetailContent.innerHTML = `
        <div class="topic-detail-header">
          <div class="topic-detail-title-row">
            <div class="forum-top-row">
              ${avatarHTML(topic.author_name_snapshot, topic.author_avatar_snapshot, false)}
              <div>
                <h2>${escapeHtml(topic.title)}</h2>
                <div class="author-meta">
                  ${escapeHtml(topic.author_name_snapshot)} • ${escapeHtml(formatDate(topic.created_at))}
                </div>
              </div>
            </div>
            ${detailDeleteBtn}
          </div>
        </div>

        <div class="topic-content">${escapeHtml(topic.content)}</div>

        <div class="replies-section">
          <h3>Replies (${replies ? replies.length : 0})</h3>
          ${repliesHtml}
        </div>
      `;

      // Wire up detail delete button
      if (isAdmin) {
        topicDetailContent.querySelector(".detail-delete-btn")?.addEventListener("click", async () => {
          // Find the matching card in the list (may not exist if list was reloaded)
          const matchingCard = topicsList?.querySelector(`[data-id="${topic.id}"]`);
          if (matchingCard) {
            await deleteTopic(topic.id, topic.title, matchingCard);
          } else {
            // Card not in DOM — delete directly and go back
            if (!confirm(`Delete "${topic.title}"?\n\nThis will also delete all replies. This cannot be undone.`)) return;
            await supabaseClient.from("forum_replies").delete().eq("topic_id", topic.id);
            await supabaseClient.from("forum_topics").delete().eq("id", topic.id);
            backToTopics();
            await loadTopics();
          }
        });
      }
    }

    if (topicsSection)    topicsSection.style.display    = "none";
    if (topicDetailPanel) topicDetailPanel.style.display = "block";

    if (window.feather) feather.replace();
  }

  function backToTopics() {
    if (topicsSection)    topicsSection.style.display    = "block";
    if (topicDetailPanel) topicDetailPanel.style.display = "none";
    currentTopicId = null;
    if (replyInput) replyInput.value = "";
  }

  // ── Create topic (admin only) ─────────────────────────────────
  async function createTopic() {
    if (!isAdminPage) return;
    const title   = titleInput?.value.trim()   || "";
    const content = contentInput?.value.trim() || "";

    if (!title) { alert("Please enter a topic title."); return; }

    const { error } = await supabaseClient.from("forum_topics").insert({
      title,
      content: content || "No description provided.",
      created_by: currentUser.id,
    });

    if (error) { alert(error.message); return; }

    titleInput.value   = "";
    contentInput.value = "";
    await loadTopics();
  }

  // ── Post reply ────────────────────────────────────────────────
  async function postReply() {
    const reply = replyInput?.value.trim() || "";
    if (!reply)          { alert("Please write a reply."); return; }
    if (!currentTopicId) return;

    const { error } = await supabaseClient.from("forum_replies").insert({
      topic_id:   currentTopicId,
      content:    reply,
      created_by: currentUser.id,
    });

    if (error) { alert(error.message); return; }

    replyInput.value = "";
    await openTopic(currentTopicId);
  }

  // ── Boot ──────────────────────────────────────────────────────
  if (!(await loadCurrentUserInfo())) return;

  await loadTopics();

  if (createTopicPanel) {
    createTopicPanel.style.display = isAdminPage ? "block" : "none";
  }

  // ── Event listeners ───────────────────────────────────────────
  menuBtn?.addEventListener("click", () => {
    closeAllPanels();
    menuPanel?.classList.add("active");
    overlay?.classList.add("active");
  });

  accountBtn?.addEventListener("click", () => {
    closeAllPanels();
    accountPanel?.classList.add("active");
    overlay?.classList.add("active");
  });

  closeMenu?.addEventListener("click",  closeAllPanels);
  closePanel?.addEventListener("click", closeAllPanels);
  overlay?.addEventListener("click",    closeAllPanels);

  personalInfoBtn?.addEventListener("click",    openPersonalModal);
  closePersonalModal?.addEventListener("click", closePersonalInfoModal);
  personalModalOverlay?.addEventListener("click", (e) => {
    if (e.target === personalModalOverlay) closePersonalInfoModal();
  });

  piSave?.addEventListener("click",   savePersonalInfo);
  piLogout?.addEventListener("click", handleLogout);
  logoutItem?.addEventListener("click", handleLogout);

  backBtn?.addEventListener("click",      backToTopics);
  postTopicBtn?.addEventListener("click", createTopic);
  postReplyBtn?.addEventListener("click", postReply);

  replyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postReply(); }
  });

  if (window.feather) feather.replace();
});