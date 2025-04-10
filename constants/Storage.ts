export const STORAGE_KEYS = {
    // Wallet related
    MNEMONIC: '@krypkey_mnemonic',
    PRIVATE_KEY: 'krypkey_private_key',
    SALT: '@krypkey_salt',
    WALLET_CREATED: '@krypkey_wallet_created',
    
    // User preferences
    THEME: '@krypkey_theme',
    LANGUAGE: '@krypkey_language',
    
    // Security settings
    BIOMETRICS_ENABLED: '@krypkey_biometrics_enabled',
    PIN_HASH: '@krypkey_pin_hash',
    
    // Session related
    LAST_ACTIVE: '@krypkey_last_active',
    SESSION_TOKEN: '@krypkey_session_token',

    PASSWORDS: 'krypkey_passwords',
    PASSWORD_HASH: 'krypkey_password_hash',
    USERNAME: '@krypkey_username',
    PASSWORD: '@krypkey_password',
    FINGERPRINT: '@krypkey_flingerprint',
    FACE: '@krypkey_face',
    IRIS: '@krypkey_iris',
    DEVICE_NAME: '@krypkey_device_name',
    AUTH_TOKEN: '@krypkey_auth_token',
    PASSWORDS_UPDATED: '@krypkey_passwords_updated',
    HIDDEN_FEATURE_ENABLED: '@krypkey_hidden_feature_enabled',
    HIDDEN_KEYWORD: '@krypkey_hidden_keyword',
    HIDDEN_PASSWORDS: '@krypkey_hidden_passwords_key',
    DURESS_ENABLED: '@krypkey_duress_enabled',
    DURESS_MODE_ACTIVE: '@krypkey_duress_mode_active',
    AUTOFILL_ENABLED: '@krypkey_autofill_enabled',
  } as const;
  
  export type StorageKey = keyof typeof STORAGE_KEYS;