<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = htmlspecialchars(strip_tags(trim($_POST['name'])));
    $email = filter_var(trim($_POST['email']), FILTER_SANITIZE_EMAIL);
    $message_content = htmlspecialchars(strip_tags(trim($_POST['message'])));

    if (empty($name) || empty($email) || empty($message_content)) {
        header("Location: contact.html?status=error&reason=empty");
        exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        header("Location: contact.html?status=error&reason=invalid_email");
        exit;
    }

    $api_key = getenv('RESEND_API_KEY'); // Set this in Render environment variables

    $body = "=== ARCHITECTPRO CONTACT FORM ===\n\n";
    $body .= "Name: $name\n";
    $body .= "Email: $email\n";
    $body .= "Date: " . date("Y-m-d H:i:s") . " UTC\n\n";
    $body .= "Message:\n$message_content\n\n";
    $body .= "=== END OF MESSAGE ===\n";

    $payload = json_encode([
        "from"    => "ArchitectPro Contact <onboarding@resend.dev>", // change after verifying domain
        "to"      => ["christenvienlolo3@gmail.com"],
        "subject" => "ArchitectPro - New Message from $name",
        "text"    => $body,
        "reply_to" => "$name <$email>"
    ]);

    $ch = curl_init("https://api.resend.com/emails");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $api_key",
        "Content-Type: application/json"
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code === 200 || $http_code === 201) {
        header("Location: contact.html?status=success");
    } else {
        header("Location: contact.html?status=error&reason=mail_failed");
    }
    exit;
}
?>