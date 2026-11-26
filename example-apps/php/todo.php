<?php

declare(strict_types=1);

// Simple CLI Todo App with PostHog Analytics
//
// A minimal plain PHP CLI application demonstrating PostHog integration
// for non-framework PHP projects (CLIs, scripts, data pipelines, etc.).

require __DIR__ . '/vendor/autoload.php';

use PostHog\PostHog;

const DATA_FILE = '.todo_app_php.json';

function loadEnvFile(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");

        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

function dataFilePath(): string
{
    $home = getenv('HOME') ?: sys_get_temp_dir();
    return rtrim($home, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . DATA_FILE;
}

function generateUuidV4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

/**
 * @return array{0: string, 1: bool} [userId, isNewUser]
 */
function ensureUserRecord(): array
{
    $path = dataFilePath();
    $todos = [];

    if (file_exists($path)) {
        $data = json_decode((string) file_get_contents($path), true);
        if (is_array($data)) {
            $todos = is_array($data['todos'] ?? null) ? $data['todos'] : [];
            $existingId = trim((string) ($data['user_id'] ?? ''));
            if ($existingId !== '') {
                return [$existingId, false];
            }
        }
    }

    // Persist the generated UUID immediately on first creation so read-only commands
    // and exception handlers reuse one stable distinctId instead of inventing new IDs.
    $userId = generateUuidV4();
    saveTodos([
        'user_id' => $userId,
        'todos' => $todos,
    ]);

    return [$userId, true];
}

function getUserId(): string
{
    [$userId] = ensureUserRecord();
    return $userId;
}

function initializePostHog(): bool
{
    loadEnvFile(__DIR__ . '/.env');

    // Leave PostHog uninitialized when POSTHOG_PROJECT_TOKEN is missing or blank rather than
    // passing an empty or placeholder key to PostHog::init.
    $projectToken = trim((string) ($_ENV['POSTHOG_PROJECT_TOKEN'] ?? getenv('POSTHOG_PROJECT_TOKEN') ?: ''));
    if ($projectToken === '') {
        $appEnv = strtolower(trim((string) ($_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: 'development')));
        if ($appEnv !== 'production') {
            fwrite(
                STDERR,
                "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured\n"
            );
        }
        return false;
    }

    $host = trim((string) ($_ENV['POSTHOG_HOST'] ?? getenv('POSTHOG_HOST') ?: ''));
    if ($host === '') {
        $host = 'https://us.i.posthog.com';
    }

    PostHog::init($projectToken, [
        'host' => $host,
        'error_tracking' => [
            'enabled' => true,
            'context_provider' => static function (array $payload): array {
                return [
                    'distinctId' => getUserId(),
                    'properties' => [
                        'app' => 'php_todo_cli',
                        'runtime' => PHP_VERSION,
                        '$exception_source' => $payload['source'] ?? null,
                    ],
                ];
            },
        ],
    ]);

    return true;
}

function loadTodos(): array
{
    [$userId] = ensureUserRecord();
    $data = json_decode((string) file_get_contents(dataFilePath()), true);
    if (!is_array($data)) {
        return ['user_id' => $userId, 'todos' => []];
    }

    $data['user_id'] = $userId;
    $data['todos'] = is_array($data['todos'] ?? null) ? $data['todos'] : [];
    return $data;
}

function saveTodos(array $data): void
{
    file_put_contents(dataFilePath(), json_encode($data, JSON_PRETTY_PRINT) . PHP_EOL);
}

function identifyUser(bool $posthogEnabled, string $userId): void
{
    if (!$posthogEnabled) {
        return;
    }

    PostHog::identify([
        'distinctId' => $userId,
        'properties' => [
            'app_language' => 'php',
            'app_type' => 'cli',
        ],
    ]);
}

function trackEvent(bool $posthogEnabled, string $eventName, array $properties = []): void
{
    if (!$posthogEnabled) {
        return;
    }

    PostHog::capture([
        'distinctId' => getUserId(),
        'event' => $eventName,
        'properties' => $properties,
    ]);
}

function cmdAdd(string $text, bool $posthogEnabled): void
{
    $data = loadTodos();

    $todo = [
        'id' => count($data['todos']) + 1,
        'text' => $text,
        'completed' => false,
        'created_at' => date(DATE_ATOM),
    ];

    $data['todos'][] = $todo;
    saveTodos($data);

    echo "Added todo #{$todo['id']}: {$todo['text']}\n";

    trackEvent($posthogEnabled, 'todo_added', [
        'todo_id' => $todo['id'],
        'todo_length' => strlen($todo['text']),
        'total_todos' => count($data['todos']),
    ]);
}

function cmdList(bool $posthogEnabled): void
{
    $data = loadTodos();

    if (count($data['todos']) === 0) {
        echo "No todos yet! Add one with: php todo.php add 'Your task'\n";
        return;
    }

    echo "\nYour Todos (" . count($data['todos']) . " total):\n\n";

    foreach ($data['todos'] as $todo) {
        $status = $todo['completed'] ? 'X' : ' ';
        echo "  [{$status}] #{$todo['id']}: {$todo['text']}\n";
    }

    echo "\n";

    trackEvent($posthogEnabled, 'todos_viewed', [
        'total_todos' => count($data['todos']),
        'completed_todos' => count(array_filter($data['todos'], static fn (array $todo): bool => (bool) $todo['completed'])),
    ]);
}

function cmdComplete(int $id, bool $posthogEnabled): void
{
    $data = loadTodos();

    foreach ($data['todos'] as &$todo) {
        if ((int) $todo['id'] !== $id) {
            continue;
        }

        if ($todo['completed']) {
            echo "Todo #{$id} is already completed\n";
            return;
        }

        $todo['completed'] = true;
        $todo['completed_at'] = date(DATE_ATOM);
        saveTodos($data);

        echo "Completed todo #{$todo['id']}: {$todo['text']}\n";

        $timeToComplete = (strtotime($todo['completed_at']) - strtotime($todo['created_at'])) / 3600;
        trackEvent($posthogEnabled, 'todo_completed', [
            'todo_id' => $todo['id'],
            'time_to_complete_hours' => $timeToComplete,
        ]);
        return;
    }

    echo "ERROR: Todo #{$id} not found\n";
}

function cmdDelete(int $id, bool $posthogEnabled): void
{
    $data = loadTodos();

    foreach ($data['todos'] as $index => $todo) {
        if ((int) $todo['id'] !== $id) {
            continue;
        }

        unset($data['todos'][$index]);
        $data['todos'] = array_values($data['todos']);
        saveTodos($data);

        echo "Deleted todo #{$id}\n";

        trackEvent($posthogEnabled, 'todo_deleted', [
            'todo_id' => $todo['id'],
            'was_completed' => $todo['completed'],
        ]);
        return;
    }

    echo "ERROR: Todo #{$id} not found\n";
}

function cmdStats(bool $posthogEnabled): void
{
    $data = loadTodos();

    $total = count($data['todos']);
    $completed = count(array_filter($data['todos'], static fn (array $todo): bool => (bool) $todo['completed']));
    $pending = $total - $completed;
    $rate = $total > 0 ? number_format($completed / $total * 100, 1) : '0.0';

    echo "\nStats:\n\n";
    echo "  Total todos:     {$total}\n";
    echo "  Completed:       {$completed}\n";
    echo "  Pending:         {$pending}\n";
    echo "  Completion rate: {$rate}%\n\n";

    trackEvent($posthogEnabled, 'stats_viewed', [
        'total_todos' => $total,
        'completed_todos' => $completed,
        'pending_todos' => $pending,
    ]);
}

function printUsage(): void
{
    echo <<<USAGE
Simple todo app with PostHog analytics

Usage:
  php todo.php add "Todo text"    Add a new todo
  php todo.php list               List all todos
  php todo.php complete <id>      Mark todo as completed
  php todo.php delete <id>        Delete a todo
  php todo.php stats              Show statistics
USAGE;
}

// Validate CLI command and arguments before initializing PostHog or recording user events.
$command = $argv[1] ?? null;
if (!$command) {
    printUsage();
    exit(0);
}

$validCommands = ['add', 'list', 'complete', 'delete', 'stats'];
if (!in_array($command, $validCommands, true)) {
    fwrite(STDERR, "ERROR: Unknown command '{$command}'\n");
    printUsage();
    exit(1);
}

if ($command === 'add' && trim((string) ($argv[2] ?? '')) === '') {
    fwrite(STDERR, "ERROR: Please provide todo text\n");
    fwrite(STDERR, "Usage: php todo.php add \"Your task\"\n");
    exit(1);
}

if (($command === 'complete' || $command === 'delete') && (int) ($argv[2] ?? 0) <= 0) {
    fwrite(STDERR, "ERROR: Please provide a valid todo ID\n");
    fwrite(STDERR, "Usage: php todo.php {$command} <id>\n");
    exit(1);
}

$posthogEnabled = false;

try {
    $posthogEnabled = initializePostHog();

    // Only call PostHog::identify when first creating the persisted installation UUID.
    [$userId, $isNewUser] = ensureUserRecord();
    if ($isNewUser) {
        identifyUser($posthogEnabled, $userId);
    }

    switch ($command) {
        case 'add':
            cmdAdd((string) $argv[2], $posthogEnabled);
            break;

        case 'list':
            cmdList($posthogEnabled);
            break;

        case 'complete':
            cmdComplete((int) $argv[2], $posthogEnabled);
            break;

        case 'delete':
            cmdDelete((int) $argv[2], $posthogEnabled);
            break;

        case 'stats':
            cmdStats($posthogEnabled);
            break;
    }
} catch (Throwable $e) {
    fwrite(STDERR, "ERROR: {$e->getMessage()}\n");

    if ($posthogEnabled) {
        PostHog::captureException($e, getUserId(), [
            'command' => $command,
            'app' => 'php_todo_cli',
        ]);
    }

    exit(1);
} finally {
    if ($posthogEnabled) {
        try {
            PostHog::flush();
        } catch (Throwable) {
            // Analytics flush failures must never fail the CLI command.
        }
    }
}
