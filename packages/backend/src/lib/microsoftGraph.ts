import { ClientSecretCredential } from '@azure/identity';
import {
  Client,
  GraphError,
  type GraphRequest,
} from '@microsoft/microsoft-graph-client';
import {
  config,
  type MicrosoftGraphConfig,
} from '../config/environment';

export const GRAPH_NOT_CONFIGURED_MESSAGE =
  'Microsoft Graph is not configured. Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and TEAMS_TEAM_ID.';

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_PREFER_HEADER = 'HonorNonIndexedQueriesWarningMayFailRandomly';

export interface GraphQuery {
  filter?: string;
  select?: string;
  top?: number;
}

export interface GraphCollection<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

export interface GraphApiClient {
  get<T>(path: string, query?: GraphQuery): Promise<T>;
  getCollection<T>(path: string, query?: GraphQuery): Promise<T[]>;
}

/** Writes to Teams. Kept separate so read-only code (sync) can't write by accident. */
export interface GraphWriteClient extends GraphApiClient {
  post<T>(path: string, body: unknown): Promise<T>;
  put(path: string, body: unknown): Promise<void>;
  delete(path: string): Promise<void>;
}

let cachedClient: GraphWriteClient | null = null;

export function isMicrosoftGraphEnabled(
  graph: MicrosoftGraphConfig = config.microsoftGraph,
): boolean {
  return graph.enabled;
}

export function getGraphClient(): GraphApiClient {
  return getGraphWriteClient();
}

export function getGraphWriteClient(): GraphWriteClient {
  if (cachedClient) return cachedClient;
  cachedClient = createGraphApiClient(config.microsoftGraph);
  return cachedClient;
}

export function createGraphApiClient(graph: MicrosoftGraphConfig): GraphWriteClient {
  if (!graph.enabled || !graph.tenantId || !graph.clientId || !graph.clientSecret) {
    throw new Error(GRAPH_NOT_CONFIGURED_MESSAGE);
  }

  const credential = new ClientSecretCredential(
    graph.tenantId,
    graph.clientId,
    graph.clientSecret,
  );

  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken(GRAPH_SCOPE);
        if (!token?.token) {
          throw new Error('Failed to acquire Microsoft Graph access token');
        }
        return token.token;
      },
    },
  });

  return wrapGraphClient(client);
}

function applyQuery(request: GraphRequest, query?: GraphQuery): GraphRequest {
  let next = request.header('Prefer', GRAPH_PREFER_HEADER);
  if (query?.filter) next = next.filter(query.filter);
  if (query?.select) next = next.select(query.select);
  if (query?.top != null) next = next.top(query.top);
  return next;
}

function wrapGraphError(err: unknown, path: string, method = 'GET'): Error {
  if (err instanceof GraphError) {
    return new Error(`Microsoft Graph ${err.statusCode} ${method} ${path}: ${err.message}`);
  }
  if (err instanceof Error) {
    return new Error(`Microsoft Graph ${method} ${path}: ${err.message}`);
  }
  return new Error(`Microsoft Graph ${method} ${path} failed`);
}

function wrapGraphClient(client: Client): GraphWriteClient {
  return {
    async post<T>(path: string, body: unknown): Promise<T> {
      try {
        return (await client.api(path).post(body)) as T;
      } catch (err) {
        throw wrapGraphError(err, path, 'POST');
      }
    },

    async put(path: string, body: unknown): Promise<void> {
      try {
        await client.api(path).put(body);
      } catch (err) {
        throw wrapGraphError(err, path, 'PUT');
      }
    },

    async delete(path: string): Promise<void> {
      try {
        await client.api(path).delete();
      } catch (err) {
        throw wrapGraphError(err, path, 'DELETE');
      }
    },

    async get<T>(path: string, query?: GraphQuery): Promise<T> {
      try {
        const request = applyQuery(client.api(path), query);
        return (await request.get()) as T;
      } catch (err) {
        throw wrapGraphError(err, path);
      }
    },

    async getCollection<T>(path: string, query?: GraphQuery): Promise<T[]> {
      const items: T[] = [];
      let response = await this.get<GraphCollection<T>>(path, query);
      items.push(...(response.value ?? []));

      while (response['@odata.nextLink']) {
        const nextLink = response['@odata.nextLink'];
        response = await this.get<GraphCollection<T>>(nextLink);
        items.push(...(response.value ?? []));
      }

      return items;
    },
  };
}
