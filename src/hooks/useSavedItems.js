import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';
import { useAuth } from '@/context/useAuth';

/** Documented application-status lifecycle (architecture.md §3.4). */
export const APPLICATION_STATUSES = [
  { value: 'saved', label: 'Saved' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

/**
 * Bookmarking and application tracking (FR-DASH-02 / FR-DASH-03).
 *
 * `saved_items` is student-owned data: RLS confines every read and write to the
 * caller (§4.4), and `item_id` is polymorphic so the referenced record is
 * resolved separately.
 */
export function useSavedItems(itemType) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!config.isConfigured || !user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from('saved_items').select('*').eq('user_id', user.id);
      if (itemType) q = q.eq('item_type', itemType);
      const { data, error: err } = await q.order('saved_at', { ascending: false });
      if (err) throw err;
      setItems(data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [user, itemType]);

  useEffect(() => {
    load();
  }, [load]);

  const isSaved = useCallback(
    (type, id) => items.some((i) => i.item_type === type && i.item_id === id),
    [items]
  );

  const save = useCallback(
    async (type, id) => {
      if (!user) return { error: { code: 'NO_SESSION', message: 'Sign in to save this.' } };
      try {
        const { error: err } = await supabase
          .from('saved_items')
          .upsert(
            { user_id: user.id, item_type: type, item_id: id },
            { onConflict: 'user_id,item_type,item_id' }
          );
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [user, load]
  );

  const remove = useCallback(
    async (type, id) => {
      if (!user) return { error: null };
      try {
        const { error: err } = await supabase
          .from('saved_items')
          .delete()
          .eq('user_id', user.id)
          .eq('item_type', type)
          .eq('item_id', id);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [user, load]
  );

  const toggle = useCallback(
    (type, id) => (isSaved(type, id) ? remove(type, id) : save(type, id)),
    [isSaved, remove, save]
  );

  const setStatus = useCallback(
    async (savedItemId, status) => {
      if (!user) return { error: null };
      try {
        const { error: err } = await supabase
          .from('saved_items')
          .update({ application_status: status })
          .eq('id', savedItemId)
          .eq('user_id', user.id);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [user, load]
  );

  return {
    items,
    loading,
    error,
    isSaved,
    save,
    remove,
    toggle,
    setStatus,
    reload: load,
    canSave: isAuthenticated,
  };
}

export default useSavedItems;
