-- Per-source integration info: the app is opened with ?source=GF (default) or ?source=FLQ
-- and GET /api/integrations returns each integration's info for that source.
-- Null columns fall back to IntegrationsCatalog; isActive = 0 hides the integration for that source.
-- Safe to re-run: skips the table if it exists.

SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'[dbo].[IntegrationSourceInfo]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[IntegrationSourceInfo] (
        [integrationId] VARCHAR(50) NOT NULL,
        [source] VARCHAR(10) NOT NULL,
        [name] NVARCHAR(100),
        [category] NVARCHAR(50),
        [iconUrl] VARCHAR(500),
        [badge] NVARCHAR(50),
        [isActive] BIT NOT NULL CONSTRAINT [IntegrationSourceInfo_isActive_df] DEFAULT 1,
        CONSTRAINT [IntegrationSourceInfo_pkey] PRIMARY KEY CLUSTERED ([integrationId],[source])
    );

    ALTER TABLE [dbo].[IntegrationSourceInfo] ADD CONSTRAINT [IntegrationSourceInfo_integrationId_fkey] FOREIGN KEY ([integrationId]) REFERENCES [dbo].[IntegrationsCatalog]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
END;

-- Example: give Oracle PLM Cloud a different name/icon for FLQ (uncomment and adjust)
-- MERGE [dbo].[IntegrationSourceInfo] AS t
-- USING (SELECT 'oracle' AS integrationId, 'FLQ' AS source) AS s
--     ON t.[integrationId] = s.integrationId AND t.[source] = s.source
-- WHEN MATCHED THEN UPDATE SET [name] = N'Oracle PLM Cloud', [iconUrl] = 'https://api.iconify.design/logos/oracle.svg?height=48'
-- WHEN NOT MATCHED THEN INSERT ([integrationId], [source], [name], [iconUrl])
--     VALUES (s.integrationId, s.source, N'Oracle PLM Cloud', 'https://api.iconify.design/logos/oracle.svg?height=48');

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
