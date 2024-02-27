import { Observable, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { PreloginRequest } from "@bitwarden/common/models/request/prelogin.request";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AuthRequestPushNotification } from "@bitwarden/common/models/response/notification.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KdfType } from "@bitwarden/common/platform/enums";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { MasterKey } from "@bitwarden/common/types/key";

import { AuthRequestServiceAbstraction, LoginStrategyServiceAbstraction } from "../../abstractions";
import { AuthRequestLoginStrategy } from "../../login-strategies/auth-request-login.strategy";
import { PasswordLoginStrategy } from "../../login-strategies/password-login.strategy";
import { SsoLoginStrategy } from "../../login-strategies/sso-login.strategy";
import { UserApiLoginStrategy } from "../../login-strategies/user-api-login.strategy";
import { WebAuthnLoginStrategy } from "../../login-strategies/webauthn-login.strategy";
import {
  UserApiLoginCredentials,
  PasswordLoginCredentials,
  SsoLoginCredentials,
  AuthRequestLoginCredentials,
  WebAuthnLoginCredentials,
} from "../../models";

const sessionTimeoutLength = 2 * 60 * 1000; // 2 minutes

export class LoginStrategyService implements LoginStrategyServiceAbstraction {
  get email(): string {
    if (
      this.logInStrategy instanceof PasswordLoginStrategy ||
      this.logInStrategy instanceof AuthRequestLoginStrategy ||
      this.logInStrategy instanceof SsoLoginStrategy
    ) {
      return this.logInStrategy.email;
    }

    return null;
  }

  get masterPasswordHash(): string {
    return this.logInStrategy instanceof PasswordLoginStrategy
      ? this.logInStrategy.masterPasswordHash
      : null;
  }

  get accessCode(): string {
    return this.logInStrategy instanceof AuthRequestLoginStrategy
      ? this.logInStrategy.accessCode
      : null;
  }

  get authRequestId(): string {
    return this.logInStrategy instanceof AuthRequestLoginStrategy
      ? this.logInStrategy.authRequestId
      : null;
  }

  get ssoEmail2FaSessionToken(): string {
    return this.logInStrategy instanceof SsoLoginStrategy
      ? this.logInStrategy.ssoEmail2FaSessionToken
      : null;
  }

  private logInStrategy:
    | UserApiLoginStrategy
    | PasswordLoginStrategy
    | SsoLoginStrategy
    | AuthRequestLoginStrategy
    | WebAuthnLoginStrategy;
  private sessionTimeout: any;

  private pushNotificationSubject = new Subject<string>();

  constructor(
    protected accountService: AccountService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected cryptoService: CryptoService,
    protected apiService: ApiService,
    protected tokenService: TokenService,
    protected appIdService: AppIdService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected logService: LogService,
    protected keyConnectorService: KeyConnectorService,
    protected environmentService: EnvironmentService,
    protected stateService: StateService,
    protected twoFactorService: TwoFactorService,
    protected i18nService: I18nService,
    protected encryptService: EncryptService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected policyService: PolicyService,
    protected deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    protected authRequestService: AuthRequestServiceAbstraction,
  ) {}

  async logIn(
    credentials:
      | UserApiLoginCredentials
      | PasswordLoginCredentials
      | SsoLoginCredentials
      | AuthRequestLoginCredentials
      | WebAuthnLoginCredentials,
  ): Promise<AuthResult> {
    this.clearState();

    let strategy:
      | UserApiLoginStrategy
      | PasswordLoginStrategy
      | SsoLoginStrategy
      | AuthRequestLoginStrategy
      | WebAuthnLoginStrategy;

    switch (credentials.type) {
      case AuthenticationType.Password:
        strategy = new PasswordLoginStrategy(
          this.accountService,
          this.masterPasswordService,
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.passwordStrengthService,
          this.policyService,
          this,
        );
        break;
      case AuthenticationType.Sso:
        strategy = new SsoLoginStrategy(
          this.accountService,
          this.masterPasswordService,
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.keyConnectorService,
          this.deviceTrustCryptoService,
          this.authRequestService,
          this.i18nService,
        );
        break;
      case AuthenticationType.UserApi:
        strategy = new UserApiLoginStrategy(
          this.accountService,
          this.masterPasswordService,
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.environmentService,
          this.keyConnectorService,
        );
        break;
      case AuthenticationType.AuthRequest:
        strategy = new AuthRequestLoginStrategy(
          this.accountService,
          this.masterPasswordService,
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.deviceTrustCryptoService,
        );
        break;
      case AuthenticationType.WebAuthn:
        strategy = new WebAuthnLoginStrategy(
          this.accountService,
          this.masterPasswordService,
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
        );
        break;
    }

    // Note: Do not set the credentials object directly on the strategy. They are
    // created in the popup and can cause DeadObject references on Firefox.
    const result = await strategy.logIn(credentials as any);

    if (result?.requiresTwoFactor) {
      this.saveState(strategy);
    }

    return result;
  }

  async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string,
  ): Promise<AuthResult> {
    if (this.logInStrategy == null) {
      throw new Error(this.i18nService.t("sessionTimeout"));
    }

    try {
      const result = await this.logInStrategy.logInTwoFactor(twoFactor, captchaResponse);

      // Only clear state if 2FA token has been accepted, otherwise we need to be able to try again
      if (!result.requiresTwoFactor && !result.requiresCaptcha) {
        this.clearState();
      }
      return result;
    } catch (e) {
      // API exceptions are okay, but if there are any unhandled client-side errors then clear state to be safe
      if (!(e instanceof ErrorResponse)) {
        this.clearState();
      }
      throw e;
    }
  }

  authingWithUserApiKey(): boolean {
    return this.logInStrategy instanceof UserApiLoginStrategy;
  }

  authingWithSso(): boolean {
    return this.logInStrategy instanceof SsoLoginStrategy;
  }

  authingWithPassword(): boolean {
    return this.logInStrategy instanceof PasswordLoginStrategy;
  }

  authingWithPasswordless(): boolean {
    return this.logInStrategy instanceof AuthRequestLoginStrategy;
  }

  async makePreloginKey(masterPassword: string, email: string): Promise<MasterKey> {
    email = email.trim().toLowerCase();
    let kdf: KdfType = null;
    let kdfConfig: KdfConfig = null;
    try {
      const preloginResponse = await this.apiService.postPrelogin(new PreloginRequest(email));
      if (preloginResponse != null) {
        kdf = preloginResponse.kdf;
        kdfConfig = new KdfConfig(
          preloginResponse.kdfIterations,
          preloginResponse.kdfMemory,
          preloginResponse.kdfParallelism,
        );
      }
    } catch (e) {
      if (e == null || e.statusCode !== 404) {
        throw e;
      }
    }
    return await this.cryptoService.makeMasterKey(masterPassword, email, kdf, kdfConfig);
  }

  async authResponsePushNotification(notification: AuthRequestPushNotification): Promise<any> {
    this.pushNotificationSubject.next(notification.id);
  }

  getPushNotificationObs$(): Observable<any> {
    return this.pushNotificationSubject.asObservable();
  }

  private saveState(
    strategy:
      | UserApiLoginStrategy
      | PasswordLoginStrategy
      | SsoLoginStrategy
      | AuthRequestLoginStrategy
      | WebAuthnLoginStrategy,
  ) {
    this.logInStrategy = strategy;
    this.startSessionTimeout();
  }

  private clearState() {
    this.logInStrategy = null;
    this.clearSessionTimeout();
  }

  private startSessionTimeout() {
    this.clearSessionTimeout();
    this.sessionTimeout = setTimeout(() => this.clearState(), sessionTimeoutLength);
  }

  private clearSessionTimeout() {
    if (this.sessionTimeout != null) {
      clearTimeout(this.sessionTimeout);
    }
  }
}
