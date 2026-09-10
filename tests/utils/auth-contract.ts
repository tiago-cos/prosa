import request from 'supertest';
import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from './common.js';
import { createApiKey } from './users.js';

export type Auth = { jwt?: string; apiKey?: string };
export type Capability = 'Create' | 'Read' | 'Update' | 'Delete';

const ALL_CAPABILITIES: Capability[] = ['Create', 'Read', 'Update', 'Delete'];

export interface AuthContractFixture<C> {
  userId: string;
  jwt: string;
  context: C;
}

export interface AuthContract<C> {
  capability: Capability;
  setup: () => Promise<AuthContractFixture<C>>;
  call: (context: C, auth: Auth) => Promise<request.Response>;
  success: number;
}

async function callExpectingRejection<C>(contract: AuthContract<C>, context: C, auth: Auth) {
  try {
    return await contract.call(context, auth);
  } catch (error: any) {
    if (error.code === 'EPIPE') return undefined;
    throw error;
  }
}

async function mintKey(userId: string, jwt: string, capabilities: Capability[], expiresAt?: number) {
  const response = await createApiKey(userId, 'Test Key', capabilities, expiresAt, { jwt });
  expect(response.status).toBe(200);
  return response.body.key as string;
}

export function describeAuthContract<C>(name: string, contract: AuthContract<C>) {
  describe(name, () => {
    test('No auth', async () => {
      const { context } = await contract.setup();

      const response = await callExpectingRejection(contract, context, {});
      if (response === undefined) return;

      expect(response.status).toBe(401);
      expect(response.text).toBe(UNAUTHORIZED);
    });

    test('Api key with the required capability', async () => {
      const { userId, jwt, context } = await contract.setup();
      const key = await mintKey(userId, jwt, [contract.capability]);

      const response = await contract.call(context, { apiKey: key });
      expect(response.status).toBe(contract.success);
    });

    test('Api key without the required capability', async () => {
      const { userId, jwt, context } = await contract.setup();
      const others = ALL_CAPABILITIES.filter((capability) => capability !== contract.capability);
      const key = await mintKey(userId, jwt, others);

      const response = await callExpectingRejection(contract, context, { apiKey: key });
      if (response === undefined) return;

      expect(response.status).toBe(403);
      expect(response.text).toBe(FORBIDDEN);
    });

    test('Expired api key', async () => {
      const { userId, jwt, context } = await contract.setup();
      const key = await mintKey(userId, jwt, [contract.capability], Date.now() + 1000);

      // Wait for the key to expire
      await wait(1.5);

      const response = await callExpectingRejection(contract, context, { apiKey: key });
      if (response === undefined) return;

      expect(response.status).toBe(401);
      expect(response.text).toBe(INVALID_API_KEY);
    });
  });
}
