const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');

test.describe('Electron IPC Integration Tests', () => {
  let electronApp;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({ args: ['main.js'] });
  });

  test.afterAll(async () => {
    // Close Electron app
    if (electronApp) await electronApp.close();
  });

  test('should successfully communicate with main process via get-version', async () => {
    const window = await electronApp.firstWindow();
    
    // Execute code inside the Electron renderer to trigger the preload.js bridge
    const version = await window.evaluate(async () => {
      return await window.electronAPI.invoke('get-version');
    });
    
    expect(version).toBeDefined();
    expect(typeof version).toBe('string');
  });
  
  test('should securely proxy api-request through main process', async () => {
    const window = await electronApp.firstWindow();
    
    // Test the API Proxy integration (renderer -> preload -> main -> backend)
    const result = await window.evaluate(async () => {
      return await window.electronAPI.invoke('api-request', { 
        endpoint: '/some-test-endpoint', 
        method: 'GET' 
      });
    });
    
    // The request will be forwarded by main.js. It should return an object with an 'ok' boolean
    // indicating whether the request succeeded or failed (e.g. backend offline or 404).
    expect(result).toBeDefined();
    expect(typeof result.ok).toBe('boolean');
  });
});
