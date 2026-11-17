import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession();
const env = process.env;
export const socialConfigured = {
  google: !!(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  facebook: !!env.EXPO_PUBLIC_FACEBOOK_APP_ID,
};

/** Hook returning start functions; calls onToken(provider, token) with the Google ID token / Facebook access token. */
export function useSocialLogin(onToken) {
  const [gReq, gRes, gPrompt] = Google.useIdTokenAuthRequest({
    webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'unset', androidClientId: env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
  const [fReq, fRes, fPrompt] = Facebook.useAuthRequest({ clientId: env.EXPO_PUBLIC_FACEBOOK_APP_ID || 'unset' });
  useEffect(() => { if (gRes?.type === 'success') onToken('google', gRes.params.id_token); }, [gRes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fRes?.type === 'success') onToken('facebook', fRes.params.access_token); }, [fRes]); // eslint-disable-line react-hooks/exhaustive-deps
  return { google: () => gPrompt(), facebook: () => fPrompt(), ready: { google: !!gReq, facebook: !!fReq } };
}
