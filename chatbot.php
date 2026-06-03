<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();

$apiKey = getenv('GEMINI_API_KEY'); 

header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);
$userMessage = trim($data["message"] ?? "");

if (empty($userMessage)) {
    echo json_encode(["error" => "No message provided"]);
    exit;
}

// Initialize or get chat history
if (!isset($_SESSION['architectpro_chat'])) {
    $_SESSION['architectpro_chat'] = [];
}

// Add user message to history
$_SESSION['architectpro_chat'][] = ["role" => "user", "parts" => [["text" => $userMessage]]];

// Keep last 10 messages for context
if (count($_SESSION['architectpro_chat']) > 10) {
    $_SESSION['architectpro_chat'] = array_slice($_SESSION['architectpro_chat'], -10);
}

// System prompt about ArchitectPro
$systemPrompt = [
    "role" => "user",
    "parts" => [[
        "text" => "You are an AI assistant for ArchitectPro. Here's what you need to know:

**ArchitectPro Platform:**
- Helps architects visualize construction plans in 3D
- Simulates environmental forces: wind, earthquakes, storms
- Two plans: Standard (visualization only) and Premium (full simulations + third-person + drone mode)

**Web Features:**
- Import and edit construction plans with drawing tools
- Team information and contact section for feedback/bug reports

**Unity App Features:**
- 3D construction modeling
- Weather and natural disaster simulations
- Three navigation modes: free, third-person character, drone

**Tech Stack:**
- Google Login API (implemented)
- Gemini API (you)
- SQL database with full CRUD operations

**Your Guidelines:**
1. Answer questions about ArchitectPro accurately
2. Help with architectural/engineering questions (foundations, materials, structural integrity)
3. Answer general questions normally
4. Be honest about limitations
5. Keep responses clear and helpful

Now respond to: " . $userMessage
    ]]
];

// Build payload with system prompt and history
$payload = [
    "contents" => array_merge([$systemPrompt], $_SESSION['architectpro_chat'])
];

$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $apiKey;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
//curl_close($ch);

if ($response === false) {
    echo json_encode(["error" => "Connection error"]);
    exit;
}

$responseData = json_decode($response, true);

if (isset($responseData['error'])) {
    echo json_encode(["error" => $responseData['error']['message']]);
    exit;
}

$botReply = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? "Sorry, I couldn't process that.";

// Save AI response to history
$_SESSION['architectpro_chat'][] = ["role" => "model", "parts" => [["text" => $botReply]]];

echo json_encode(["reply" => $botReply]);
?>