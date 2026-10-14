-- 1. Rename 'oracle' from "Oracle Database" to "Oracle PLM Cloud" and update its app icon.
-- 2. Add Oracle GSM to the integrations catalog and give it to every customer.
--    Same behavior as POST /api/admin/catalog: one CustomerIntegration row per customer
--    (isEnabled = 1, isConfigured = 0). The UI shows it as "Coming soon".
-- Safe to re-run: the rename/icon update is idempotent, the catalog row is skipped if it exists,
-- and customers that already have Oracle GSM are skipped.

SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

DECLARE @oracleIconUrl VARCHAR(500) = 'https://api.iconify.design/logos/oracle.svg?height=48';
DECLARE @plmId VARCHAR(50) = 'oracle';
DECLARE @gsmId VARCHAR(50) = 'oracle_gsm';

-- 1. Oracle PLM Cloud name + icon
UPDATE [dbo].[IntegrationsCatalog]
SET [name] = N'Oracle PLM Cloud', [iconUrl] = @oracleIconUrl
WHERE [id] = @plmId;

PRINT CONCAT('Catalog rows updated for ', @plmId, ': ', @@ROWCOUNT);

-- 2a. Oracle GSM catalog row
IF NOT EXISTS (SELECT 1 FROM [dbo].[IntegrationsCatalog] WHERE [id] = @gsmId)
BEGIN
    INSERT INTO [dbo].[IntegrationsCatalog] ([id], [name], [category], [iconUrl], [badge], [isGlobalActive])
    VALUES (
        @gsmId,
        N'Oracle GSM',
        N'Supply Chain',
        @oracleIconUrl,
        N'Supplier',
        1
    );
END;

-- 2b. Give it to every customer that doesn't have it yet
INSERT INTO [dbo].[CustomerIntegration] ([customerId], [integrationId], [isEnabled], [isConfigured])
SELECT c.[id], @gsmId, 1, 0
FROM [dbo].[Customer] c
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[CustomerIntegration] ci
    WHERE ci.[customerId] = c.[id] AND ci.[integrationId] = @gsmId
);

PRINT CONCAT('Customers given ', @gsmId, ': ', @@ROWCOUNT);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
