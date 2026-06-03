// ─────────────────────────────────────────────────────────────
//  project.js  –  ArchitectPro  (fixed & hardened)
//  Fixes applied:
//   1. Credentials moved to a single CONFIG block (easy to env-ify)
//   2. onAuthStateChange handles token expiry / forced sign-out
//   3. Projects query filters by owner_id (RLS-safe)
//   4. unityFrame guard on setInterval
//   5. Confirm dialog added for Approve action
//   6. piSave button disabled during async save to prevent double-submit
// ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {

  // ── 1. CREDENTIALS — swap these for env vars in a real build ──
  //    e.g. injected by a server-side template or a bundler (Vite/Webpack)
  //    so they never live scattered across multiple JS files.
  const CONFIG = {
    supabaseUrl:     "https://klxtstltmqwsaqccekfm.supabase.co",
    supabaseAnonKey: "sb_publishable_9RkYRGEhC9VyU2AuF8Z-NQ_C529J20s",
  };

  const { createClient } = window.supabase;
  const supabaseClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

  const pageRole = document.documentElement.dataset.pageRole || "project";

  // ── DOM refs ───────────────────────────────────────────────
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

  const welcomeTitle   = document.getElementById("welcomeTitle");
  const welcomeAvatar  = document.getElementById("welcomeAvatar");
  const accountAvatar  = document.getElementById("accountAvatar");
  const accountName    = document.getElementById("accountName");
  const accountEmail   = document.getElementById("accountEmail");

  const projectsList       = document.getElementById("projectsList");
  const loadingProjects    = document.getElementById("loadingProjects");
  const noProjectsMsg      = document.getElementById("noProjectsMsg");
  const refreshProjectsBtn = document.getElementById("refreshProjectsBtn");
  const forumLink          = document.getElementById("forumLink");

  const unityFrame       = document.getElementById("unityFrame");
  const openFullUnityBtn = document.getElementById("openFullUnityBtn");

  const requestsList       = document.getElementById("requestsList");
  const noRequestsMsg      = document.getElementById("noRequestsMsg");
  const refreshRequestsBtn = document.getElementById("refreshRequestsBtn");

  // ── State ──────────────────────────────────────────────────
  let currentUser    = null;
  let currentProfile = null;
  let currentSession = null;
  let isAdmin        = false;

  // ── Helpers ────────────────────────────────────────────────
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

  function setAvatar(el, name, avatarUrl) {
    if (!el) return;
    if (avatarUrl) {
      el.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(name)}">`;
    } else {
      el.textContent = getInitials(name);
    }
  }

  function closeAllPanels() {
    menuPanel?.classList.remove("active");
    accountPanel?.classList.remove("active");
    overlay?.classList.remove("active");
  }

  function buildSessionPayload() {
    if (!currentUser || !currentSession?.access_token) return null;
    return JSON.stringify({
      userId:      currentUser.id,
      accessToken: currentSession.access_token,
    });
  }

  function sendSessionToUnity() {
    const payload = buildSessionPayload();
    if (!payload) return;
    unityFrame?.contentWindow?.postMessage({ type: "set-session", payload }, "*");
  }

  function storeSessionForUnity() {
    if (!currentUser || !currentSession?.access_token) return;
    localStorage.setItem("supabase_user_id",      currentUser.id);
    localStorage.setItem("supabase_access_token", currentSession.access_token);
  }

  function clearLocalSession() {
    localStorage.removeItem("supabase_user_id");
    localStorage.removeItem("supabase_access_token");
    unityFrame?.contentWindow?.postMessage({ type: "clear-session" }, "*");
  }

  // ── 2. AUTH STATE CHANGE — handles token expiry ────────────
  //    Fires whenever the session changes (refresh, sign-out,
  //    or token expiry). Redirects to Sign.html on SIGNED_OUT.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
      clearLocalSession();
      window.location.href = "Sign.html";
    }
    if (session) {
      currentSession = session;
      storeSessionForUnity();
      sendSessionToUnity();
    }
  });

  // ── Load user & profile ────────────────────────────────────
  async function loadCurrentUserInfo() {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    const { data: sessionData }                = await supabaseClient.auth.getSession();

    if (userError || !userData?.user) {
      window.location.href = "Sign.html";
      return false;
    }

    currentUser    = userData.user;
    currentSession = sessionData?.session ?? null;

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
    isAdmin = profile.role === "admin";

    // Block non-admins from admin page
    if (pageRole === "project-admin" && !isAdmin) {
      window.location.href = "project.html";
      return false;
    }

    const displayName = profile.display_name || getFallbackName(currentUser.email);
    const email       = profile.email        || currentUser.email;
    const avatarUrl   = profile.avatar_url   || currentUser.user_metadata?.avatar_url || "";

    if (welcomeTitle) welcomeTitle.textContent = "Projects";
    if (accountName)  accountName.textContent  = displayName;
    if (accountEmail) accountEmail.textContent = email;

    setAvatar(welcomeAvatar,  displayName, avatarUrl);
    setAvatar(accountAvatar,  displayName, avatarUrl);

    if (piName)     piName.value     = displayName;
    if (piEmail)    piEmail.value    = email;
    if (piPassword) piPassword.value = "";

    if (forumLink) {
      forumLink.href = isAdmin ? "forum-admin.html" : "forum.html";
    }

    storeSessionForUnity();
    sendSessionToUnity();

    return true;
  }

  // ── 3. PROJECTS — filtered by owner_id ─────────────────────
  //    Prevents users from seeing each other's projects.
  //    Make sure your Supabase RLS policy also enforces this
  //    server-side as the authoritative guard.
  async function loadProjects() {
    if (!projectsList || !currentUser) return;

    if (loadingProjects) loadingProjects.style.display = "block";
    if (noProjectsMsg)   noProjectsMsg.style.display   = "none";
    projectsList.innerHTML = "";

    const query = supabaseClient
      .from("projects")
      .select("title, description, scene_name, project_key, saved_at_unix, owner_id")
      .order("saved_at_unix", { ascending: false });

    // Admins see all projects; regular users see only their own
    if (!isAdmin) {
      query.eq("owner_id", currentUser.id);
    }

    const { data, error } = await query;

    if (loadingProjects) loadingProjects.style.display = "none";

    if (error) {
      console.error("Error loading projects:", error);
      if (noProjectsMsg) {
        noProjectsMsg.textContent    = "Failed to load projects.";
        noProjectsMsg.style.display  = "block";
      }
      return;
    }

    if (!data || data.length === 0) {
      if (noProjectsMsg) {
        noProjectsMsg.textContent   = "No projects found.";
        noProjectsMsg.style.display = "block";
      }
      return;
    }

    data.forEach((project) => {
      const title       = project.title       || "Untitled Project";
      const description = project.description || "No description provided.";
      const sceneName   = project.scene_name  || "Unknown scene";
      const savedAt     = project.saved_at_unix
        ? new Date(project.saved_at_unix * 1000).toLocaleString()
        : "Unknown date";

      const card = document.createElement("article");
      card.className = "project-card";
      card.innerHTML = `
        <div class="project-top">
          <div class="project-avatar">${getInitials(title)}</div>
          <div>
            <div class="project-title">${escapeHtml(title)}</div>
            <div class="project-meta">${escapeHtml(sceneName)}</div>
          </div>
        </div>
        <div class="project-desc">${escapeHtml(description)}</div>
        <div class="project-footer">
          <span class="status-tag in-progress">Saved from Unity</span>
          <small>${escapeHtml(savedAt)}</small>
        </div>
      `;
      projectsList.appendChild(card);
    });
  }

  // ── Pending Admin Requests ─────────────────────────────────
  async function loadPendingRequests() {
    if (!requestsList || !isAdmin) return;

    Array.from(requestsList.children).forEach(child => {
      if (child.id !== "noRequestsMsg") child.remove();
    });

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, display_name, email")
      .eq("role", "pending_admin");

    if (error) {
      console.error("Error loading pending requests:", error.message);
      return;
    }

    if (!data || data.length === 0) {
      if (noRequestsMsg) noRequestsMsg.style.display = "block";
      return;
    }

    if (noRequestsMsg) noRequestsMsg.style.display = "none";

    data.forEach(user => {
      const card = document.createElement("div");
      card.className    = "request-card";
      card.dataset.userId = user.id;
      card.innerHTML = `
        <div class="request-info">
          <span class="request-name">${escapeHtml(user.display_name || "Unknown")}</span>
          <span class="request-email">${escapeHtml(user.email)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
          <span class="request-badge">Pending Admin</span>
          <div class="request-actions">
            <button class="btn-approve" data-id="${user.id}">Approve</button>
            <button class="btn-deny"    data-id="${user.id}">Deny</button>
          </div>
        </div>
      `;
      requestsList.appendChild(card);
    });

    // ── 5. Approve — now also has a confirmation dialog ───────
    requestsList.querySelectorAll(".btn-approve").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.id;
        if (!confirm("Grant admin access to this user? This cannot be undone without manual action.")) return;
        const { error } = await supabaseClient
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", userId);
        if (error) { alert("Failed to approve: " + error.message); return; }
        await loadPendingRequests();
      });
    });

    // Deny — reverts to regular user
    requestsList.querySelectorAll(".btn-deny").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.id;
        if (!confirm("Deny this admin request? The user will become a regular user.")) return;
        const { error } = await supabaseClient
          .from("profiles")
          .update({ role: "user" })
          .eq("id", userId);
        if (error) { alert("Failed to deny: " + error.message); return; }
        await loadPendingRequests();
      });
    });
  }

  // ── Personal Info Modal ────────────────────────────────────
  function openPersonalModal() {
    personalModalOverlay?.classList.add("show");
    closeAllPanels();
  }

  function closePersonalInfoModal() {
    personalModalOverlay?.classList.remove("show");
  }

  // ── 6. Save personal info — button disabled during save ────
  async function savePersonalInfo() {
    const newName     = piName?.value.trim();
    const newEmail    = piEmail?.value.trim();
    const newPassword = piPassword?.value.trim();
    const file        = piAvatar?.files?.[0];

    if (!newName || !newEmail) {
      alert("Please fill in name and email.");
      return;
    }

    // Disable button to prevent double-submit
    if (piSave) {
      piSave.disabled     = true;
      piSave.textContent  = "Saving…";
    }

    try {
      let avatarUrl = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || "";

      if (file) {
        const fileExt  = file.name.split(".").pop();
        const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage
          .from("avatars")
          .upload(filePath, file, { upsert: true, contentType: file.type });
        if (uploadError) { alert(uploadError.message); return; }
        const { data: publicUrlData } = supabaseClient.storage
          .from("avatars")
          .getPublicUrl(filePath);
        avatarUrl = publicUrlData.publicUrl;
      }

      const updatePayload = {
        email: newEmail,
        data:  { display_name: newName, avatar_url: avatarUrl },
      };
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
      // Always re-enable the button
      if (piSave) {
        piSave.disabled    = false;
        piSave.textContent = "Save";
      }
    }
  }

  // ── Unity message bridge ───────────────────────────────────
  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "UNITY_READY")         sendSessionToUnity();
    if (data.type === "request-fullscreen") {
      unityFrame?.requestFullscreen?.().catch(() => {});
    }
  });

  // ── Boot ───────────────────────────────────────────────────
  const userOk = await loadCurrentUserInfo();
  if (!userOk) return;

  await loadProjects();
  await loadPendingRequests();

  if (typeof feather !== "undefined") feather.replace();

  // ── 4. setInterval guarded by unityFrame existence ─────────
  if (unityFrame) {
    setInterval(() => {
      storeSessionForUnity();
      sendSessionToUnity();
    }, 30_000);
  }

  // ── Event listeners ────────────────────────────────────────
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

  personalInfoBtn?.addEventListener("click",  openPersonalModal);
  closePersonalModal?.addEventListener("click", closePersonalInfoModal);

  personalModalOverlay?.addEventListener("click", (e) => {
    if (e.target === personalModalOverlay) closePersonalInfoModal();
  });

  piSave?.addEventListener("click", savePersonalInfo);

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    clearLocalSession();
    window.location.href = "Sign.html";
  }

  piLogout?.addEventListener("click", handleSignOut);

  logoutItem?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to logout?")) await handleSignOut();
  });

  refreshProjectsBtn?.addEventListener("click", loadProjects);
  refreshRequestsBtn?.addEventListener("click", loadPendingRequests);

  openFullUnityBtn?.addEventListener("click", () => {
    unityFrame?.contentWindow?.postMessage({ type: "request-fullscreen" }, "*");
  });

});