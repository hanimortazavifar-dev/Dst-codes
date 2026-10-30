<?php
/**
 * Admin only. `pages` lists the pages a user may open (see LS_PAGES); "admin" implies all.
 * Pages in `publicPages` are open to everyone, signed in or not.
 * GET                                                   → { users: User[], publicPages: string[] }
 * POST { action: "create", phone, name, pages, password }
 * POST { action: "update", id, name?, pages?, password? }
 * POST { action: "delete", id }
 * POST { action: "public", pages }                      (pages open without signing in)
 */

require __DIR__ . '/_lib.php';

$me = require_user('admin');

$list = function (): void {
    send_json(['users' => array_map('public_user', load_users()), 'publicPages' => public_pages()]);
};

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $list();
}

$body = require_post();
$action = $body['action'] ?? '';
$users = load_users();

/** Stores the page list, keeping the legacy "role" field in step with it. */
function with_pages(array $u, array $pages): array
{
    $u['pages'] = $pages;
    $u['role'] = in_array('admin', $pages, true) ? 'admin' : 'viewer';
    return $u;
}

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
    $pages = clean_pages($body['pages'] ?? []);
    if (!$pages) {
        fail('دست‌کم دسترسی به یک صفحه را انتخاب کنید.');
    }
    $users[] = with_pages([
        'id' => bin2hex(random_bytes(8)),
        'phone' => $phone,
        'name' => trim((string) ($body['name'] ?? '')),
        'hash' => password_hash(check_new_password($body['password'] ?? ''), PASSWORD_DEFAULT),
        'created' => gmdate('c'),
    ], $pages);
    save_users($users);
    $list();
}

if ($action === 'public') {
    // The admin page and the management dashboard can never be public.
    $pages = array_values(array_diff(clean_pages(is_array($body['pages'] ?? null) ? array_diff($body['pages'], LS_NEVER_PUBLIC) : []), LS_NEVER_PUBLIC));
    write_json_file('access.json', ['public_pages' => $pages]);
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

$admins = count(array_filter($users, 'is_admin'));

if ($action === 'update') {
    if (isset($body['name'])) {
        $users[$index]['name'] = trim((string) $body['name']);
    }
    if (isset($body['pages'])) {
        $pages = clean_pages($body['pages']);
        $losesAdmin = is_admin($users[$index]) && !in_array('admin', $pages, true);
        if ($losesAdmin && $users[$index]['id'] === $me['id']) {
            fail('نمی‌توانید دسترسی مدیریت را از حساب خودتان بردارید.');
        }
        if ($losesAdmin && $admins <= 1) {
            fail('سامانه باید دست‌کم یک مدیر داشته باشد.');
        }
        $users[$index] = with_pages($users[$index], $pages);
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
    if (is_admin($users[$index]) && $admins <= 1) {
        fail('سامانه باید دست‌کم یک مدیر داشته باشد.');
    }
    array_splice($users, $index, 1);
    save_users($users);
    $list();
}

fail('درخواست نامعتبر است.');
