<?php
/**
 * Shared helpers for the LUBESTATION API: JSON responses, file storage, sessions and users.
 * Works on PHP 7.3+ shared hosting with no database: data lives in api/storage/ (web access denied).
 */

declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

$LS_CONFIG = require __DIR__ . '/config.php';

define('LS_STORAGE', rtrim($LS_CONFIG['storage_dir'], '/\\'));
define('LS_DATA_FILE', LS_STORAGE . '/data.xlsx');
define('LS_CACHE_FILE', LS_STORAGE . '/remote-cache.xlsx');

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function send_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): void
{
    send_json(['error' => $message], $status);
}

function ensure_storage(): void
{
    if (!is_dir(LS_STORAGE) && !@mkdir(LS_STORAGE, 0750, true)) {
        fail('پوشهٔ ذخیره‌سازی سرور ساخته نشد. دسترسی نوشتن پوشهٔ api/storage را بررسی کنید.', 500);
    }
    if (!is_writable(LS_STORAGE)) {
        fail('پوشهٔ api/storage روی سرور قابل نوشتن نیست.', 500);
    }
}

function read_json_file(string $name, $default)
{
    $path = LS_STORAGE . '/' . $name;
    if (!is_file($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : $default;
}

/** Atomic write: a temp file renamed over the target, so readers never see half a file. */
function write_json_file(string $name, $data): void
{
    ensure_storage();
    $path = LS_STORAGE . '/' . $name;
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false || !rename($tmp, $path)) {
        @unlink($tmp);
        fail('ذخیرهٔ اطلاعات روی سرور انجام نشد.', 500);
    }
}

function is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https' || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function start_session(): void
{
    global $LS_CONFIG;
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ensure_storage();
    $dir = LS_STORAGE . '/sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    // Own session folder: shared hosts may clean the global one aggressively or share it.
    if (is_dir($dir) && is_writable($dir)) {
        session_save_path($dir);
    }
    $lifetime = (int) $LS_CONFIG['session_hours'] * 3600;
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    ini_set('session.use_strict_mode', '1');
    session_name('ls_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    if (isset($_SESSION['seen']) && time() - (int) $_SESSION['seen'] > $lifetime) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['seen'] = time();
}

/**
 * State-changing requests must be POST and carry the X-Requested-With header the site sends.
 * A cross-site page cannot add that header without a CORS preflight, which this API never allows.
 */
function require_post(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        fail('روش درخواست نامعتبر است.', 405);
    }
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'lubestation') {
        fail('درخواست نامعتبر است.', 403);
    }
    $type = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
    if (stripos($type, 'application/json') === 0) {
        $body = json_decode((string) file_get_contents('php://input'), true);
        return is_array($body) ? $body : [];
    }
    return $_POST;
}

// --- users ----------------------------------------------------------------------------------

function load_users(): array
{
    $data = read_json_file('users.json', ['users' => []]);
    return isset($data['users']) && is_array($data['users']) ? $data['users'] : [];
}

function save_users(array $users): void
{
    write_json_file('users.json', ['users' => array_values($users)]);
}

function public_user(array $u): array
{
    return ['id' => $u['id'], 'phone' => $u['phone'], 'name' => $u['name'] ?? '', 'role' => $u['role']];
}

function normalize_phone($phone): string
{
    $phone = strtr((string) $phone, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ]);
    return preg_replace('/[\s\-]/', '', $phone) ?? '';
}

function valid_phone(string $phone): bool
{
    return (bool) preg_match('/^09\d{9}$/', $phone);
}

function check_new_password($password): string
{
    $password = (string) $password;
    $length = function_exists('mb_strlen') ? mb_strlen($password, 'UTF-8') : strlen($password);
    if ($length < 8) {
        fail('رمز عبور باید دست‌کم ۸ کاراکتر باشد.');
    }
    return $password;
}

function valid_role($role): string
{
    return in_array($role, ['admin', 'viewer'], true) ? $role : 'viewer';
}

/** The signed-in user, re-read from storage so role changes and deletions apply immediately. */
function current_user(): ?array
{
    start_session();
    $id = $_SESSION['uid'] ?? null;
    if (!$id) {
        return null;
    }
    foreach (load_users() as $u) {
        if ($u['id'] === $id) {
            return $u;
        }
    }
    unset($_SESSION['uid']);
    return null;
}

/** $role 'viewer' admits every signed-in user; 'admin' only admins. */
function require_user(string $role = 'viewer'): array
{
    $user = current_user();
    if (!$user) {
        fail('ابتدا وارد سامانه شوید.', 401);
    }
    if ($role === 'admin' && $user['role'] !== 'admin') {
        fail('شما مجوز این کار را ندارید.', 403);
    }
    return $user;
}

function sign_in(array $user): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = $user['id'];
}

// --- login throttling -----------------------------------------------------------------------

function client_key(): string
{
    return hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
}

/** Blocks an address for 15 minutes after 8 failed logins. */
function throttle_check(): void
{
    $rows = read_json_file('login-attempts.json', []);
    $row = $rows[client_key()] ?? null;
    if ($row && $row['count'] >= 8 && time() - $row['first'] < 900) {
        fail('تعداد تلاش‌های ناموفق زیاد است. ۱۵ دقیقهٔ دیگر دوباره امتحان کنید.', 429);
    }
}

function throttle_record(bool $success): void
{
    $rows = read_json_file('login-attempts.json', []);
    $now = time();
    foreach ($rows as $k => $r) {
        if ($now - $r['first'] >= 900) {
            unset($rows[$k]);
        }
    }
    $key = client_key();
    if ($success) {
        unset($rows[$key]);
    } else {
        $row = $rows[$key] ?? ['count' => 0, 'first' => $now];
        $row['count']++;
        $rows[$key] = $row;
    }
    write_json_file('login-attempts.json', $rows);
}
