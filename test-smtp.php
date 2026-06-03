<?php
/**
 * ArchitectPro – SMTP Diagnostic Script
 * ─────────────────────────────────────
 * Uploadez ce fichier à la racine de votre projet,
 * accédez-y via navigateur ou CLI, puis SUPPRIMEZ-LE après le test.
 *
 * Usage CLI : php test-smtp.php
 * Usage web : https://votre-domaine.com/test-smtp.php?secret=architectpro_debug
 */

// ── Protection minimale ─────────────────────────────────────────────────────
if (PHP_SAPI !== 'cli') {
    $secret = $_GET['secret'] ?? '';
    if ($secret !== 'architectpro_debug') {
        http_response_code(403);
        die('Access denied. Add ?secret=architectpro_debug to the URL.');
    }
}

require __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// ── Chargement du .env ──────────────────────────────────────────────────────
if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
    echo "✅ .env loaded\n";
} else {
    echo "⚠️  No .env file found – using getenv() fallback\n";
}

// ── Lecture des variables ────────────────────────────────────────────────────
$smtpUser = trim($_ENV['MAIL_USERNAME'] ?? getenv('MAIL_USERNAME') ?? '');
$smtpPass = str_replace(' ', '', trim($_ENV['MAIL_PASSWORD'] ?? getenv('MAIL_PASSWORD') ?? ''));
$fromName = trim($_ENV['MAIL_FROM_NAME'] ?? getenv('MAIL_FROM_NAME') ?? 'ArchitectPro');

// ── Affichage des valeurs lues (masquage partiel du mot de passe) ────────────
echo "\n── Configuration lue ──────────────────────────────────────────\n";
echo "MAIL_USERNAME  : " . ($smtpUser ?: '(vide !)') . "\n";
echo "MAIL_PASSWORD  : " . (
    $smtpPass
        ? substr($smtpPass, 0, 4) . str_repeat('*', max(0, strlen($smtpPass) - 4)) . ' (' . strlen($smtpPass) . ' chars)'
        : '(vide !)'
) . "\n";
echo "MAIL_FROM_NAME : " . ($fromName ?: '(vide !)') . "\n";

if ($smtpUser === '' || $smtpPass === '') {
    echo "\n❌ FATAL: MAIL_USERNAME ou MAIL_PASSWORD est vide. Vérifiez votre .env.\n";
    exit(1);
}

if (strlen($smtpPass) !== 16) {
    echo "\n⚠️  ATTENTION: L'App Password Gmail doit faire exactement 16 caractères. ";
    echo "Le vôtre en a " . strlen($smtpPass) . ".\n";
    echo "   Vérifiez que vous avez bien copié l'App Password depuis myaccount.google.com\n";
}

// ── Test de connexion SMTP ───────────────────────────────────────────────────
echo "\n── Test connexion SMTP (smtp.gmail.com:465) ───────────────────\n";

$mail = new PHPMailer(true);

try {
    // Active le debug SMTP complet
    $mail->SMTPDebug  = SMTP::DEBUG_SERVER;
    $mail->Debugoutput = function ($str, $level) {
        echo "   [SMTP] " . trim($str) . "\n";
    };

    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpUser;
    $mail->Password   = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->Timeout    = 15;

    $mail->setFrom($smtpUser, $fromName);
    $mail->addAddress($smtpUser); // Envoi à soi-même pour le test
    $mail->Subject = 'ArchitectPro – SMTP Test';
    $mail->isHTML(false);
    $mail->Body    = "SMTP test successful. Sent at: " . date('Y-m-d H:i:s') . " UTC";

    $mail->send();

    echo "\n✅ SUCCESS: Email de test envoyé à {$smtpUser}\n";
    echo "   Vérifiez votre boîte de réception (et les spams).\n";

} catch (Exception $e) {
    echo "\n❌ ÉCHEC de l'envoi\n";
    echo "   PHPMailer ErrorInfo : " . $mail->ErrorInfo . "\n";
    echo "   Exception message   : " . $e->getMessage() . "\n";

    echo "\n── Diagnostic automatique ─────────────────────────────────────\n";

    $err = strtolower($mail->ErrorInfo . ' ' . $e->getMessage());

    if (str_contains($err, 'username and password not accepted') || str_contains($err, '535')) {
        echo "❌ CAUSE : Authentification refusée par Gmail.\n";
        echo "   Solutions :\n";
        echo "   1. Vérifiez que la 2FA est ACTIVÉE sur le compte Google.\n";
        echo "   2. Générez un NOUVEL App Password sur :\n";
        echo "      https://myaccount.google.com/apppasswords\n";
        echo "   3. Choisissez 'Mail' + 'Other (Custom name)' → copiez les 16 caractères SANS espaces.\n";
        echo "   4. Mettez à jour MAIL_PASSWORD dans votre .env.\n";

    } elseif (str_contains($err, 'connection') || str_contains($err, 'could not connect') || str_contains($err, 'timed out')) {
        echo "❌ CAUSE : Impossible de joindre smtp.gmail.com:465.\n";
        echo "   Solutions :\n";
        echo "   1. Votre hébergeur bloque peut-être le port 465 (outbound SMTP).\n";
        echo "      → Testez avec le port 587 + STARTTLS (voir ci-dessous).\n";
        echo "   2. Si vous êtes sur Render / Railway / Fly.io :\n";
        echo "      → Certains plans bloquent SMTP sortant. Utilisez un service tiers\n";
        echo "        comme Resend (https://resend.com) ou Mailgun à la place.\n";

    } elseif (str_contains($err, 'less secure') || str_contains($err, 'application-specific')) {
        echo "❌ CAUSE : Google exige un App Password.\n";
        echo "   → Activez la 2FA puis générez un App Password :\n";
        echo "      https://myaccount.google.com/apppasswords\n";

    } elseif (str_contains($err, 'ssl') || str_contains($err, 'tls')) {
        echo "❌ CAUSE : Problème de certificat SSL/TLS.\n";
        echo "   → Ajoutez ceci dans sendOtpEmail() de register.php :\n";
        echo "     \$mail->SMTPOptions = ['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]];\n";
        echo "   ⚠️  Seulement pour le diagnostic – à ne pas laisser en production.\n";

    } else {
        echo "❓ Cause inconnue. Lisez le log SMTP complet ci-dessus.\n";
    }

    // ── Test alternatif port 587 ─────────────────────────────────────────────
    echo "\n── Test alternatif : port 587 + STARTTLS ──────────────────────\n";

    $mail2 = new PHPMailer(true);
    $mail2->SMTPDebug   = SMTP::DEBUG_SERVER;
    $mail2->Debugoutput = function ($str, $level) {
        echo "   [SMTP587] " . trim($str) . "\n";
    };

    try {
        $mail2->isSMTP();
        $mail2->Host       = 'smtp.gmail.com';
        $mail2->SMTPAuth   = true;
        $mail2->Username   = $smtpUser;
        $mail2->Password   = $smtpPass;
        $mail2->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail2->Port       = 587;
        $mail2->Timeout    = 15;

        $mail2->setFrom($smtpUser, $fromName);
        $mail2->addAddress($smtpUser);
        $mail2->Subject = 'ArchitectPro – SMTP Test (port 587)';
        $mail2->isHTML(false);
        $mail2->Body    = "SMTP 587 test. Sent at: " . date('Y-m-d H:i:s') . " UTC";

        $mail2->send();
        echo "\n✅ SUCCESS sur le port 587 !\n";
        echo "   → Changez votre register.php pour utiliser :\n";
        echo "     \$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;\n";
        echo "     \$mail->Port = 587;\n";

    } catch (Exception $e2) {
        echo "\n❌ Port 587 aussi échoue : " . $mail2->ErrorInfo . "\n";
        echo "   → Votre hébergeur bloque probablement SMTP.\n";
        echo "   → Utilisez Resend (https://resend.com) avec l'API HTTP à la place.\n";
    }
}

echo "\n── Infos serveur ──────────────────────────────────────────────\n";
echo "PHP version     : " . PHP_VERSION . "\n";
echo "OpenSSL         : " . (defined('OPENSSL_VERSION_TEXT') ? OPENSSL_VERSION_TEXT : 'non disponible') . "\n";
echo "allow_url_fopen : " . (ini_get('allow_url_fopen') ? 'On' : 'Off') . "\n";

// Test réseau basique vers Gmail
$fp = @fsockopen('ssl://smtp.gmail.com', 465, $errno, $errstr, 5);
if ($fp) {
    echo "Port 465 ouvert : ✅ OUI\n";
    fclose($fp);
} else {
    echo "Port 465 ouvert : ❌ NON (errno={$errno} – {$errstr})\n";
    echo "   → Votre hébergeur bloque le port 465 sortant.\n";
}

$fp2 = @fsockopen('smtp.gmail.com', 587, $errno2, $errstr2, 5);
if ($fp2) {
    echo "Port 587 ouvert : ✅ OUI\n";
    fclose($fp2);
} else {
    echo "Port 587 ouvert : ❌ NON (errno={$errno2} – {$errstr2})\n";
}

echo "\n⚠️  IMPORTANT : Supprimez ce fichier (test-smtp.php) après le diagnostic !\n\n";