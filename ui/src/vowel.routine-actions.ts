/**
 * Vowel voice agent routine management actions
 *
 * This module provides voice-accessible routine management for the Paperclip
 * voice assistant. Users can create, run, and query scheduled routines.
 *
 * @module vowel.routine-actions
 */

import type { Vowel } from "@vowel.to/client";
import { routinesApi } from "@/api/routines";
import { getVoiceCurrentCompanyId } from "./vowel.company-actions";

/**
 * Get the currently selected company ID
 */
function getCurrentCompanyId(): string | null {
  return getVoiceCurrentCompanyId();
}

/**
 * Create a new routine
 */
export async function createRoutine(data: {
  title: string;
  description?: string | null;
  prompt?: string | null;
  assigneeAgentId?: string | null;
  status?: "active" | "paused" | "archived";
}): Promise<{
  success: boolean;
  routine?: { id: string; title: string; status: string };
  voiceResponse?: string;
  error?: string;
}> {
  const companyId = getCurrentCompanyId();
  if (!companyId) {
    return {
      success: false,
      error: "No company selected. Please select a company first.",
    };
  }

  try {
    const routine = await routinesApi.create(companyId, {
      title: data.title,
      description: data.description ?? null,
      prompt: data.prompt ?? null,
      assigneeAgentId: data.assigneeAgentId ?? null,
      status: data.status ?? "active",
    });

    return {
      success: true,
      routine: {
        id: routine.id,
        title: routine.title,
        status: routine.status,
      },
      voiceResponse: `Created routine: ${routine.title}. Status: ${routine.status}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create routine: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * List all routines for the current company
 */
export async function listRoutines(): Promise<{
  success: boolean;
  routines?: Array<{ id: string; title: string; status: string }>;
  voiceResponse?: string;
  error?: string;
}> {
  const companyId = getCurrentCompanyId();
  if (!companyId) {
    return {
      success: false,
      error: "No company selected. Please select a company first.",
    };
  }

  try {
    const routines = await routinesApi.list(companyId);

    const formatted = routines.map((routine) => ({
      id: routine.id,
      title: routine.title,
      status: routine.status,
    }));

    // Format terse voice response
    const count = formatted.length;
    if (count === 0) {
      return {
        success: true,
        routines: [],
        voiceResponse: "No routines found.",
      };
    }

    const activeCount = formatted.filter((r) => r.status === "active").length;
    const firstFew = formatted.slice(0, 3);
    const names = firstFew.map((r) => r.title).join(", ");
    const more = count > 3 ? ` and ${count - 3} more` : "";

    return {
      success: true,
      routines: formatted,
      voiceResponse: `${count} routines${activeCount > 0 ? `, ${activeCount} active` : ""}. ${names}${more}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to list routines: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Run a routine manually
 */
export async function runRoutine(
  routineId: string
): Promise<{
  success: boolean;
  run?: { id: string; status: string };
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const run = await routinesApi.run(routineId);

    return {
      success: true,
      run: {
        id: run.id,
        status: run.status,
      },
      voiceResponse: `Started routine run. Run ID: ${run.id.slice(0, 8)}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to run routine: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Get routine details including recent runs
 */
export async function getRoutine(routineId: string): Promise<{
  success: boolean;
  routine?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    recentRuns: Array<{ id: string; status: string; createdAt: Date }>;
  };
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const [routine, runs] = await Promise.all([
      routinesApi.get(routineId),
      routinesApi.listRuns(routineId, 5),
    ]);

    const recentRuns = runs.map((run) => ({
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
    }));

    const lastRun = recentRuns[0];
    const runInfo = lastRun
      ? ` Last run: ${lastRun.status} at ${lastRun.createdAt.toLocaleDateString()}.`
      : " No runs yet.";

    return {
      success: true,
      routine: {
        id: routine.id,
        title: routine.title,
        description: routine.description,
        status: routine.status,
        recentRuns,
      },
      voiceResponse: `${routine.title}: ${routine.status}.${runInfo}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to get routine: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Update a routine
 */
export async function updateRoutine(
  routineId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: "active" | "paused" | "archived";
  }
): Promise<{
  success: boolean;
  routine?: { id: string; title: string; status: string };
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const routine = await routinesApi.update(routineId, {
      ...data,
      description: data.description ?? undefined,
    });

    return {
      success: true,
      routine: {
        id: routine.id,
        title: routine.title,
        status: routine.status,
      },
      voiceResponse: `Updated routine: ${routine.title}. Status: ${routine.status}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to update routine: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Register all routine management actions with a Vowel client instance
 */
export function registerRoutineActions(vowel: Vowel): void {
  /**
   * Create a new routine
   */
  vowel.registerAction(
    "createRoutine",
    {
      description:
        "Create a new scheduled routine. Call this when the user asks to create, add, or make a new routine or scheduled task.",
      parameters: {
        title: {
          type: "string",
          description: "The title of the routine (required)",
        },
        description: {
          type: "string",
          description: "Optional description of what the routine does",
        },
        prompt: {
          type: "string",
          description: "Optional prompt text for the assigned agent",
        },
        assigneeAgentId: {
          type: "string",
          description: "Optional agent ID to assign the routine to",
        },
        status: {
          type: "string",
          description: "Status: active, paused, or archived (default: active)",
        },
      },
    },
    async (params: {
      title: string;
      description?: string;
      prompt?: string;
      assigneeAgentId?: string;
      status?: "active" | "paused" | "archived";
    }) => {
      const result = await createRoutine({
        ...params,
        description: params.description ?? null,
        prompt: params.prompt ?? null,
        assigneeAgentId: params.assigneeAgentId ?? null,
      });
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.routine,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * List routines
   */
  vowel.registerAction(
    "listRoutines",
    {
      description:
        "List all routines in the current company. Call this when the user asks to see, list, or show routines or scheduled tasks.",
      parameters: {},
    },
    async () => {
      const result = await listRoutines();
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.routines,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Run a routine manually
   */
  vowel.registerAction(
    "runRoutine",
    {
      description:
        "Manually trigger/run a routine. Call this when the user asks to run, trigger, or execute a routine.",
      parameters: {
        routineId: {
          type: "string",
          description: "The routine ID (required)",
        },
      },
    },
    async (params: { routineId: string }) => {
      const result = await runRoutine(params.routineId);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.run,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Get routine details
   */
  vowel.registerAction(
    "getRoutine",
    {
      description:
        "Get detailed information about a routine including recent runs. Call this when the user asks about routine details or status.",
      parameters: {
        routineId: {
          type: "string",
          description: "The routine ID (required)",
        },
      },
    },
    async (params: { routineId: string }) => {
      const result = await getRoutine(params.routineId);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.routine,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Update a routine
   */
  vowel.registerAction(
    "updateRoutine",
    {
      description:
        "Update an existing routine. Call this when the user asks to update, change, or modify a routine.",
      parameters: {
        routineId: {
          type: "string",
          description: "The routine ID (required)",
        },
        title: {
          type: "string",
          description: "New title (optional)",
        },
        description: {
          type: "string",
          description: "New description (optional)",
        },
        status: {
          type: "string",
          description: "New status: active, paused, or archived (optional)",
        },
      },
    },
    async (params: {
      routineId: string;
      title?: string;
      description?: string;
      status?: "active" | "paused" | "archived";
    }) => {
      const { routineId, ...updateData } = params;
      const result = await updateRoutine(routineId, {
        ...updateData,
        description: updateData.description ?? null,
      });
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.routine,
        };
      }
      return { success: false, error: result.error };
    }
  );

  console.log("✅ Routine voice actions registered");
}
