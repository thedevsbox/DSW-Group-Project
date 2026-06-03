<?php
require 'vendor/autoload.php';
require 'supabase.php';

session_start();

if (empty($_SESSION['pending_email'])) {
    header('Location: index.html');
    exit;
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$email = $_SESSION['pending_email'];
$error = '';

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if (!hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'] ?? '')) {
        die('Invalid request.');
    }

    $otp_input = trim($_POST['otp'] ?? '');

    if ($otp_input === '' || strlen($otp_input) !== 6 || !ctype_digit($otp_input)) {
        $error = 'Please enter a valid 6-digit code.';
    } else {
        $result = supabase(
            'GET',
            '/rest/v1/profiles?email=eq.' . rawurlencode($email) . '&select=id,email,otp,otp_expires_at,otp_attempts,is_verified,role'
        );

        if ($result['code'] !== 200 || empty($result['body'])) {
            $error = 'User not found. <a href="register.php">Register again</a>';
        } else {
            $user = $result['body'][0];
            $attempts = (int)($user['otp_attempts'] ?? 0);

            if (!empty($user['is_verified'])) {
                $_SESSION['pending_email'] = '';
                header('Location: index.html?verified=1');
                exit;
            }

            if (!empty($user['otp_expires_at']) && strtotime($user['otp_expires_at']) < time()) {
                $error = 'This code has expired. <a href="register.php">Request a new one</a>.';
            } elseif ($attempts >= 5) {
                $error = 'Too many failed attempts. Please <a href="register.php">request a new code</a>.';
            } else {
                if ((string)($user['otp'] ?? '') !== $otp_input) {
                    supabase('PATCH', '/rest/v1/profiles?email=eq.' . rawurlencode($email), [
                        'otp_attempts' => $attempts + 1,
                    ]);

                    $remaining = max(0, 4 - $attempts);
                    $error = "Incorrect code. You have {$remaining} attempt(s) remaining.";
                } else {
                    $updateProfile = supabase('PATCH', '/rest/v1/profiles?email=eq.' . rawurlencode($email), [
                        'is_verified'    => true,
                        'otp'            => null,
                        'otp_expires_at' => null,
                        'otp_attempts'   => 0,
                    ]);

                    if (!in_array($updateProfile['code'], [200, 204], true)) {
                        $error = 'Could not verify profile: ' . h(json_encode($updateProfile['body']));
                    } else {
                        $userId = $user['id'] ?? '';

                        if ($userId !== '') {
                            supabase('PUT', '/auth/v1/admin/users/' . rawurlencode($userId), [
                                'email_confirm' => true,
                            ]);
                        }

                        unset($_SESSION['pending_email']);
                        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

                        header('Location: index.html?verified=1');
                        exit;
                    }
                }
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArchitectPro – Verify Email</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      width: 100%;
      min-height: 100%;
      overflow-x: hidden;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: #0a0a0a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      padding: 1rem;
      animation: fadeInPage 1.2s ease-in-out;
    }

    @keyframes fadeInPage {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    #bg-video {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      z-index: -1;
      pointer-events: none;
    }

    .video-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.72);
      z-index: 0;
    }

    .modal-content {
      position: relative;
      z-index: 1;
      background: #1a1a1a;
      border-radius: 28px;
      width: 100%;
      max-width: 420px;
      padding: 2rem;
      border: 1px solid #2a2a2a;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.8),
        0 0 0 1px rgba(255, 255, 255, 0.05);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .modal-header h2 {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #fff, #aaa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .close-btn {
      background: transparent;
      border: none;
      font-size: 2.2rem;
      color: #aaa;
      cursor: pointer;
      line-height: 1;
      border-radius: 8px;
      transition: color 0.15s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover { color: #fff; }

    .email-hint {
      font-size: 0.92rem;
      color: #888;
      margin-bottom: 1.75rem;
      line-height: 1.5;
    }

    .email-hint strong {
      color: #ccc;
      font-weight: 500;
    }

    .otp-wrapper {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .otp-wrapper input {
      width: 52px;
      height: 60px;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 12px;
      color: #ffffff;
      outline: none;
      transition: border 0.2s, box-shadow 0.2s, background 0.2s;
      caret-color: transparent;
    }

    .otp-wrapper input:focus {
      border-color: #5a5a5a;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.07);
      background: #2e2e2e;
    }

    .otp-wrapper input.filled {
      border-color: #555;
      background: #2e2e2e;
    }

    #otpHidden { display: none; }

    button[type="submit"] {
      width: 100%;
      padding: 1rem;
      background: linear-gradient(145deg, #2d2d2d, #1f1f1f);
      border: 1px solid #3d3d3d;
      border-radius: 40px;
      font-size: 1.15rem;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      color: #ffffff;
      cursor: pointer;
      letter-spacing: 1px;
      transition: background 0.2s, border-color 0.2s, transform 0.1s;
    }

    button[type="submit"]:hover {
      background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
      border-color: #5a5a5a;
    }

    button[type="submit"]:active { transform: scale(0.98); }

    .modal-footer {
      margin-top: 1.5rem;
      text-align: center;
      color: #aaa;
      font-size: 0.92rem;
    }

    .modal-footer a {
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      border-bottom: 1px solid #555;
      padding-bottom: 2px;
    }

    .modal-footer a:hover { color: #ccc; border-bottom-color: #ccc; }

    .error-msg {
      background: rgba(255, 80, 80, 0.1);
      border: 1px solid rgba(255, 100, 100, 0.25);
      color: #ffaaaa;
      border-radius: 12px;
      padding: 0.85rem 1rem;
      font-size: 0.92rem;
      margin-bottom: 1.25rem;
      text-align: center;
      word-break: break-word;
    }

    .error-msg a { color: #ffcccc; }
  </style>
</head>
<body>

  <video id="bg-video" autoplay muted loop playsinline>
    <source src="assets/BackgroundVideo.mp4" type="video/mp4">
  </video>
  <div class="video-overlay"></div>

  <div class="modal-content">
    <div class="modal-header">
      <h2>Verify Email</h2>
      <a href="register.php" class="close-btn">&times;</a>
    </div>

    <p class="email-hint">
      A 6-digit code was sent to <strong><?= h($email) ?></strong>. Enter it below.
    </p>

    <?php if ($error): ?>
      <div class="error-msg"><?= $error ?></div>
    <?php endif; ?>

    <form method="POST" novalidate id="verifyForm">
      <input type="hidden" name="csrf_token" value="<?= h($_SESSION['csrf_token']) ?>">
      <input type="hidden" name="otp" id="otpHidden">

      <div class="otp-wrapper">
        <input type="text" maxlength="1" inputmode="numeric" pattern="\d" class="otp-digit" autofocus>
        <input type="text" maxlength="1" inputmode="numeric" pattern="\d" class="otp-digit">
        <input type="text" maxlength="1" inputmode="numeric" pattern="\d" class="otp-digit">
        <input type="text" maxlength="1" inputmode="numeric" pattern="\d" class="otp-digit">
        <input type="text" maxlength="1" inputmode="numeric" pattern="\d" class="otp-digit">
        <input type="text" maxlength="1" inputmode="numeric" pattern="\d" class="otp-digit">
      </div>

      <button type="submit">Verify Email</button>
    </form>

    <div class="modal-footer">
      <a href="register.php">← Use a different email</a>
    </div>
  </div>

  <script>
    const digits = document.querySelectorAll('.otp-digit');
    const hidden = document.getElementById('otpHidden');
    const form   = document.getElementById('verifyForm');

    function syncHidden() {
      hidden.value = Array.from(digits).map(d => d.value).join('');
    }

    digits.forEach((input, i) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '');
        if (input.value && i < digits.length - 1) {
          digits[i + 1].focus();
        }
        input.classList.toggle('filled', input.value !== '');
        syncHidden();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          digits[i - 1].focus();
          digits[i - 1].value = '';
          digits[i - 1].classList.remove('filled');
          syncHidden();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        pasted.split('').forEach((ch, j) => {
          if (digits[j]) {
            digits[j].value = ch;
            digits[j].classList.add('filled');
          }
        });
        const next = Math.min(pasted.length, digits.length - 1);
        digits[next].focus();
        syncHidden();
      });
    });

    form.addEventListener('submit', (e) => {
      syncHidden();
      if (hidden.value.length !== 6) {
        e.preventDefault();
        digits[0].focus();
      }
    });
  </script>
</body>
</html>