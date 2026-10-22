import { ApiClient } from './api-client.js';

/** Shared client pointed at the menu API. */
export const api = new ApiClient(
  'https://script.google.com/macros/s/AKfycbxCDiG_frhFkGDYnaY-bB6qelCLwp2sg26cL5EtxrfL2MQ7-iArHPY-S1K74tgmApeC/exec',
);
