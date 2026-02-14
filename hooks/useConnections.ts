import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Connection, Profile } from '../types';

export interface ConnectionWithPartner extends Connection {
  partner?: Profile;
}

export function useConnections(userId: string | undefined) {
  const [connections, setConnections] = useState<ConnectionWithPartner[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConnections = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await supabase
      .from('connections')
      .select('*')
      .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true });

    if (data && data.length > 0) {
      // Fetch partner profiles
      const partnerIds = (data as Connection[]).map((c) =>
        c.user_id === userId ? c.partner_id : c.user_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', partnerIds);

      const profileMap: Record<string, Profile> = {};
      (profiles ?? []).forEach((p: Profile) => {
        profileMap[p.id] = p;
      });

      setConnections(
        (data as Connection[]).map((c) => ({
          ...c,
          partner:
            profileMap[c.user_id === userId ? c.partner_id : c.user_id],
        }))
      );
    } else {
      setConnections([]);
    }

    setLoading(false);
  }, [userId]);

  return { connections, loading, fetchConnections };
}
