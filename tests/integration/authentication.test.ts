import { jwtVerify, createRemoteJWKSet } from 'jose';
import { SERVER_URL } from '../utils/common.js';
import { createApiKey, registerUser } from '../utils/users.js';
import { fetchIdentity } from '../utils/authentication.js';
import { describeAuthContract } from '../utils/auth-contract.js';

describe('JWT + JWKS Verification', () => {
  test('Verify Signature', async () => {
    const { response } = await registerUser();
    expect(response.status).toBe(200);

    const encodedJwt = response.body.jwt_token;
    expect(encodedJwt).toBeDefined();

    const jwt = Buffer.from(encodedJwt, 'base64').toString('utf8');

    const jwksUrl = new URL('/.well-known/jwks.json', SERVER_URL);
    const jwks = createRemoteJWKSet(jwksUrl);

    const { payload, protectedHeader } = await jwtVerify(jwt, jwks, {
      algorithms: ['RS256'],
      issuer: 'prosa'
    });

    expect(protectedHeader.alg).toBe('RS256');
    expect(protectedHeader.kid).toBe('prosa-key-1');

    expect(payload).toHaveProperty('role');
    expect(payload).toHaveProperty('capabilities');
    expect(payload).toHaveProperty('session_id');
    expect(payload).toHaveProperty('iss');
    expect(payload).toHaveProperty('exp');
  });
});

describe('Get identity', () => {
  test('JWT', async () => {
    const { response, username } = await registerUser();
    expect(response.status).toBe(200);

    const identity = await fetchIdentity({ jwt: response.body.jwt_token });
    expect(identity.status).toBe(200);

    expect(identity.body.auth_type).toBe('Jwt');
    expect(identity.body.user_id).toBe(response.body.user_id);
    expect(identity.body.username).toBe(username);
    expect(identity.body.is_admin).toBe(false);
    expect(identity.body.capabilities.sort()).toEqual(['Create', 'Delete', 'Read', 'Update']);
    expect(identity.body.key_id).toBeUndefined();
  });

  test('Admin JWT', async () => {
    const { response } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(response.status).toBe(200);

    const identity = await fetchIdentity({ jwt: response.body.jwt_token });
    expect(identity.status).toBe(200);

    expect(identity.body.is_admin).toBe(true);
  });

  test('Api key', async () => {
    const { response, username } = await registerUser();
    expect(response.status).toBe(200);
    const userId = response.body.user_id;
    const jwt = response.body.jwt_token;

    const keyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt });
    expect(keyResponse.status).toBe(200);

    const identity = await fetchIdentity({ apiKey: keyResponse.body.key });
    expect(identity.status).toBe(200);

    expect(identity.body.auth_type).toBe('ApiKey');
    expect(identity.body.user_id).toBe(userId);
    expect(identity.body.username).toBe(username);
    expect(identity.body.is_admin).toBe(false);
    expect(identity.body.capabilities.sort()).toEqual(['Create', 'Read']);
    expect(identity.body.key_id).toBe(keyResponse.body.id);
  });
});

describeAuthContract('Get identity auth', {
  capability: 'Read',
  success: 200,
  setup: async () => {
    const { response } = await registerUser();
    expect(response.status).toBe(200);

    return { userId: response.body.user_id, jwt: response.body.jwt_token, context: null };
  },
  call: (_context, auth) => fetchIdentity(auth)
});
