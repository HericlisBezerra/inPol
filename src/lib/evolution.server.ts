// Evolution API client (server-only). All calls authenticated with the
// per-instance apikey stored on whatsapp_instances.evolution_api_key.

export class EvolutionError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function evolutionFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new EvolutionError(res.status, `Evolution API erro ${res.status}`, body);
  }
  return body;
}

export interface EvolutionGroup {
  id: string;
  subject: string;
  size?: number;
  pictureUrl?: string;
  participants?: unknown[];
}

export async function fetchInstanceStatus(baseUrl: string, apiKey: string, instanceName: string) {
  return evolutionFetch(baseUrl, apiKey, `/instance/connectionState/${instanceName}`);
}

export interface EvolutionInstance {
  name: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  status?: string;
}

export async function fetchInstances(
  baseUrl: string,
  apiKey: string,
): Promise<EvolutionInstance[]> {
  const data = (await evolutionFetch(baseUrl, apiKey, `/instance/fetchInstances`)) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .map((raw) => {
      const o = raw as Record<string, unknown>;
      // Evolution v2 flat: { name, ownerJid, profileName, connectionStatus, ... }
      // Evolution v1 nested: { instance: { instanceName, owner, profileName, status } }
      const inst = (o.instance as Record<string, unknown> | undefined) ?? o;
      const name = String(inst.name ?? inst.instanceName ?? "");
      const ownerJid =
        typeof inst.ownerJid === "string"
          ? (inst.ownerJid as string)
          : typeof inst.owner === "string"
            ? (inst.owner as string)
            : undefined;
      return {
        name,
        ownerJid,
        profileName:
          typeof inst.profileName === "string" ? (inst.profileName as string) : undefined,
        profilePicUrl:
          typeof inst.profilePicUrl === "string" ? (inst.profilePicUrl as string) : undefined,
        status:
          typeof inst.connectionStatus === "string"
            ? (inst.connectionStatus as string)
            : typeof inst.status === "string"
              ? (inst.status as string)
              : undefined,
      };
    })
    .filter((i) => i.name);
}

export async function fetchGroups(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvolutionGroup[]> {
  // Evolution API v2: GET /group/fetchAllGroups/{instance}?getParticipants=false
  const data = (await evolutionFetch(
    baseUrl,
    apiKey,
    `/group/fetchAllGroups/${instanceName}?getParticipants=false`,
  )) as unknown;
  if (!Array.isArray(data)) return [];
  return data.map((g) => {
    const obj = g as Record<string, unknown>;
    return {
      id: String(obj.id ?? obj.remoteJid ?? ""),
      subject: String(obj.subject ?? obj.name ?? "Sem nome"),
      size: typeof obj.size === "number" ? obj.size : undefined,
      pictureUrl:
        typeof obj.pictureUrl === "string"
          ? obj.pictureUrl
          : typeof obj.profilePicUrl === "string"
            ? (obj.profilePicUrl as string)
            : undefined,
    };
  });
}

export async function setWebhook(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl: string,
) {
  return evolutionFetch(baseUrl, apiKey, `/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });
}

// Fetch historical messages from a group via Evolution v2 chat/findMessages.
// Handles the multiple response shapes across Evolution builds:
//   - { messages: { records: [...] } }
//   - { messages: [...] }
//   - [ ... ]  (top-level array)
// Only returns messages with messageTimestamp >= sinceTsSeconds (when provided).
export async function fetchMessagesForGroup(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  opts: { remoteJid: string; sinceTsSeconds?: number; pageSize?: number; maxPages?: number },
): Promise<Array<Record<string, unknown>>> {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 20;
  const out: Array<Record<string, unknown>> = [];

  for (let page = 1; page <= maxPages; page++) {
    const body: Record<string, unknown> = {
      where: { key: { remoteJid: opts.remoteJid } },
      page,
      offset: pageSize,
    };
    let raw: unknown;
    try {
      raw = await evolutionFetch(baseUrl, apiKey, `/chat/findMessages/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (e instanceof EvolutionError && e.status === 404) break;
      throw e;
    }

    const records: unknown[] = (() => {
      if (Array.isArray(raw)) return raw;
      const r = raw as { messages?: unknown };
      if (Array.isArray(r.messages)) return r.messages;
      const m = r.messages as { records?: unknown } | undefined;
      if (m && Array.isArray(m.records)) return m.records;
      return [];
    })();
    if (records.length === 0) break;

    let stop = false;
    for (const rec of records) {
      const obj = rec as Record<string, unknown>;
      const ts = Number(obj.messageTimestamp ?? 0);
      if (opts.sinceTsSeconds && ts && ts < opts.sinceTsSeconds) {
        stop = true;
        continue;
      }
      out.push(obj);
    }
    if (records.length < pageSize) break;
    if (stop) break;
  }
  return out;
}
