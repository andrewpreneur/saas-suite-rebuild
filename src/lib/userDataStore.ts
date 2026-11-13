import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export interface UserToolData {
  [key: string]: any;
}

export class UserDataStore {
  // Ensure user progress exists using secure function
  static async ensureUserProgress(userEmail: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('create_user_progress_safe', {
        user_email: userEmail
      });

      if (error) {
        console.error('Error ensuring user progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error ensuring user progress:', error);
      return null;
    }
  }

  // Save user tool data
  static async saveToolData(userEmail: string, toolName: string, data: UserToolData) {
    try {
      // First ensure user progress exists
      await this.ensureUserProgress(userEmail);

      const { data: success, error } = await supabase.rpc('save_user_tool_data_safe', {
        user_email: userEmail,
        tool_name: toolName,
        tool_data: data
      });

      if (error) {
        console.error('Error saving tool data:', error);
        return false;
      }
      
      return success;
    } catch (error) {
      console.error('Error saving tool data:', error);
      return false;
    }
  }

  // Load user tool data
  static async loadToolData(userEmail: string, toolName: string): Promise<UserToolData | null> {
    try {
      const { data, error } = await supabase.rpc('load_user_tool_data_safe', {
        user_email: userEmail,
        tool_name: toolName
      });

      if (error) {
        console.error('Error loading tool data:', error);
        return null;
      }

      return (data as UserToolData) || null;
    } catch (error) {
      console.error('Error loading tool data:', error);
      return null;
    }
  }

  // Delete user tool data
  static async deleteToolData(userEmail: string, toolName: string) {
    try {
      const { data: success, error } = await supabase.rpc('delete_user_tool_data_safe', {
        user_email: userEmail,
        tool_name: toolName
      });

      if (error) {
        console.error('Error deleting tool data:', error);
        return false;
      }
      
      return success;
    } catch (error) {
      console.error('Error deleting tool data:', error);
      return false;
    }
  }

  // Get all saved tool data for a user
  static async getAllUserToolData(userEmail: string): Promise<{ toolName: string; data: UserToolData; updatedAt: string }[]> {
    try {
      const { data, error } = await supabase.rpc('get_all_user_tool_data_safe', {
        user_email: userEmail
      });

      if (error) {
        console.error('Error loading user tool data:', error);
        return [];
      }

      return data?.map(item => ({
        toolName: item.tool_name,
        data: item.tool_data as UserToolData,
        updatedAt: item.updated_at
      })) || [];
    } catch (error) {
      console.error('Error loading user tool data:', error);
      return [];
    }
  }
}