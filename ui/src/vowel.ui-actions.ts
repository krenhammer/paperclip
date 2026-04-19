/**
 * Vowel voice agent UI-interactive actions
 *
 * This module provides voice actions that work through the UI rather than
 * direct API calls. Values are populated into dialogs/forms where users
 * can see and verify them before submitting.
 *
 * @module vowel.ui-actions
 */

import type { Vowel } from "@vowel.to/client";
import { getVoiceCurrentCompanyId } from "./vowel.company-actions";

/** Global reference to dialog actions - set by DialogContext */
let dialogActions: {
  openNewIssue?: (defaults?: Record<string, unknown>) => void;
  closeNewIssue?: () => void;
  openNewGoal?: (defaults?: Record<string, unknown>) => void;
  closeNewGoal?: () => void;
  openNewProject?: () => void;
  openNewAgent?: () => void;
} | null = null;

/** Global reference to track if a dialog was opened by voice */
let voiceOpenedDialog: {
  type: "issue" | "goal" | "project" | "agent" | "routine" | null;
  timestamp: number;
} = { type: null, timestamp: 0 };

/**
 * Register dialog actions for voice system
 * Called by DialogContext provider
 */
export function registerVoiceDialogActions(actions: {
  openNewIssue?: (defaults?: Record<string, unknown>) => void;
  closeNewIssue?: () => void;
  openNewGoal?: (defaults?: Record<string, unknown>) => void;
  closeNewGoal?: () => void;
  openNewProject?: () => void;
  openNewAgent?: () => void;
}): void {
  dialogActions = actions;
}

/**
 * Check if a dialog was recently opened by voice
 */
export function wasDialogOpenedByVoice(type: "issue" | "goal" | "project" | "agent" | "routine", withinMs = 5000): boolean {
  return voiceOpenedDialog.type === type && Date.now() - voiceOpenedDialog.timestamp < withinMs;
}

/**
 * Mark a dialog as submitted (clears voice-opened flag)
 */
export function markDialogSubmitted(): void {
  voiceOpenedDialog = { type: null, timestamp: 0 };
}

/**
 * Get the currently selected company ID
 */
function getCurrentCompanyId(): string | null {
  return getVoiceCurrentCompanyId();
}

/**
 * Open New Issue dialog with pre-populated values
 */
export async function openCreateIssueDialog(data: {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "backlog" | "todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";
  assigneeAgentId?: string | null;
}): Promise<{
  success: boolean;
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

  if (!dialogActions?.openNewIssue) {
    return {
      success: false,
      error: "Issue dialog not available.",
    };
  }

  // Build defaults from voice input
  const defaults: Record<string, unknown> = {};
  if (data.title) defaults.title = data.title;
  if (data.description) defaults.description = data.description;
  if (data.priority) defaults.priority = data.priority;
  if (data.status) defaults.status = data.status;
  if (data.assigneeAgentId !== undefined) defaults.assigneeAgentId = data.assigneeAgentId;

  // Mark as opened by voice
  voiceOpenedDialog = { type: "issue", timestamp: Date.now() };

  // Open the dialog
  dialogActions.openNewIssue(defaults);

  // Build response based on what was filled
  const filled = Object.keys(defaults).filter(k => defaults[k] !== undefined && defaults[k] !== null);
  if (filled.length === 0) {
    return {
      success: true,
      voiceResponse: "Opened new issue dialog. Tell me the details to fill in.",
    };
  }

  const summary = filled.map(k => k === "assigneeAgentId" ? "assignee" : k).join(", ");
  return {
    success: true,
    voiceResponse: `Opened issue dialog with ${summary}. Say "submit" or "create it" when ready.`,
  };
}

/**
 * Open New Goal dialog with pre-populated values
 */
export async function openCreateGoalDialog(data: {
  title?: string;
  description?: string | null;
  level?: "company" | "team" | "individual";
  status?: "active" | "paused" | "completed" | "cancelled";
  targetDate?: string | null;
}): Promise<{
  success: boolean;
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

  if (!dialogActions?.openNewGoal) {
    return {
      success: false,
      error: "Goal dialog not available.",
    };
  }

  // Build defaults from voice input
  const defaults: Record<string, unknown> = {};
  if (data.title) defaults.title = data.title;
  if (data.description) defaults.description = data.description;
  if (data.level) defaults.level = data.level;
  if (data.status) defaults.status = data.status;
  if (data.targetDate) defaults.targetDate = data.targetDate;

  // Mark as opened by voice
  voiceOpenedDialog = { type: "goal", timestamp: Date.now() };

  // Open the dialog
  dialogActions.openNewGoal(defaults);

  // Build response
  const filled = Object.keys(defaults).filter(k => defaults[k] !== undefined && defaults[k] !== null);
  if (filled.length === 0) {
    return {
      success: true,
      voiceResponse: "Opened new goal dialog. Tell me the details to fill in.",
    };
  }

  const summary = filled.join(", ");
  return {
    success: true,
    voiceResponse: `Opened goal dialog with ${summary}. Say "submit" or "create it" when ready.`,
  };
}

/**
 * Open New Project dialog
 */
export async function openCreateProjectDialog(): Promise<{
  success: boolean;
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

  if (!dialogActions?.openNewProject) {
    return {
      success: false,
      error: "Project dialog not available.",
    };
  }

  voiceOpenedDialog = { type: "project", timestamp: Date.now() };
  dialogActions.openNewProject();

  return {
    success: true,
    voiceResponse: "Opened new project dialog. Fill in the details and say 'submit' when ready.",
  };
}

/**
 * Open New Agent dialog
 */
export async function openCreateAgentDialog(): Promise<{
  success: boolean;
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

  if (!dialogActions?.openNewAgent) {
    return {
      success: false,
      error: "Agent dialog not available.",
    };
  }

  voiceOpenedDialog = { type: "agent", timestamp: Date.now() };
  dialogActions.openNewAgent();

  return {
    success: true,
    voiceResponse: "Opened new agent dialog. Fill in the details and say 'submit' when ready.",
  };
}

/**
 * Submit/confirm the currently open dialog
 */
export async function submitCurrentDialog(): Promise<{
  success: boolean;
  voiceResponse?: string;
  error?: string;
}> {
  if (!voiceOpenedDialog.type) {
    return {
      success: false,
      error: "No dialog is currently open. Say 'create issue' or 'create goal' first.",
    };
  }

  // Check if still within valid time window
  if (Date.now() - voiceOpenedDialog.timestamp > 30000) {
    voiceOpenedDialog = { type: null, timestamp: 0 };
    return {
      success: false,
      error: "Dialog timed out. Please open a new dialog and try again.",
    };
  }

  // Since we can't actually trigger the submit button programmatically
  // (dialogs handle their own submission), we instruct the user
  // The actual submission happens via keyboard shortcut or button click
  const type = voiceOpenedDialog.type;

  return {
    success: true,
    voiceResponse: `Press Enter or click the Create button to submit the ${type}.`,
  };
}

/**
 * Cancel/close the currently open dialog
 */
export async function cancelCurrentDialog(): Promise<{
  success: boolean;
  voiceResponse?: string;
  error?: string;
}> {
  if (!voiceOpenedDialog.type) {
    return {
      success: false,
      error: "No dialog is currently open.",
    };
  }

  const type = voiceOpenedDialog.type;

  // Close the appropriate dialog
  if (type === "issue" && dialogActions?.closeNewIssue) {
    dialogActions.closeNewIssue();
  } else if (type === "goal" && dialogActions?.closeNewGoal) {
    dialogActions.closeNewGoal();
  }

  voiceOpenedDialog = { type: null, timestamp: 0 };

  return {
    success: true,
    voiceResponse: `Cancelled ${type} creation.`,
  };
}

/**
 * Register UI-interactive voice actions
 */
export function registerUIActions(vowel: Vowel): void {
  /**
   * Open Create Issue dialog with optional pre-filled values
   */
  vowel.registerAction(
    "createIssue",
    {
      description:
        "Open the new issue dialog with optional pre-filled values. Call this when user says 'create issue', 'new issue', 'add task'. Values are shown in the UI for user to verify before submitting.",
      parameters: {
        title: {
          type: "string",
          description: "Issue title to pre-fill (optional)",
        },
        description: {
          type: "string",
          description: "Issue description to pre-fill (optional)",
        },
        priority: {
          type: "string",
          description: "Priority to pre-fill: low, medium, high, urgent (optional)",
        },
        status: {
          type: "string",
          description: "Status to pre-fill: backlog, todo, in_progress, blocked, in_review (optional, default: todo)",
        },
        assigneeAgentId: {
          type: "string",
          description: "Agent ID to assign (optional)",
        },
      },
    },
    async (params: {
      title?: string;
      description?: string;
      priority?: "low" | "medium" | "high" | "urgent";
      status?: "backlog" | "todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";
      assigneeAgentId?: string;
    }) => {
      const result = await openCreateIssueDialog(params);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Open Create Goal dialog with optional pre-filled values
   */
  vowel.registerAction(
    "createGoal",
    {
      description:
        "Open the new goal dialog with optional pre-filled values. Call this when user says 'create goal', 'new goal', 'set objective'. Values are shown in the UI for user to verify before submitting.",
      parameters: {
        title: {
          type: "string",
          description: "Goal title to pre-fill (optional)",
        },
        description: {
          type: "string",
          description: "Goal description to pre-fill (optional)",
        },
        level: {
          type: "string",
          description: "Level to pre-fill: company, team, individual (optional, default: company)",
        },
        status: {
          type: "string",
          description: "Status to pre-fill: active, paused, completed, cancelled (optional, default: active)",
        },
        targetDate: {
          type: "string",
          description: "Target date to pre-fill (ISO format, optional)",
        },
      },
    },
    async (params: {
      title?: string;
      description?: string;
      level?: "company" | "team" | "individual";
      status?: "active" | "paused" | "completed" | "cancelled";
      targetDate?: string;
    }) => {
      const result = await openCreateGoalDialog(params);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Open Create Project dialog
   */
  vowel.registerAction(
    "createProject",
    {
      description:
        "Open the new project dialog. Call this when user says 'create project', 'new project'.",
      parameters: {},
    },
    async () => {
      const result = await openCreateProjectDialog();
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Open Create Agent dialog
   */
  vowel.registerAction(
    "createAgent",
    {
      description:
        "Open the new agent dialog. Call this when user says 'create agent', 'new agent', 'hire agent'.",
      parameters: {},
    },
    async () => {
      const result = await openCreateAgentDialog();
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Submit/confirm the current dialog
   */
  vowel.registerAction(
    "submitDialog",
    {
      description:
        "Submit/confirm the currently open dialog. Call this when user says 'submit', 'create it', 'confirm', 'save it' after filling in a dialog.",
      parameters: {},
    },
    async () => {
      const result = await submitCurrentDialog();
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Cancel/close the current dialog
   */
  vowel.registerAction(
    "cancelDialog",
    {
      description:
        "Cancel/close the currently open dialog without saving. Call this when user says 'cancel', 'close', 'never mind', 'abort'.",
      parameters: {},
    },
    async () => {
      const result = await cancelCurrentDialog();
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
        };
      }
      return { success: false, error: result.error };
    }
  );

  console.log("✅ UI-interactive voice actions registered");
}
