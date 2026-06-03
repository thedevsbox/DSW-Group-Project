<?php
require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

function supabase(string $method, string $path, array $body = []): array
{
    $baseUrl    = trim($_ENV['SUPABASE_URL'] ?? getenv('SUPABASE_URL') ?? '');
    $serviceKey = trim($_ENV['SUPABASE_SERVICE_ROLE_KEY'] ?? getenv('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    if ($baseUrl === '' || $serviceKey === '') {
        return [
            'code' => 500,
            'body' => [
                'message' => 'Supabase env vars not set.',
            ],
        ];
    }

    $url = rtrim($baseUrl, '/') . $path;

    $headers = [
        'Content-Type: application/json',
        'apikey: ' . $serviceKey,
        'Authorization: Bearer ' . $serviceKey,
        'Prefer: return=representation',
    ];

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST   => strtoupper($method),
        CURLOPT_HTTPHEADER      => $headers,
        CURLOPT_TIMEOUT         => 20,
    ]);

    if (!empty($body)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    $response = curl_exec($ch);

    if ($response === false) {
        $curlError = curl_error($ch);
        curl_close($ch);

        return [
            'code' => 500,
            'body' => [
                'message' => 'cURL error',
                'detail'  => $curlError,
            ],
        ];
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($response, true);

    return [
        'code' => $httpCode,
        'body' => $decoded ?? [
            'raw' => $response,
        ],
    ];
}