<?php

declare(strict_types=1);

date_default_timezone_set('Europe/Minsk');

function respondJson(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cleanPostValue(string $key, int $maxLength = 2000): string
{
    $value = $_POST[$key] ?? '';

    if (!is_string($value)) {
        return '';
    }

    $value = trim($value);

    if ($value === '') {
        return '';
    }

    return function_exists('mb_substr')
        ? mb_substr($value, 0, $maxLength)
        : substr($value, 0, $maxLength);
}

function cleanServerValue(string $key, int $maxLength = 500): string
{
    $value = $_SERVER[$key] ?? '';

    if (!is_string($value)) {
        return '';
    }

    $value = trim($value);

    if ($value === '') {
        return '';
    }

    return function_exists('mb_substr')
        ? mb_substr($value, 0, $maxLength)
        : substr($value, 0, $maxLength);
}

function escapeHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function sendTelegramMessage(string $url, array $payload): array
{
    $encodedPayload = http_build_query($payload);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $encodedPayload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
            ],
        ]);

        $body = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        return [
            'body' => is_string($body) ? $body : '',
            'error' => $error ?: null,
            'status' => $status,
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $encodedPayload,
            'timeout' => 15,
            'ignore_errors' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $status = 0;

    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $headerLine) {
            if (preg_match('/\s(\d{3})\s/', $headerLine, $matches)) {
                $status = (int) $matches[1];
                break;
            }
        }
    }

    return [
        'body' => is_string($body) ? $body : '',
        'error' => $body === false ? 'Не удалось выполнить HTTP-запрос к Telegram Bot API.' : null,
        'status' => $status,
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respondJson(405, [
        'ok' => false,
        'message' => 'Разрешён только POST-запрос.',
    ]);
}

$configPath = __DIR__ . '/telegram-config.php';

if (!is_file($configPath)) {
    respondJson(500, [
        'ok' => false,
        'message' => 'Файл telegram-config.php не найден. Добавьте токен бота и chat id.',
    ]);
}

$config = require $configPath;

if (!is_array($config)) {
    respondJson(500, [
        'ok' => false,
        'message' => 'Файл telegram-config.php должен возвращать массив настроек.',
    ]);
}

$botToken = trim((string) ($config['telegram_bot_token'] ?? ''));
$chatId = trim((string) ($config['telegram_chat_id'] ?? ''));
$threadId = trim((string) ($config['telegram_thread_id'] ?? ''));

if ($botToken === '' || $chatId === '') {
    respondJson(500, [
        'ok' => false,
        'message' => 'Telegram не настроен: заполните telegram_bot_token и telegram_chat_id в telegram-config.php.',
    ]);
}

if (cleanPostValue('company', 255) !== '') {
    respondJson(200, [
        'ok' => true,
        'message' => 'Заявка отправлена. Мы скоро свяжемся с вами.',
    ]);
}

$name = cleanPostValue('name', 120);
$phone = cleanPostValue('phone', 80);
$car = cleanPostValue('car', 200);
$message = cleanPostValue('message', 2000);
$source = cleanPostValue('source', 120);
$pageUrl = cleanPostValue('page_url', 500);
$pageTitle = cleanPostValue('page_title', 200);
$ip = cleanServerValue('REMOTE_ADDR', 120);
$userAgent = cleanServerValue('HTTP_USER_AGENT', 300);

if ($name === '' || $phone === '') {
    respondJson(422, [
        'ok' => false,
        'message' => 'Заполните имя и телефон.',
    ]);
}

$lines = [
    '🚗 <b>Новая заявка с сайта</b>',
    '',
    '<b>Имя:</b> ' . escapeHtml($name),
    '<b>Телефон:</b> ' . escapeHtml($phone),
];

if ($car !== '') {
    $lines[] = '<b>Автомобиль:</b> ' . escapeHtml($car);
}

if ($message !== '') {
    $lines[] = '<b>Комментарий:</b> ' . escapeHtml($message);
}

if ($source !== '') {
    $lines[] = '<b>Источник:</b> ' . escapeHtml($source);
}

if ($pageTitle !== '') {
    $lines[] = '<b>Страница:</b> ' . escapeHtml($pageTitle);
}

if ($pageUrl !== '') {
    $lines[] = '<b>URL:</b> ' . escapeHtml($pageUrl);
}

if ($ip !== '') {
    $lines[] = '<b>IP:</b> <code>' . escapeHtml($ip) . '</code>';
}

if ($userAgent !== '') {
    $lines[] = '<b>User-Agent:</b> <code>' . escapeHtml($userAgent) . '</code>';
}

$lines[] = '<b>Время:</b> ' . date('d.m.Y H:i:s');

$payload = [
    'chat_id' => $chatId,
    'text' => implode("\n", $lines),
    'parse_mode' => 'HTML',
    'disable_web_page_preview' => 'true',
];

if ($threadId !== '') {
    $payload['message_thread_id'] = $threadId;
}

$telegramUrl = sprintf('https://api.telegram.org/bot%s/sendMessage', $botToken);
$telegramResponse = sendTelegramMessage($telegramUrl, $payload);
$decodedResponse = json_decode($telegramResponse['body'], true);
$telegramOk = is_array($decodedResponse) && !empty($decodedResponse['ok']);

if ($telegramResponse['error'] || !$telegramOk) {
    respondJson(502, [
        'ok' => false,
        'message' => 'Не удалось отправить заявку в Telegram. Проверьте токен, chat id и права бота.',
    ]);
}

respondJson(200, [
    'ok' => true,
    'message' => 'Заявка отправлена. Мы скоро свяжемся с вами.',
]);
