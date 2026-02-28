import crypto from 'node:crypto';

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

export interface OAuth1RequestTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
  authorizationUrl: string;
}

export interface OAuth1AccessTokenResult {
  accessToken: string;
  accessTokenSecret: string;
}

const OAUTH1_BASE_URL = 'https://authentication.fatsecret.com/oauth';
const REQUEST_TOKEN_URL = `${OAUTH1_BASE_URL}/request_token`;
const AUTHORIZE_URL = `${OAUTH1_BASE_URL}/authorize`;
const ACCESS_TOKEN_URL = `${OAUTH1_BASE_URL}/access_token`;

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function buildBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
}

function sign(
  baseString: string,
  consumerSecret: string,
  tokenSecret: string = '',
): string {
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac('sha1', key).update(baseString).digest('base64');
}

export function buildOAuth1Params(
  method: string,
  url: string,
  credentials: OAuth1Credentials,
  extraParams: Record<string, string> = {},
): Record<string, string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0',
  };

  if (credentials.accessToken) {
    oauthParams.oauth_token = credentials.accessToken;
  }

  const allParams = { ...oauthParams, ...extraParams };
  const baseString = buildBaseString(method, url, allParams);
  oauthParams.oauth_signature = sign(
    baseString,
    credentials.consumerSecret,
    credentials.accessTokenSecret || '',
  );

  return { ...oauthParams, ...extraParams };
}

export async function requestToken(
  credentials: OAuth1Credentials,
): Promise<OAuth1RequestTokenResult> {
  const params = buildOAuth1Params('GET', REQUEST_TOKEN_URL, credentials, { oauth_callback: 'oob' });
  const qs = new URLSearchParams(params).toString();

  const response = await fetch(`${REQUEST_TOKEN_URL}?${qs}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get request token: ${response.status} ${text}`);
  }

  const responseBody = await response.text();
  const responseParams = new URLSearchParams(responseBody);
  const oauthToken = responseParams.get('oauth_token');
  const oauthTokenSecret = responseParams.get('oauth_token_secret');

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error(`Invalid request token response: ${responseBody}`);
  }

  return {
    oauthToken,
    oauthTokenSecret,
    authorizationUrl: `${AUTHORIZE_URL}?oauth_token=${oauthToken}`,
  };
}

export async function accessToken(
  credentials: OAuth1Credentials,
  oauthToken: string,
  oauthTokenSecret: string,
  verifier: string,
): Promise<OAuth1AccessTokenResult> {
  const tokenCredentials: OAuth1Credentials = {
    ...credentials,
    accessToken: oauthToken,
    accessTokenSecret: oauthTokenSecret,
  };

  const params = buildOAuth1Params('GET', ACCESS_TOKEN_URL, tokenCredentials, { oauth_verifier: verifier });
  const qs = new URLSearchParams(params).toString();

  const response = await fetch(`${ACCESS_TOKEN_URL}?${qs}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${text}`);
  }

  const responseBody = await response.text();
  const responseParams = new URLSearchParams(responseBody);
  const accessTokenValue = responseParams.get('oauth_token');
  const accessTokenSecretValue = responseParams.get('oauth_token_secret');

  if (!accessTokenValue || !accessTokenSecretValue) {
    throw new Error(`Invalid access token response: ${responseBody}`);
  }

  return {
    accessToken: accessTokenValue,
    accessTokenSecret: accessTokenSecretValue,
  };
}
