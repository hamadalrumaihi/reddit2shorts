/**
 * Local scheduler utilities for Windows Task Scheduler integration.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

export interface ScheduleConfig {
  taskName: string;
  intervalHours: number;
  account?: string;
  preset?: string;
  extraArgs?: string;
}

/**
 * Create a Windows Task Scheduler job via schtasks.
 */
export function createScheduledTask(config: ScheduleConfig): string {
  const projectDir = resolve(process.cwd());
  const batPath = resolve(projectDir, "schedule.bat");

  if (!existsSync(batPath)) {
    throw new Error(`schedule.bat not found at ${batPath}. Create it first.`);
  }

  const taskName = config.taskName || "Reddit2Shorts_AutoPost";
  const intervalMinutes = config.intervalHours * 60;

  // Build the schtasks command
  const cmd = [
    "schtasks",
    "/Create",
    "/TN", `"${taskName}"`,
    "/TR", `"${batPath}"`,
    "/SC", "MINUTE",
    "/MO", String(intervalMinutes),
    "/F", // Force overwrite
  ].join(" ");

  try {
    execSync(cmd, { stdio: "pipe" });
    return `Task "${taskName}" scheduled every ${config.intervalHours} hour(s).`;
  } catch (e: any) {
    throw new Error(`Failed to create scheduled task: ${e.message}`);
  }
}

/**
 * Remove a scheduled task.
 */
export function removeScheduledTask(taskName: string = "Reddit2Shorts_AutoPost"): void {
  try {
    execSync(`schtasks /Delete /TN "${taskName}" /F`, { stdio: "pipe" });
  } catch {
    // Task may not exist
  }
}

/**
 * Check if task exists in scheduler.
 */
export function isTaskScheduled(taskName: string = "Reddit2Shorts_AutoPost"): boolean {
  try {
    execSync(`schtasks /Query /TN "${taskName}"`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
