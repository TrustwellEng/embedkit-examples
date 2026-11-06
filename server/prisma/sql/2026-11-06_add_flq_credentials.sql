-- Food LogiQ (FLQ) sign-in for POST /api/flq/code.
--
-- A customer is either Genesis or FLQ; the other product's columns are NULL:
--   Genesis: genesisId + genesisAuthToken                     (POST /api/code)
--   FLQ:     flqCustomerId + flqUsername + flqPasswordHash    (POST /api/flq/code)
--
-- Changes to Customer:
--   genesisId, genesisAuthToken  -> NULL allowed (were NOT NULL)
--   flqCustomerId    VARCHAR(100)  NULL  FLQ's cust_id (header x-customer-id)
--   flqUsername      NVARCHAR(256) NULL  header x-username
--   flqPasswordHash  NVARCHAR(255) NULL  scrypt hash, same format as AdminUser.passwordHash (src/admin/auth.js)
--   genesisId / flqCustomerId unique when set (filtered indexes: a plain UNIQUE allows only one NULL)
--   CHECK: exactly one of genesisId / flqCustomerId is set
--
-- Existing rows are all Genesis customers and are unchanged.
-- FLQ customers are created on their first POST /api/flq/code, once the FoodLogiQ auth API accepts the credentials
-- (like Genesis customers). The example at the bottom is only needed to pre-create one by hand.
-- Run BEFORE deploying the server that uses these columns. Safe to re-run: every step checks whether it has already been applied.

SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

/* ------------ FLQ columns ------------ */
IF COL_LENGTH(N'dbo.Customer', N'flqCustomerId') IS NULL
    ALTER TABLE [dbo].[Customer] ADD [flqCustomerId] VARCHAR(100) NULL;

IF COL_LENGTH(N'dbo.Customer', N'flqUsername') IS NULL
    ALTER TABLE [dbo].[Customer] ADD [flqUsername] NVARCHAR(256) NULL;

IF COL_LENGTH(N'dbo.Customer', N'flqPasswordHash') IS NULL
    ALTER TABLE [dbo].[Customer] ADD [flqPasswordHash] NVARCHAR(255) NULL;

/* ------------ genesisId: unfiltered UNIQUE -> filtered unique index ------------ */
-- The column can't be altered while an index uses it, so drop the old unique index/constraint first
DECLARE @name SYSNAME, @isConstraint BIT, @sql NVARCHAR(MAX);
SELECT TOP 1 @name = i.name, @isConstraint = i.is_unique_constraint
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'dbo.Customer') AND c.name = N'genesisId' AND i.is_unique = 1 AND i.has_filter = 0;

IF @name IS NOT NULL
BEGIN
    SET @sql = CASE WHEN @isConstraint = 1
        THEN N'ALTER TABLE [dbo].[Customer] DROP CONSTRAINT ' + QUOTENAME(@name) + N';'
        ELSE N'DROP INDEX ' + QUOTENAME(@name) + N' ON [dbo].[Customer];' END;
    EXEC sp_executesql @sql;
END;

ALTER TABLE [dbo].[Customer] ALTER COLUMN [genesisId] VARCHAR(100) NULL;
ALTER TABLE [dbo].[Customer] ALTER COLUMN [genesisAuthToken] VARCHAR(255) NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
GO

-- Separate batch so the new columns are visible
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Customer_genesisId_key' AND object_id = OBJECT_ID(N'dbo.Customer'))
    CREATE UNIQUE INDEX [Customer_genesisId_key] ON [dbo].[Customer] ([genesisId]) WHERE [genesisId] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Customer_flqCustomerId_key' AND object_id = OBJECT_ID(N'dbo.Customer'))
    CREATE UNIQUE INDEX [Customer_flqCustomerId_key] ON [dbo].[Customer] ([flqCustomerId]) WHERE [flqCustomerId] IS NOT NULL;

IF OBJECT_ID(N'dbo.Customer_product_ck', N'C') IS NULL
    ALTER TABLE [dbo].[Customer] ADD CONSTRAINT [Customer_product_ck] CHECK (
        ([genesisId] IS NOT NULL AND [flqCustomerId] IS NULL) OR ([genesisId] IS NULL AND [flqCustomerId] IS NOT NULL)
    );
GO

/* ------------ pre-create an FLQ customer by hand (optional; example: uncomment and adjust) ------------ */
-- Hash the password first (prompts for it, so it stays out of shell history):
--   cd server && npm run hash-password
--
-- New FLQ customer (genesisId / genesisAuthToken stay NULL):
-- INSERT INTO [dbo].[Customer] ([id], [customerName], [flqCustomerId], [flqUsername], [flqPasswordHash])
-- VALUES (NEWID(), N'Acme Foods', '12345', N'acme-integration', N'scrypt$32768$8$1$...');  -- hash = output of npm run hash-password
-- (integrations are added on its first POST /api/flq/code)
--
-- Change the password later:
-- UPDATE [dbo].[Customer] SET [flqPasswordHash] = N'scrypt$...', [modifiedAt] = SYSUTCDATETIME() WHERE [flqCustomerId] = '12345';
