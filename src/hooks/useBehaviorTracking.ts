import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

export interface BehaviorMetrics {
  success: boolean;
  error?: string;
  login_frequency?: {
    last_login_at: string | null;
    days_inactive: number;
    weekly_active: boolean;
    login_count: number;
    weekly_login_count: number;
  };
  checklist_completion?: {
    completion_percentage: number;
    last_incomplete_step_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    time_to_complete_seconds: number | null;
  };
  education_engagement?: {
    videos_watched: number;
    videos_skipped: number;
    total_watch_time_seconds: number;
    watch_ratio: number;
  };
  support_usage?: {
    ai_questions_count: number;
    tickets_opened: number;
  };
}

export function useBehaviorTracking() {
  const { email } = useUser();

  // Record user login
  const recordLogin = useCallback(async () => {
    if (!email) return null;
    
    try {
      const { data, error } = await supabase.rpc('record_user_login', {
        user_email: email
      });
      
      if (error) {
        console.error('Error recording login:', error);
        return null;
      }
      
      return data as { success: boolean; days_inactive: number; weekly_active: boolean };
    } catch (err) {
      console.error('Error recording login:', err);
      return null;
    }
  }, [email]);

  // Update onboarding progress
  const updateOnboardingProgress = useCallback(async (stepId: string, isCompleted: boolean = false) => {
    if (!email) return false;
    
    try {
      const { data, error } = await supabase.rpc('update_onboarding_progress', {
        user_email: email,
        step_id: stepId,
        is_completed: isCompleted
      });
      
      if (error) {
        console.error('Error updating onboarding progress:', error);
        return false;
      }
      
      return data as boolean;
    } catch (err) {
      console.error('Error updating onboarding progress:', err);
      return false;
    }
  }, [email]);

  // Track video engagement
  const trackVideoEngagement = useCallback(async (
    actionType: 'watched' | 'skipped',
    watchTimeSeconds: number = 0
  ) => {
    if (!email) return false;
    
    try {
      const { data, error } = await supabase.rpc('track_video_engagement', {
        user_email: email,
        action_type: actionType,
        watch_time_seconds: watchTimeSeconds
      });
      
      if (error) {
        console.error('Error tracking video engagement:', error);
        return false;
      }
      
      return data as boolean;
    } catch (err) {
      console.error('Error tracking video engagement:', err);
      return false;
    }
  }, [email]);

  // Increment AI question count
  const incrementAIQuestionCount = useCallback(async () => {
    if (!email) return false;
    
    try {
      const { data, error } = await supabase.rpc('increment_ai_question_count', {
        user_email: email
      });
      
      if (error) {
        console.error('Error incrementing AI question count:', error);
        return false;
      }
      
      return data as boolean;
    } catch (err) {
      console.error('Error incrementing AI question count:', err);
      return false;
    }
  }, [email]);

  // Increment tickets opened count
  const incrementTicketsOpened = useCallback(async () => {
    if (!email) return false;
    
    try {
      const { data, error } = await supabase.rpc('increment_tickets_opened', {
        user_email: email
      });
      
      if (error) {
        console.error('Error incrementing tickets opened:', error);
        return false;
      }
      
      return data as boolean;
    } catch (err) {
      console.error('Error incrementing tickets opened:', err);
      return false;
    }
  }, [email]);

  // Get all behavior metrics
  const getBehaviorMetrics = useCallback(async (): Promise<BehaviorMetrics | null> => {
    if (!email) return null;
    
    try {
      const { data, error } = await supabase.rpc('get_user_behavior_metrics', {
        user_email: email
      });
      
      if (error) {
        console.error('Error getting behavior metrics:', error);
        return null;
      }
      
      return data as unknown as BehaviorMetrics;
    } catch (err) {
      console.error('Error getting behavior metrics:', err);
      return null;
    }
  }, [email]);

  return {
    recordLogin,
    updateOnboardingProgress,
    trackVideoEngagement,
    incrementAIQuestionCount,
    incrementTicketsOpened,
    getBehaviorMetrics
  };
}
