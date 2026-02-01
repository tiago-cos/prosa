import request from 'supertest';
import { SERVER_URL } from './common.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'smol-toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function healthcheck() {
  return request(SERVER_URL).get(`/health`).send();
}

export function getCargoMetadata() {
  const cargoPath = join(__dirname, '../../Cargo.toml');
  const fileContents = readFileSync(cargoPath, 'utf8');

  const cargo = parse(fileContents) as any;

  return {
    name: cargo.package.name,
    version: cargo.package.version
  };
}
