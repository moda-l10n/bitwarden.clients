import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../abstractions/api.service";
import { AppIdService } from "../../abstractions/appId.service";
import { CryptoService } from "../../abstractions/crypto.service";
import { EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { MessagingService } from "../../abstractions/messaging.service";
import { PlatformUtilsService } from "../../abstractions/platformUtils.service";
import { StateService } from "../../abstractions/state.service";
import { Utils } from "../../misc/utils";
import { KeyConnectorService } from "../abstractions/key-connector.service";
import { TokenApiService } from "../abstractions/token-api.service.abstraction";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { UserApiLogInCredentials } from "../models/domain/log-in-credentials";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { UserApiLogInStrategy } from "./user-api-login.strategy";

describe("UserApiLogInStrategy", () => {
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let environmentService: MockProxy<EnvironmentService>;
  let tokenApiService: MockProxy<TokenApiService>;

  let apiLogInStrategy: UserApiLogInStrategy;
  let credentials: UserApiLogInCredentials;

  const deviceId = Utils.newGuid();
  const keyConnectorUrl = "KEY_CONNECTOR_URL";
  const apiClientId = "API_CLIENT_ID";
  const apiClientSecret = "API_CLIENT_SECRET";

  beforeEach(async () => {
    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    keyConnectorService = mock<KeyConnectorService>();
    environmentService = mock<EnvironmentService>();
    tokenApiService = mock<TokenApiService>();

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.getTwoFactorToken.mockResolvedValue(null);
    tokenService.decodeAccessToken.mockResolvedValue({});

    apiLogInStrategy = new UserApiLogInStrategy(
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService,
      environmentService,
      keyConnectorService,
      tokenApiService
    );

    credentials = new UserApiLogInCredentials(apiClientId, apiClientSecret);
  });

  it("sends api key credentials to the server", async () => {
    tokenApiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());
    await apiLogInStrategy.logIn(credentials);

    expect(tokenApiService.postIdentityToken).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: apiClientId,
        clientSecret: apiClientSecret,
        device: expect.objectContaining({
          identifier: deviceId,
        }),
        twoFactor: expect.objectContaining({
          provider: null,
          token: null,
        }),
      })
    );
  });

  it("sets the local environment after a successful login", async () => {
    tokenApiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());

    await apiLogInStrategy.logIn(credentials);

    expect(stateService.setApiKeyClientId).toHaveBeenCalledWith(apiClientId);
    expect(stateService.setApiKeyClientSecret).toHaveBeenCalledWith(apiClientSecret);
    expect(stateService.addAccount).toHaveBeenCalled();
  });

  it("gets and sets the Key Connector key from environmentUrl", async () => {
    const tokenResponse = identityTokenResponseFactory();
    tokenResponse.apiUseKeyConnector = true;

    tokenApiService.postIdentityToken.mockResolvedValue(tokenResponse);
    environmentService.getKeyConnectorUrl.mockReturnValue(keyConnectorUrl);

    await apiLogInStrategy.logIn(credentials);

    expect(keyConnectorService.getAndSetKey).toHaveBeenCalledWith(keyConnectorUrl);
  });
});
