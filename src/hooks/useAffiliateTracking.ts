import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to track affiliate referral events (views, clicks).
 * Reads ?ref= from URL, looks up the affiliate, and logs events.
 * 
 * @param page - The page identifier (e.g., 'home', 'branding-tool', 'ai-support')
 */
export function useAffiliateTracking(page: string) {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const tracked = useRef(false);

  useEffect(() => {
    if (!ref || tracked.current) return;
    tracked.current = true;

    const trackView = async () => {
      try {
        // Slug -> id only. anon cannot select affiliates, so this goes through
        // resolve_affiliate_slug instead of a table read.
        const { data: affiliateId, error } = await supabase.rpc('resolve_affiliate_slug', {
          slug: ref,
        });

        if (error || !affiliateId) {
          if (error) console.error('Affiliate tracking error:', error);
          return;
        }

        // Store affiliate ref in localStorage for attribution on signup
        localStorage.setItem('affiliate_ref', ref);
        localStorage.setItem('affiliate_id', affiliateId);

        // Log the view event
        await supabase.from('affiliate_events').insert({
          affiliate_id: affiliateId,
          event_type: 'view',
          page,
          referrer_url: document.referrer || null,
          user_agent: navigator.userAgent,
        });
      } catch (err) {
        console.error('Affiliate tracking error:', err);
      }
    };

    trackView();
  }, [ref, page]);

  const trackClick = async (clickType?: string) => {
    if (!ref) return;
    
    try {
      const affiliateId = localStorage.getItem('affiliate_id');
      if (!affiliateId) return;

      await supabase.from('affiliate_events').insert({
        affiliate_id: affiliateId,
        event_type: 'click',
        page,
        metadata: clickType ? { click_type: clickType } : {},
      });
    } catch (err) {
      console.error('Affiliate click tracking error:', err);
    }
  };

  return { affiliateRef: ref, trackClick };
}
