<?php
/**
 * GET                                   → { user: User|null, setupNeeded: bool }
 * POST { action: "login", phone, password }
 * POST { action: "logout" }
 * POST { action: "password", current, next }   (change own password)
 * POST { action: "setup", phone, name, password }  (only while no user exists: creates the first admin)
 */

require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $user = current_user();
    send_json(['user' => $user ? public_user($user) : null, 'setupNeeded' => !load_users()]);
}

$body = require_post();
$action = $body['action'] ?? '';

if ($action === 'login') {
    throttle_check();
    $phone = normalize_phone($body['phone'] ?? '');
    $password = (string) ($body['password'] ?? '');
    $found = null;
    foreach (load_users() as $u) {
        if ($u['phone'] === $phone) {
            $found = $u;
            break;
        }
    }
    // Hash anyway for unknown phones so response time does not reveal which phones exist.
    $hash = $found ? $found['hash'] : password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
    if (!password_verify($password, $hash) || !$found) {
        throttle_record(false);
        fail('شماره موبایل یا رمز عبور اشتباه است.', 401);
    }
    throttle_record(true);
    if (password_needs_rehash($found['hash'], PASSWORD_DEFAULT)) {
        $users = load_users();
        foreach ($users as &$u) {
            if ($u['id'] === $found['id']) {
                $u['hash'] = password_hash($password, PASSWORD_DEFAULT);
            }
        }
        unset($u);
        save_users($users);
    }
    sign_in($found);
    send_json(['user' => public_user($found)]);
}

if ($action === 'logout') {
    start_session();
    $_SESSION = [];
    session_destroy();
    send_json(['ok' => true]);
}

if ($action === 'password') {
    $me = require_user();
    if (!password_verify((string) ($body['current'] ?? ''), $me['hash'])) {
        fail('رمز فعلی اشتباه است.');
    }
    $next = check_new_password($body['next'] ?? '');
    $users = load_users();
    foreach ($users as &$u) {
        if ($u['id'] === $me['id']) {
            $u['hash'] = password_hash($next, PASSWORD_DEFAULT);
        }
    }
    unset($u);
    save_users($users);
    send_json(['ok' => true]);
}

if ($action === 'setup') {
    ensure_storage();
    // Lock so two simultaneous setup requests cannot both create an admin.
    $lock = fopen(LS_STORAGE . '/setup.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        fail('ذخیرهٔ اطلاعات روی سرور انجام نشد.', 500);
    }
    if (load_users()) {
        fail('مدیر سامانه قبلاً ساخته شده است.', 409);
    }
    $phone = normalize_phone($body['phone'] ?? '');
    if (!valid_phone($phone)) {
        fail('شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.');
    }
    $user = [
        'id' => bin2hex(random_bytes(8)),
        'phone' => $phone,
        'name' => trim((string) ($body['name'] ?? '')),
        'role' => 'admin',
        'pages' => LS_PAGES,
        'hash' => password_hash(check_new_password($body['password'] ?? ''), PASSWORD_DEFAULT),
        'created' => gmdate('c'),
    ];
    save_users([$user]);
    flock($lock, LOCK_UN);
    sign_in($user);
    send_json(['user' => public_user($user)]);
}

fail('درخواست نامعتبر است.');
