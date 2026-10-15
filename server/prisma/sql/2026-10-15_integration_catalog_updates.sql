-- Integration catalog updates (run once):
--   1. Add IntegrationsCatalog.isComingSoon
--   2. Add Google Suite (coming soon) and give it to every customer
--   3. Remove Amazon S3, BigQuery, Calendly, Confluence and Algolia (and all their child rows)
--   4. Flag coming-soon apps: SAP S/4HANA, NetSuite, Oracle GSM, Google Suite, Microsoft Teams
--   5. Badges: Standard for Slack, Microsoft Teams, Google Suite; Premium for every other integration
--
-- Before running: deploy the server version that no longer lists the removed apps in DEFAULT_INTEGRATIONS,
-- otherwise new customers fail to be created.
-- Step 1 runs in its own batch (the column must exist before it is used); steps 2-5 run in one transaction,
-- so any error rolls all of them back. Safe to re-run.

SET XACT_ABORT ON;

-- 1. isComingSoon column
IF COL_LENGTH(N'[dbo].[IntegrationsCatalog]', N'isComingSoon') IS NULL
BEGIN
    ALTER TABLE [dbo].[IntegrationsCatalog]
    ADD [isComingSoon] BIT NOT NULL CONSTRAINT [IntegrationsCatalog_isComingSoon_df] DEFAULT 0;
    PRINT 'Added IntegrationsCatalog.isComingSoon';
END;
GO

SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

-- IntegrationSourceInfo is created by 2026-10-15_add_integration_source_info.sql and may not exist yet.
-- Statements that use it go through dynamic SQL so this batch compiles without it.
DECLARE @hasSourceInfo BIT = CASE WHEN OBJECT_ID(N'[dbo].[IntegrationSourceInfo]', N'U') IS NULL THEN 0 ELSE 1 END;

-- 2. Google Suite
DECLARE @googleId VARCHAR(50) = 'google_suite';

IF NOT EXISTS (SELECT 1 FROM [dbo].[IntegrationsCatalog] WHERE [id] = @googleId)
BEGIN
    INSERT INTO [dbo].[IntegrationsCatalog] ([id], [name], [category], [iconUrl], [badge], [isGlobalActive], [isComingSoon])
    VALUES (
        @googleId,
        N'Google Suite',
        N'Productivity',
        'https://api.iconify.design/logos/google-icon.svg?height=48',
        N'Standard',
        1,
        1
    );
    PRINT 'Added catalog row google_suite';
END;

INSERT INTO [dbo].[CustomerIntegration] ([customerId], [integrationId], [isEnabled], [isConfigured])
SELECT c.[id], @googleId, 1, 0
FROM [dbo].[Customer] c
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[CustomerIntegration] ci
    WHERE ci.[customerId] = c.[id] AND ci.[integrationId] = @googleId
);
PRINT CONCAT('Customers given google_suite: ', @@ROWCOUNT);

-- 3. Remove unused integrations (matched by id or name, in case ids differ between environments)
IF OBJECT_ID(N'tempdb..#toRemove') IS NOT NULL DROP TABLE #toRemove;
CREATE TABLE #toRemove ([id] VARCHAR(50) PRIMARY KEY);

INSERT INTO #toRemove ([id])
SELECT [id]
FROM [dbo].[IntegrationsCatalog]
WHERE [id] IN ('amazon-s3', 'bigquery', 'calendly', 'confluence', 'algolia')
   OR LOWER(LTRIM(RTRIM([name]))) IN (N'amazon s3', N'bigquery', N'calendly', N'confluence', N'algolia');

-- List what will be removed
SELECT c.[id], c.[name]
FROM [dbo].[IntegrationsCatalog] c
JOIN #toRemove r ON r.[id] = c.[id];

DELETE t FROM [dbo].[ScheduleCredential] t JOIN #toRemove r ON r.[id] = t.[integrationId];
PRINT CONCAT('ScheduleCredential rows removed: ', @@ROWCOUNT);

DELETE t FROM [dbo].[DataSyncCredential] t JOIN #toRemove r ON r.[id] = t.[integrationId];
PRINT CONCAT('DataSyncCredential rows removed: ', @@ROWCOUNT);

DELETE t FROM [dbo].[ConnectionCredential] t JOIN #toRemove r ON r.[id] = t.[integrationId];
PRINT CONCAT('ConnectionCredential rows removed: ', @@ROWCOUNT);

IF @hasSourceInfo = 1
    EXEC sp_executesql N'
        DELETE t FROM [dbo].[IntegrationSourceInfo] t JOIN #toRemove r ON r.[id] = t.[integrationId];
        PRINT CONCAT(''IntegrationSourceInfo rows removed: '', @@ROWCOUNT);';

DELETE t FROM [dbo].[CustomerIntegration] t JOIN #toRemove r ON r.[id] = t.[integrationId];
PRINT CONCAT('CustomerIntegration rows removed: ', @@ROWCOUNT);

DELETE t FROM [dbo].[IntegrationsCatalog] t JOIN #toRemove r ON r.[id] = t.[id];
PRINT CONCAT('IntegrationsCatalog rows removed: ', @@ROWCOUNT);

DROP TABLE #toRemove;

-- 4. Coming soon
UPDATE [dbo].[IntegrationsCatalog]
SET [isComingSoon] = CASE WHEN [id] IN ('sap_s4hana', 'netsuite', 'oracle_gsm', 'google_suite', 'teams') THEN 1 ELSE 0 END;
PRINT CONCAT('Catalog rows coming-soon flag set: ', @@ROWCOUNT);

-- 5. Standard / Premium badges; per-source badge overrides are cleared so every source shows the tier
UPDATE [dbo].[IntegrationsCatalog]
SET [badge] = CASE
    WHEN [id] IN ('slack_integration', 'teams', 'google_suite') THEN N'Standard'
    ELSE N'Premium'
END;
PRINT CONCAT('Catalog badges updated: ', @@ROWCOUNT);

IF @hasSourceInfo = 1
    EXEC sp_executesql N'
        UPDATE [dbo].[IntegrationSourceInfo] SET [badge] = NULL WHERE [badge] IS NOT NULL;
        PRINT CONCAT(''Source badge overrides cleared: '', @@ROWCOUNT);';

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
