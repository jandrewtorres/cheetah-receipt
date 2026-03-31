// mobile/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../services/supabase';

const C = { bg:'#070c16', surface:'#0f172a', border:'#1e293b', brand:'#f59e0b', text:'#f1f5f9', muted:'#64748b', input:'#111827' };

export default function LoginScreen({ navigation }: any) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const login = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.logoRow}>
        <View style={styles.logoBox}><Text style={{ fontSize: 20 }}>⚡</Text></View>
        <View>
          <Text style={styles.logoTitle}>Cheetah</Text>
          <Text style={styles.logoSub}>RECEIPTS</Text>
        </View>
      </View>

      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} style={styles.input}
          placeholder="you@example.com" placeholderTextColor={C.muted}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} style={styles.input}
          placeholder="••••••••" placeholderTextColor={C.muted} secureTextEntry />
      </View>

      <TouchableOpacity style={styles.btnPrimary} onPress={login} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnPrimaryText}>Sign In</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.linkRow}>
        <Text style={styles.linkText}>No account? <Text style={styles.link}>Create one free</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// mobile/src/screens/auth/SignupScreen.tsx — bundled in same file for brevity
export function SignupScreen({ navigation }: any) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const signup = async () => {
    if (!name || !email || !password) { Alert.alert('Error', 'Please fill all fields'); return; }
    if (password.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    });
    setLoading(false);
    if (error) { Alert.alert('Signup Failed', error.message); return; }
    Alert.alert('Check your email!', 'We sent a confirmation link to ' + email);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.logoRow}>
        <View style={styles.logoBox}><Text style={{ fontSize: 20 }}>⚡</Text></View>
        <View><Text style={styles.logoTitle}>Cheetah</Text><Text style={styles.logoSub}>RECEIPTS</Text></View>
      </View>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Free to join. Start in 2 minutes.</Text>

      {[
        { label:'Full Name', value:name, setter:setName, placeholder:'John Smith', type:'default' as const },
        { label:'Email', value:email, setter:setEmail, placeholder:'you@example.com', type:'email-address' as const },
        { label:'Password', value:password, setter:setPassword, placeholder:'Min 8 characters', type:'default' as const, secure:true },
      ].map(({ label, value, setter, placeholder, type, secure }) => (
        <View key={label} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput value={value} onChangeText={setter} style={styles.input}
            placeholder={placeholder} placeholderTextColor={C.muted}
            keyboardType={type} autoCapitalize={type === 'default' ? 'words' : 'none'}
            secureTextEntry={!!secure} />
        </View>
      ))}

      <TouchableOpacity style={styles.btnPrimary} onPress={signup} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnPrimaryText}>Create Free Account</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign in</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  content:        { padding: 24, paddingTop: 60 },
  logoRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoBox:        { width: 44, height: 44, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  logoTitle:      { color: C.text, fontWeight: '900', fontSize: 20, letterSpacing: -0.5 },
  logoSub:        { color: C.brand, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  title:          { color: C.text, fontSize: 28, fontWeight: '900', marginBottom: 4 },
  subtitle:       { color: C.muted, fontSize: 15, marginBottom: 28 },
  field:          { marginBottom: 16 },
  label:          { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:          { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15 },
  btnPrimary:     { backgroundColor: C.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnPrimaryText: { color: '#000', fontWeight: '800', fontSize: 16 },
  linkRow:        { marginTop: 20, alignItems: 'center' },
  linkText:       { color: C.muted, fontSize: 14 },
  link:           { color: C.brand, fontWeight: '700' },
});
