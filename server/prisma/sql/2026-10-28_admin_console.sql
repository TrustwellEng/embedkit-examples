-- Admin console: admin users, audit log, and created/modified stamps on every table.
--
-- Stamps on every table:
--   createdAt / modifiedAt  DATETIME2 NULL  (default SYSUTCDATETIME() for new rows)
--   createdBy / modifiedBy  UNIQUEIDENTIFIER NULL -> AdminUser.id of the admin who made the change
-- NULL "by" = done by the system or a customer (wizard), or old data from before this script.
-- Existing rows keep NULL "at" values (unknown), except:
--   - Customer.createdAt already existed and is kept
--   - *Credential.updatedAt is renamed to modifiedAt so the existing timestamps are kept
--
-- Seeds the first admin: tduong@trustwell.com / Admin123@ (only inserted if the email doesn't exist yet).
-- Safe to re-run: every step checks whether it has already been applied.

SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

/* ------------ AdminUser ------------ */
IF OBJECT_ID(N'[dbo].[AdminUser]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AdminUser] (
        [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [AdminUser_id_df] DEFAULT NEWID(),
        [email] NVARCHAR(256) NOT NULL,
        [passwordHash] NVARCHAR(255) NOT NULL,
        [isActive] BIT NOT NULL CONSTRAINT [AdminUser_isActive_df] DEFAULT 1,
        -- Set for new users and after a reset: the temporary password must be changed at sign-in
        [mustChangePassword] BIT NOT NULL CONSTRAINT [AdminUser_mustChangePassword_df] DEFAULT 1,
        [failedLoginCount] INT NOT NULL CONSTRAINT [AdminUser_failedLoginCount_df] DEFAULT 0,
        [lockoutEnd] DATETIME2 NULL,
        [lastLoginAt] DATETIME2 NULL,
        -- Sessions issued before this time are rejected (password change/reset signs out other sessions)
        [passwordChangedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NULL CONSTRAINT [AdminUser_createdAt_df] DEFAULT SYSUTCDATETIME(),
        [createdBy] UNIQUEIDENTIFIER NULL,
        [modifiedAt] DATETIME2 NULL CONSTRAINT [AdminUser_modifiedAt_df] DEFAULT SYSUTCDATETIME(),
        [modifiedBy] UNIQUEIDENTIFIER NULL,
        CONSTRAINT [AdminUser_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [AdminUser_email_key] UNIQUE NONCLUSTERED ([email])
    );
END;

/* ------------ AdminAuditLog (append-only: rows are never modified, so no modifiedAt/By) ------------ */
IF OBJECT_ID(N'[dbo].[AdminAuditLog]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AdminAuditLog] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        -- login_success, login_failed, logout, user_created, user_updated, password_reset,
        -- token_updated, token_rejected, integration_toggled, catalog_created, catalog_updated, catalog_deleted
        [action] NVARCHAR(50) NOT NULL,
        -- Email at the time of the event (kept even if the user is renamed; also set for unknown emails)
        [email] NVARCHAR(256) NULL,
        [detail] NVARCHAR(500) NULL,
        [ip] NVARCHAR(45) NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [AdminAuditLog_createdAt_df] DEFAULT SYSUTCDATETIME(),
        [createdBy] UNIQUEIDENTIFIER NULL,
        CONSTRAINT [AdminAuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
    );
    CREATE NONCLUSTERED INDEX [AdminAuditLog_createdAt_idx] ON [dbo].[AdminAuditLog] ([createdAt] DESC);
END;

/* ------------ *Credential: updatedAt -> modifiedAt (keeps existing values), now nullable ------------ */
IF COL_LENGTH(N'dbo.ConnectionCredential', N'updatedAt') IS NOT NULL
    EXEC sp_rename N'dbo.ConnectionCredential.updatedAt', N'modifiedAt', N'COLUMN';
IF COL_LENGTH(N'dbo.DataSyncCredential', N'updatedAt') IS NOT NULL
    EXEC sp_rename N'dbo.DataSyncCredential.updatedAt', N'modifiedAt', N'COLUMN';
IF COL_LENGTH(N'dbo.ScheduleCredential', N'updatedAt') IS NOT NULL
    EXEC sp_rename N'dbo.ScheduleCredential.updatedAt', N'modifiedAt', N'COLUMN';

ALTER TABLE [dbo].[ConnectionCredential] ALTER COLUMN [modifiedAt] DATETIME2 NULL;
ALTER TABLE [dbo].[DataSyncCredential] ALTER COLUMN [modifiedAt] DATETIME2 NULL;
ALTER TABLE [dbo].[ScheduleCredential] ALTER COLUMN [modifiedAt] DATETIME2 NULL;

/* ------------ stamp columns on the existing tables ------------
   Added as NULL without WITH VALUES, so existing rows stay NULL and only new rows get the default. */
DECLARE @tables TABLE ([name] SYSNAME);
INSERT INTO @tables VALUES
    (N'Customer'), (N'IntegrationsCatalog'), (N'IntegrationSourceInfo'), (N'CustomerIntegration'),
    (N'ConnectionCredential'), (N'DataSyncCredential'), (N'ScheduleCredential');

DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
DECLARE stamp_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT [name] FROM @tables;
OPEN stamp_cursor;
FETCH NEXT FROM stamp_cursor INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @t, N'createdAt') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE [dbo].' + QUOTENAME(@t) + N' ADD [createdAt] DATETIME2 NULL CONSTRAINT '
                 + QUOTENAME(@t + N'_createdAt_df') + N' DEFAULT SYSUTCDATETIME();';
        EXEC sp_executesql @sql;
    END;
    IF COL_LENGTH(N'dbo.' + @t, N'createdBy') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE [dbo].' + QUOTENAME(@t) + N' ADD [createdBy] UNIQUEIDENTIFIER NULL;';
        EXEC sp_executesql @sql;
    END;
    IF COL_LENGTH(N'dbo.' + @t, N'modifiedAt') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE [dbo].' + QUOTENAME(@t) + N' ADD [modifiedAt] DATETIME2 NULL CONSTRAINT '
                 + QUOTENAME(@t + N'_modifiedAt_df') + N' DEFAULT SYSUTCDATETIME();';
        EXEC sp_executesql @sql;
    END;
    IF COL_LENGTH(N'dbo.' + @t, N'modifiedBy') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE [dbo].' + QUOTENAME(@t) + N' ADD [modifiedBy] UNIQUEIDENTIFIER NULL;';
        EXEC sp_executesql @sql;
    END;
    FETCH NEXT FROM stamp_cursor INTO @t;
END;
CLOSE stamp_cursor;
DEALLOCATE stamp_cursor;

/* ------------ first admin (scrypt hash of the password, same format as src/admin/auth.js) ------------ */
IF NOT EXISTS (SELECT 1 FROM [dbo].[AdminUser] WHERE [email] = N'tduong@trustwell.com')
    INSERT INTO [dbo].[AdminUser] ([email], [passwordHash], [isActive], [mustChangePassword])
    VALUES (
        N'tduong@trustwell.com',
        N'scrypt$32768$8$1$ouMpXFV0Vb9N4I06B9nxfw$mDk9E6K4AyceSWCzm_P2p5qHblbPtiK0kwvAvWvK9pOM5v18s1-q68NqEXlST8OxWD82xTMYs1Ywf7q2eme5RA',
        1,
        0
    );

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
