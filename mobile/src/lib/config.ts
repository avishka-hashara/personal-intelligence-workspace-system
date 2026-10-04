import Storage from 'expo-sqlite/kv-store';

const API_URL_KEY = 'piw_api_url';

let apiUrl: string = Storage.getItemSync(API_URL_KEY) || process.env.EXPO_PUBLIC_API_URL || '';

/** Base URL of the deployed Next.js backend, without trailing slash */
export function getApiUrl(): string {
  return apiUrl.replace(/\/+$/, '');
}

export function setApiUrl(url: string) {
  apiUrl = url.trim();
  if (apiUrl) {
    Storage.setItemSync(API_URL_KEY, apiUrl);
  } else {
    Storage.removeItemSync(API_URL_KEY);
    apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
  }
}
