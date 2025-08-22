import waitOn from 'wait-on';

export default async () => {
  try {
    await waitOn({
      resources: ['http://localhost:5000/health'],
      timeout: 5000
    });
    console.log('[jest.setup] Server is healthy and running.');
  } catch (err) {
    console.error('[jest.setup] Healthcheck failed: server is not running.');
    throw new Error('Cannot run tests: Server is not up.');
  }
};
