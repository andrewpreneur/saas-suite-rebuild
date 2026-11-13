-- Update the populate_default_agency_videos function to include the new documents-contracts video
CREATE OR REPLACE FUNCTION public.populate_default_agency_videos(agency_id_param text, tier_param text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Categories and modules from the frontend onboarding data
  categories_modules JSONB := '[
    {
      "category_id": "foundational-setup",
      "modules": [
        "new-contact", "import-contacts", "generate-leads", "multi-channel", 
        "first-campaign", "drip-campaigns", "scheduling", "sales-pipeline"
      ]
    },
    {
      "category_id": "marketing-lead-generation", 
      "modules": ["social-media-planner", "facebook-lead-ads", "sms-campaign"]
    },
    {
      "category_id": "sales-conversation",
      "modules": ["email-sync", "live-chat", "social-messaging"]
    },
    {
      "category_id": "website-content",
      "modules": ["professional-website", "wordpress-migration", "documents-contracts"]
    },
    {
      "category_id": "commerce",
      "modules": ["first-product", "online-course", "stripe-payments", "payment-link", "invoices"]
    }
  ]'::jsonb;
  category_item JSONB;
  module_id_item TEXT;
BEGIN
  -- Validate inputs
  IF agency_id_param IS NULL OR agency_id_param = '' OR tier_param IS NULL OR tier_param = '' THEN
    RETURN false;
  END IF;
  
  -- Loop through categories and modules to create default entries
  FOR category_item IN SELECT * FROM jsonb_array_elements(categories_modules)
  LOOP
    -- Loop through modules in each category
    FOR module_id_item IN SELECT * FROM jsonb_array_elements_text(category_item->'modules')
    LOOP
      -- Insert default setting (visible = true) if it doesn't exist
      INSERT INTO agency_video_settings (agency_id, tier, category_id, module_id, is_visible)
      VALUES (
        agency_id_param,
        tier_param,
        category_item->>'category_id',
        module_id_item,
        true
      )
      ON CONFLICT (agency_id, tier, category_id, module_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;