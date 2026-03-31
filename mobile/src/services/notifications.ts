// mobile/src/services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  // Save token to Supabase user record
  const { data: { user } } = await supabase.auth.getUser();
  if (user && token) {
    await supabase.from('users').update({ expo_push_token: token }).eq('id', user.id);
  }

  return token;
}

export function usePushNotifications(onNotification: (data: any) => void) {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    onNotification(notification.request.content.data);
  });
  return () => subscription.remove();
}
