/**
 * Vowel voice agent goal management actions
 *
 * This module provides voice-accessible goal management for the Paperclip
 * voice assistant. Users can create, update, and query company goals.
 *
 * @module vowel.goal-actions
 */

import type { Vowel } from "@vowel.to/client";
import { goalsApi } from "@/api/goals";
import { getVoiceCurrentCompanyId } from "./vowel.company-actions";

/**
 * Get the currently selected company ID
 */
function getCurrentCompanyId(): string | null {
  return getVoiceCurrentCompanyId();
}

/**
 * Create a new goal
 */
export async function createGoal(data: {
  title: string;
  description?: string | null;
  level?: "company" | "team" | "individual";
  status?: "active" | "paused" | "completed" | "cancelled";
  targetDate?: string | null;
}): Promise<{
  success: boolean;
  goal?: { id: string; title: string; level: string };
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
    const goal = await goalsApi.create(companyId, {
      title: data.title,
      description: data.description ?? null,
      level: data.level ?? "company",
      status: data.status ?? "active",
      targetDate: data.targetDate ?? null,
    });

    return {
      success: true,
      goal: {
        id: goal.id,
        title: goal.title,
        level: goal.level,
      },
      voiceResponse: `Created ${goal.level} goal: ${goal.title}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create goal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * List all goals for the current company
 */
export async function listGoals(): Promise<{
  success: boolean;
  goals?: Array<{ id: string; title: string; level: string; status: string }>;
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
    const goals = await goalsApi.list(companyId);

    const formatted = goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      level: goal.level,
      status: goal.status,
    }));

    // Format terse voice response
    const count = formatted.length;
    if (count === 0) {
      return {
        success: true,
        goals: [],
        voiceResponse: "No goals found.",
      };
    }

    const activeCount = formatted.filter((g) => g.status === "active").length;
    const firstFew = formatted.slice(0, 3);
    const names = firstFew.map((g) => g.title).join(", ");
    const more = count > 3 ? ` and ${count - 3} more` : "";

    return {
      success: true,
      goals: formatted,
      voiceResponse: `${count} goals${activeCount > 0 ? `, ${activeCount} active` : ""}. ${names}${more}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to list goals: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Update an existing goal
 */
export async function updateGoal(
  goalId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: "active" | "paused" | "completed" | "cancelled";
    targetDate?: string | null;
  }
): Promise<{
  success: boolean;
  goal?: { id: string; title: string; status: string };
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const goal = await goalsApi.update(goalId, data);

    return {
      success: true,
      goal: {
        id: goal.id,
        title: goal.title,
        status: goal.status,
      },
      voiceResponse: `Updated goal: ${goal.title}.${data.status ? ` Status: ${data.status}.` : ""}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to update goal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Register all goal management actions with a Vowel client instance
 */
export function registerGoalActions(vowel: Vowel): void {
  /**
   * Create a new goal
   */
  vowel.registerAction(
    "createGoal",
    {
      description:
        "Create a new company goal. Call this when the user asks to create, add, or make a new goal or objective.",
      parameters: {
        title: {
          type: "string",
          description: "The title of the goal (required)",
        },
        description: {
          type: "string",
          description: "Optional description of the goal",
        },
        level: {
          type: "string",
          description: "Level: company, team, or individual (default: company)",
        },
        status: {
          type: "string",
          description: "Status: active, paused, completed, or cancelled (default: active)",
        },
        targetDate: {
          type: "string",
          description: "Optional target date (ISO format, e.g., '2024-12-31')",
        },
      },
    },
    async (params: {
      title: string;
      description?: string;
      level?: "company" | "team" | "individual";
      status?: "active" | "paused" | "completed" | "cancelled";
      targetDate?: string;
    }) => {
      const result = await createGoal({
        ...params,
        description: params.description ?? null,
        targetDate: params.targetDate ?? null,
      });
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.goal,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * List goals
   */
  vowel.registerAction(
    "listGoals",
    {
      description:
        "List all goals in the current company. Call this when the user asks to see, list, or show goals or objectives.",
      parameters: {},
    },
    async () => {
      const result = await listGoals();
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.goals,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Update a goal
   */
  vowel.registerAction(
    "updateGoal",
    {
      description:
        "Update an existing goal. Call this when the user asks to update, change, or modify a goal.",
      parameters: {
        goalId: {
          type: "string",
          description: "The goal ID (required)",
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
          description: "New status: active, paused, completed, cancelled (optional)",
        },
        targetDate: {
          type: "string",
          description: "New target date (ISO format, optional)",
        },
      },
    },
    async (params: {
      goalId: string;
      title?: string;
      description?: string;
      status?: "active" | "paused" | "completed" | "cancelled";
      targetDate?: string;
    }) => {
      const { goalId, ...updateData } = params;
      const result = await updateGoal(goalId, {
        ...updateData,
        description: updateData.description ?? null,
        targetDate: updateData.targetDate ?? null,
      });
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.goal,
        };
      }
      return { success: false, error: result.error };
    }
  );

  console.log("✅ Goal voice actions registered");
}
