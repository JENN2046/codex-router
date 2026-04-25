import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CheckpointRef } from "../../contracts/src/index.js";

export class FileCheckpointIndex {
  constructor(private readonly path: string) {}

  async record(checkpoint: CheckpointRef): Promise<void> {
    const checkpoints = await this.loadAll();
    checkpoints.push(checkpoint);
    await this.persist(checkpoints);
  }

  async findLatestForTask(taskId: string): Promise<CheckpointRef | undefined> {
    const checkpoints = await this.loadAll();
    return checkpoints
      .filter((entry) => entry.taskId === taskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async loadAll(): Promise<CheckpointRef[]> {
    try {
      const raw = await readFile(this.path, "utf8");
      return JSON.parse(raw) as CheckpointRef[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  private async persist(checkpoints: CheckpointRef[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(checkpoints, null, 2), "utf8");
  }
}
