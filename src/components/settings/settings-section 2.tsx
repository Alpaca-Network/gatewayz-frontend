import React from 'react';

interface SettingsSectionProps {
  title: string;
  description: string;
  descriptionDetail?: string;
  children: React.ReactNode;
}

/**
 * Reusable settings section layout component
 * Creates a responsive 3-column grid with title/description on left, content on right
 *
 * @example
 * <SettingsSection
 *   title="API Keys"
 *   description="Manage your API keys for authentication"
 *   descriptionDetail="Keep your keys secure and rotate them regularly"
 * >
 *   <YourSettingsContent />
 * </SettingsSection>
 */
export function SettingsSection({
  title,
  description,
  descriptionDetail,
  children
}: SettingsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {descriptionDetail && (
          <p className="text-sm text-muted-foreground mt-2">{descriptionDetail}</p>
        )}
      </div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}
