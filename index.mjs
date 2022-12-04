import { isaacCSPRNG } from './isaac.mjs';
import http from 'http';
import { createCipheriv, createHash, pbkdf2Sync } from 'crypto';

class RandomSequence {
  constructor(genesisSeed, startTime) {
    this.GENESIS_SEED = genesisSeed;
    this.START_TIME = startTime;
    
    this.roundsElasped = 0;

    this.previousRawRandom = this.seekRawRandom(0);
  }

  _hash(random, roundsElasped) {
    return createHash('sha512')
      .update(random.toString())
      .update(roundsElasped.toString())
      .digest('hex');
  }

  seekRawRandom(noOfRounds) {
    let dummyCSPRNG = isaacCSPRNG();

    let i = !!this.previousRawRandom ? this.roundsElasped + 1 : 0;
    let previousTerm = this.previousRawRandom;

    for (; i <= noOfRounds; i++) {
      let seed = previousTerm || this.GENESIS_SEED;
      dummyCSPRNG.seed(seed);

      let random = dummyCSPRNG.int32();

      previousTerm = this._hash(random, i);
    }

    return previousTerm;
  }

  getCurrentTerm() {
    let currentRoundsElasped = Math.floor(((Date.now() - this.START_TIME) / 30000));

    if (currentRoundsElasped !== this.roundsElasped) {
      this.previousRawRandom = this.seekRawRandom(currentRoundsElasped);
      this.roundsElasped = currentRoundsElasped;
    }

    return this.previousRawRandom;
  }
}

function trimTrailingSlash(string) {
  return string.endsWith('/') ? string.slice(0, -1) : string;
}


const startTime = Date.now();
// WARNING: the seed should be keep secret!
const keySequence = new RandomSequence('abc', startTime);
const saltSequence = new RandomSequence('cde', startTime);

const requestListener = function (request, response) {
  response.setHeader('Content-Type', 'application/json');

  const { url, headers } = request;
  const requestURL = new URL(url, `http://${headers.host}`);
  const requestPath = trimTrailingSlash(requestURL.pathname);

  if (requestPath === '/key') {
    const key = keySequence.getCurrentTerm();
    const salt = saltSequence.getCurrentTerm();

    const result = pbkdf2Sync(key, salt, 200000, 32, 'sha512');

    response.writeHead(200);
    return response.end(`{"key": "${result.toString('hex')}"}`);
  }

  if (requestPath === '/encrypt') {
    // Expected as hex encoded string
    const data = requestURL.searchParams.get('data');
    const endTime = parseInt(requestURL.searchParams.get('t'), 10);
    const iv = requestURL.searchParams.get('iv');

    const noOfRoundsElaspedWhenDecrypt = Math.floor(((endTime - Date.now()) / 30000));

    const rawKey = keySequence.seekRawRandom(noOfRoundsElaspedWhenDecrypt);
    const salt = saltSequence.seekRawRandom(noOfRoundsElaspedWhenDecrypt);

    const key = pbkdf2Sync(rawKey, salt, 200000, 32, 'sha512');

    const cipher = createCipheriv('aes-256-cbc', key, iv);

    let result = '';

    result += cipher.update(data);
    result += cipher.final('hex');

    response.writeHead(200);
    return response.end(`{"result": "${result}"}`);
  }

  response.writeHead(404);
  response.end('{"message": "Not found"}');
}

const server = http.createServer(requestListener);
server.listen(8080);
