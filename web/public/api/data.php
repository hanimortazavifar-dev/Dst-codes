<?php
/**
 * The dashboard Excel file. The browser parses it; this endpoint only decides who may read it.
 *
 * GET                     (signed in) → the .xlsx bytes; headers X-Data-Updated, X-Data-Source, X-Data-Stale
 * GET ?meta=1             (admin)     → { source, url, updatedAt, uploadedBy, size, cacheMinutes }
 * POST multipart "file"   (admin)     → replaces the uploaded file
 * POST { action: "source", url }  (admin) → sets the online source ("" = use the uploaded file)
 */

require __DIR__ . '/_lib.php';

function settings(): array
{
    global $LS_CONFIG;
    $saved = read_json_file('settings.json', []);
    return ['excel_url' => array_key_exists('excel_url', $saved) ? (string) $saved['excel_url'] : (string) $LS_CONFIG['excel_url']];
}

function upload_meta(): array
{
    return read_json_file('upload.json', []);
}

function looks_like_xlsx(string $head): bool
{
    return strncmp($head, "PK\x03\x04", 4) === 0;
}

function send_xlsx(string $path, string $source, string $updated, bool $stale): void
{
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Length: ' . filesize($path));
    header('X-Data-Source: ' . $source);
    header('X-Data-Updated: ' . $updated);
    header('X-Data-Stale: ' . ($stale ? '1' : '0'));
    readfile($path);
    exit;
}

/** Downloads the online file into the cache. Returns an error message, or null on success. */
function fetch_remote(string $url): ?string
{
    global $LS_CONFIG;
    ensure_storage();
    $tmp = LS_CACHE_FILE . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $max = (int) $LS_CONFIG['max_bytes'];

    if (function_exists('curl_init')) {
        $out = fopen($tmp, 'wb');
        $ch = curl_init($url);
        $size = 0;
        curl_setopt_array($ch, [
            CURLOPT_FILE => $out,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'LUBESTATION/1.0',
            CURLOPT_NOPROGRESS => false,
            CURLOPT_PROGRESSFUNCTION => function ($ch, $total, $now) use ($max, &$size) {
                $size = $now;
                return $now > $max ? 1 : 0; // non-zero aborts
            },
        ]);
        $ok = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        fclose($out);
        if (!$ok || $code >= 400) {
            @unlink($tmp);
            return $size > $max ? 'فایل آنلاین از حد مجاز بزرگ‌تر است.' : "دریافت فایل آنلاین ناموفق بود ({$code} {$err}).";
        }
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => 30, 'follow_location' => 1, 'max_redirects' => 3, 'user_agent' => 'LUBESTATION/1.0']]);
        $data = @file_get_contents($url, false, $ctx, 0, $max + 1);
        if ($data === false) {
            return 'دریافت فایل آنلاین ناموفق بود.';
        }
        if (strlen($data) > $max) {
            return 'فایل آنلاین از حد مجاز بزرگ‌تر است.';
        }
        file_put_contents($tmp, $data);
    }

    $head = (string) file_get_contents($tmp, false, null, 0, 4);
    if (!looks_like_xlsx($head)) {
        @unlink($tmp);
        return 'فایل دریافت‌شده از آدرس آنلاین، فایل اکسل (xlsx) نیست. آدرس باید مستقیم به خود فایل باشد.';
    }
    if (!rename($tmp, LS_CACHE_FILE)) {
        @unlink($tmp);
        return 'ذخیرهٔ فایل روی سرور انجام نشد.';
    }
    return null;
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET' && isset($_GET['meta'])) {
    require_user('admin');
    $url = settings()['excel_url'];
    $meta = upload_meta();
    send_json([
        'source' => $url !== '' ? 'url' : 'upload',
        'url' => $url,
        'updatedAt' => $url !== '' ? (is_file(LS_CACHE_FILE) ? gmdate('c', (int) filemtime(LS_CACHE_FILE)) : null) : ($meta['updatedAt'] ?? null),
        'uploadedBy' => $meta['uploadedBy'] ?? null,
        'hasUpload' => is_file(LS_DATA_FILE),
        'cacheMinutes' => (int) $LS_CONFIG['cache_minutes'],
    ]);
}

if ($method === 'GET') {
    require_user();
    $url = settings()['excel_url'];
    if ($url !== '') {
        $fresh = is_file(LS_CACHE_FILE) && time() - (int) filemtime(LS_CACHE_FILE) < (int) $LS_CONFIG['cache_minutes'] * 60;
        $error = $fresh ? null : fetch_remote($url);
        clearstatcache();
        if (is_file(LS_CACHE_FILE)) {
            send_xlsx(LS_CACHE_FILE, 'url', gmdate('c', (int) filemtime(LS_CACHE_FILE)), $error !== null);
        }
        fail($error ?? 'فایل آنلاین هنوز دریافت نشده است.', 502);
    }
    if (!is_file(LS_DATA_FILE)) {
        fail('هنوز فایل داده‌ای بارگذاری نشده است.', 404);
    }
    send_xlsx(LS_DATA_FILE, 'upload', upload_meta()['updatedAt'] ?? gmdate('c', (int) filemtime(LS_DATA_FILE)), false);
}

if ($method === 'POST' && isset($_FILES['file'])) {
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'lubestation') {
        fail('درخواست نامعتبر است.', 403);
    }
    $me = require_user('admin');
    $file = $_FILES['file'];
    $err = is_array($file['error']) ? -1 : (int) $file['error'];
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
        fail('حجم فایل از حد مجاز سرور بیشتر است.');
    }
    if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        fail('بارگذاری فایل انجام نشد.');
    }
    if ($file['size'] > (int) $LS_CONFIG['max_bytes']) {
        fail('حجم فایل از حد مجاز بیشتر است.');
    }
    if (!preg_match('/\.xlsx$/i', (string) $file['name']) || !looks_like_xlsx((string) file_get_contents($file['tmp_name'], false, null, 0, 4))) {
        fail('فقط فایل اکسل با پسوند xlsx پذیرفته می‌شود.');
    }
    ensure_storage();
    $tmp = LS_DATA_FILE . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (!move_uploaded_file($file['tmp_name'], $tmp) || !rename($tmp, LS_DATA_FILE)) {
        @unlink($tmp);
        fail('ذخیرهٔ فایل روی سرور انجام نشد.', 500);
    }
    $meta = ['updatedAt' => gmdate('c'), 'uploadedBy' => $me['name'] !== '' ? $me['name'] : $me['phone'], 'size' => (int) $file['size']];
    write_json_file('upload.json', $meta);
    send_json(['ok' => true] + $meta);
}

// A multipart POST without the file means PHP dropped it for exceeding post_max_size.
if ($method === 'POST' && stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/') === 0) {
    fail('حجم فایل از حد مجاز سرور بیشتر است.');
}

$body = require_post();
require_user('admin');

if (($body['action'] ?? '') === 'source') {
    $url = trim((string) ($body['url'] ?? ''));
    if ($url !== '') {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (!filter_var($url, FILTER_VALIDATE_URL) || !in_array($scheme, ['http', 'https'], true)) {
            fail('آدرس باید با http:// یا https:// شروع شود.');
        }
    }
    write_json_file('settings.json', ['excel_url' => $url]);
    @unlink(LS_CACHE_FILE);
    if ($url !== '') {
        $error = fetch_remote($url);
        if ($error !== null) {
            fail('آدرس ذخیره شد، اما ' . $error, 502);
        }
    }
    send_json(['ok' => true]);
}

fail('درخواست نامعتبر است.');
