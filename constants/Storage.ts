export const STORAGE_KEYS = {
    // Wallet related
    MNEMONIC: '@krypkey_mnemonic',
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
    PASSWORD_HASH: 'krypkey_password_hash'
        
  } as const;
  
  export type StorageKey = keyof typeof STORAGE_KEYS;