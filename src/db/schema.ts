export const CREATE_EXPERIMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    hypothesis TEXT,
    status TEXT DEFAULT 'active',
    linked_node TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_MEASUREMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);
`;

export const CREATE_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT DEFAULT 'backlog',
    linked_exp TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_REASONING_TABLE = `
CREATE TABLE IF NOT EXISTS reasoning (
    id TEXT PRIMARY KEY,
    hypothesis TEXT NOT NULL,
    evidence_score REAL DEFAULT 0.0,
    branch_a TEXT,
    branch_b TEXT,
    certainty REAL DEFAULT 0.0,
    parent_id TEXT
);
`;
