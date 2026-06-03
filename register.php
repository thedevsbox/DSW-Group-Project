<?php
require 'vendor/autoload.php';
require 'supabase.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

session_start();

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$error = '';

function sendOtpEmail(string $email, string $otp): bool
{
    $mail = new PHPMailer(true);

    try {
        $smtpUser = trim($_ENV['MAIL_USERNAME'] ?? getenv('MAIL_USERNAME') ?? '');
        $smtpPass = trim($_ENV['MAIL_PASSWORD'] ?? getenv('MAIL_PASSWORD') ?? '');
        $fromName = trim($_ENV['MAIL_FROM_NAME'] ?? getenv('MAIL_FROM_NAME') ?? 'ArchitectPro');

        if ($smtpUser === '' || $smtpPass === '') {
            throw new Exception('SMTP credentials are missing.');
        }

        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = $smtpUser;
        $mail->Password   = $smtpPass;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;

        $mail->setFrom($smtpUser, $fromName);
        $mail->addAddress($email);

        $mail->Subject = 'Your ArchitectPro verification code';
        $mail->isHTML(false);
        $mail->Body =
            "Your one-time verification code is: {$otp}\n\n" .
            "It expires in 10 minutes.\n\n" .
            "If you did not create an ArchitectPro account, please ignore this email.";

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('Mailer error: ' . $mail->ErrorInfo . ' / ' . $e->getMessage());
        return false;
    }
}

function deleteAuthUser(string $userId): void
{
    if ($userId === '') {
        return;
    }
    supabase('DELETE', '/auth/v1/admin/users/' . rawurlencode($userId));
}

function deleteProfileById(string $userId): void
{
    if ($userId === '') {
        return;
    }
    supabase('DELETE', '/rest/v1/profiles?id=eq.' . rawurlencode($userId));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if (!empty($_POST['csrf_token']) && !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
        die("Invalid request.");
    }

    $email       = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
    $displayName = trim($_POST['username'] ?? '');
    $password    = $_POST['password'] ?? '';
    $confirm     = $_POST['confirm'] ?? '';
    $role        = $_POST['role'] ?? 'user';

    $ownerId     = trim($_POST['owner_id'] ?? '');
    $createdBy   = trim($_POST['created_by'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = "Invalid email address.";
    } elseif ($displayName === '') {
        $error = "Username is required.";
    } elseif (strlen($password) < 6) {
        $error = "Password must be at least 6 characters.";
    } elseif ($password !== $confirm) {
        $error = "Passwords do not match.";
    } elseif (!in_array($role, ['user', 'admin'], true)) {
        $error = "Invalid role.";
    }

    if ($error === '') {
        $check = supabase(
            'GET',
            '/rest/v1/profiles?email=eq.' . rawurlencode($email) . '&select=id,is_verified,role'
        );

        if ($check['code'] === 200 && !empty($check['body'])) {
            $existing = $check['body'][0];

            if (!empty($existing['is_verified'])) {
                $error = "This email is already registered. <a href='index.html'>Sign in here</a>";
            } else {
                $otp     = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                $expires = date('Y-m-d H:i:s', strtotime('+10 minutes'));

                $updateResult = supabase('PATCH', '/rest/v1/profiles?email=eq.' . rawurlencode($email), [
                    'otp'            => $otp,
                    'otp_expires_at' => $expires,
                    'otp_attempts'   => 0,
                    'is_verified'    => false,
                    'display_name'   => $displayName,
                ]);

                if (!in_array($updateResult['code'], [200, 204], true)) {
                    $error = "Could not update verification code: " . json_encode($updateResult['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } elseif (!sendOtpEmail($email, $otp)) {
                    $error = "Account updated, but the verification email could not be sent. Please check SMTP configuration.";
                } else {
                    $_SESSION['pending_email'] = $email;
                    $_SESSION['csrf_token']    = bin2hex(random_bytes(32));
                    header('Location: verify.php');
                    exit;
                }
            }
        } else {
            $savedRole = ($role === 'admin') ? 'pending_admin' : 'user';
            $otp       = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $expires   = date('Y-m-d H:i:s', strtotime('+10 minutes'));

            $authResult = supabase('POST', '/auth/v1/admin/users', [
                'email'         => $email,
                'password'      => $password,
                'email_confirm' => false,
                'user_metadata' => [
                    'display_name' => $displayName,
                    'role'         => $savedRole,
                ],
            ]);

            if (!in_array($authResult['code'], [200, 201], true)) {
                $error = "Auth creation failed (" . $authResult['code'] . "): " . json_encode($authResult['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                $userId = $authResult['body']['id'] ?? $authResult['body']['user']['id'] ?? '';

                if ($userId === '') {
                    $error = "Auth user created, but no user ID was returned: " . json_encode($authResult['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } else {
                    if ($ownerId === '') {
                        $ownerId = $userId;
                    }
                    if ($createdBy === '') {
                        $createdBy = $userId;
                    }

                    $profilePayload = [
                        'id'             => $userId,
                        'email'          => $email,
                        'display_name'   => $displayName,
                        'role'           => $savedRole,
                        'otp'            => $otp,
                        'otp_expires_at' => $expires,
                        'is_verified'    => false,
                        'otp_attempts'   => 0,
                        'owner_id'       => $ownerId,
                        'created_by'     => $createdBy,
                    ];

                    $profileResult = supabase('POST', '/rest/v1/profiles', $profilePayload);

                    if (in_array($profileResult['code'], [200, 201], true)) {
                        // OK
                    } elseif ($profileResult['code'] === 409) {
                        $profileResult = supabase('PATCH', '/rest/v1/profiles?id=eq.' . rawurlencode($userId), $profilePayload);
                    }

                    if (!in_array($profileResult['code'], [200, 201, 204], true)) {
                        deleteProfileById($userId);
                        deleteAuthUser($userId);
                        $error = "Profile setup failed (" . $profileResult['code'] . "): " . json_encode($profileResult['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    } elseif (!sendOtpEmail($email, $otp)) {
                        deleteProfileById($userId);
                        deleteAuthUser($userId);
                        $error = "Account created, but the verification email could not be sent. Please check SMTP configuration.";
                    } else {
                        $_SESSION['pending_email'] = $email;
                        $_SESSION['csrf_token']    = bin2hex(random_bytes(32));
                        header('Location: verify.php');
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
  <title>ArchitectPro – Register</title>
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
      max-width: 450px;
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
      margin-bottom: 2rem;
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
      transition: color 0.15s, background 0.15s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover { color: #fff; }

    .input-group {
      margin-bottom: 1.25rem;
      text-align: left;
    }

    .input-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #dddddd;
      font-size: 0.95rem;
    }

    .input-group input,
    .input-group select {
      width: 100%;
      padding: 0.9rem 1.2rem;
      background-color: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 12px;
      font-size: 1rem;
      color: #ffffff;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border 0.2s, box-shadow 0.2s, background 0.2s;
    }

    .input-group input:focus,
    .input-group select:focus {
      border-color: #5a5a5a;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
      background-color: #2e2e2e;
    }

    .input-group input::placeholder { color: #6a6a6a; }

    .select-wrapper {
      position: relative;
    }

    .select-wrapper select {
      appearance: none;
      padding-right: 2.8rem;
      cursor: pointer;
    }

    .select-wrapper select option {
      background-color: #1a1a1a;
      color: #ffffff;
    }

    .select-arrow {
      position: absolute;
      right: 1.1rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.75rem;
      color: #888;
      pointer-events: none;
    }

    .role-hint {
      margin-top: 0.6rem;
      font-size: 0.83rem;
      color: #a0c4ff;
      background: rgba(100, 160, 255, 0.08);
      border: 1px solid rgba(100, 160, 255, 0.2);
      border-radius: 8px;
      padding: 0.5rem 0.85rem;
      display: none;
      align-items: center;
      gap: 6px;
      line-height: 1.4;
    }

    .role-hint.visible { display: flex; }

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
      margin-top: 1rem;
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
      font-size: 0.95rem;
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
      <h2>Sign Up</h2>
      <a href="index.html" class="close-btn">&times;</a>
    </div>

    <?php if ($error): ?>
      <div class="error-msg"><?= $error ?></div>
    <?php endif; ?>

    <form method="POST" novalidate>
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token']) ?>">

      <div class="input-group">
        <label>Account Type</label>
        <div class="select-wrapper">
          <select name="role" id="roleSelect">
            <option value="user">Regular User</option>
            <option value="admin">Administrator (requires approval)</option>
          </select>
          <span class="select-arrow"><i class="fa fa-chevron-down"></i></span>
        </div>
        <div class="role-hint" id="roleHint">
          <i class="fa fa-info-circle"></i>
          Admin accounts require approval before access is granted.
        </div>
      </div>

      <div class="input-group">
        <label>Email</label>
        <input type="email" name="email" placeholder="example@email.com" required
               value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
      </div>

      <div class="input-group">
        <label>Username</label>
        <input type="text" name="username" placeholder="Choose a username" required
               value="<?= htmlspecialchars($_POST['username'] ?? '') ?>">
      </div>

      <div class="input-group">
        <label>Password</label>
        <input type="password" name="password" placeholder="Minimum 6 characters" required>
      </div>

      <div class="input-group">
        <label>Confirm Password</label>
        <input type="password" name="confirm" placeholder="Re-enter your password" required>
      </div>

      <button type="submit">Sign Up</button>
    </form>

    <div class="modal-footer">
      Already have an account? <a href="index.html">Sign In</a>
    </div>
  </div>

  <script>
    const roleSelect = document.getElementById('roleSelect');
    const roleHint   = document.getElementById('roleHint');

    roleSelect.addEventListener('change', () => {
      roleHint.classList.toggle('visible', roleSelect.value === 'admin');
    });
  </script>
</body>
</html>