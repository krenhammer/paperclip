/**
 * Vowel voice agent issue management actions
 *
 * This module provides voice-accessible issue management for the Paperclip
 * voice assistant. Users can create, update, and query issues using voice commands.
 *
 * @module vowel.issue-actions
 */

import type { Vowel } from "@vowel.to/client";
import { issuesApi } from "@/api/issues";
import { getVoiceCurrentCompanyId } from "./vowel.company-actions";

/**
 * Get the currently selected company ID
 */
function getCurrentCompanyId(): string | null {
  return getVoiceCurrentCompanyId();
}

/**
 * Create a new issue
 */
export async function createIssue(data: {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "backlog" | "todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";
  assigneeAgentId?: string | null;
}): Promise<{
  success: boolean;
  issue?: { id: string; identifier: string; title: string };
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
    const issue = await issuesApi.create(companyId, {
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? "medium",
      status: data.status ?? "todo",
      assigneeAgentId: data.assigneeAgentId ?? null,
    });

    return {
      success: true,
      issue: {
        id: issue.id,
        identifier: issue.identifier ?? "",
        title: issue.title,
      },
      voiceResponse: `Created ${issue.identifier || "issue"}: ${issue.title}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create issue: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * List issues with optional filters
 */
export async function listIssues(filters?: {
  status?: string;
  assigneeAgentId?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  issues?: Array<{ id: string; identifier: string; title: string; status: string }>;
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
    const issues = await issuesApi.list(companyId, {
      status: filters?.status,
      assigneeAgentId: filters?.assigneeAgentId,
      limit: filters?.limit ?? 10,
    });

    const formatted = issues.map((issue) => ({
      id: issue.id,
      identifier: issue.identifier ?? "",
      title: issue.title,
      status: issue.status,
    }));

    // Format terse voice response
    const count = formatted.length;
    const statusLabel = filters?.status ? `${filters.status} ` : "";

    if (count === 0) {
      return {
        success: true,
        issues: [],
        voiceResponse: `No ${statusLabel}issues found.`,
      };
    }

    const firstFew = formatted.slice(0, 3);
    const names = firstFew.map((i) => `${i.identifier || "?"}: ${i.title}`).join(". ");
    const more = count > 3 ? ` and ${count - 3} more.` : "";

    return {
      success: true,
      issues: formatted,
      voiceResponse: `${count} ${statusLabel}issue${count === 1 ? "" : "s"}. ${names}.${more}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to list issues: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Update an issue
 */
export async function updateIssue(
  issueId: string,
  data: {
    status?: string;
    priority?: string;
    title?: string;
    assigneeAgentId?: string | null;
    comment?: string;
  }
): Promise<{
  success: boolean;
  issue?: { id: string; identifier: string; title: string };
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const result = await issuesApi.update(issueId, data);

    return {
      success: true,
      issue: {
        id: result.id,
        identifier: result.identifier ?? "",
        title: result.title,
      },
      voiceResponse: `Updated ${result.identifier || "issue"}.${data.status ? ` Status: ${data.status}.` : ""}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to update issue: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Add a comment to an issue
 */
export async function addComment(
  issueId: string,
  body: string,
  reopen?: boolean
): Promise<{
  success: boolean;
  comment?: { id: string };
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const comment = await issuesApi.addComment(issueId, body, reopen);

    return {
      success: true,
      comment: { id: comment.id },
      voiceResponse: `Added comment to ${issueId}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to add comment: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Register all issue management actions with a Vowel client instance
 */
export function registerIssueActions(vowel: Vowel): void {
  /**
   * Create a new issue
   */
  vowel.registerAction(
    "createIssue",
    {
      description:
        "Create a new issue/task in the current company. Call this when the user asks to create, add, or make a new issue or task.",
      parameters: {
        title: {
          type: "string",
          description: "The title of the issue (required)",
        },
        description: {
          type: "string",
          description: "Optional description of the issue",
        },
        priority: {
          type: "string",
          description: "Priority: low, medium, high, or urgent (default: medium)",
        },
        status: {
          type: "string",
          description: "Status: backlog, todo, in_progress, blocked, in_review, done (default: todo)",
        },
        assigneeAgentId: {
          type: "string",
          description: "Optional agent ID to assign the issue to",
        },
      },
    },
    async (params: {
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high" | "urgent";
      status?: "backlog" | "todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";
      assigneeAgentId?: string;
    }) => {
      const result = await createIssue(params);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.issue,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * List issues
   */
  vowel.registerAction(
    "listIssues",
    {
      description:
        "List issues in the current company. Call this when the user asks to see, list, or show issues or tasks.",
      parameters: {
        status: {
          type: "string",
          description: "Filter by status (optional)",
        },
        assigneeAgentId: {
          type: "string",
          description: "Filter by assignee agent ID (optional)",
        },
        limit: {
          type: "number",
          description: "Maximum number of issues to return (default: 10)",
        },
      },
    },
    async (params: {
      status?: string;
      assigneeAgentId?: string;
      limit?: number;
    }) => {
      const result = await listIssues(params);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.issues,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Update an issue
   */
  vowel.registerAction(
    "updateIssue",
    {
      description:
        "Update an existing issue. Call this when the user asks to update, change, or modify an issue.",
      parameters: {
        issueId: {
          type: "string",
          description: "The issue ID or identifier (e.g., 'CMP-123') (required)",
        },
        status: {
          type: "string",
          description: "New status (optional)",
        },
        priority: {
          type: "string",
          description: "New priority (optional)",
        },
        title: {
          type: "string",
          description: "New title (optional)",
        },
        assigneeAgentId: {
          type: "string",
          description: "New assignee agent ID (optional, null to unassign)",
        },
        comment: {
          type: "string",
          description: "Comment to add with the update (optional)",
        },
      },
    },
    async (params: {
      issueId: string;
      status?: string;
      priority?: string;
      title?: string;
      assigneeAgentId?: string | null;
      comment?: string;
    }) => {
      const { issueId, ...updateData } = params;
      const result = await updateIssue(issueId, updateData);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.issue,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Add comment to an issue
   */
  vowel.registerAction(
    "addComment",
    {
      description:
        "Add a comment to an issue. Call this when the user asks to comment on an issue.",
      parameters: {
        issueId: {
          type: "string",
          description: "The issue ID or identifier (required)",
        },
        body: {
          type: "string",
          description: "The comment text (required)",
        },
        reopen: {
          type: "boolean",
          description: "Whether to reopen the issue (default: false)",
        },
      },
    },
    async (params: {
      issueId: string;
      body: string;
      reopen?: boolean;
    }) => {
      const result = await addComment(params.issueId, params.body, params.reopen);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.comment,
        };
      }
      return { success: false, error: result.error };
    }
  );

  console.log("✅ Issue voice actions registered");
}
