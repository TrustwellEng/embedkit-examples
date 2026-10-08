-- Add Microsoft Teams to the integrations catalog and give it to every customer.
-- Same behavior as POST /api/admin/catalog: one CustomerIntegration row per customer
-- (isEnabled = 1, isConfigured = 0).
-- Safe to re-run: skips the catalog row if it exists and customers that already have it.

SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

DECLARE @integrationId VARCHAR(50) = 'teams';

-- 1. Catalog row
IF NOT EXISTS (SELECT 1 FROM [dbo].[IntegrationsCatalog] WHERE [id] = @integrationId)
BEGIN
    INSERT INTO [dbo].[IntegrationsCatalog] ([id], [name], [category], [iconUrl], [badge], [isGlobalActive])
    VALUES (
        @integrationId,
        N'Microsoft Teams',
        N'Communication',
        'https://api.iconify.design/logos/microsoft-teams.svg?height=48',
        N'Chat',
        1
    );
END;

-- 2. Give it to every customer that doesn't have it yet
INSERT INTO [dbo].[CustomerIntegration] ([customerId], [integrationId], [isEnabled], [isConfigured])
SELECT c.[id], @integrationId, 1, 0
FROM [dbo].[Customer] c
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[CustomerIntegration] ci
    WHERE ci.[customerId] = c.[id] AND ci.[integrationId] = @integrationId
);

PRINT CONCAT('Customers given ', @integrationId, ': ', @@ROWCOUNT);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
