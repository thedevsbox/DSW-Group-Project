document.addEventListener("DOMContentLoaded", async () => {
  // =========================
  // Supabase Config
  // =========================
  const SUPABASE_URL = "https://klxtstltmqwsaqccekfm.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9RkYRGEhC9VyU2AuF8Z-NQ_C529J20s";

  const { createClient } = window.supabase;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =========================
  // Helpers
  // =========================
  function getInitials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function getFallbackName(email = "") {
    return email ? email.split("@")[0] : "User";
  }

  // =========================
  // DOM Elements
  // =========================
  const welcomeTitle = document.getElementById("welcomeTitle");
  const accountAvatar = document.getElementById("accountAvatar");
  const accountName = document.getElementById("accountName");
  const accountEmail = document.getElementById("accountEmail");
  const welcomeAvatar = document.getElementById("welcomeAvatar");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");
  const menuPanel = document.getElementById("menuPanel");
  const closeMenu = document.getElementById("closeMenu");
  const accountBtn = document.getElementById("accountBtn");
  const accountPanel = document.getElementById("accountPanel");
  const closePanel = document.getElementById("closePanel");
  const logoutItem = document.querySelector(".logout-item");
  const personalInfoBtn = document.getElementById("personalInfoBtn");

  const personalModalOverlay = document.getElementById("personalModalOverlay");
  const closePersonalModal = document.getElementById("closePersonalModal");
  const piName = document.getElementById("piName");
  const piEmail = document.getElementById("piEmail");
  const piPassword = document.getElementById("piPassword");
  const piAvatar = document.getElementById("piAvatar");
  const piSave = document.getElementById("piSave");
  const piLogout = document.getElementById("piLogout");
  const piDelete = document.getElementById("piDelete");

  const usersTableBody = document.getElementById("usersTableBody");
  const noUsersMsg = document.getElementById("noUsersMsg");
  const loadingUsers = document.getElementById("loadingUsers");
  const refreshBtn = document.getElementById("refreshUsersBtn");

  let currentUser = null;
  let currentProfile = null;

  // =========================
  // Auth & Role Check
  // =========================
  async function checkAdminAccess() {
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
      alert("Unable to verify admin privileges.");
      window.location.href = "home.html";
      return false;
    }

    if (profile.role !== "admin") {
      alert("Access denied. Admins only.");
      window.location.href = "home.html";
      return false;
    }

    currentProfile = profile;
    return true;
  }

  // =========================
  // Load current user info
  // =========================
  async function loadCurrentUserInfo() {
    const displayName = currentProfile?.display_name || getFallbackName(currentUser.email);
    const email = currentProfile?.email || currentUser.email;
    const avatarUrl = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || "";

    welcomeTitle.textContent = `Welcome, ${displayName} (Admin)`;
    accountName.textContent = displayName;
    accountEmail.textContent = email;

    setAvatar(welcomeAvatar, displayName, avatarUrl);
    setAvatar(accountAvatar, displayName, avatarUrl);

    if (piName) piName.value = displayName;
    if (piEmail) piEmail.value = email;
    if (piPassword) piPassword.value = "";
  }

  function setAvatar(el, name, avatarUrl) {
    if (!el) return;
    if (avatarUrl) {
      el.innerHTML = `<img src="${avatarUrl}" alt="${name}">`;
    } else {
      el.textContent = getInitials(name);
    }
  }

  // =========================
  // Load users table
  // =========================
  async function loadUsers() {
    if (!usersTableBody) return;

    loadingUsers.style.display = "block";
    noUsersMsg.style.display = "none";
    usersTableBody.innerHTML = "";

    const { data: profiles, error } = await supabaseClient
      .from("profiles")
      .select("id, email, display_name, role, avatar_url")
      .order("created_at", { ascending: false });

    loadingUsers.style.display = "none";

    if (error) {
      console.error("Error loading users:", error.message);
      noUsersMsg.textContent = "Failed to load users.";
      noUsersMsg.style.display = "block";
      return;
    }

    if (!profiles || profiles.length === 0) {
      noUsersMsg.style.display = "block";
      return;
    }

    profiles.forEach((profile) => {
      const row = document.createElement("tr");

      // Avatar cell
      const avatarCell = document.createElement("td");
      avatarCell.className = "user-avatar-cell";
      const avatarDiv = document.createElement("div");
      avatarDiv.className = "user-avatar-small";
      if (profile.avatar_url) {
        avatarDiv.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.display_name || ''}">`;
      } else {
        avatarDiv.textContent = getInitials(profile.display_name || profile.email);
      }
      avatarCell.appendChild(avatarDiv);
      row.appendChild(avatarCell);

      // Display name
      const nameCell = document.createElement("td");
      nameCell.textContent = profile.display_name || profile.email.split("@")[0];
      row.appendChild(nameCell);

      // Email
      const emailCell = document.createElement("td");
      emailCell.textContent = profile.email;
      row.appendChild(emailCell);

      // Role badge
      const roleCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `role-badge ${profile.role}`;
      badge.textContent = profile.role || "user";
      roleCell.appendChild(badge);
      row.appendChild(roleCell);

      // Actions
      const actionsCell = document.createElement("td");
      actionsCell.className = "action-buttons";

      // Delete button (disabled for self)
      const isSelf = profile.id === currentUser.id;
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "icon-btn-small delete";
      deleteBtn.innerHTML = '<i data-feather="trash-2"></i>';
      deleteBtn.setAttribute("aria-label", "Delete user");
      deleteBtn.title = isSelf ? "Cannot delete your own account" : "Delete user";
      deleteBtn.disabled = isSelf;

      if (!isSelf) {
        deleteBtn.addEventListener("click", () => deleteUser(profile.id, profile.email));
      }

      actionsCell.appendChild(deleteBtn);
      row.appendChild(actionsCell);

      usersTableBody.appendChild(row);
    });

    // Re-run feather icons for new elements
    if (window.feather) feather.replace();
  }

  // =========================
  // Delete user function
  // =========================
async function deleteUser(userId, userEmail) {
  if (!confirm(`Are you sure you want to delete the user "${userEmail}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !sessionData?.session?.access_token) {
      alert("No active session.");
      return;
    }

    const accessToken = sessionData.session.access_token;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId }),
    });

    let result = {};
    try {
      result = await response.json();
    } catch {
      result = { error: "Invalid response from server" };
    }

    if (!response.ok) {
      console.error("Delete user error:", result);
      alert(result.error || "Failed to delete user.");
      return;
    }

    await loadUsers();
    alert("User deleted successfully.");
  } catch (err) {
    console.error("Delete user exception:", err);
    alert("An unexpected error occurred.");
  }
}

  // =========================
  // Panels logic (same as home)
  // =========================
  function openPanel(panel) {
    closeAllPanels();
    panel.classList.add("active");
    overlay.classList.add("active");
  }

  function closeAllPanels() {
    menuPanel.classList.remove("active");
    accountPanel.classList.remove("active");
    overlay.classList.remove("active");
  }

  if (menuBtn) menuBtn.addEventListener("click", () => openPanel(menuPanel));
  if (accountBtn) accountBtn.addEventListener("click", () => openPanel(accountPanel));
  if (closeMenu) closeMenu.addEventListener("click", closeAllPanels);
  if (closePanel) closePanel.addEventListener("click", closeAllPanels);
  if (overlay) overlay.addEventListener("click", closeAllPanels);

  // =========================
  // Personal Info Modal
  // =========================
  function openPersonalModal() {
    if (!personalModalOverlay) return;
    personalModalOverlay.classList.add("show");
    closeAllPanels();
  }

  function closePersonalInfoModal() {
    personalModalOverlay.classList.remove("show");
  }

  if (personalInfoBtn) personalInfoBtn.addEventListener("click", openPersonalModal);
  if (closePersonalModal) closePersonalModal.addEventListener("click", closePersonalInfoModal);
  if (personalModalOverlay) {
    personalModalOverlay.addEventListener("click", (e) => {
      if (e.target === personalModalOverlay) closePersonalInfoModal();
    });
  }

  // Save personal info (same as home)
  if (piSave) {
    piSave.addEventListener("click", async () => {
      const newName = piName.value.trim();
      const newEmail = piEmail.value.trim();
      const newPassword = piPassword.value.trim();
      const file = piAvatar?.files?.[0];

      if (!newName || !newEmail) {
        alert("Please fill in name and email.");
        return;
      }

      try {
        let avatarUrl = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || "";

        if (file) {
          const fileExt = file.name.split(".").pop();
          const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabaseClient.storage
            .from("avatars")
            .upload(filePath, file, { upsert: true, contentType: file.type });

          if (uploadError) {
            alert(uploadError.message);
            return;
          }

          const { data: publicUrlData } = supabaseClient.storage
            .from("avatars")
            .getPublicUrl(filePath);
          avatarUrl = publicUrlData.publicUrl;
        }

        const updatePayload = {
          email: newEmail,
          data: { display_name: newName, avatar_url: avatarUrl },
        };
        if (newPassword) updatePayload.password = newPassword;

        const { error: authUpdateError } = await supabaseClient.auth.updateUser(updatePayload);
        if (authUpdateError) {
          alert(authUpdateError.message);
          return;
        }

        const { error: profileUpdateError } = await supabaseClient
          .from("profiles")
          .update({ display_name: newName, email: newEmail, avatar_url: avatarUrl })
          .eq("id", currentUser.id);

        if (profileUpdateError) {
          alert(profileUpdateError.message);
          return;
        }

        // Reload info
        const { data: refreshedProfile } = await supabaseClient
          .from("profiles")
          .select("display_name, email, role, avatar_url")
          .eq("id", currentUser.id)
          .single();
        if (refreshedProfile) currentProfile = refreshedProfile;

        await loadCurrentUserInfo();
        closePersonalInfoModal();
        alert("Information updated successfully.");
      } catch (err) {
        console.error(err);
        alert("Error while updating information.");
      }
    });
  }

  // Logout
  if (piLogout) piLogout.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "Sign.html";
  });
  if (logoutItem) logoutItem.addEventListener("click", async () => {
    if (confirm("Are you sure you want to logout?")) {
      await supabaseClient.auth.signOut();
      window.location.href = "Sign.html";
    }
  });

  // Delete own account (admin can delete themselves, but we'll redirect to home)
if (piDelete) {
  piDelete.addEventListener("click", async () => {
    const confirmDelete = confirm("Do you really want to delete your admin account?");
    if (!confirmDelete) return;

    try {
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        alert("No active session found.");
        return;
      }

      const accessToken = sessionData.session.access_token;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId: currentUser.id }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(result.error || "Failed to delete account.");
        return;
      }

      await supabaseClient.auth.signOut();
      window.location.href = "Sign.html";
    } catch (err) {
      console.error(err);
      alert("Error while deleting account.");
    }
  });
}

  // Refresh button
  if (refreshBtn) refreshBtn.addEventListener("click", loadUsers);

  // =========================
  // Init
  // =========================
  const isAdmin = await checkAdminAccess();
  if (!isAdmin) return;

  await loadCurrentUserInfo();
  await loadUsers();

  // Feather icons update
  if (window.feather) feather.replace();

    // =========================
  // AI CHATBOT LOGIC
  // =========================
  const aiFab = document.getElementById('aiFab');
  const chatWindow = document.getElementById('chatWindow');
  const chatClose = document.getElementById('chatClose');
  const chatSend = document.getElementById('chatSend');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');

  if (aiFab) {
    aiFab.addEventListener('click', () => {
      chatWindow.classList.toggle('open');
      if (chatWindow.classList.contains('open')) {
        chatInput.focus();
        // Re-run feather icons if chat window was just opened
        if (window.feather) feather.replace();
      }
    });
  }

  if (chatClose) {
    chatClose.addEventListener('click', () => {
      chatWindow.classList.remove('open');
    });
  }

  function scrollChatToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // User message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
    chatMessages.appendChild(userMsg);
    chatInput.value = '';
    scrollChatToBottom();

    // Bot typing indicator
    const botMsg = document.createElement('div');
    botMsg.className = 'chat-msg bot';
    botMsg.innerHTML = `<div class="msg-bubble">Typing...</div>`;
    chatMessages.appendChild(botMsg);
    scrollChatToBottom();

    try {
      const response = await fetch("https://architectpro.onrender.com/chatbot.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await response.json();

      if (data.reply) {
        botMsg.innerHTML = `<div class="msg-bubble">${data.reply}</div>`;
      } else if (data.error) {
        botMsg.innerHTML = `<div class="msg-bubble"> Error: ${data.error}</div>`;
      } else {
        botMsg.innerHTML = `<div class="msg-bubble"> No response from AI</div>`;
      }
    } catch (error) {
      console.error("Chat fetch error:", error);
      botMsg.innerHTML = `<div class="msg-bubble"> Connection failed.</div>`;
    }

    scrollChatToBottom();
    if (window.feather) feather.replace();
  }

  if (chatSend) {
    chatSend.addEventListener('click', sendChatMessage);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }
  const tasksList = document.getElementById("tasksList");
const tasksEmptyMsg = document.getElementById("tasksEmptyMsg");
const taskTitleInput = document.getElementById("taskTitle");
const taskDueDateInput = document.getElementById("taskDueDate");
const createTaskBtn = document.getElementById("createTaskBtn");

async function loadTasks() {
  if (!tasksList) return;

  const { data: tasks, error } = await supabaseClient
    .from("tasks")
    .select("id, title, due_date, is_completed, completed_at, created_at")
    .order("due_date", { ascending: true });

  tasksList.innerHTML = "";
  tasksEmptyMsg.style.display = "none";

  if (error) {
    console.error("Error loading tasks:", error.message);
    tasksEmptyMsg.textContent = "Failed to load tasks.";
    tasksEmptyMsg.style.display = "block";
    return;
  }

  if (!tasks || tasks.length === 0) {
    tasksEmptyMsg.style.display = "block";
    return;
  }

  const now = new Date();

  tasks.forEach((task) => {
    const dueDate = new Date(`${task.due_date}T23:59:59`);
    const overdue = !task.is_completed && dueDate < now;

    const row = document.createElement("div");
    row.className = "task-item";

    const left = document.createElement("div");
    left.className = "task-left";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = `Due date: ${task.due_date}`;

    const status = document.createElement("div");
    status.className = "task-status";

    if (task.is_completed) {
      status.classList.add("completed");
      status.innerHTML = `<i data-feather="check-circle"></i> Completed`;
    } else if (overdue) {
      status.classList.add("overdue");
      status.innerHTML = `<i data-feather="alert-circle"></i> Overdue`;
    } else {
      status.classList.add("on-time");
      status.innerHTML = `<i data-feather="check-circle"></i> In time`;
    }

    left.appendChild(title);
    left.appendChild(meta);
    left.appendChild(status);

    const right = document.createElement("div");
    right.className = "task-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-ghost";
    toggleBtn.textContent = task.is_completed ? "Undo" : "Complete";
    toggleBtn.addEventListener("click", async () => {
      await toggleTaskComplete(task.id, !task.is_completed);
    });

    right.appendChild(toggleBtn);

    row.appendChild(left);
    row.appendChild(right);

    tasksList.appendChild(row);
  });

  if (window.feather) feather.replace();
}

async function createTask() {
  const title = taskTitleInput?.value.trim();
  const dueDate = taskDueDateInput?.value;

  if (!title || !dueDate) {
    alert("Please enter a task title and due date.");
    return;
  }

  const { error } = await supabaseClient.rpc("create_task", {
    p_title: title,
    p_due_date: dueDate,
  });

  if (error) {
    alert(error.message);
    return;
  }

  taskTitleInput.value = "";
  taskDueDateInput.value = "";
  await loadTasks();
}

async function toggleTaskComplete(taskId, completed) {
  const { error } = await supabaseClient.rpc("set_task_completed", {
    p_task_id: taskId,
    p_completed: completed,
  });

  if (error) {
    alert(error.message);
    return;
  }

  await loadTasks();
}

if (createTaskBtn) {
  createTaskBtn.addEventListener("click", createTask);
}
  await loadTasks();
});
