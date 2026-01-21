import { jwtVerify, createRemoteJWKSet } from 'jose';
import { SERVER_URL } from '../utils/common.js';
import { registerUser } from '../utils/users.js';

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
