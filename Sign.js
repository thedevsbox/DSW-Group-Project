document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Supabase Config
  // =========================
  const SUPABASE_URL = "https://klxtstltmqwsaqccekfm.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9RkYRGEhC9VyU2AuF8Z-NQ_C529J20s";
  const { createClient } = window.supabase;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =========================
  // Sounds
  // =========================
  const hoverSound = new Audio("assets/hover.wav");
  const clickSound = new Audio("assets/click.mp3");
  hoverSound.preload = "auto";
  clickSound.preload = "auto";
  hoverSound.volume = 0.35;
  clickSound.volume = 0.65;

  let userInteracted = false;
  let lastHoverTime = 0;
  const HOVER_COOLDOWN_MS = 50;

  document.addEventListener(
    "click",
    () => {
      userInteracted = true;
    },
    { once: true }
  );

  function playHover() {
    const now = Date.now();
    if (now - lastHoverTime < HOVER_COOLDOWN_MS) return;
    lastHoverTime = now;
    if (!userInteracted) return;
    try {
      hoverSound.currentTime = 0;
      hoverSound.play().catch(() => {});
    } catch (e) {}
  }

  function playClick() {
    try {
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
    } catch (e) {}
  }

  // =========================
  // DOM Elements
  // =========================
  const profilesContainer = document.getElementById("profiles");
  const modal = document.getElementById("modal");
  const closeModalBtn = document.getElementById("closeModal");
  const modalTitle = document.getElementById("modal-title");
  const submitBtn = document.getElementById("submitBtn");
  const authForm = document.getElementById("authForm");
  const loginFields = document.getElementById("loginFields");
  const registerFields = document.getElementById("registerFields");
  const toggleModeText = document.getElementById("toggleMode");

  const loginEmail = document.getElementById("login-username");
  const loginPassword = document.getElementById("login-password");
  const loginRoleSelect = document.getElementById("login-role");

  const regEmail = document.getElementById("reg-email");
  const regUsername = document.getElementById("reg-username");
  const regPassword = document.getElementById("reg-password");
  const regConfirm = document.getElementById("reg-confirm");
  const regRoleSelect = document.getElementById("reg-role");
  const roleHint = document.getElementById("roleHint");

  const forgotPasswordLink = document.getElementById("forgotPasswordLink");

  let currentMode = "login";
  let lastFocusedElement = null;
  let selectedProfileEmail = "";

  // =========================
  // Local Profiles Helpers
  // =========================
  function safeGetProfiles() {
    try {
      const raw = localStorage.getItem("ap_profiles");
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn("Invalid ap_profiles in localStorage, resetting.", err);
      localStorage.removeItem("ap_profiles");
      return [];
    }
  }

  function upsertLocalProfile(profile) {
    if (!profile?.email) return;

    const profiles = safeGetProfiles();
    const email = profile.email.toLowerCase();

    const normalized = {
      email,
      display_name: profile.display_name || email.split("@")[0],
      avatar_url: profile.avatar_url || "",
      role: profile.role || "user",
    };

    const index = profiles.findIndex(
      (p) => (p.email || "").toLowerCase() === email
    );

    if (index >= 0) {
      profiles[index] = { ...profiles[index], ...normalized };
    } else {
      profiles.push(normalized);
    }

    localStorage.setItem("ap_profiles", JSON.stringify(profiles));
  }

  // =========================
  // Pending Admin Waiting Screen
  // =========================
  function buildWaitingScreen() {
    const existing = document.getElementById("pendingOverlay");
    if (existing) return existing;

    const overlay = document.createElement("div");
    overlay.id = "pendingOverlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 1.5rem;
      font-family: inherit; text-align: center; padding: 2rem;
    `;
    overlay.innerHTML = `
      <div style="
        background: #111827;
        border: 1px solid #374151;
        border-radius: 1rem;
        padding: 2.5rem 3rem;
        max-width: 420px;
        width: 100%;
        box-shadow: 0 25px 60px rgba(0,0,0,0.6);
      ">
        <div style="font-size: 3.5rem; margin-bottom: 1rem; animation: spin 4s linear infinite; display:inline-block;">⏳</div>

        <h2 style="color:#f9fafb; font-size:1.4rem; margin:0 0 0.75rem;">
          Account Pending Approval
        </h2>

        <p style="color:#9ca3af; font-size:0.95rem; line-height:1.6; margin:0 0 1.5rem;">
          Your administrator account has been created and is
          <strong style="color:#fbbf24;">awaiting approval</strong>
          from an existing admin.<br><br>
          You'll be able to sign in once your request has been reviewed.
        </p>

        <div style="
          background:#1f2937;
          border-radius:0.5rem;
          padding:0.75rem 1rem;
          color:#6b7280;
          font-size:0.8rem;
          margin-bottom:1.5rem;
          text-align:left;
        ">
          <strong style="color:#9ca3af;">What happens next?</strong><br>
          An admin will approve or deny your request.<br>
          Check back later or contact your system administrator.
        </div>

        <button id="pendingSignOutBtn" style="
          background: #374151;
          color: #f9fafb;
          border: none;
          border-radius: 0.5rem;
          padding: 0.65rem 1.5rem;
          font-size: 0.9rem;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s;
        ">
          Sign Out
        </button>
      </div>

      <style>
        @keyframes spin {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(0deg); }
          50%  { transform: rotate(180deg); }
          75%  { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }
        #pendingSignOutBtn:hover { background: #4b5563 !important; }
      </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById("pendingSignOutBtn").addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      overlay.remove();
      authForm?.reset();
      loginEmail.readOnly = false;
      loadProfiles();
    });

    return overlay;
  }

  function showPendingScreen() {
    modal.style.display = "none";
    buildWaitingScreen();
  }

  // =========================
  // Helpers
  // =========================
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function redirectByRole(role) {
    if (role === "admin") {
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "home.html";
    }
  }

  function escapeHtml(text = "") {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // =========================
  // Forgot Password
  // =========================
  forgotPasswordLink?.addEventListener("click", (e) => {
    e.preventDefault();
    playClick();

    const forgotModal = document.getElementById("forgotModal");
    const forgotEmail = document.getElementById("forgot-email");
    const forgotMsg = document.getElementById("forgotMsg");
    const forgotSubmit = document.getElementById("forgotSubmitBtn");
    const closeForgot = document.getElementById("closeForgotModal");

    forgotEmail.value = loginEmail.value.trim();
    forgotMsg.style.display = "none";
    forgotSubmit.disabled = false;
    forgotSubmit.textContent = "Send Reset Link";
    forgotModal.style.display = "flex";

    closeForgot.onclick = () => {
      forgotModal.style.display = "none";
    };

    window.addEventListener(
      "click",
      (ev) => {
        if (ev.target === forgotModal) forgotModal.style.display = "none";
      },
      { once: true }
    );

    forgotSubmit.onclick = async () => {
      const email = forgotEmail.value.trim();

      if (!email || !validateEmail(email)) {
        forgotMsg.textContent = "Please enter a valid email address.";
        forgotMsg.className = "reset-message error";
        forgotMsg.style.display = "block";
        return;
      }

      forgotSubmit.disabled = true;
      forgotSubmit.textContent = "Sending…";

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/resetpassword.html",
      });

      if (error) {
        forgotMsg.textContent = "Error: " + error.message;
        forgotMsg.className = "reset-message error";
        forgotSubmit.disabled = false;
        forgotSubmit.textContent = "Send Reset Link";
      } else {
        forgotMsg.textContent = `Reset link sent to ${email}. Check your inbox.`;
        forgotMsg.className = "reset-message success";
        forgotSubmit.disabled = true;
      }

      forgotMsg.style.display = "block";
    };
  });

  // =========================
  // Load Profiles
  // =========================
  async function loadProfiles() {
    if (!profilesContainer) return;

    profilesContainer.innerHTML = `
      <div class="loading-animation">
        <video autoplay loop muted playsinline>
          <source src="assets/loading.webm" type="video/webm">
        </video>
      </div>
    `;

    const { data: { session } } = await supabaseClient.auth.getSession();

    const combined = new Map();

    const localProfiles = safeGetProfiles();
    localProfiles.forEach((p) => {
      if (!p?.email) return;
      combined.set(p.email.toLowerCase(), {
        email: p.email.toLowerCase(),
        display_name: p.display_name || p.email.split("@")[0],
        avatar_url: p.avatar_url || "",
        role: p.role || "user",
      });
    });

    if (session?.user?.id) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("email, display_name, avatar_url, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile?.email) {
        upsertLocalProfile(profile);

        combined.set(profile.email.toLowerCase(), {
          email: profile.email.toLowerCase(),
          display_name: profile.display_name || profile.email.split("@")[0],
          avatar_url: profile.avatar_url || "",
          role: profile.role || "user",
        });
      }
    }

    profilesContainer.innerHTML = "";

    for (const profile of combined.values()) {
      if (profile.role === "pending_admin") continue;

      const card = document.createElement("div");
      card.className = "profile-card";
      card.dataset.email = profile.email;

      const name = profile.display_name || profile.email.split("@")[0];
      const avatarHtml = profile.avatar_url
        ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}" class="profile-photo" />`
        : `<i class="fas fa-user-circle"></i>`;

      const roleLabel = profile.role === "admin" ? "Admin" : "User";
      const roleClass = profile.role === "admin" ? "role-badge admin" : "role-badge user";

      card.innerHTML = `
        <div class="avatar ${profile.avatar_url ? "has-image" : ""}">
          ${avatarHtml}
        </div>
        <span class="name">${escapeHtml(name)}</span>
        <span class="${roleClass}">${roleLabel}</span>
      `;

      card.addEventListener("mouseenter", playHover);
      card.addEventListener("click", () => {
        playClick();
        openModal("login", profile.email);
      });

      profilesContainer.appendChild(card);
    }

    const addUserCard = document.createElement("div");
    addUserCard.className = "profile-card add-user";
    addUserCard.innerHTML = `
      <div class="avatar large">
        <i class="fas fa-plus-circle"></i>
      </div>
      <span class="name">Add User</span>
      <span class="login-hint">New User</span>
    `;
    addUserCard.addEventListener("mouseenter", playHover);
    addUserCard.addEventListener("click", () => {
      playClick();
      openModal("register");
    });
    profilesContainer.appendChild(addUserCard);
  }

  // =========================
  // Modal UI
  // =========================
  function attachToggleEvent() {
    const switchToRegister = document.getElementById("switchToRegister");
    const switchToLogin = document.getElementById("switchToLogin");
    if (switchToRegister) switchToRegister.onclick = (e) => { e.preventDefault(); openModal("register"); };
    if (switchToLogin) switchToLogin.onclick = (e) => { e.preventDefault(); openModal("login"); };
  }

  function openModal(mode, email = "") {
    lastFocusedElement = document.activeElement;
    currentMode = mode;
    selectedProfileEmail = email.trim().toLowerCase();
    modal.style.display = "flex";

    if (mode === "login") {
      modalTitle.textContent = "Sign In";
      loginFields.style.display = "block";
      registerFields.style.display = "none";
      submitBtn.textContent = "Sign In";
      toggleModeText.innerHTML =
        `Don't have an account? <a href="#" id="switchToRegister">Create one</a>`;

      loginEmail.value = email;
      loginEmail.readOnly = !!email;
      loginPassword.value = "";
      loginRoleSelect.value = "user";
      loginPassword.focus();
    } else {
      modalTitle.textContent = "Sign Up";
      loginFields.style.display = "none";
      registerFields.style.display = "block";
      submitBtn.textContent = "Sign Up";
      toggleModeText.innerHTML =
        `Already have an account? <a href="#" id="switchToLogin">Sign In</a>`;

      loginEmail.readOnly = false;
      selectedProfileEmail = "";
      regEmail.value = "";
      regUsername.value = "";
      regPassword.value = "";
      regConfirm.value = "";
      regRoleSelect.value = "user";
      roleHint.style.display = "none";
      regEmail.focus();
    }

    attachToggleEvent();
  }

  regRoleSelect?.addEventListener("change", () => {
    roleHint.style.display = regRoleSelect.value === "admin" ? "block" : "none";
  });

  function closeModal() {
    modal.style.display = "none";
    authForm.reset();
    loginEmail.readOnly = false;
    selectedProfileEmail = "";
    roleHint.style.display = "none";
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  if (closeModalBtn) closeModalBtn.onclick = closeModal;
  window.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  // =========================
  // Auth Submit
  // =========================
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = currentMode === "login" ? "Signing in…" : "Signing up…";

    try {
      if (currentMode === "login") {
        const email = loginEmail.value.trim().toLowerCase();
        const password = loginPassword.value.trim();
        const selectedRole = loginRoleSelect.value;

        if (!email || !password) {
          alert("Please fill in all fields.");
          return;
        }

        if (selectedProfileEmail && email !== selectedProfileEmail) {
          alert("The email entered does not match the selected profile.");
          return;
        }

        const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }

        const { data: profileData, error: profileError } = await supabaseClient
          .from("profiles")
          .select("email, display_name, avatar_url, role")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profileError) {
          alert("Unable to load user profile.");
          return;
        }

        if (profileData?.email) {
          upsertLocalProfile(profileData);
        } else if (authData.user?.email) {
          upsertLocalProfile({
            email: authData.user.email,
            display_name: authData.user.email.split("@")[0],
            avatar_url: "",
            role: selectedRole || "user",
          });
        }

        const dbRole = profileData?.role || selectedRole || "user";

        if (dbRole === "pending_admin") {
          showPendingScreen();
          return;
        }

        if (selectedRole === "admin" && dbRole !== "admin") {
          await supabaseClient.auth.signOut();
          alert("You don't have administrator access.\nContact your administrator if you need access.");
          return;
        }

        loadProfiles();
        redirectByRole(dbRole);
      } else {
        const email = regEmail.value.trim();
        const username = regUsername.value.trim();
        const password = regPassword.value;
        const confirm = regConfirm.value;
        const role = regRoleSelect.value;

        if (!email || !username || !password || !confirm) {
          alert("Please fill in all fields.");
          return;
        }
        if (!validateEmail(email)) {
          alert("Invalid email address.");
          return;
        }
        if (password.length < 6) {
          alert("Password must be at least 6 characters.");
          return;
        }
        if (password !== confirm) {
          alert("Passwords do not match.");
          return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();

        upsertLocalProfile({
          email,
          display_name: username,
          avatar_url: "",
          role,
        });

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "register.php";

        [
          ["email", email],
          ["username", username],
          ["password", password],
          ["confirm", confirm],
          ["role", role],
          ["owner_id", session?.user?.id ?? ""],
          ["created_by", session?.user?.id ?? ""]
        ].forEach(([name, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = currentMode === "login" ? "Sign In" : "Sign Up";
    }
  });

  // =========================
  // Hover / Click on links
  // =========================
  document.addEventListener("mouseover", (e) => {
    if (e.target.matches?.("#switchToRegister, #switchToLogin, .modal-footer a")) playHover();
  });

  document.addEventListener("click", (e) => {
    if (e.target.matches?.("#switchToRegister, #switchToLogin, .modal-footer a")) playClick();
  });

  // =========================
  // Init
  // =========================
  loadProfiles();
});