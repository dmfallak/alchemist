import { Database } from 'sqlite3';
import { CREATE_EXPERIMENTS_TABLE, CREATE_MEASUREMENTS_TABLE, CREATE_TASKS_TABLE, CREATE_REASONING_TABLE } from './schema';

export async function initializeDatabase(db: Database): Promise<void> {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(CREATE_EXPERIMENTS_TABLE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });
            db.run(CREATE_MEASUREMENTS_TABLE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });
            db.run(CREATE_TASKS_TABLE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });
            db.run(CREATE_REASONING_TABLE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    });
}
