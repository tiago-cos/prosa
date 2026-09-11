import { getCargoMetadata, getConfig, healthcheck } from '../utils/core.js';

describe('Core server endpoints', () => {
  const { name, version } = getCargoMetadata();

  test('Healthcheck', async () => {
    const response = await healthcheck();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.software).toBe(name);
    expect(response.body.version).toBe(version);
  });

  test('Public configuration', async () => {
    const response = await getConfig();

    expect(response.status).toBe(200);
    expect(response.body.allow_user_registration).toBe(true);
    expect(response.body.metadata_providers).toEqual([
      { provider_id: 'epub_metadata_extractor', requires_api_key: false },
      { provider_id: 'openlibrary', requires_api_key: false },
      { provider_id: 'hardcover', requires_api_key: true },
      { provider_id: 'google_books', requires_api_key: true }
    ]);
  });
});
