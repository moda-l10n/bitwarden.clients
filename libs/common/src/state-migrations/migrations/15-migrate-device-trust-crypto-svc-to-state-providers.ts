import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// Types to represent data as it is stored in JSON
type DeviceKeyJsonType = {
  keyB64: string;
};

type ExpectedAccountType = {
  keys?: {
    deviceKey?: DeviceKeyJsonType;
  };
  settings?: {
    trustDeviceChoiceForDecryption?: boolean;
  };
};

export const DEVICE_KEY: KeyDefinitionLike = {
  key: "deviceKey", // matches KeyDefinition.key in DeviceTrustCryptoService
  stateDefinition: {
    name: "deviceTrust", // matches StateDefinition.name in StateDefinitions
  },
};

export const SHOULD_TRUST_DEVICE: KeyDefinitionLike = {
  key: "deviceKey",
  stateDefinition: {
    name: "deviceTrust",
  },
};

export class DeviceTrustCryptoServiceStateProviderMigrator extends Migrator<14, 15> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      // Migrate deviceKey
      const existingDeviceKey = account?.keys?.deviceKey;

      await helper.setToUser(userId, DEVICE_KEY, existingDeviceKey);

      if (existingDeviceKey != null) {
        delete account.keys.deviceKey;
      }

      // Migrate shouldTrustDevice
      const existingShouldTrustDevice = account?.settings?.trustDeviceChoiceForDecryption;
      await helper.setToUser(userId, SHOULD_TRUST_DEVICE, existingShouldTrustDevice);

      if (existingShouldTrustDevice != null) {
        delete account.settings.trustDeviceChoiceForDecryption;
      }

      // Save the migrated account
      await helper.set(userId, account);
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      // Rollback deviceKey
      const migratedDeviceKey: DeviceKeyJsonType = await helper.getFromUser(userId, DEVICE_KEY);

      if (account?.keys) {
        account.keys.deviceKey = migratedDeviceKey;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, DEVICE_KEY, null);

      // Rollback shouldTrustDevice
      const migratedShouldTrustDevice = await helper.getFromUser<boolean>(
        userId,
        SHOULD_TRUST_DEVICE,
      );

      if (account?.settings) {
        account.settings.trustDeviceChoiceForDecryption = migratedShouldTrustDevice;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, SHOULD_TRUST_DEVICE, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
