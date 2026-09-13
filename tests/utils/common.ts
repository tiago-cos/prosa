export const SERVER_URL = 'http://localhost:5000';
export const BOOK_DIR = 'books/';
export const COVERS_DIR = 'covers/';

export const FORBIDDEN = 'Forbidden.';
export const UNAUTHORIZED = 'No authentication was provided.';
export const INVALID_API_KEY = 'The provided API key is invalid.';

export function randomString(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function settleBackgroundFetch(seconds = 1): Promise<void> {
  return wait(seconds);
}

export async function raceCreations(count: number, create: (index: number) => Promise<any>) {
  const responses = await Promise.all(Array.from({ length: count }, (_, index) => create(index)));

  return {
    succeeded: responses.filter((response) => response.status === 200 || response.status === 204),
    rejected: responses.filter((response) => response.status !== 200 && response.status !== 204)
  };
}
