/**
 * @file workerPool.ts
 * @brief Orchestrates a pool of WebWorkers for parallel mathematical compilation.
 */
import { Logger } from "../../utils/logger";

export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: any[] = [];
  private activeTasks = 0;
  private maxWorkers: number;

  constructor(size: number = navigator.hardwareConcurrency || 4) {
    this.maxWorkers = size;
    Logger.info(
      "WorkerPool",
      `Initialized compiler pool with ${size} workers.`,
    );
  }

  private createWorker(): Worker {
    const worker = new Worker(
      new URL("./compiler.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e) => {
      this.activeTasks--;
      this.processNext();
    };
    worker.onerror = (e) => {
      Logger.error("WorkerPool", `Worker error: ${e.message}`);
      this.activeTasks--;
      this.processNext();
    };
    return worker;
  }

  public async compileGLSLAsync(
    id: string,
    exprText: string,
    isComplex: boolean,
    customFunctions?: Record<string, { param: string; body: string }>,
    customNames?: string[],
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const task = {
        payload: { id, exprText, isComplex, customFunctions, customNames },
        resolve,
        reject,
      };
      this.taskQueue.push(task);
      this.processNext();
    });
  }

  private processNext() {
    if (this.taskQueue.length === 0) return;

    if (
      this.workers.length < this.maxWorkers &&
      this.activeTasks === this.workers.length
    ) {
      this.workers.push(this.createWorker());
    }

    if (this.activeTasks < this.workers.length) {
      const worker = this.workers[this.activeTasks];
      const task = this.taskQueue.shift();
      if (!task) return;

      this.activeTasks++;

      worker.onmessage = (e) => {
        this.activeTasks--;
        if (e.data.success) {
          task.resolve(e.data);
        } else {
          task.reject(new Error(e.data.error));
        }
        this.processNext();
      };
      worker.postMessage(task.payload);
    }
  }
}

export const compilerPool = new WorkerPool();
