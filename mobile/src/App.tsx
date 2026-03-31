// mobile/src/App.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from './services/supabase';
import { registerForPushNotifications } from './services/notifications';

// Screens
import LoginScreen    from './screens/auth/LoginScreen';
import SignupScreen   from './screens/auth/SignupScreen';
import MarketplaceScreen from './screens/marketplace/MarketplaceScreen';
import ReceiptDetailScreen from './screens/marketplace/ReceiptDetailScreen';
import SellScreen     from './screens/sell/SellScreen';
import ScanScreen     from './screens/sell/ScanScreen';
import ManualReviewScreen from './screens/sell/ManualReviewScreen';
import PriceScreen    from './screens/sell/PriceScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import OrdersScreen   from './screens/orders/OrdersScreen';
import OrderDetailScreen from './screens/orders/OrderDetailScreen';
import DisputeScreen  from './screens/orders/DisputeScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';

// Icons (inline SVG-style with emoji for simplicity)
import { Text } from 'react-native';

const TAB_ICONS: Record<string, string> = {
  Marketplace: '🏪',
  Sell:        '⚡',
  Orders:      '📦',
  Dashboard:   '📊',
  Settings:    '⚙️',
};

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const COLORS = {
  bg:      '#070c16',
  surface: '#0f172a',
  border:  '#1e293b',
  brand:   '#f59e0b',
  text:    '#f1f5f9',
  muted:   '#64748b',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{TAB_ICONS[name]}</Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, height: 80, paddingBottom: 20 },
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} />
      <Tab.Screen name="Sell"        component={SellScreen} />
      <Tab.Screen name="Orders"      component={OrdersScreen} />
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="Settings"    component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}>
      <Stack.Screen name="Login"  component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: COLORS.bg }, headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.text, headerShadowVisible: false }}>
      <Stack.Screen name="Main"          component={MainTabs}           options={{ headerShown: false }} />
      <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} options={{ title: 'Receipt' }} />
      <Stack.Screen name="Scan"          component={ScanScreen}          options={{ title: 'Scan Receipt', presentation: 'modal' }} />
      <Stack.Screen name="ManualReview"  component={ManualReviewScreen}  options={{ title: 'Review Details' }} />
      <Stack.Screen name="PriceReceipt"  component={PriceScreen}         options={{ title: 'Set Price' }} />
      <Stack.Screen name="OrderDetail"   component={OrderDetailScreen}   options={{ title: 'Order Details' }} />
      <Stack.Screen name="Dispute"       component={DisputeScreen}       options={{ title: 'Dispute', presentation: 'modal' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) registerForPushNotifications().catch(console.error);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) registerForPushNotifications().catch(console.error);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.brand} size="large" />
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_KEY!}>
      <NavigationContainer>
        <StatusBar style="light" />
        {session ? <AppStack /> : <AuthStack />}
      </NavigationContainer>
    </StripeProvider>
  );
}
