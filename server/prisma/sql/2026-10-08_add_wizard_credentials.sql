BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[DataSyncCredential] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [customerId] UNIQUEIDENTIFIER NOT NULL,
    [integrationId] VARCHAR(50) NOT NULL,
    [configPayload] NVARCHAR(max) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DataSyncCredential_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DataSyncCredential_customerId_integrationId_key] UNIQUE NONCLUSTERED ([customerId],[integrationId])
);

-- CreateTable
CREATE TABLE [dbo].[ScheduleCredential] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [customerId] UNIQUEIDENTIFIER NOT NULL,
    [integrationId] VARCHAR(50) NOT NULL,
    [configPayload] NVARCHAR(max) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ScheduleCredential_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ScheduleCredential_customerId_integrationId_key] UNIQUE NONCLUSTERED ([customerId],[integrationId])
);

-- AddForeignKey
ALTER TABLE [dbo].[DataSyncCredential] ADD CONSTRAINT [DataSyncCredential_customerId_fkey] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customer]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DataSyncCredential] ADD CONSTRAINT [DataSyncCredential_integrationId_fkey] FOREIGN KEY ([integrationId]) REFERENCES [dbo].[IntegrationsCatalog]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ScheduleCredential] ADD CONSTRAINT [ScheduleCredential_customerId_fkey] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customer]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ScheduleCredential] ADD CONSTRAINT [ScheduleCredential_integrationId_fkey] FOREIGN KEY ([integrationId]) REFERENCES [dbo].[IntegrationsCatalog]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

