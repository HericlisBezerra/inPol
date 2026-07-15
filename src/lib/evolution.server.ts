// Evolution API client (server-only). All calls authenticated with the
// per-instance apikey stored on whatsapp_instances.evolution_api_key.

export class EvolutionError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
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

export async function fetchInstances(baseUrl: string, apiKey: string): Promise<EvolutionInstance[]> {
  const data = (await evolutionFetch(baseUrl, apiKey, `/instance/fetchInstances`)) as unknown;
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
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
  }).filter((i) => i.name);
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
