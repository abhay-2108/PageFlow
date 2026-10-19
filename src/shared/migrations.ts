const MIGRATION_KEY = "pageflow_migrations";

interface Migration {
  version: number;
  name: string;
  up: () => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "pg_ prefix to pageflow_ for display options",
    up: () => {
      const mappings: Record<string, string> = {
        pg_full_width: "pageflow_full_width",
        pg_small_text: "pageflow_small_text",
        pg_font_style: "pageflow_font_style",
        pg_theme: "pageflow_theme",
      };
      for (const [oldKey, newKey] of Object.entries(mappings)) {
        const val = localStorage.getItem(oldKey);
        if (val !== null) {
          localStorage.setItem(newKey, val);
          localStorage.removeItem(oldKey);
        }
      }
    },
  },
];

function getAppliedVersions(): number[] {
  try {
    const raw = localStorage.getItem(MIGRATION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

function saveAppliedVersions(versions: number[]): void {
  localStorage.setItem(MIGRATION_KEY, JSON.stringify(versions));
}

export function runMigrations(): void {
  const applied = getAppliedVersions();
  const pending = migrations.filter((m) => !applied.includes(m.version));
  if (pending.length === 0) return;

  for (const migration of pending) {
    try {
      migration.up();
      applied.push(migration.version);
    } catch {
      break;
    }
  }
  saveAppliedVersions(applied);
}

export function resetMigrations(): void {
  localStorage.removeItem(MIGRATION_KEY);
}
