(async () => {
  // =========================
  // Supabase Config
  // =========================
  const SUPABASE_URL      = "https://klxtstltmqwsaqccekfm.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9RkYRGEhC9VyU2AuF8Z-NQ_C529J20s";
  const { createClient }  = window.supabase;
  const supabaseClient    = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =========================
  // DOM
  // =========================
  const resetForm   = document.getElementById("resetForm");
  const resetBtn    = document.getElementById("resetBtn");
  const resetMsg    = document.getElementById("resetMsg");
  const invalidState = document.getElementById("invalidState");

  // =========================
  // Helpers
  // =========================
  function showMsg(text, type = "success") {
    resetMsg.textContent = text;
    resetMsg.className = `reset-message ${type}`;
    resetMsg.style.display = "block";
  }

  function hideForm() {
    resetForm.style.display = "none";
    invalidState.style.display = "block";
  }

  // =========================
  // Validate session from reset link
  // Supabase v2 auto-exchanges the token in the URL hash
  // =========================
  let sessionValid = false;

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      sessionValid = true;
    }
  });

  // Give the client a moment to process the URL hash token
  await new Promise((resolve) => setTimeout(resolve, 600));

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    hideForm();
  }

  // =========================
  // Show/hide password toggle
  // =========================
  document.querySelectorAll(".toggle-pw").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const icon  = btn.querySelector("i");

      if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  });

  // =========================
  // Submit new password
  // =========================
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newPass     = document.getElementById("new-password").value.trim();
    const confirmPass = document.getElementById("confirm-password").value.trim();

    if (!newPass || !confirmPass) {
      showMsg("Please fill in both fields.", "error");
      return;
    }

    if (newPass.length < 6) {
      showMsg("Password must be at least 6 characters.", "error");
      return;
    }

    if (newPass !== confirmPass) {
      showMsg("Passwords do not match.", "error");
      return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = "Updating…";

    const { error } = await supabaseClient.auth.updateUser({ password: newPass });

    if (error) {
      showMsg("Error: " + error.message, "error");
      resetBtn.disabled = false;
      resetBtn.textContent = "Update Password";
    } else {
      showMsg("Password updated successfully! Redirecting…", "success");
      resetForm.querySelector("#new-password").value = "";
      resetForm.querySelector("#confirm-password").value = "";

      setTimeout(() => {
        window.location.href = "index.html";
      }, 2500);
    }
  });
})();