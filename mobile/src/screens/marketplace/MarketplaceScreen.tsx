// mobile/src/screens/marketplace/MarketplaceScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../../services/supabase';

const C = { bg:'#070c16', surface:'#0f172a', card:'#111827', border:'#1e293b', brand:'#f59e0b', text:'#f1f5f9', muted:'#64748b', green:'#4ade80', red:'#f87171' };

function ReceiptRow({ item, onPress }: { item: any; onPress: () => void }) {
  const daysLeft = item.return_by_date
    ? Math.ceil((new Date(item.return_by_date).getTime() - Date.now()) / 86400000)
    : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardStore}>{item.store_name}</Text>
        <Text style={styles.cardPrice}>${item.listing_price?.toFixed(2)}</Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>{item.store_city ? `${item.store_city}, ${item.store_state}` : item.store_number ?? ''}</Text>
        <Text style={styles.cardMetaText}>{item.receipt_items?.[0]?.count ?? 0} items · ${item.total?.toFixed(2)}</Text>
      </View>
      {daysLeft !== null && (
        <Text style={[styles.cardReturn, { color: daysLeft < 7 ? C.red : C.green }]}>
          Return by {item.return_by_date} ({daysLeft}d)
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function MarketplaceScreen({ navigation }: any) {
  const [receipts,  setReceipts]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [search,    setSearch]    = useState('');

  const load = useCallback(async (q = search) => {
    setLoading(true);
    let query = supabase.from('receipts')
      .select('*, receipt_items(count)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);
    if (q) query = query.ilike('store_name', `%${q}%`);
    const { data } = await query;
    setReceipts(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [search]);

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ Marketplace</Text>
        <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => load(search)}
          style={styles.searchInput} placeholder="Search receipts..." placeholderTextColor={C.muted}
          returnKeyType="search" />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <ReceiptRow item={item} onPress={() => navigation.navigate('ReceiptDetail', { receipt: item })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brand} />}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={<View style={styles.center}><Text style={{ color: C.muted }}>No receipts found</Text></View>}
        />
      )}
    </View>
  );
}

// ─── Receipt Detail ───────────────────────────────────────────────────────────
export function ReceiptDetailScreen({ route, navigation }: any) {
  const { receipt } = route.params;
  const [items,   setItems]   = useState<any[]>([]);
  const [buying,  setBuying]  = useState(false);
  const [user,    setUser]    = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    supabase.from('receipt_items').select('*').eq('receipt_id', receipt.id)
      .then(({ data }) => setItems(data ?? []));
  }, [receipt.id]);

  const buy = async () => {
    if (!user) { navigation.navigate('Login'); return; }
    setBuying(true);
    // Navigate to checkout — Stripe handled natively
    navigation.navigate('OrderDetail', { receiptId: receipt.id, listingPrice: receipt.listing_price });
    setBuying(false);
  };

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      ListHeaderComponent={
        <View>
          <View style={styles.card}>
            <Text style={styles.detailStore}>{receipt.store_name}</Text>
            <Text style={styles.detailMeta}>{receipt.store_number} · {receipt.store_city}, {receipt.store_state}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {[
                { label: 'Total', value: `$${receipt.total?.toFixed(2)}` },
                { label: 'Date', value: receipt.purchase_date },
                { label: 'Return By', value: receipt.return_by_date ?? 'N/A' },
              ].map(({ label, value }) => (
                <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: C.muted, fontSize: 10 }}>{label}</Text>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Items ({items.length})</Text>
        </View>
      }
      data={items}
      keyExtractor={i => i.id}
      renderItem={({ item }) => (
        <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{item.name}</Text>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
              UPC: {'• • • • • • • • • •'} (unlock after purchase)
            </Text>
          </View>
          <Text style={{ color: C.text, fontWeight: '700' }}>${item.total_price?.toFixed(2)}</Text>
        </View>
      )}
      ListFooterComponent={
        <TouchableOpacity style={[styles.btnPrimary, { marginTop: 16 }]} onPress={buy} disabled={buying}>
          {buying ? <ActivityIndicator color="#000" /> : (
            <Text style={styles.btnPrimaryText}>⚡ Buy Now · ${receipt.listing_price?.toFixed(2)}</Text>
          )}
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  header:         { padding: 16, paddingTop: 60, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  headerTitle:    { color: C.text, fontSize: 22, fontWeight: '900' },
  searchInput:    { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: C.text, fontSize: 14 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  card:           { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardStore:      { color: C.text, fontWeight: '800', fontSize: 16 },
  cardPrice:      { color: C.brand, fontWeight: '900', fontSize: 20 },
  cardMeta:       { flexDirection: 'row', justifyContent: 'space-between' },
  cardMetaText:   { color: C.muted, fontSize: 12 },
  cardReturn:     { fontSize: 12, fontWeight: '600', marginTop: 6 },
  detailStore:    { color: C.text, fontSize: 22, fontWeight: '900', marginBottom: 4 },
  detailMeta:     { color: C.muted, fontSize: 13 },
  sectionTitle:   { color: C.text, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  btnPrimary:     { backgroundColor: C.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
