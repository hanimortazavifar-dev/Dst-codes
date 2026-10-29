<?php
/**
 * The dashboard Excel file. The browser parses it; this endpoint only decides who may read it.
 *
 * GET                     (signed in) → the .xlsx bytes, reduced to the sheets the user's pages need;
 *                                        headers X-Data-Updated, X-Data-Source, X-Data-Stale
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

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function load_xml($xml): ?DOMDocument
{
    if (!is_string($xml) || $xml === '') {
        return null;
    }
    $doc = new DOMDocument();
    return @$doc->loadXML($xml, LIBXML_NONET) ? $doc : null;
}

/** Text of an <si>/<is> node, skipping phonetic runs (same as richText() in src/lib/xlsx.ts). */
function rich_text(DOMElement $node): string
{
    $out = '';
    foreach ($node->getElementsByTagNameNS('*', 't') as $t) {
        if (!$t->parentNode || $t->parentNode->localName !== 'rPh') {
            $out .= $t->textContent;
        }
    }
    return $out;
}

/**
 * Writes a copy of the workbook that holds only the sheets whose normalized titles are in $keys.
 * Shared strings are inlined into each kept sheet, so text from removed sheets is not in the copy.
 * Returns the temp file path, or null if the server lacks ZipArchive/DOM or the file is unreadable.
 */
function filtered_xlsx(string $src, array $keys): ?string
{
    if (!class_exists('ZipArchive') || !class_exists('DOMDocument')) {
        return null;
    }
    $in = new ZipArchive();
    if ($in->open($src) !== true) {
        return null;
    }
    $wb = load_xml($in->getFromName('xl/workbook.xml'));
    $rels = load_xml($in->getFromName('xl/_rels/workbook.xml.rels'));
    if (!$wb || !$rels) {
        $in->close();
        return null;
    }
    $targets = [];
    foreach ($rels->getElementsByTagNameNS('*', 'Relationship') as $r) {
        $targets[$r->getAttribute('Id')] = $r->getAttribute('Target');
    }
    $shared = [];
    $sst = load_xml($in->getFromName('xl/sharedStrings.xml'));
    if ($sst) {
        foreach ($sst->getElementsByTagNameNS('*', 'si') as $si) {
            $shared[] = rich_text($si);
        }
    }

    $kept = [];
    foreach ($wb->getElementsByTagNameNS('*', 'sheet') as $sheet) {
        $name = $sheet->getAttribute('name');
        if (!in_array(title_key($name), $keys, true)) {
            continue;
        }
        $target = $targets[$sheet->getAttributeNS(NS_REL, 'id')] ?? '';
        $path = $target !== '' && $target[0] === '/' ? substr($target, 1) : 'xl/' . $target;
        $doc = load_xml($in->getFromName($path));
        if (!$doc) {
            continue;
        }
        $cells = [];
        foreach ($doc->getElementsByTagNameNS('*', 'c') as $c) {
            $cells[] = $c;
        }
        foreach ($cells as $c) {
            if ($c->getAttribute('t') !== 's') {
                continue;
            }
            $v = $c->getElementsByTagNameNS('*', 'v')->item(0);
            $text = $v ? ($shared[(int) $v->textContent] ?? '') : '';
            while ($c->firstChild) {
                $c->removeChild($c->firstChild);
            }
            $c->setAttribute('t', 'inlineStr');
            $is = $doc->createElementNS($c->namespaceURI, 'is');
            $t = $doc->createElementNS($c->namespaceURI, 't');
            $t->setAttribute('xml:space', 'preserve');
            $t->appendChild($doc->createTextNode($text));
            $is->appendChild($t);
            $c->appendChild($is);
        }
        $kept[] = ['name' => $name, 'xml' => $doc->saveXML()];
    }
    $in->close();

    ensure_storage();
    $out = LS_STORAGE . '/view-' . bin2hex(random_bytes(6)) . '.xlsx';
    $zip = new ZipArchive();
    if ($zip->open($out, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        return null;
    }
    $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    $pkg = 'http://schemas.openxmlformats.org/package/2006/relationships';
    $head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    $types = '';
    $sheets = '';
    $sheetRels = '';
    foreach ($kept as $i => $s) {
        $n = $i + 1;
        $types .= '<Override PartName="/xl/worksheets/sheet' . $n . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        $sheets .= '<sheet name="' . htmlspecialchars($s['name'], ENT_XML1 | ENT_QUOTES, 'UTF-8') . '" sheetId="' . $n . '" r:id="rId' . $n . '"/>';
        $sheetRels .= '<Relationship Id="rId' . $n . '" Type="' . NS_REL . '/worksheet" Target="worksheets/sheet' . $n . '.xml"/>';
        $zip->addFromString('xl/worksheets/sheet' . $n . '.xml', $s['xml']);
    }
    $zip->addFromString('[Content_Types].xml', $head . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . $types . '</Types>');
    $zip->addFromString('_rels/.rels', $head . '<Relationships xmlns="' . $pkg . '"><Relationship Id="rId1" Type="' . NS_REL . '/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    $zip->addFromString('xl/workbook.xml', $head . '<workbook xmlns="' . $main . '" xmlns:r="' . NS_REL . '"><sheets>' . $sheets . '</sheets></workbook>');
    $zip->addFromString('xl/_rels/workbook.xml.rels', $head . '<Relationships xmlns="' . $pkg . '">' . $sheetRels . '</Relationships>');
    return $zip->close() ? $out : null;
}

/**
 * Sends the workbook to $user: whole for admins and users with every data page, otherwise only
 * the sheets their pages need (so e.g. technician details never reach a dashboard-only user).
 */
function send_xlsx(array $user, string $path, string $source, string $updated, bool $stale): void
{
    $pages = user_pages($user);
    $keys = [];
    $full = true;
    foreach (LS_PAGE_SHEETS as $page => $titles) {
        if (in_array($page, $pages, true) || in_array('admin', $pages, true)) {
            foreach ($titles as $t) {
                $keys[] = title_key($t);
            }
        } else {
            $full = false;
        }
    }
    if (!$keys) {
        fail('شما به هیچ صفحهٔ داده‌ای دسترسی ندارید.', 403);
    }
    $temp = null;
    if (!$full) {
        $temp = filtered_xlsx($path, array_values(array_unique($keys)));
        if ($temp === null) {
            fail('سرور نتوانست داده‌های مجاز شما را جدا کند (افزونهٔ ZipArchive یا DOM روی هاست فعال نیست).', 500);
        }
        $path = $temp;
    }
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Length: ' . filesize($path));
    header('X-Data-Source: ' . $source);
    header('X-Data-Updated: ' . $updated);
    header('X-Data-Stale: ' . ($stale ? '1' : '0'));
    readfile($path);
    if ($temp !== null) {
        @unlink($temp);
    }
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
    $user = require_user();
    $url = settings()['excel_url'];
    if ($url !== '') {
        $fresh = is_file(LS_CACHE_FILE) && time() - (int) filemtime(LS_CACHE_FILE) < (int) $LS_CONFIG['cache_minutes'] * 60;
        $error = $fresh ? null : fetch_remote($url);
        clearstatcache();
        if (is_file(LS_CACHE_FILE)) {
            send_xlsx($user, LS_CACHE_FILE, 'url', gmdate('c', (int) filemtime(LS_CACHE_FILE)), $error !== null);
        }
        fail($error ?? 'فایل آنلاین هنوز دریافت نشده است.', 502);
    }
    if (!is_file(LS_DATA_FILE)) {
        fail('هنوز فایل داده‌ای بارگذاری نشده است.', 404);
    }
    send_xlsx($user, LS_DATA_FILE, 'upload', upload_meta()['updatedAt'] ?? gmdate('c', (int) filemtime(LS_DATA_FILE)), false);
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
