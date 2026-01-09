-- Remove Gemini provider from provider_settings constraints

DELETE FROM provider_settings WHERE provider = 'gemini';

ALTER TABLE provider_settings
  DROP CONSTRAINT IF EXISTS provider_settings_provider_check;

ALTER TABLE provider_settings
  ADD CONSTRAINT provider_settings_provider_check
  CHECK (provider IN ('openrouter', 'openai'));
