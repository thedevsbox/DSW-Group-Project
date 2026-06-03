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
  // DOM
  // =========================
  const welcomeTitle = document.getElementById("welcomeTitle");
  const accountAvatar = document.getElementById("accountAvatar");
  const accountName = document.getElementById("accountName");
  const accountEmail = document.getElementById("accountEmail");
  const welcomeAvatar = document.getElementById("welcomeAvatar");
const piAvatar = document.getElementById("piAvatar");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");
  const menuPanel = document.getElementById("menuPanel");
  const closeMenu = document.getElementById("closeMenu");
  const accountBtn = document.getElementById("accountBtn");
  const accountPanel = document.getElementById("accountPanel");
  const closePanel = document.getElementById("closePanel");
  const logoutItem = document.querySelector(".logout-item");
  const personalInfoBtn = document.getElementById("personalInfoBtn");

  const createBtn = document.getElementById("create-btn");
  const modalOverlay = document.getElementById("modal-overlay");
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");

  const personalModalOverlay = document.getElementById("personalModalOverlay");
  const closePersonalModal = document.getElementById("closePersonalModal");
  const piName = document.getElementById("piName");
  const piEmail = document.getElementById("piEmail");
  const piPassword = document.getElementById("piPassword");
  const piSave = document.getElementById("piSave");
  const piLogout = document.getElementById("piLogout");
  const piDelete = document.getElementById("piDelete");

  const projectsGrid = document.getElementById("projects-grid");

  let currentUser = null;
  let currentProfile = null;

  // =========================
  // Auth / Profile load
  // =========================
  async function loadCurrentUser() {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !userData?.user) {
      window.location.href = "Sign.html";
      return;
    }

    currentUser = userData.user;

const { data: profile, error: profileError } = await supabaseClient
  .from("profiles")
  .select("display_name, email, role, avatar_url")
  .eq("id", currentUser.id)
  .single();

    currentProfile = profile || null;
    if (profile?.role === 'pending_admin') {
      await supabaseClient.auth.signOut();
      window.location.href = 'Sign.html?pending=1';
      return;
    }

const displayName =
  profile?.display_name ||
  currentUser.user_metadata?.display_name ||
  getFallbackName(currentUser.email);

const email = profile?.email || currentUser.email || "";
const avatarUrl = profile?.avatar_url || currentUser.user_metadata?.avatar_url || "";

welcomeTitle.textContent = `Welcome back, ${displayName}`;
accountName.textContent = displayName;
accountEmail.textContent = email;

setAvatar(welcomeAvatar, displayName, avatarUrl);
setAvatar(accountAvatar, displayName, avatarUrl);

    if (piName) piName.value = displayName;
    if (piEmail) piEmail.value = email;
    if (piPassword) piPassword.value = "";

    if (profileError) {
      console.warn("Profile read error:", profileError.message);
    }
    
  }
piSave.addEventListener("click", async () => {
  const newName = piName.value.trim();
  const newEmail = piEmail.value.trim();
  const newPassword = piPassword.value.trim();
  const file = piAvatar.files[0];

  if (!newName || !newEmail) {
    alert("Please fill in name and email.");
    return;
  }

  let avatarUrl = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || "";

  if (file) {
    const fileExt = file.name.split(".").pop();
    const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

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
    data: {
      display_name: newName,
      avatar_url: avatarUrl,
    },
  };

  if (newPassword) {
    updatePayload.password = newPassword;
  }

  const { error: authUpdateError } = await supabaseClient.auth.updateUser(updatePayload);
  if (authUpdateError) {
    alert(authUpdateError.message);
    return;
  }

  const { error: profileUpdateError } = await supabaseClient
    .from("profiles")
    .update({
      display_name: newName,
      email: newEmail,
      avatar_url: avatarUrl,
    })
    .eq("id", currentUser.id);

  if (profileUpdateError) {
    alert(profileUpdateError.message);
    return;
  }

  await loadCurrentUser();
  closePersonalInfoModal();
  alert("Information updated successfully.");
});
  // =========================
  // Panels
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

  document.querySelectorAll(".menu-link").forEach((link) => {
    link.addEventListener("click", function () {
      document.querySelectorAll(".menu-link").forEach((l) => l.classList.remove("active"));
      this.classList.add("active");
      closeAllPanels();
    });
  });
function setAvatar(el, name, avatarUrl) {
  if (!el) return;

  if (avatarUrl) {
    el.innerHTML = `<img src="${avatarUrl}" alt="${name}">`;
  } else {
    el.textContent = getInitials(name);
  }
}
  // =========================
  // Personal info modal
  // =========================
  function openPersonalModal() {
    if (!personalModalOverlay) return;
    if (piName) piName.value = currentProfile?.display_name || currentUser?.user_metadata?.display_name || "";
    if (piEmail) piEmail.value = currentProfile?.email || currentUser?.email || "";
    if (piPassword) piPassword.value = "";
    personalModalOverlay.classList.add("show");
    closeAllPanels();
  }

  function closePersonalInfoModal() {
    if (!personalModalOverlay) return;
    personalModalOverlay.classList.remove("show");
  }

  if (personalInfoBtn) personalInfoBtn.addEventListener("click", openPersonalModal);
  if (closePersonalModal) closePersonalModal.addEventListener("click", closePersonalInfoModal);
  if (personalModalOverlay) {
    personalModalOverlay.addEventListener("click", (e) => {
      if (e.target === personalModalOverlay) closePersonalInfoModal();
    });
  }

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
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type,
          });

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
        data: {
          display_name: newName,
          avatar_url: avatarUrl,
        },
      };

      if (newPassword) {
        updatePayload.password = newPassword;
      }

      const { error: authUpdateError } = await supabaseClient.auth.updateUser(updatePayload);

      if (authUpdateError) {
        alert(authUpdateError.message);
        return;
      }

      const { error: profileUpdateError } = await supabaseClient
        .from("profiles")
        .update({
          display_name: newName,
          email: newEmail,
          avatar_url: avatarUrl,
        })
        .eq("id", currentUser.id);

      if (profileUpdateError) {
        alert(profileUpdateError.message);
        return;
      }

      await loadCurrentUser();
      closePersonalInfoModal();
      alert("Information updated successfully.");
    } catch (err) {
      console.error(err);
      alert("Error while updating information.");
    }
  });
}

  if (piLogout) {
    piLogout.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "Sign.html";
    });
  }

  if (piDelete) {
    piDelete.addEventListener("click", async () => {
      const confirmDelete = confirm("Do you really want to delete your account?");
      if (!confirmDelete) return;

      try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
          alert("No active session found.");
          return;
        }

        const response = await fetch("https://klxtstltmqwsaqccekfm.supabase.co/functions/v1/swift-processor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        });

        const result = await response.json();

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

  // =========================
  // Create project modal
  // =========================
  function closeModal() {
    modalOverlay.classList.remove("show");
    document.getElementById("input-name").value = "";
    document.getElementById("input-desc").value = "";
    document.getElementById("input-client").value = "";
  }

  if (createBtn) createBtn.addEventListener("click", () => modalOverlay.classList.add("show"));
  if (modalCancel) modalCancel.addEventListener("click", closeModal);

  if (modalOverlay) {
    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (modalConfirm) {
    modalConfirm.addEventListener("click", function () {
      const name = document.getElementById("input-name").value.trim();
      const desc = document.getElementById("input-desc").value.trim();
      const client = document.getElementById("input-client").value.trim();

      if (!name) {
        alert("Please enter a project name.");
        return;
      }

      const emptyMsg = document.getElementById("empty-msg");
      if (emptyMsg) emptyMsg.remove();

      const card = document.createElement("div");
      card.className = "proj-card";

      const imgBox = document.createElement("div");
      imgBox.className = "proj-card-img proj-card-placeholder";
      imgBox.innerHTML = "<span>No Image</span>";

      const body = document.createElement("div");
      body.className = "proj-card-body";
      body.innerHTML = `
        <div class="proj-card-title">${name}</div>
        <div class="proj-card-meta">${client || "No client"}</div>
        <div class="proj-card-desc">${desc || ""}</div>
      `;

      card.appendChild(imgBox);
      card.appendChild(body);
      projectsGrid.appendChild(card);

      closeModal();
    });
  }

  // =========================
  // Logout from account panel
  // =========================
  if (logoutItem) {
    logoutItem.addEventListener("click", async function () {
      if (confirm("Are you sure you want to logout?")) {
        await supabaseClient.auth.signOut();
        window.location.href = "Sign.html";
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

  // =========================
  // Init
  // =========================
  await loadCurrentUser();
  await loadTasks();
});

// ── AI CHAT WINDOW ──
const aiFab      = document.getElementById('aiFab');
const chatWindow = document.getElementById('chatWindow');
const chatClose  = document.getElementById('chatClose');
const chatSend   = document.getElementById('chatSend');
const chatInput  = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

aiFab.addEventListener('click', () => {
  chatWindow.classList.toggle('open');
  if (chatWindow.classList.contains('open')) chatInput.focus();
});

chatClose.addEventListener('click', () => chatWindow.classList.remove('open'));

// ✅ UPDATED FUNCTION (CONNECTED TO PHP)
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // 🧑 User message
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
  chatMessages.appendChild(userMsg);

  chatInput.value = '';
  scrollToBottom();

  // 🤖 Typing indicator
  const botMsg = document.createElement('div');
  botMsg.className = 'chat-msg bot';
  botMsg.innerHTML = `<div class="msg-bubble">Typing...</div>`;
  chatMessages.appendChild(botMsg);
  scrollToBottom();

  try {
    const response = await fetch("https://architectpro.onrender.com/chatbot.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    console.log("AI Response:", data);

    if (data.reply) {
      botMsg.innerHTML = `<div class="msg-bubble">${data.reply}</div>`;
    } else if (data.error) {
      botMsg.innerHTML = `<div class="msg-bubble"> Error: ${data.error}</div>`;
    } else {
      botMsg.innerHTML = `<div class="msg-bubble"> No response from AI</div>`;
    }
    
  } catch (error) {
    console.error("Fetch error:", error);
    botMsg.innerHTML = `<div class="msg-bubble"> Connection failed. Check console.</div>`;
  }
}

chatSend.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') sendMessage();
});

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── LOGOUT ──
/*document.querySelector('.logout-item').addEventListener('click', function () {
  if (confirm('Are you sure you want to logout?')) {
    window.location.href = 'index.html'; // change to your login/landing page
  }
});*/

function closeModal() {
  modalOverlay.classList.remove('show');
  document.getElementById('input-name').value  = '';
  document.getElementById('input-desc').value  = '';
  document.getElementById('input-client').value = '';
}