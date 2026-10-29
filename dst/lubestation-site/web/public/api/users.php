<?php
/**
 * Admin only.
 * GET                                                  → { users: User[] }
 * POST { action: "create", phone, name, role, password }
 * POST { action: "update", id, name?, role?, password? }
 * POST { action: "delete", id }
 */

require __DIR__ . '/_lib.php';

$me = require_user('admin');

$list = function (): void {
    send_json(['users' => array_map('public_user', load_users())]);
};

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $list();
}

$body = require_post();
$action = $body['action'] ?? '';
$users = load_users();

if ($action === 'create') {
    $phone = normalize_phone($body['phone'] ?? '');
    if (!valid_phone($phone)) {
        fail('شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.');
    }
    foreach ($users as $u) {
        if ($u['phone'] === $phone) {
            fail('کاربری با این شماره موبایل وجود دارد.', 409);
        }
    }
    $users[] = [
        'id' => bin2hex(random_bytes(8)),
        'phone' => $phone,
        'name' => trim((string) ($body['name'] ?? '')),
        'role' => valid_role($body['role'] ?? 'viewer'),
        'hash' => password_hash(check_new_password($body['password'] ?? ''), PASSWORD_DEFAULT),
        'created' => gmdate('c'),
    ];
    save_users($users);
    $list();
}

$id = (string) ($body['id'] ?? '');
$index = null;
foreach ($users as $i => $u) {
    if ($u['id'] === $id) {
        $index = $i;
    }
}
if ($index === null) {
    fail('کاربر پیدا نشد.', 404);
}

$admins = count(array_filter($users, function ($u) {
    return $u['role'] === 'admin';
}));

if ($action === 'update') {
    if (isset($body['name'])) {
        $users[$index]['name'] = trim((string) $body['name']);
    }
    if (isset($body['role'])) {
        $role = valid_role($body['role']);
        if ($users[$index]['role'] === 'admin' && $role !== 'admin' && $admins <= 1) {
            fail('سامانه باید دست‌کم یک مدیر داشته باشد.');
        }
        $users[$index]['role'] = $role;
    }
    if (isset($body['password']) && $body['password'] !== '') {
        $users[$index]['hash'] = password_hash(check_new_password($body['password']), PASSWORD_DEFAULT);
    }
    save_users($users);
    $list();
}

if ($action === 'delete') {
    if ($users[$index]['id'] === $me['id']) {
        fail('نمی‌توانید حساب خودتان را حذف کنید.');
    }
    if ($users[$index]['role'] === 'admin' && $admins <= 1) {
        fail('سامانه باید دست‌کم یک مدیر داشته باشد.');
    }
    array_splice($users, $index, 1);
    save_users($users);
    $list();
}

fail('درخواست نامعتبر است.');
