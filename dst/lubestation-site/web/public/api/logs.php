<?php
/**
 * Dispenser sales logs (the "لیست فروش" CSV each tank exports), one merged history per dealer.
 * The browser parses the CSV; this endpoint checks the rows, merges them and hands them out.
 *
 * GET                                                         (dealer-report access) → { logs: Log[] }
 * POST { action: "import", dealer, tank, rows: [[date, time, litres, code], …] }  (admin) → { added, total }
 * POST { action: "clear", dealer }                            (admin)
 * Log = { dealer, tank, updatedAt, uploadedBy, rows: [["2026-06-13", "08:48:51", 42.085, "1041"], …] }
 */

require __DIR__ . '/_lib.php';

const LOG_DIR = 'logs';
const LOG_MAX_ROWS = 20000;

function log_name(string $dealer): string
{
    return LOG_DIR . '/' . $dealer . '.json';
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    // Same rule as the dealer-report page: its users, or everyone when that page is public.
    $user = current_user();
    if (!in_array('dealers', effective_pages($user), true)) {
        $user ? fail('شما به گزارش نمایندگی‌ها دسترسی ندارید.', 403) : fail('ابتدا وارد سامانه شوید.', 401);
    }
    $logs = [];
    foreach (glob(LS_STORAGE . '/' . LOG_DIR . '/*.json') ?: [] as $file) {
        $log = read_json_file(LOG_DIR . '/' . basename($file), null);
        if (is_array($log) && isset($log['dealer'], $log['rows']) && is_array($log['rows'])) {
            $logs[] = $log;
        }
    }
    send_json(['logs' => $logs]);
}

$body = require_post();
$me = require_user('admin');
$action = $body['action'] ?? '';
$dealer = (string) ($body['dealer'] ?? '');
if (!preg_match('/^[a-z0-9-]{1,40}$/', $dealer)) {
    fail('نمایندگی نامعتبر است.');
}

if ($action === 'import') {
    $rows = $body['rows'] ?? null;
    if (!is_array($rows) || !$rows) {
        fail('فایل هیچ ردیف فروشی ندارد.');
    }
    if (count($rows) > LOG_MAX_ROWS) {
        fail('تعداد ردیف‌های فایل بیش از حد مجاز است.');
    }
    $clean = [];
    foreach ($rows as $r) {
        $r = is_array($r) ? array_values($r) : [];
        if (count($r) !== 4
            || !is_string($r[0]) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $r[0])
            || !is_string($r[1]) || !preg_match('/^\d{2}:\d{2}:\d{2}$/', $r[1])
            || !is_numeric($r[2])
            || !is_string($r[3]) || strlen($r[3]) > 32) {
            fail('قالب ردیف‌های فایل نامعتبر است.');
        }
        $clean[] = [$r[0], $r[1], round((float) $r[2], 3), trim($r[3])];
    }

    ensure_storage();
    if (!is_dir(LS_STORAGE . '/' . LOG_DIR) && !@mkdir(LS_STORAGE . '/' . LOG_DIR, 0750, true)) {
        fail('پوشهٔ ذخیره‌سازی سرور ساخته نشد.', 500);
    }
    // Lock per dealer so two uploads at once cannot drop each other's rows.
    $lock = fopen(LS_STORAGE . '/' . LOG_DIR . '/' . $dealer . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        fail('ذخیرهٔ اطلاعات روی سرور انجام نشد.', 500);
    }
    $old = read_json_file(log_name($dealer), []);
    $oldRows = isset($old['rows']) && is_array($old['rows']) ? $old['rows'] : [];

    // The key starts with date and time, so sorting it keeps the history in order.
    $merged = [];
    foreach (array_merge($oldRows, $clean) as $r) {
        $merged[$r[0] . ' ' . $r[1] . '|' . sprintf('%.3f', $r[2]) . '|' . $r[3]] = $r;
    }
    ksort($merged, SORT_STRING);

    $tank = trim((string) preg_replace('/[\x00-\x1f\x7f]/u', '', (string) ($body['tank'] ?? '')));
    $tank = function_exists('mb_substr') ? mb_substr($tank, 0, 80, 'UTF-8') : substr($tank, 0, 160);
    write_json_file(log_name($dealer), [
        'dealer' => $dealer,
        'tank' => $tank !== '' ? $tank : (string) ($old['tank'] ?? ''),
        'updatedAt' => gmdate('c'),
        'uploadedBy' => $me['name'] !== '' ? $me['name'] : $me['phone'],
        'rows' => array_values($merged),
    ]);
    flock($lock, LOCK_UN);
    send_json(['added' => count($merged) - count($oldRows), 'total' => count($merged)]);
}

if ($action === 'clear') {
    @unlink(LS_STORAGE . '/' . log_name($dealer));
    send_json(['ok' => true]);
}

fail('درخواست نامعتبر است.');
