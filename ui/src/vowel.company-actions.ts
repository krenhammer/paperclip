/**
 * Vowel voice agent company management actions
 *
 * This module provides voice-accessible company management actions for the
 * Paperclip voice assistant. These actions allow users to:
 * - Get company synopsis/status overview
 * - Create new companies
 * - List accessible companies
 * - Get detailed company information
 *
 * @module vowel.company-actions
 */

import type { Vowel } from "@vowel.to/client";
import { companiesApi } from "@/api/companies";
import { dashboardApi } from "@/api/dashboard";

/** Global reference to current company ID - set by CompanyContext */
let currentCompanyId: string | null = null;

/**
 * Set the current company ID for voice actions
 * Called by the app when company selection changes
 */
export function setVoiceCurrentCompanyId(companyId: string | null): void {
  currentCompanyId = companyId;
}

/**
 * Get the currently selected company ID
 * Exported for use by other voice action modules
 */
export function getVoiceCurrentCompanyId(): string | null {
  return currentCompanyId;
}

/**
 * Get the currently selected company ID
 * Internal use only
 */
function getCurrentCompanyId(): string | null {
  return currentCompanyId;
}

/**
 * Format a company synopsis into a terse voice-friendly response
 */
function formatSynopsisForVoice(synopsis: CompanySynopsis): string {
  const { companyName, agents, tasks, costs, pendingApprovals } = synopsis;

  const agentTotal = agents.active + agents.running + agents.paused + agents.error;
  const taskTotal = tasks.open + tasks.inProgress + tasks.blocked + tasks.done;

  // Build terse response
  const parts: string[] = [];

  parts.push(`${companyName}:`);
  parts.push(`${agentTotal} agents${agents.running > 0 ? `, ${agents.running} running` : ""}.`);
  parts.push(`${tasks.open} open tasks${tasks.inProgress > 0 ? `, ${tasks.inProgress} in progress` : ""}.`);

  if (costs.monthBudgetCents > 0) {
    const spentDollars = (costs.monthSpendCents / 100).toFixed(0);
    const budgetDollars = (costs.monthBudgetCents / 100).toFixed(0);
    parts.push(`$${spentDollars} spent of $${budgetDollars}.`);
  }

  if (pendingApprovals > 0) {
    parts.push(`${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} pending.`);
  }

  return parts.join(" ");
}

/**
 * Company synopsis data structure
 */
export interface CompanySynopsis {
  companyId: string;
  companyName: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
}

/**
 * Company summary for list responses
 */
export interface CompanySummary {
  id: string;
  name: string;
  status: string;
  agentCount: number;
  issueCount: number;
}

/**
 * Get a comprehensive synopsis of a company's current state
 */
export async function getCompanySynopsis(companyId?: string): Promise<{
  success: boolean;
  synopsis?: CompanySynopsis;
  voiceResponse?: string;
  error?: string;
}> {
  const id = companyId ?? getCurrentCompanyId();
  if (!id) {
    return {
      success: false,
      error: "No company selected. Please select a company first or provide a company ID.",
    };
  }

  try {
    const [company, dashboard] = await Promise.all([
      companiesApi.get(id),
      dashboardApi.summary(id),
    ]);

    const synopsis: CompanySynopsis = {
      companyId: id,
      companyName: company.name,
      agents: dashboard.agents,
      tasks: dashboard.tasks,
      costs: dashboard.costs,
      pendingApprovals: dashboard.pendingApprovals,
      budgets: dashboard.budgets,
    };

    return {
      success: true,
      synopsis,
      voiceResponse: formatSynopsisForVoice(synopsis),
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to get company synopsis: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Create a new company
 */
export async function createCompany(data: {
  name: string;
  description?: string | null;
  budgetMonthlyCents?: number;
}): Promise<{
  success: boolean;
  company?: { id: string; name: string; issuePrefix: string };
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const company = await companiesApi.create({
      name: data.name,
      description: data.description ?? null,
      budgetMonthlyCents: data.budgetMonthlyCents ?? 0,
    });

    return {
      success: true,
      company: {
        id: company.id,
        name: company.name,
        issuePrefix: company.issuePrefix,
      },
      voiceResponse: `Created ${company.name}. Prefix: ${company.issuePrefix}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create company: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * List all accessible companies
 */
export async function listCompanies(): Promise<{
  success: boolean;
  companies?: CompanySummary[];
  voiceResponse?: string;
  error?: string;
}> {
  try {
    const [companies, stats] = await Promise.all([
      companiesApi.list(),
      companiesApi.stats(),
    ]);

    const summaries: CompanySummary[] = companies.map((company) => {
      const companyStats = stats[company.id] ?? { agentCount: 0, issueCount: 0 };
      return {
        id: company.id,
        name: company.name,
        status: company.status,
        agentCount: companyStats.agentCount,
        issueCount: companyStats.issueCount,
      };
    });

    // Format terse voice response
    const count = summaries.length;
    if (count === 0) {
      return {
        success: true,
        companies: [],
        voiceResponse: "No companies found.",
      };
    }

    const names = summaries.map((c) => c.name).join(", ");
    const voiceResponse = `${count} compan${count === 1 ? "y" : "ies"}: ${names}.`;

    return {
      success: true,
      companies: summaries,
      voiceResponse,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to list companies: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Get detailed information about a specific company
 */
export async function getCompany(companyId?: string): Promise<{
  success: boolean;
  company?: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    issuePrefix: string;
    budgetMonthlyCents: number;
    spentMonthlyCents: number;
  };
  voiceResponse?: string;
  error?: string;
}> {
  const id = companyId ?? getCurrentCompanyId();
  if (!id) {
    return {
      success: false,
      error: "No company selected. Please select a company first or provide a company ID.",
    };
  }

  try {
    const company = await companiesApi.get(id);

    const voiceResponse = `${company.name}: ${company.status}. Prefix ${company.issuePrefix}. ${company.description ?? ""}`;

    return {
      success: true,
      company: {
        id: company.id,
        name: company.name,
        description: company.description,
        status: company.status,
        issuePrefix: company.issuePrefix,
        budgetMonthlyCents: company.budgetMonthlyCents,
        spentMonthlyCents: company.spentMonthlyCents,
      },
      voiceResponse: voiceResponse.trim(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to get company: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Register all company management actions with a Vowel client instance
 *
 * @param vowel - The Vowel client instance
 */
export function registerCompanyActions(vowel: Vowel): void {
  /**
   * Get company synopsis - comprehensive state overview
   */
  vowel.registerAction(
    "getCompanySynopsis",
    {
      description:
        "Get a comprehensive overview of a company's current state including agents, tasks, costs, and approvals. Call this when the user asks about company status, overview, or 'how is my company doing'.",
      parameters: {
        companyId: {
          type: "string",
          description:
            "Optional company ID. If omitted, uses the currently selected company.",
        },
      },
    },
    async ({ companyId }: { companyId?: string }) => {
      const result = await getCompanySynopsis(companyId);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.synopsis,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Create a new company
   */
  vowel.registerAction(
    "createCompany",
    {
      description:
        "Create a new agent company. Call this when the user asks to create, add, or make a new company.",
      parameters: {
        name: {
          type: "string",
          description: "The name of the new company (required)",
        },
        description: {
          type: "string",
          description: "Optional description of the company",
        },
        budgetMonthlyCents: {
          type: "number",
          description: "Monthly budget in cents (default: 0, no budget)",
        },
      },
    },
    async (params: {
      name: string;
      description?: string;
      budgetMonthlyCents?: number;
    }) => {
      const result = await createCompany(params);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.company,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * List all accessible companies
   */
  vowel.registerAction(
    "listCompanies",
    {
      description:
        "List all companies accessible to the current user. Call this when the user asks to see, list, or show companies.",
      parameters: {},
    },
    async () => {
      const result = await listCompanies();
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.companies,
        };
      }
      return { success: false, error: result.error };
    }
  );

  /**
   * Get detailed company information
   */
  vowel.registerAction(
    "getCompany",
    {
      description:
        "Get detailed information about a specific company. Call this when the user asks for company details or information.",
      parameters: {
        companyId: {
          type: "string",
          description:
            "Optional company ID. If omitted, uses the currently selected company.",
        },
      },
    },
    async ({ companyId }: { companyId?: string }) => {
      const result = await getCompany(companyId);
      if (result.success) {
        return {
          success: true,
          voiceResponse: result.voiceResponse,
          data: result.company,
        };
      }
      return { success: false, error: result.error };
    }
  );

  console.log("✅ Company voice actions registered");
}
